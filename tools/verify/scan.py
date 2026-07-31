"""Banned-pattern scan (spec 7.4) and structural-separation scan (spec 7.3).

SCOPE RULE (plan decision D2). The scan root is the whole of `tools/verify/`,
recursively, with NO directory excluded -- excluding the fixture tree wholesale
would be the always-green failure 7.4 exists to prevent.

`.py` files get the AST detectors plus the lexical ones; every other file gets
the lexical ones. Lexical *tokens* live in data
(`selfcheck/fixtures/patterns.json`) rather than in this module's source, so the
scanner is not itself a violation of the vocabulary it enforces -- and the scan
asserts each token occurs in that file exactly once, so the data file cannot
become a hiding place.

Exemption is per *line*, via a marker::

    # BANNED-FIXTURE: <pattern-id> src=<root>/<path>:<line> | none:<reason>

guarded by invariants that can each fail:

  stray-marker       a marker outside selfcheck/fixtures/
  unknown-pattern    a marker naming a pattern id that does not exist
  stale-fixture      a marked line the named detector does NOT flag
  pattern-uncovered  a pattern with zero marked-and-detected fixture lines
  bad-provenance     src=<root>/<path>:<line> whose text is not contained in the
                     fixture line (i.e. the fixture is not the quoted original)
  token-vocabulary   a lexical token appearing more than once in patterns.json
  sleep-sites/-home  more than one blocking-wait call site, or one not at
                     cdp.py::_poll_interval
  caller-tree-import a shipped module importing selfcheck/ or examples/
  dynamic-import     a shipped module importing at run time, which the static
                     import walk cannot see

SCOPE OF THE CLAIM. Every detector here is a RATCHET, not a sound gate: it
catches the ordinary spelling a cooperating author would write, and a determined
bypass defeats it. The specific gaps are named in tools/verify/README.md; do not
describe this scan as proving the absence of a pattern.
"""
from __future__ import annotations

import ast
import json
import os
import re
from dataclasses import dataclass
from typing import Iterable, Optional

FIXTURE_DIR = "selfcheck/fixtures"
PATTERNS_JSON = FIXTURE_DIR + "/patterns.json"
MARKER_RE = re.compile(r"#\s*BANNED-FIXTURE:\s*([a-z0-9\-]+)\s+src=(\S+)")

SLEEP_HOME = ("cdp.py", "_poll_interval")
AST_PATTERNS = ("copy-tree", "sleep", "evaluate-sentinel", "grid-fallback")


@dataclass(frozen=True)
class Hit:
    pattern: str
    path: str
    lineno: int
    evidence: str


@dataclass(frozen=True)
class Marker:
    pattern: str
    src: str
    path: str
    lineno: int
    text: str


@dataclass
class ScanObservation:
    hits: list
    markers: list
    problems: list
    files_scanned: int
    patterns_covered: dict
    unsourced_fixtures: list
    unverified_provenance: list


# --------------------------------------------------------------------------
# AST detectors
# --------------------------------------------------------------------------
def _calls(tree: ast.AST) -> Iterable[ast.Call]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            yield node


def _dotted(node: ast.AST) -> str:
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
    return ".".join(reversed(parts))


def detect_copy_tree(path: str, src: str, tree: ast.AST) -> list:
    """AST: a subprocess.* call whose argument list contains the recursive-copy
    shell utility followed by -r/-R/-a, plus shutil.copytree by name.
    A literal substring grep finds 0 of the 5 salvage instances (all list-form)."""
    out = []
    for call in _calls(tree):
        name = _dotted(call.func)
        if name.endswith("copytree"):
            out.append(Hit("copy-tree", path, call.lineno, "shutil.copytree"))
            continue
        if not name.startswith("subprocess."):
            continue
        for arg in list(call.args) + [kw.value for kw in call.keywords]:
            if not isinstance(arg, (ast.List, ast.Tuple)):
                continue
            items = [e.value for e in arg.elts
                     if isinstance(e, ast.Constant) and isinstance(e.value, str)]
            for i, it in enumerate(items[:-1]):
                if it == "cp" and items[i + 1] in ("-r", "-R", "-a"):
                    out.append(Hit("copy-tree", path, call.lineno,
                                   "%s([... 'cp', '%s' ...])" % (name, items[i + 1])))
    return out


def _enclosing(tree: ast.AST) -> dict:
    """lineno -> nearest enclosing FunctionDef name."""
    owner: dict = {}
    for fn in ast.walk(tree):
        if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for node in ast.walk(fn):
                ln = getattr(node, "lineno", None)
                if ln is not None and ln not in owner:
                    owner[ln] = fn.name
    return owner


def sleep_names(tree: ast.AST) -> tuple:
    """Resolve import aliases to the names a blocking wait can hide behind.

    Matching the literal dotted names `time.sleep`/`sleep` was defeated by
    `import time as _clock; _clock.sleep(1.0)` (measured: 0 hits, suite green).
    Renaming the MODULE is cheaper than renaming a helper and just as invisible.
    """
    mods, funcs = {"time"}, {"sleep"}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                if a.name in ("time", "asyncio"):
                    mods.add(a.asname or a.name)
        elif isinstance(node, ast.ImportFrom) and node.module in ("time", "asyncio"):
            for a in node.names:
                if a.name == "sleep":
                    funcs.add(a.asname or a.name)
    return mods, funcs


def detect_sleep(path: str, src: str, tree: ast.AST) -> list:
    out = []
    owner = _enclosing(tree)
    mods, funcs = sleep_names(tree)
    for call in _calls(tree):
        name = _dotted(call.func)
        head, _, tail = name.rpartition(".")
        if (tail == "sleep" and (head in mods or not head)) or name in funcs:
            out.append(Hit("sleep", path, call.lineno,
                           "in %s" % owner.get(call.lineno, "<module>")))
    return out


def poll_call_sites(root: str) -> list:
    """Every call to the one permitted blocking-wait helper, with its enclosing
    function. Calling the helper in a loop is a fixed sleep with extra steps, so
    the CALLERS are constrained too, not just the definition."""
    sites = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d != "__pycache__"]
        for fn in sorted(filenames):
            if not fn.endswith(".py"):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            if _is_fixture(rel):
                continue
            try:
                tree = ast.parse(open(full, encoding="utf-8").read(), filename=full)
            except SyntaxError:
                continue
            owner = _enclosing(tree)
            for call in _calls(tree):
                if _dotted(call.func) == SLEEP_HOME[1]:
                    sites.append((rel, call.lineno, owner.get(call.lineno, "<module>")))
    return sites


def detect_evaluate_sentinel(path: str, src: str, tree: ast.AST) -> list:
    """AST: a `return` of a dict literal from any function whose name starts
    with `evaluate` -- the truthy error-sentinel shape of spec 4.1 #3."""
    out = []
    for fn in ast.walk(tree):
        if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if not fn.name.startswith("evaluate"):
            continue
        for node in ast.walk(fn):
            if isinstance(node, ast.Return) and isinstance(node.value, ast.Dict):
                out.append(Hit("evaluate-sentinel", path, node.lineno,
                               "%s returns a dict literal" % fn.name))
    return out


_JS_FALLBACK_RE = re.compile(r"\|\|\s*\d+")
_JS_GRIDPROP_RE = re.compile(r"\.\s*(cols|rows|width|height)\b")


def detect_grid_fallback(path: str, src: str, tree: ast.AST) -> list:
    """AST locates embedded-JS string constants; inside one, a `|| <int>` whose
    preceding 60 characters mention .cols/.rows/.width/.height is a hit.

    The originally specified rule -- 'BoolOp(or) whose LEFT operand is an
    attribute named cols/rows/width/height' -- misses the second of the two
    salvage forms, where the left operand is a parenthesised expression."""
    out = []
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Constant) and isinstance(node.value, str)):
            continue
        text = node.value
        for m in _JS_FALLBACK_RE.finditer(text):
            if _JS_GRIDPROP_RE.search(text[max(0, m.start() - 60):m.start()]):
                out.append(Hit("grid-fallback", path, node.lineno,
                               text[max(0, m.start() - 30):m.end()].strip()))
                break
    return out


AST_DETECTORS = {
    "copy-tree": detect_copy_tree,
    "sleep": detect_sleep,
    "evaluate-sentinel": detect_evaluate_sentinel,
    "grid-fallback": detect_grid_fallback,
}


# --------------------------------------------------------------------------
# lexical detectors, driven by data
# --------------------------------------------------------------------------
def load_patterns(root: str) -> dict:
    with open(os.path.join(root, PATTERNS_JSON), encoding="utf-8") as fh:
        return json.load(fh)["lexical"]


def detect_lexical(path: str, src: str, lex: dict, in_ast: Optional[ast.AST]) -> list:
    """Token substring over raw lines, plus -- for .py files -- the same token
    inside any string constant, since it can appear in either form."""
    out = []
    lines = src.splitlines()
    for pid, spec in lex.items():
        tok = spec["token"]
        seen = set()
        for i, line in enumerate(lines, 1):
            if tok in line:
                out.append(Hit(pid, path, i, line.strip()[:90]))
                seen.add(i)
        if in_ast is not None:
            for node in ast.walk(in_ast):
                if isinstance(node, ast.Constant) and isinstance(node.value, str) \
                        and tok in node.value and node.lineno not in seen:
                    out.append(Hit(pid, path, node.lineno, node.value[:90]))
    return out


# --------------------------------------------------------------------------
# scan
# --------------------------------------------------------------------------
def _is_fixture(rel: str) -> bool:
    return rel.replace(os.sep, "/").startswith(FIXTURE_DIR + "/")


def scan(root: str, provenance_roots: Optional[dict] = None) -> ScanObservation:
    lex = load_patterns(root)
    all_patterns = list(AST_DETECTORS) + list(lex)
    hits: list = []
    markers: list = []
    problems: list = []
    files = 0
    sources: dict = {}

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d != "__pycache__"]
        for fn in sorted(filenames):
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            try:
                src = open(full, encoding="utf-8").read()
            except (UnicodeDecodeError, OSError):
                continue
            files += 1
            sources[rel] = src
            tree = None
            if fn.endswith(".py"):
                try:
                    tree = ast.parse(src, filename=full)
                except SyntaxError as exc:
                    problems.append("unparseable: %s: %s" % (rel, exc))
                    continue
                for det in AST_DETECTORS.values():
                    hits.extend(det(rel, src, tree))
            hits.extend(detect_lexical(rel, src, lex, tree))
            for i, line in enumerate(src.splitlines(), 1):
                m = MARKER_RE.search(line)
                if m:
                    markers.append(Marker(m.group(1), m.group(2), rel, i, line.strip()))

    # the vocabulary file must define each token exactly once
    vocab = sources.get(PATTERNS_JSON, "")
    for pid, spec in lex.items():
        n = vocab.count(spec["token"])
        if n != 1:
            problems.append("token-vocabulary: %r occurs %d times in %s (expected 1)"
                            % (pid, n, PATTERNS_JSON))
    # ...and its own definition lines are the one exemption it gets
    hits = [h for h in hits if not (h.path == PATTERNS_JSON and h.pattern in lex)]

    exempt: set = set()
    unsourced: list = []
    unverified: list = []
    for mk in markers:
        if not _is_fixture(mk.path):
            problems.append("stray-marker: %s:%d declares BANNED-FIXTURE outside %s/"
                            % (mk.path, mk.lineno, FIXTURE_DIR))
            continue
        if mk.pattern not in all_patterns:
            problems.append("unknown-pattern: %s:%d names %r"
                            % (mk.path, mk.lineno, mk.pattern))
            continue
        if not any(h.pattern == mk.pattern and h.path == mk.path and h.lineno == mk.lineno
                   for h in hits):
            problems.append(
                "stale-fixture: %s:%d claims %r but the detector does not flag that line"
                % (mk.path, mk.lineno, mk.pattern))
            continue
        exempt.add((mk.pattern, mk.path, mk.lineno))
        if mk.src.startswith("none:"):
            if len(mk.src) < len("none:") + 10:
                problems.append("bad-provenance: %s:%d unsourced fixture needs a reason"
                                % (mk.path, mk.lineno))
            unsourced.append("%s:%d %s" % (mk.path, mk.lineno, mk.pattern))
        else:
            probs, ok = _provenance(mk, provenance_roots or {})
            problems.extend(probs)
            if not ok:
                unverified.append("%s:%d %s" % (mk.path, mk.lineno, mk.pattern))

    covered = {}
    for pid in all_patterns:
        covered[pid] = sum(1 for (p, _f, _l) in exempt if p == pid)
        if covered[pid] == 0:
            problems.append("pattern-uncovered: %r has no marked-and-detected fixture "
                            "line -- the detector is untested" % pid)

    problems.extend(_sleep_rule(hits, exempt))
    problems.extend(poll_caller_problems(root))
    problems.extend(caller_tree_import_problems(root))
    live = [h for h in hits
            if (h.pattern, h.path, h.lineno) not in exempt
            and not (h.pattern == "sleep" and os.path.basename(h.path) == SLEEP_HOME[0])]
    return ScanObservation(live, markers, problems, files, covered, unsourced, unverified)


def _sleep_rule(hits: list, exempt: set) -> list:
    sites = [h for h in hits if h.pattern == "sleep"
             and (h.pattern, h.path, h.lineno) not in exempt]
    if len(sites) != 1:
        return ["sleep-sites: expected exactly 1 non-fixture blocking-wait call site, "
                "found %d (%s)" % (len(sites),
                                   ", ".join("%s:%d" % (s.path, s.lineno) for s in sites))]
    site = sites[0]
    if os.path.basename(site.path) != SLEEP_HOME[0]:
        return ["sleep-home: the single blocking-wait is in %s, expected %s"
                % (site.path, SLEEP_HOME[0])]
    if site.evidence != "in %s" % SLEEP_HOME[1]:
        return ["sleep-home: the single blocking-wait is at %s:%d %s, expected "
                "function %s -- renaming the helper must not launder it"
                % (site.path, site.lineno, site.evidence, SLEEP_HOME[1])]
    return []


# Only these functions may call the blocking-wait helper, and only once each.
POLL_CALLERS = ("wait_for", "launch")


# Names that perform an import at run time. `ast.Import`/`ast.ImportFrom` do not
# see any of them, so a walk restricted to those two nodes leaves the fixture
# tree wide open. Measured against that walk: a marked helper under
# `selfcheck/fixtures/` reached by `importlib.import_module(...)` from `boot()`
# slept a real 1.00 s while the scan reported clean AND the laundered line raised
# reported coverage 1 -> 2.
#
# Matched on the TERMINAL attribute name, so `import importlib as il;
# il.import_module(...)` is caught as well as the dotted spelling.
DYNAMIC_IMPORT_CALLS = ("import_module", "__import__", "spec_from_file_location",
                        "module_from_spec", "exec_module", "load_module",
                        "run_module", "run_path")
CALLER_TREE_TOKENS = ("fixtures", "selfcheck", "examples")


def _terminal_name(func: ast.AST) -> str:
    if isinstance(func, ast.Attribute):
        return func.attr
    if isinstance(func, ast.Name):
        return func.id
    return ""


def caller_tree_import_problems(root: str) -> list:
    """The caller-side subtrees are where deliberate violations and hand-written
    assertions live, so no shipped module may import from them -- statically or
    dynamically.

    Without this, per-line exemption IS directory-wide exemption: a helper in
    `selfcheck/fixtures/util.py` carrying a BANNED-FIXTURE marker, imported and
    called from `game.boot()`, sleeps a real 1.0 s while the scan reports
    `hits=[] problems=[]` and the laundered line *increases* reported coverage.
    Measured. Every one of the other invariants is satisfied by that shape.

    It is also what closes the `CALLER_SUBTREES` exclusion in the 7.3 exports
    rule: code that cannot be imported from the shipped API cannot launder a
    verdict into it.
    """
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d != "__pycache__"]
        for fn in sorted(filenames):
            if not fn.endswith(".py"):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            if rel.startswith("selfcheck/"):
                continue                      # selfcheck may use its own fixtures
            try:
                tree = ast.parse(open(full, encoding="utf-8").read(), filename=full)
            except SyntaxError:
                continue
            for node in ast.walk(tree):
                mod = ""
                if isinstance(node, ast.ImportFrom):
                    mod = ("." * (node.level or 0)) + (node.module or "")
                elif isinstance(node, ast.Import):
                    mod = ",".join(a.name for a in node.names)
                elif isinstance(node, ast.Call) and \
                        _terminal_name(node.func) in DYNAMIC_IMPORT_CALLS:
                    lits = [a.value for a in node.args
                            if isinstance(a, ast.Constant) and isinstance(a.value, str)]
                    named = [t for t in CALLER_TREE_TOKENS
                             if any(t in s for s in lits)]
                    if named:
                        mod = ",".join(lits)
                    else:
                        # A non-literal argument cannot be shown NOT to name the
                        # caller-side tree, and no shipped module has any reason
                        # to import dynamically, so the call itself is the defect.
                        out.append(
                            "dynamic-import: %s:%d calls %s(...) -- a run-time "
                            "import is invisible to the static import walk, so it "
                            "is banned outside selfcheck/ regardless of argument"
                            % (rel, node.lineno, _terminal_name(node.func)))
                        continue
                if any(t in mod for t in CALLER_TREE_TOKENS):
                    out.append("caller-tree-import: %s:%d imports %r -- a shipped "
                               "module must not reach into %s, which is where "
                               "deliberate violations and hand-written assertions "
                               "live" % (rel, node.lineno, mod,
                                         list(CALLER_SUBTREES)))
    return out


def poll_caller_problems(root: str) -> list:
    sites = poll_call_sites(root)
    bad = [s for s in sites if s[2] not in POLL_CALLERS]
    out = []
    if bad:
        out.append("poll-callers: %s() may only be called from %s; found %s"
                   % (SLEEP_HOME[1], list(POLL_CALLERS),
                      ["%s:%d in %s" % b for b in bad]))
    if len(sites) != len(POLL_CALLERS):
        out.append("poll-callers: expected exactly %d call sites of %s(), found %d (%s)"
                   % (len(POLL_CALLERS), SLEEP_HOME[1], len(sites),
                      ["%s:%d in %s" % s for s in sites]))
    return out


def _provenance(mk: Marker, roots: dict):
    """Cross-check a fixture against the source it claims to quote.

    Returns (problems, verified). Two deliberate weakenings, both forced by
    executed failures:

    * A root that was not supplied is SKIPPED, not failed. Binding the committed
      gate to an ephemeral artifacts directory made the suite unrunnable anywhere
      else -- and an unrunnable self-check is worth less than a stated gap.
      run.py prints the unverified count.
    * The cited line number is a HINT; the check searches the file for the text.
      Requiring an exact line number made an unrelated insertion above line 55 of
      serve.py turn this gate red, which is the live-source coupling 7.2 forbids.
    """
    ref, _, lno = mk.src.rpartition(":")
    tag, _, rel = ref.partition("/")
    if not tag or not lno.isdigit():
        return (["bad-provenance: %s:%d malformed src=%r" % (mk.path, mk.lineno, mk.src)],
                False)
    if tag not in roots:
        return ([], False)                      # root not supplied -> unverified
    full = os.path.join(roots[tag], rel)
    if not os.path.exists(full):
        return (["bad-provenance: %s:%d cites missing file %s (root %s=%s)"
                 % (mk.path, mk.lineno, ref, tag, roots[tag])], False)
    lines = open(full, encoding="utf-8", errors="replace").read().splitlines()
    n = int(lno)
    cited = lines[n - 1].strip() if 1 <= n <= len(lines) else None
    if cited and cited in mk.text:
        return ([], True)
    # line drifted: accept any line of the file whose text the fixture contains
    for i, ln in enumerate(lines, 1):
        t = ln.strip()
        if t and t in mk.text and len(t) > 20:
            return (["provenance-drift: %s:%d cites %s:%d but the text is now at line %d"
                     % (mk.path, mk.lineno, ref, n, i)], True)
    return (["bad-provenance: %s:%d does not quote anything in %s\n"
             "      fixture: %s" % (mk.path, mk.lineno, ref, mk.text[:110])], False)


# --------------------------------------------------------------------------
# 7.3 structural separation
# --------------------------------------------------------------------------
NAME_RE = re.compile(r"^(assert|verify|expect|should|is|has|can|did|was)_")
# Segment match, not endswith: `build_matches_worktree` carries the verdict word
# in the MIDDLE, and endswith() let it through (measured).
BAD_WORDS = ("ok", "passes", "advanced", "valid", "reproducible", "matches",
             "reproduces", "works", "correct", "succeeds")
BAD_WORD_RE = re.compile(r"(?:^|_)(%s)(?:_|$)" % "|".join(BAD_WORDS))

# 7.3 applies to every SHIPPED module of the package, so the module set is
# DISCOVERED by walking the tree -- never enumerated.
#
# It used to be the tuple ("cdp.py", "game.py", "static.py", "scan.py"), and a
# hardcoded list silently un-scans the next module anyone adds, which is the
# single most likely future edit. Measured against that tuple: a
# `verify_sim_advanced_ok(sess) -> bool` appended to the shipped `errors.py`, and
# a whole new `oracle.py`, both left the suite at rc=0 with 0 failures --
# `errors.py` was already an unscanned shipped module.
#
# Two subtrees are excluded because they are CALLER-side code whose job is to
# write assertions (the 7.1 spotchecks/negative controls, and the criterion-3
# example caller); applying "no verdict-shaped name" to them would ban the
# assertions the design requires callers to write. The exclusion is not a hole:
# `caller_tree_import_problems()` separately forbids any shipped module from
# importing either subtree -- statically OR dynamically -- so nothing excluded
# here is reachable from the API this rule protects.
CALLER_SUBTREES = ("selfcheck/", "examples/")


def public_modules(root: str) -> list:
    """Every shipped `.py` module under `root`, discovered rather than listed."""
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d != "__pycache__"]
        for fn in sorted(filenames):
            if not fn.endswith(".py"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, fn), root).replace(os.sep, "/")
            if rel.startswith(CALLER_SUBTREES):
                continue
            out.append(rel)
    return sorted(out)


def name_problem(name: str) -> str:
    if NAME_RE.match(name):
        return "verdict-shaped prefix"
    m = BAD_WORD_RE.search(name)
    return "verdict word %r" % m.group(1) if m else ""


@dataclass
class ExportsObservation:
    problems: list
    functions_checked: int
    names_checked: list
    modules_scanned: list


def _public_defs(tree: ast.AST, module: str) -> list:
    """Module-level functions AND methods of public classes.

    Restricting this to `tree.body` left every method of Session/Browser
    unchecked -- so `Session.sim_advanced() -> bool`, the exact shape 7.3 rule 2
    names, passed (measured)."""
    out = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if not node.name.startswith("_"):
                out.append(("%s.%s" % (module, node.name), node))
        elif isinstance(node, ast.ClassDef) and not node.name.startswith("_"):
            for sub in node.body:
                if isinstance(sub, (ast.FunctionDef, ast.AsyncFunctionDef)) \
                        and not sub.name.startswith("_"):
                    out.append(("%s.%s.%s" % (module, node.name, sub.name), sub))
    return out


def _bool_aliases(tree: ast.AST) -> set:
    """Module-level names that ARE bool. `Verdict = bool` then
    `def scene_ready(self) -> Verdict` defeated a literal `id == "bool"` test
    (measured: suite green with a shared boolean oracle exported)."""
    aliases = {"bool"}
    changed = True
    while changed:
        changed = False
        for node in tree.body:
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Name) \
                    and node.value.id in aliases:
                for t in node.targets:
                    if isinstance(t, ast.Name) and t.id not in aliases:
                        aliases.add(t.id)
                        changed = True
            elif isinstance(node, ast.AnnAssign) and isinstance(node.value, ast.Name) \
                    and node.value.id in aliases and isinstance(node.target, ast.Name):
                if node.target.id not in aliases:
                    aliases.add(node.target.id)
                    changed = True
    return aliases


def exports_scan(root: str) -> ExportsObservation:
    problems: list = []
    names: list = []
    modules = public_modules(root)
    if not modules:
        problems.append(
            "module-discovery: no shipped module discovered under %r -- an empty "
            "module set makes this scan vacuously clean, which is the failure 7.3 "
            "exists to prevent" % root)
    for fn in modules:
        full = os.path.join(root, fn)
        tree = ast.parse(open(full, encoding="utf-8").read(), filename=full)
        bools = _bool_aliases(tree)
        for qual, node in _public_defs(tree, fn):
            names.append(qual)
            why = name_problem(node.name)
            if why:
                problems.append("name-rule: %s encodes a verdict (%s)" % (qual, why))
            ann = node.returns
            if ann is None:
                problems.append("return-rule: %s has no return annotation" % qual)
            elif isinstance(ann, ast.Name) and ann.id in bools:
                problems.append("return-rule: %s returns a bare bool%s" %
                                (qual, "" if ann.id == "bool"
                                 else " (via the alias %r)" % ann.id))
    return ExportsObservation(problems, len(names), names, modules)


def runtime_return_problems(pairs: Iterable) -> list:
    """Rule 2, dynamic arm: reject an *observed* bare-bool return from a public
    entry point. Booleans are legal only as fields of an observation record."""
    return ["return-rule(runtime): %s returned a bare bool" % name
            for name, value in pairs if isinstance(value, bool)]
