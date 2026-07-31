#!/usr/bin/env python3
"""Self-verification suite for tools/verify (spec 7.5 / 8).

Exits NON-ZERO on any failure -- explicitly unlike run_integration_tests.py,
which sets success solely from a substring of its own report.

Prints the number of checks run, how many were negative controls, and a
per-item coverage map over the 20 numbered components (A.1-A.7, B.1-B.8,
C.1-C.5). A run reporting zero negative controls is a FAILED run, and so is a
run in which any numbered item lacks a spotcheck or a negative control.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
VERIFY = os.path.dirname(HERE)
REPO_ROOT = os.path.dirname(os.path.dirname(VERIFY))
sys.path.insert(0, REPO_ROOT)

# Byte-code caches are writes too. Importing the package creates untracked
# tools/**/__pycache__/ directories, which is why criterion 7's literal wording
# ("git status --porcelain is empty") was never satisfiable once tools/verify is
# tracked -- measured: `?? tools/__pycache__/`, `?? tools/verify/__pycache__/`
# after a bare import. Suppressed here, and inherited by every subprocess,
# rather than excluded from the delta: an exclusion would be a hole in the one
# check that catches stray writes.
sys.dont_write_bytecode = True
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"


def git_dirty(root: str) -> set:
    p = subprocess.run(["git", "status", "--porcelain"], cwd=root,
                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    if p.returncode != 0:
        return set()
    return {ln[3:] for ln in p.stdout.splitlines() if ln.strip()}


# Criterion 7 must cover IMPORT time as well as run time. Sampled inside main()
# -- i.e. after `from tools.verify import ...` -- the baseline absorbed every
# import-time write: a module-scope write to README.md in static.py left 8.7
# green and the suite at rc=0 while `git status` showed ` M README.md`
# (measured). So the baseline is taken here and 8.7 evaluates this arm too.
DIRTY_BEFORE_IMPORT = git_dirty(REPO_ROOT)   # <- BEFORE the package import, on purpose

from tools.verify import cdp, game, scan, static                      # noqa: E402
from tools.verify.errors import (BootError, GeometryError,            # noqa: E402
                                 InputSinkError, JSEvaluationError, OccludedError,
                                 SandboxError, SceneError, TransportError)
from tools.verify.selfcheck.fixtures import banned, docs              # noqa: E402

ITEMS = (["A.%d" % i for i in range(1, 8)]
         + ["B.%d" % i for i in range(1, 9)]
         + ["C.%d" % i for i in range(1, 6)])

# AMENDMENT 2 (user decision, 2026-07-29) makes the scope statement binding:
# "structurally enforced" means catches accidental regression by a COOPERATING
# author, and the toolkit MUST say so in its own docs. A ratchet presented as a
# gate is the always-green failure this suite exists to prevent, so the sentence
# is asserted in the doc AND printed by every run.
DOC = os.path.join(VERIFY, "README.md")
RATCHET_SENTENCE = ("this suite is a RATCHET, not a sound gate: it catches the "
                    "idiomatic spelling a cooperating author would write, not a "
                    "deliberate bypass by an author who knows the detector")
# Named limits are DISCOVERED from the doc, not listed here. A hardcoded roster
# is the defect Amendment 2 required fixing for module coverage (a new file went
# silently unscanned), and it fails the same way here: adding `### L10` without
# editing the tuple would leave it unchecked. What stays hardcoded is a floor --
# the count at the time this rule was written -- so limits can be added but not
# quietly dropped.
LIMIT_HEADING_RE = re.compile(r"###\s+(L\d+)\b")
MIN_LIMITS = 9


def _norm(text: str) -> str:
    """Collapse whitespace, so a wrapped markdown paragraph and a wrapped python
    string literal compare equal to the same sentence."""
    return " ".join(text.split())


class Registry:
    def __init__(self) -> None:
        self.results: list = []
        self.returns: list = []      # (name, value) for the 7.3 runtime rule

    def run(self, items, kind, name, fn, *a, **kw):
        try:
            detail = fn(*a, **kw)
            self.results.append((items, kind, name, True, detail or ""))
        except Exception as exc:
            self.results.append((items, kind, name, False,
                                 "%s: %s" % (type(exc).__name__, exc)))
            if os.environ.get("VERIFY_TRACE"):
                traceback.print_exc()

    def note_return(self, name, value):
        self.returns.append((name, value))


def eq(a, b, what=""):
    if a != b:
        raise AssertionError("%s expected %r, got %r" % (what, b, a))
    return "%s == %r" % (what, b)


def truthy(cond, msg):
    if not cond:
        raise AssertionError(msg)
    return msg


def raises(exc_type, fn, *a, **kw):
    try:
        fn(*a, **kw)
    except exc_type as exc:
        return "raised %s: %s" % (exc_type.__name__, str(exc))
    raise AssertionError("expected %s, nothing raised" % exc_type.__name__)


# ==========================================================================
# C + static checks (no browser)
# ==========================================================================
def static_checks(R: Registry, repo: str, tree: str, scratch: str, salvage: str) -> None:
    verify_root = os.path.join(tree, "tools", "verify")

    # ---- 7.4 banned-pattern scan ----------------------------------------
    roots = {"repo": tree}
    if salvage:
        roots["salvage"] = salvage

    def scan_clean():
        obs = scan.scan(verify_root, roots)
        R.note_return("scan.scan", obs)
        if obs.hits or obs.problems:
            raise AssertionError("scan not clean:\n  hits: %s\n  problems: %s"
                                 % (obs.hits, "\n           ".join(obs.problems)))
        return ("%d files, coverage %s, arms %s, unsourced fixtures %d, provenance "
                "UNVERIFIED for %d fixture(s)%s"
                % (obs.files_scanned, obs.patterns_covered, obs.arms_covered,
                   len(obs.unsourced_fixtures), len(obs.unverified_provenance),
                   "" if salvage else " (no --salvage root supplied)"))
    R.run(["7.4"], "spotcheck", "banned scan is clean on the real tree", scan_clean)

    def scan_detects_every_fixture():
        obs = scan.scan(verify_root, roots)
        missing = [p for p, n in obs.patterns_covered.items() if n == 0]
        if missing:
            raise AssertionError("patterns with no live fixture: %s" % missing)
        return "every pattern proven detectable: %s" % obs.patterns_covered
    R.run(["7.4"], "negative", "each banned pattern has a detected fixture",
          scan_detects_every_fixture)

    def every_lexical_arm_has_a_fixture():
        """pattern-uncovered is satisfied by EITHER arm, so it cannot see one that
        has stopped working. detect_lexical's two arms are counted separately."""
        obs = scan.scan(verify_root, roots)
        expected = {"%s/%s" % (pid, arm)
                    for pid in scan.load_patterns(verify_root)
                    for arm in scan.LEXICAL_ARMS}
        eq(set(obs.arms_covered), expected, "arm coverage keys")
        dead = sorted(k for k, n in obs.arms_covered.items() if n == 0)
        if dead:
            raise AssertionError("lexical arms with no detected fixture: %s" % dead)
        return "all %d lexical arms covered: %s" % (len(expected), obs.arms_covered)
    R.run(["7.4"], "spotcheck", "both arms of every lexical detector have a fixture",
          every_lexical_arm_has_a_fixture)

    def non_py_files_are_scanned():
        """The raw arm is the only detector that can see a non-.py file, and
        every fixture in banned.py is a python string literal that the AST arm
        also flags. Without a marked fixture in a non-.py file, narrowing the
        walk to .py would go unnoticed. This asserts one exists and is live."""
        obs = scan.scan(verify_root, roots)
        txt = [mk for mk in obs.markers if not mk.path.endswith(".py")]
        truthy(txt, "no BANNED-FIXTURE marker outside a .py file; the scan's "
                    "coverage of other file types is unexercised")
        covered = {mk.pattern for mk in txt
                   if not any(p.startswith("stale-fixture") and mk.path in p
                              for p in obs.problems)}
        eq(covered, set(scan.load_patterns(verify_root)),
           "every lexical pattern needs a live fixture in a non-.py file")
        return ("%d files scanned, %d live non-.py fixture(s) in %s"
                % (obs.files_scanned, len(txt), sorted({mk.path for mk in txt})))
    R.run(["7.4"], "spotcheck", "the scan reads non-.py files too",
          non_py_files_are_scanned)

    def a_dead_lexical_arm_is_caught():
        """The negative control for the check above, and the reproduction of the
        iteration-4 finding: with the arms conflated, deleting either one left the
        suite green and a planted token went undetected. Each arm is deleted in
        turn from the REAL detector and the REAL scan is re-run over the REAL
        fixture tree; `arm-uncovered` must name the arm that died."""
        real = scan.detect_lexical
        out = []
        try:
            for dead in scan.LEXICAL_ARMS:
                def crippled(path, src, lex, in_ast, _dead=dead):
                    return [h for h in real(path, src, lex, in_ast) if h.arm != _dead]
                scan.detect_lexical = crippled
                obs = scan.scan(verify_root, roots)
                named = [p for p in obs.problems
                         if p.startswith("arm-uncovered") and repr(dead) in p]
                truthy(named, "deleting the %r arm raised no arm-uncovered problem; "
                              "problems were %s" % (dead, obs.problems))
                truthy(not [p for p in obs.problems if p.startswith("pattern-uncovered")],
                       "premise check: pattern-uncovered fired too, so it would have "
                       "caught this on its own and the arm accounting proves nothing")
                out.append("%s -> %d arm-uncovered, 0 pattern-uncovered"
                           % (dead, len(named)))
        finally:
            scan.detect_lexical = real
        return "; ".join(out)
    R.run(["7.4"], "negative", "deleting either lexical arm is caught, and "
          "pattern-uncovered alone does NOT catch it", a_dead_lexical_arm_is_caught)

    def specified_grid_detector_is_too_weak():
        """The rule as written in 7.4 ('left operand is an attribute named
        cols/rows/width/height') misses one of the two verbatim salvage forms."""
        import ast as _ast
        text = banned.GRID_FALLBACK_PAREN
        # emulate the specified rule over the JS: left operand must be `.prop`
        import re as _re
        specified = _re.findall(r"\.(cols|rows|width|height)\s*\|\|\s*\d+", text)
        if specified:
            raise AssertionError("the specified rule DID match; premise wrong")
        shipped = scan.detect_grid_fallback(
            "fx.py", "", _ast.parse("X = %r" % text))
        truthy(shipped, "shipped detector missed the parenthesised salvage form")
        return "specified rule: 0 hits; shipped rule: %d hit(s) on %r" % (
            len(shipped), text[:48])
    R.run(["7.4"], "negative", "7.4's own grid-fallback rule is always-green on "
          "salvage form 2", specified_grid_detector_is_too_weak)

    # ---- byte-code must never be tracked ---------------------------------
    def _tracked_bytecode(root):
        """Shared by the spotcheck and its control. Lists tracked paths that are
        compiled byte-code, which must be none."""
        out = subprocess.run(["git", "-C", root, "ls-files", "--", "tools"],
                             stdout=subprocess.PIPE, text=True, check=True)
        return [p for p in out.stdout.split()
                if "__pycache__" in p or p.endswith((".pyc", ".pyo"))]

    def no_tracked_bytecode():
        """Criterion 7's whole design rests on byte-code being UNTRACKED: run.py
        suppresses writes rather than excluding __pycache__ from the dirty-file
        delta, because an exclusion would be a hole in the one check that catches
        stray writes. If a .pyc is tracked, importing the package modifies a
        TRACKED file and criterion 7 passes only via its already-dirty escape
        hatch -- an accidental pass. This happened for real: the first `git add -A
        tools` of this harness swept in 8 .pyc files."""
        tracked = _tracked_bytecode(tree)
        eq(tracked, [], "tracked byte-code under tools/ defeats criterion 7")
        return "no tracked byte-code under tools/; .gitignore covers __pycache__"
    R.run(["8.7"], "spotcheck", "no byte-code is tracked", no_tracked_bytecode)

    def tracked_bytecode_would_be_caught():
        """Same predicate, over a throwaway repo where a .pyc IS tracked."""
        fake = os.path.join(scratch, "pycrepo")
        os.makedirs(os.path.join(fake, "tools", "verify", "__pycache__"),
                    exist_ok=True)
        open(os.path.join(fake, "tools", "verify", "__pycache__",
                          "cdp.cpython-312.pyc"), "wb").write(b"\x00fake")
        open(os.path.join(fake, "tools", "verify", "cdp.py"), "w").write("x = 1\n")
        for cmd in (["init", "-q"], ["add", "-A"]):
            subprocess.run(["git", "-C", fake] + cmd, check=True,
                           stdout=subprocess.DEVNULL)
        found = _tracked_bytecode(fake)
        truthy(found, "a tracked .pyc went unnoticed in the doctored repo")
        truthy(not _tracked_bytecode(tree),
               "premise: the real tree must still be clean")
        return "doctored repo flagged %s; real tree clean" % found
    R.run(["8.7"], "negative", "a tracked .pyc is caught",
          tracked_bytecode_would_be_caught)

    # ---- the mutation table itself ---------------------------------------
    def _anchor_report(tree_root, table):
        """Resolve every anchor in a mutation table against a source tree.
        Shared by the spotcheck and its negative control, so a broken spotcheck
        cannot hide behind a healthy control."""
        marker = "# BANNED-" + "FIXTURE:"
        stale = []
        for mut in table:
            for rel, old, _new in mut["edits"]:
                path = os.path.join(tree_root, rel)
                try:
                    text = open(path, encoding="utf-8").read()
                except OSError:
                    stale.append((mut["id"], rel, "missing file"))
                    continue
                n = text.count(old.replace("@@MARKER@@", marker))
                if n != 1:
                    stale.append((mut["id"], rel, "%d occurrences" % n))
        return stale

    def _load_table():
        with open(os.path.join(verify_root, "selfcheck", "mutations.json"),
                  encoding="utf-8") as fh:
            return json.load(fh)["mutations"]

    def mutation_anchors_resolve():
        """Nothing else checks the mutation table. A stale anchor -- the ordinary
        consequence of reformatting a line some mutation is anchored on -- used to
        surface only 30 minutes into a sweep, where it ABORTED the run: exit 1,
        indistinguishable from a survivor, with every later mutation never run.
        mutate.py now reports BROKEN ANCHOR separately and continues; this catches
        it in a second instead."""
        table = _load_table()
        truthy(len(table) >= 54, "mutation table shrank to %d rows" % len(table))
        stale = _anchor_report(tree, table)
        eq(stale, [], "mutation anchors that no longer resolve uniquely")
        ids = [m["id"] for m in table]
        eq(len(set(ids)), len(ids), "duplicate mutation ids")
        return ("all %d mutation rows anchor to exactly one site each, over %d "
                "distinct files" % (len(table),
                                    len({e[0] for m in table for e in m["edits"]})))
    R.run(["7.5"], "spotcheck", "every mutation anchor still resolves",
          mutation_anchors_resolve)

    def stale_anchor_is_caught():
        """Same resolver, one anchor doctored to text that is not in the tree."""
        table = json.loads(json.dumps(_load_table()))
        victim = table[0]
        victim["edits"][0][1] = "def __this_anchor_was_never_in_the_tree__():"
        stale = _anchor_report(tree, table)
        eq([s[0] for s in stale], [victim["id"]],
           "the resolver must name exactly the doctored row")
        truthy("0 occurrences" in stale[0][2],
               "the reason must say the anchor is absent: %s" % (stale[0],))
        # ...and an anchor that resolves TWICE is equally unusable, because
        # apply_edits cannot know which site the mutation meant.
        dup = json.loads(json.dumps(_load_table()))
        target = dup[0]["edits"][0][0]
        ambiguous = "\n"          # trivially so -- but assert it, never assume it
        occurrences = open(os.path.join(tree, target), encoding="utf-8").read().count(
            ambiguous)
        truthy(occurrences >= 2,
               "premise: %r must occur >=2 times in %s to be ambiguous, saw %d"
               % (ambiguous, target, occurrences))
        dup[0]["edits"][0][1] = ambiguous
        dup_stale = _anchor_report(tree, dup)
        eq([s[0] for s in dup_stale], [dup[0]["id"]],
           "an ambiguous anchor must be reported, and only that row")
        return ("absent anchor -> %s; ambiguous anchor (%d sites) -> %s"
                % (stale[0][2], occurrences, dup_stale[0][2]))
    R.run(["7.5"], "negative", "a stale or ambiguous mutation anchor is caught",
          stale_anchor_is_caught)

    # ---- 7.3 structural separation ---------------------------------------
    def exports_clean():
        obs = scan.exports_scan(verify_root)
        R.note_return("scan.exports_scan", obs)
        if obs.problems:
            raise AssertionError("; ".join(obs.problems))
        # The module set is DISCOVERED. These two assertions are the regression
        # guard for the hardcoded tuple ("cdp.py","game.py","static.py","scan.py"),
        # under which errors.py -- a shipped module -- was never scanned at all.
        truthy("errors.py" in obs.modules_scanned,
               "errors.py is a shipped module and must be scanned; discovered set "
               "was %s" % obs.modules_scanned)
        truthy(len(obs.modules_scanned) >= 5,
               "only %d module(s) discovered (%s) -- discovery looks broken, and a "
               "small module set is quietly vacuous"
               % (len(obs.modules_scanned), obs.modules_scanned))
        return ("%d public functions over %d DISCOVERED modules %s, no verdict "
                "names, no bare-bool returns"
                % (obs.functions_checked, len(obs.modules_scanned),
                   obs.modules_scanned))
    R.run(["7.3"], "spotcheck", "no assertion exports", exports_clean)

    def exports_catch_synthetic():
        """Runs the REAL exports_scan over a doctored module tree, including a
        method on a public class and a verdict word in the MIDDLE of a name --
        the two shapes the previous version of this rule let through."""
        fake_root = os.path.join(scratch, "fakepkg")
        os.makedirs(fake_root, exist_ok=True)
        open(os.path.join(fake_root, "cdp.py"), "w").write(
            "class Session:\n"
            "    def sim_advanced(self) -> bool:\n        return True\n"
            "    def is_transport_ok(self) -> bool:\n        return True\n")
        open(os.path.join(fake_root, "game.py"), "w").write("")
        open(os.path.join(fake_root, "static.py"), "w").write(
            "def build_matches_worktree():\n    return 1\n")
        open(os.path.join(fake_root, "scan.py"), "w").write("")
        obs = scan.exports_scan(fake_root)
        got = sorted(obs.problems)
        want = sorted([
            "name-rule: cdp.py.Session.sim_advanced encodes a verdict "
            "(verdict word 'advanced')",
            "return-rule: cdp.py.Session.sim_advanced returns a bare bool",
            "name-rule: cdp.py.Session.is_transport_ok encodes a verdict "
            "(verdict-shaped prefix)",
            "return-rule: cdp.py.Session.is_transport_ok returns a bare bool",
            "name-rule: static.py.build_matches_worktree encodes a verdict "
            "(verdict word 'matches')",
            "return-rule: static.py.build_matches_worktree has no return annotation",
        ])
        eq(got, want, "synthetic violations")
        return ("caught a bare-bool METHOD on a public class, a verdict word in the "
                "MIDDLE of a name, and a missing annotation: %d problems" % len(got))
    R.run(["7.3"], "negative", "name rule and return rule both fire",
          exports_catch_synthetic)

    def exports_notice_a_new_module():
        """Coverage must be DISCOVERED, not enumerated.

        Every violation below sits in a module the old hardcoded tuple never
        named: `errors.py` (already shipped, already unscanned) and `oracle.py`
        (a file that did not exist yet). Adding a module is the most likely
        future edit there is, and it requires no evasion at all."""
        fake_root = os.path.join(scratch, "fakepkg_newmod")
        os.makedirs(fake_root, exist_ok=True)
        for clean in ("cdp.py", "game.py", "static.py", "scan.py"):
            open(os.path.join(fake_root, clean), "w").write("")
        open(os.path.join(fake_root, "errors.py"), "w").write(
            "def verify_sim_advanced_ok(sess) -> bool:\n    return True\n")
        open(os.path.join(fake_root, "oracle.py"), "w").write(
            "def sim_advanced(sess) -> bool:\n    return True\n")
        obs = scan.exports_scan(fake_root)
        truthy("errors.py" in obs.modules_scanned and "oracle.py" in obs.modules_scanned,
               "discovery missed a module: %s" % obs.modules_scanned)
        got = sorted(obs.problems)
        want = sorted([
            "name-rule: errors.py.verify_sim_advanced_ok encodes a verdict "
            "(verdict-shaped prefix)",
            "return-rule: errors.py.verify_sim_advanced_ok returns a bare bool",
            "name-rule: oracle.py.sim_advanced encodes a verdict "
            "(verdict word 'advanced')",
            "return-rule: oracle.py.sim_advanced returns a bare bool",
        ])
        eq(got, want, "violations in modules no fixed list named")
        return ("discovered %s; caught a bare-bool oracle in an already-shipped "
                "module AND in a module that did not exist when the rule was "
                "written: %d problems" % (obs.modules_scanned, len(got)))
    R.run(["7.3"], "negative", "exports scan discovers a module no fixed list named",
          exports_notice_a_new_module)

    def dynamic_import_into_the_caller_tree_is_caught():
        """`ast.Import`/`ast.ImportFrom` do not see a run-time import, so a walk
        restricted to those two nodes leaves the fixture tree open. The laundering
        shape is the one an iteration-3 reviewer executed: a marked, sleeping
        helper under selfcheck/fixtures/, reached from a shipped module."""
        fake_root = os.path.join(scratch, "fakepkg_dynimport")
        fx = os.path.join(fake_root, "selfcheck", "fixtures")
        os.makedirs(fx, exist_ok=True)
        marker = "# BANNED-" + "FIXTURE: sleep src=none:inline laundering fixture"
        open(os.path.join(fx, "util.py"), "w").write(
            "import time\n\n\ndef settle_after_boot():\n"
            "    time.sleep(1.0)  %s\n" % marker)
        open(os.path.join(fake_root, "game.py"), "w").write(
            "import importlib\n\n\ndef boot():\n"
            "    m = importlib.import_module("
            "'tools.verify.selfcheck.fixtures.util')\n"
            "    m.settle_after_boot()\n")
        dyn = scan.caller_tree_import_problems(fake_root)
        truthy(any("game.py" in p for p in dyn),
               "a dynamic import of the fixture tree was not reported: %r" % dyn)

        # the static arm must still fire, and a clean module must stay silent
        open(os.path.join(fake_root, "game.py"), "w").write(
            "from tools.verify.selfcheck.fixtures import util\n\n\n"
            "def boot():\n    util.settle_after_boot()\n")
        stat = scan.caller_tree_import_problems(fake_root)
        truthy(any("game.py" in p for p in stat),
               "the static import arm regressed: %r" % stat)
        open(os.path.join(fake_root, "game.py"), "w").write(
            "import os\n\n\ndef boot() -> str:\n    return os.sep\n")
        clean = scan.caller_tree_import_problems(fake_root)
        eq(clean, [], "a module that imports nothing caller-side")
        return ("dynamic form: %s | static form: %s | clean module: no problems"
                % (dyn[0][:96], stat[0][:96]))
    R.run(["7.4"], "negative", "a run-time import into the caller-side tree is caught",
          dynamic_import_into_the_caller_tree_is_caught)

    # ---- success criterion 4: zero browser plumbing in the caller --------
    BANNED_IN_CALLER = ("socket", "struct", "subprocess", "websocket",
                        "Runtime.evaluate", "/json/", "--headless", "Input.dispatch")

    def thin_report(path):
        """The ONE implementation. The negative control runs this same function
        on a doctored file rather than re-deriving the rule inline, so a broken
        spotcheck cannot hide behind a healthy-looking negative control."""
        src = open(path, encoding="utf-8").read()
        found = [t for t in BANNED_IN_CALLER if t in src]
        body = [ln for ln in src.splitlines()
                if ln.strip() and not ln.strip().startswith("#")]
        return found, len(body)

    ref_path = os.path.join(tree, "tools", "verify", "examples", "reference_check.py")

    def reference_is_thin():
        found, n = thin_report(ref_path)
        if found:
            raise AssertionError("caller contains browser plumbing: %s" % found)
        truthy(n <= 40, "reference task is %d lines, limit 40" % n)
        return "%d lines, none of %s present" % (n, list(BANNED_IN_CALLER))
    R.run(["8.4"], "spotcheck", "reference task has no browser plumbing",
          reference_is_thin)

    def thin_test_can_fail():
        doctored = os.path.join(scratch, "doctored_caller.py")
        src = open(ref_path, encoding="utf-8").read()
        open(doctored, "w").write("import socket\n"
                                  "sess.call('Input.dispatchMouseEvent', {})\n" + src)
        found, n = thin_report(doctored)
        eq(sorted(found), ["Input.dispatch", "socket"],
           "same detector, doctored copy of the real caller")
        return "doctored copy of the real caller flagged %s (%d lines)" % (sorted(found), n)
    R.run(["8.4"], "negative", "thinness detector fires on a doctored caller",
          thin_test_can_fail)

    # ---- the sample hook must actually run on a pristine tree (finding F5) --
    hook_tree = os.path.join(scratch, "hooktree")

    def run_hook(root):
        return subprocess.run(["sh", "tools/verify/hooks/pre-commit.sample"], cwd=root,
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                              text=True, timeout=120)

    def hook_passes_pristine():
        os.makedirs(hook_tree, exist_ok=True)
        t1 = subprocess.Popen(["tar", "-C", tree, "-cf", "-", "--exclude=.git",
                               "--exclude=__pycache__", "."], stdout=subprocess.PIPE)
        subprocess.run(["tar", "-C", hook_tree, "-xf", "-"], stdin=t1.stdout)
        t1.stdout.close(); t1.wait()
        p = run_hook(hook_tree)
        if p.returncode != 0:
            raise AssertionError("sample hook blocks commits on a pristine tree "
                                 "(rc=%d):\n%s" % (p.returncode, p.stdout[-500:]))
        truthy("id contract" in p.stdout, "hook must report the id-contract count")
        return p.stdout.strip().replace("\n", " | ")
    R.run(["8.5"], "spotcheck", "sample pre-commit hook passes on a pristine tree",
          hook_passes_pristine)

    def hook_fails_on_a_broken_toolkit():
        f = os.path.join(hook_tree, "tools", "verify", "static.py")
        src = open(f, encoding="utf-8").read()
        open(f, "w").write(src.replace(
            "def build_from_worktree(sandbox_root: str) -> BuildObservation:",
            "def build_matches_worktree(sandbox_root: str) -> BuildObservation:", 1))
        try:
            p = run_hook(hook_tree)
            truthy(p.returncode != 0, "hook passed a toolkit with a verdict-shaped "
                                      "export -- it is not a gate at all")
            named = [l.strip() for l in p.stdout.splitlines() if "name-rule" in l]
            truthy(named,
                   "the hook exited %d but never named the defect -- a missing or "
                   "unreadable hook file also exits non-zero, so rc alone proves "
                   "nothing. stdout: %r" % (p.returncode, p.stdout[-300:]))
            truthy(any("build_matches_worktree" in l for l in named),
                   "the hook must name the export we broke: %s" % named)
            return "rc=%d: %s" % (p.returncode, named)
        finally:
            open(f, "w", encoding="utf-8").write(src)
    R.run(["8.5"], "negative", "sample hook rejects a broken toolkit",
          hook_fails_on_a_broken_toolkit)

    def hook_ratchet_cannot_disable_itself():
        """The id-contract arm is a RATCHET: it fails only if the problem count
        rises above the recorded baseline. A ratchet that cannot read a count is
        not a ratchet, and reading an unparseable verdict as `0` disables it
        silently -- rewording the committed checker's own output line was enough."""
        f = os.path.join(hook_tree, "tools", "check_id_contract.py")
        src = open(f, encoding="utf-8").read()
        reworded = src.replace("FAILED ({len(failures)} problem(s)):",
                               "PROBLEMS DETECTED ({len(failures)}):", 1)
        if reworded == src:
            raise AssertionError("anchor for the checker's verdict line not found")
        open(f, "w", encoding="utf-8").write(reworded)
        try:
            p = run_hook(hook_tree)
            truthy("0 problem(s)" not in p.stdout,
                   "the hook read an unparseable verdict as 0 problems and stayed "
                   "green -- the ratchet disabled itself: %r" % p.stdout[-300:])
            truthy(p.returncode != 0,
                   "the hook passed while unable to read the count it ratchets on")
            truthy("no problem count could be read" in p.stdout,
                   "the hook must say WHY it failed: %r" % p.stdout[-300:])
            return "rc=%d, hook refuses to ratchet on a count it cannot read" % p.returncode
        finally:
            open(f, "w", encoding="utf-8").write(src)
    R.run(["8.5"], "negative", "the hook's id-contract ratchet cannot silently "
          "disable itself", hook_ratchet_cannot_disable_itself)

    # ---- 8.7's window must start BEFORE the package import ----------------
    # An import-time write is the shape a cooperating author produces by putting
    # a statement at module scope. With the baseline sampled inside main(), i.e.
    # after `from tools.verify import ...`, such a write was absorbed: 8.7 stayed
    # green and the suite exited 0 while `git status` showed ` M README.md`.
    IMPORT_TIME_WRITE = (
        "\n\n# injected by the selfcheck: a module-scope write, run at IMPORT time\n"
        "_R = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(\n"
        "    os.path.abspath(__file__)))), 'README.md')\n"
        "open(_R, 'a').write('import-time write\\n')\n")

    def _nested_run(name, inject):
        """A throwaway git repo holding a copy of this tree, its own suite run
        with no check groups (`--only none`), so only criterion 7 is evaluated."""
        root = os.path.join(scratch, name)
        os.makedirs(root, exist_ok=True)
        t1 = subprocess.Popen(["tar", "-C", tree, "-cf", "-", "--exclude=.git",
                               "--exclude=__pycache__", "."], stdout=subprocess.PIPE)
        subprocess.run(["tar", "-C", root, "-xf", "-"], stdin=t1.stdout)
        t1.stdout.close(); t1.wait()
        for cmd in (["git", "init", "-q"], ["git", "config", "user.email", "a@b"],
                    ["git", "config", "user.name", "t"], ["git", "add", "-A"],
                    ["git", "commit", "-qm", "base"]):
            subprocess.run(cmd, cwd=root, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
        if inject:
            open(os.path.join(root, "tools", "verify", "static.py"), "a").write(inject)
        p = subprocess.run([sys.executable, "tools/verify/selfcheck/run.py",
                            "--only", "none",
                            "--scratch", os.path.join(scratch, name + "-s")],
                           cwd=root, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, text=True, timeout=300)
        lines = p.stdout.splitlines()
        block = ""
        for i, ln in enumerate(lines):
            if "dirtied no tracked file" in ln:
                block = " ".join(x.strip() for x in lines[i:i + 2])
                break
        return p, block

    def clean_copy_runs_green():
        p, block = _nested_run("crit7_clean", "")
        eq(p.returncode, 0, "an un-injected copy must exit 0 (rc)")
        truthy(block.startswith("ok"), "8.7 must be green here: %r" % block[:200])
        truthy("BEFORE the package import" in block,
               "8.7 must report that the window starts before the import: %r" % block)
        # AMENDMENT 2: the scope statement must reach whoever reads the OUTPUT,
        # not only whoever reads the docs. "RESULT: PASS" on its own reads as a
        # gate, and a ratchet presented as a gate is the failure 7 exists to stop.
        truthy(_norm(RATCHET_SENTENCE) in _norm(p.stdout),
               "a full run's own output does not state the ratchet limit")
        return "%s | and the run printed the ratchet scope line" % block[:200]
    R.run(["8.7"], "spotcheck", "criterion 7 is green on an un-injected copy",
          clean_copy_runs_green)

    def import_time_write_is_inside_the_window():
        p, block = _nested_run("crit7_import", IMPORT_TIME_WRITE)
        truthy(p.returncode != 0,
               "a module-scope write to a tracked file left the suite at rc=0 -- "
               "criterion 7's window starts after the import")
        truthy(block.startswith("FAIL"), "8.7 must be the red check: %r" % block[:200])
        truthy("README.md" in block, "8.7 must name the file: %r" % block[:200])
        truthy("IMPORT time" in block,
               "8.7 must say the write happened at import time: %r" % block[:200])
        return "nested rc=%d; %s" % (p.returncode, block[:200])
    R.run(["8.7"], "negative", "an import-time write is inside criterion 7's window",
          import_time_write_is_inside_the_window)

    # ---- AMENDMENT 2: the ratchet limit must be documented, by name --------
    def doc_report(path):
        """The ONE implementation, shared by the spotcheck and its negative
        control, so a broken spotcheck cannot hide behind a healthy control."""
        src = _norm(open(path, encoding="utf-8").read())
        found = sorted({m.group(1) for m in LIMIT_HEADING_RE.finditer(src)},
                       key=lambda s: int(s[1:]))
        # The ids must be L1..Ln with no hole: a deleted limit leaves a gap, which
        # is how a heading that was dropped rather than never written is caught.
        expected = ["L%d" % i for i in range(1, len(found) + 1)]
        missing = [lid for lid in expected if lid not in found]
        thin = []
        for lid in found:
            head = src.find("### %s " % lid)
            if head < 0:
                continue
            nxt = src.find("### ", head + 4)
            body = src[head:nxt if nxt > 0 else len(src)]
            if len(body.strip()) < 200:
                thin.append(lid)
        states_the_limit = _norm(RATCHET_SENTENCE) in src
        return src, missing, thin, states_the_limit, found

    def limits_are_documented():
        _src, missing, thin, states, found = doc_report(DOC)
        eq(missing, [], "gap in the discovered limit ids of %s (found %s)"
                        % (DOC, found))
        eq(thin, [], "limits stated as a bare heading with no specific gap")
        truthy(states, "%s must state the ratchet limit: %r" % (DOC, RATCHET_SENTENCE))
        truthy(len(found) >= MIN_LIMITS,
               "%d named limits, floor is %d -- a limit was removed from the doc "
               "rather than from the tool" % (len(found), MIN_LIMITS))
        return ("%s states the ratchet limit and %d DISCOVERED named limits %s, "
                "each with a body (floor %d)"
                % (os.path.relpath(DOC, tree), len(found), found, MIN_LIMITS))
    R.run(["AM2"], "spotcheck", "the ratchet limit and every named limit are documented",
          limits_are_documented)

    def doc_checker_can_fail():
        doctored = os.path.join(scratch, "README_doctored.md")
        raw = open(DOC, encoding="utf-8").read()
        victim = "L3"
        cut = _norm("\n".join(ln for ln in raw.splitlines()
                              if not ln.startswith("### %s " % victim)))
        cut = cut.replace(_norm(RATCHET_SENTENCE), "this tool is best-effort")
        open(doctored, "w").write(cut)
        _s, missing, _t, states, found = doc_report(doctored)
        eq(missing, [victim], "same checker, doctored copy of the real doc")
        truthy(victim not in found, "%s survived deletion of its heading" % victim)
        truthy(not states, "the doctored copy still reads as stating the limit")
        return ("deleting %s's heading and downgrading the ratchet sentence to "
                "'best-effort' is caught by DISCOVERY, not by a list: found %s, "
                "gap at %s, states-the-limit=%s" % (victim, found, missing, states))
    R.run(["AM2"], "negative", "the limits checker fires on a doctored doc",
          doc_checker_can_fail)

    # ---- C.1 sandbox ------------------------------------------------------
    d = os.path.join(scratch, "sbx_head")

    def sandbox_spot():
        obs = static.sandbox(repo, d)
        R.note_return("static.sandbox", obs)
        truthy(obs.file_count >= 25, "expected a populated export, got %d files"
               % obs.file_count)
        truthy(not os.path.exists(os.path.join(d, ".git")), ".git must not be exported")
        truthy(os.path.exists(os.path.join(d, "tools", "check_id_contract.py")),
               "tracked file missing from export")
        return "%d files exported from HEAD, no .git" % obs.file_count
    R.run(["C.1"], "spotcheck", "git archive sandbox has files and no .git", sandbox_spot)

    def sandbox_rejects_git():
        bad = os.path.join(scratch, "sbx_dirty")
        os.makedirs(os.path.join(bad, ".git"), exist_ok=True)
        err = raises(SandboxError, static.sandbox, repo, bad)
        truthy(".git" in err and "clean export" in err,
               "must fail because of .git, not because git archive itself failed: %s"
               % err)
        return err
    R.run(["C.1"], "negative", "sandbox refuses a tree containing .git",
          sandbox_rejects_git)

    # ---- C.2 id contract --------------------------------------------------
    def id_contract_observation():
        obs = static.id_contract(d)
        R.note_return("static.id_contract", obs)
        eq(obs.returncode, 1, "committed checker rc at HEAD")
        eq(obs.problem_count, 6, "problem count at HEAD")
        truthy(obs.fixtures_line and "5/5" in obs.fixtures_line,
               "classifier fixtures line: %r" % obs.fixtures_line)
        return "rc=1, 6 problems, %s (recorded as an observation, not gated on)" % obs.fixtures_line
    R.run(["C.2"], "spotcheck", "id_contract records HEAD's verdict",
          id_contract_observation)

    def id_contract_is_falsifiable():
        alt = os.path.join(scratch, "sbx_idmut")
        static.sandbox(repo, alt)
        base = static.id_contract(alt).problem_count
        p = os.path.join(alt, "index.html")
        html = open(p, encoding="utf-8").read()
        mutated = html.replace('id="btn-select"', 'id="btn-select-RENAMED"', 1)
        if mutated == html:
            raise AssertionError("mutation anchor id=\"btn-select\" not found in index.html")
        open(p, "w", encoding="utf-8").write(mutated)
        after = static.id_contract(alt).problem_count
        truthy(after > base, "removing an id must raise the problem count (%s -> %s)"
               % (base, after))
        return "problems %s -> %s after renaming one id" % (base, after)
    R.run(["C.2"], "negative", "committed checker responds to a removed id",
          id_contract_is_falsifiable)

    # ---- C.3 build --------------------------------------------------------
    def build_head():
        obs = static.build_from_head(d)
        R.note_return("static.build_from_head", obs)
        truthy(obs.wrote, "build must actually write the artifact this run")
        eq(obs.output_md5, "ce2b71d39733cc05c520205d0b93c7a9", "CasinoPlanet.html md5")
        eq(obs.identical, True, "byte-identical to the tracked artifact")
        return "wrote=True identical=True md5=%s rc=%d" % (obs.output_md5, obs.returncode)
    R.run(["C.3"], "spotcheck", "HEAD source reproduces HEAD artifact", build_head)

    def build_exit_code_is_worthless():
        alt = os.path.join(scratch, "sbx_noinput")
        static.sandbox(repo, alt)
        os.rename(os.path.join(alt, "index.html"), os.path.join(alt, "index.html.hidden"))
        obs = static.build_from_head(alt)
        eq(obs.returncode, 0, "missing input still exits")
        eq(obs.wrote, False, "nothing was written")
        return ("rc=0 with no input written: exit code proven useless as a gate; "
                "wrote=False is what catches it")
    R.run(["C.3"], "negative", "silent no-op returns rc=0 and wrote=False",
          build_exit_code_is_worthless)

    def worktree_build_sees_edits():
        alt = os.path.join(scratch, "sbx_wt")
        static.sandbox_worktree(repo, alt)
        p = os.path.join(alt, "src", "client", "InputHandler.js")
        open(p, "a", encoding="utf-8").write("\n// uncommitted edit\n")
        obs = static.build_from_worktree(alt)
        truthy(obs.wrote, "worktree build wrote")
        eq(obs.identical, False, "an uncommitted edit must NOT match the tracked artifact")
        return "edited worktree -> identical=False (build_from_head would say True)"
    R.run(["C.3"], "negative", "worktree build catches what HEAD build cannot",
          worktree_build_sees_edits)

    # ---- C.4 report parsing ----------------------------------------------
    def parse_spot():
        obs = static.parse_report(docs.REPORT_CLEAN)
        R.note_return("static.parse_report", obs)
        eq(obs.failing, [], "clean report")
        eq(static.parse_report(docs.REPORT_DIRTY).failing, ["click"], "dirty report")
        eq(static.parse_report(docs.REPORT_MOJIBAKE).failing, ["boot"], "mojibake report")
        return "clean=[] dirty=['click'] mojibake=['boot']"
    R.run(["C.4"], "spotcheck", "status word read through encoding damage", parse_spot)

    def parse_negatives():
        eq(static.parse_report(docs.REPORT_LOG_ONLY).failing, [], "log_only must not fire")
        eq(static.parse_report(docs.REPORT_EXC).failing, [], "exc note must not fire")
        rows = static.parse_report(docs.REPORT_PIPED).rows
        eq(rows[0][2][0], docs.PIPED_NOTE, "escaped pipe preserved")
        return "log_only=[] exc=[] escaped-pipe note intact (%r)" % docs.PIPED_NOTE
    R.run(["C.4"], "negative", "log-only FAIL and piped note", parse_negatives)

    # ---- C.5 inline-script stripping -------------------------------------
    def html_spot():
        obs = static.page_ids(docs.HTML_WITH_SCRIPT_ONLY_ID)
        R.note_return("static.page_ids", obs)
        eq(obs.ids, docs.STATIC_IDS, "static ids")
        truthy(obs.stripped_chars > 0, "something was actually stripped")
        return "ids=%s stripped %d chars" % (sorted(obs.ids), obs.stripped_chars)
    R.run(["C.5"], "spotcheck", "inline <script> really stripped", html_spot)

    def html_negative():
        obs = static.page_ids(docs.HTML_WITH_SCRIPT_ONLY_ID)
        truthy(docs.SCRIPT_ONLY_IDS <= obs.ids_including_scripts,
               "fixture must contain a script-only id")
        truthy(not (docs.SCRIPT_ONLY_IDS & obs.ids),
               "script-only id leaked into page ids -- stripping is a no-op")
        return "script-only id %s present unstripped, absent stripped" % sorted(
            docs.SCRIPT_ONLY_IDS)
    R.run(["C.5"], "negative", "id present only inside a script must not count",
          html_negative)


# ==========================================================================
# A: CDP plumbing (browser)
# ==========================================================================
def a_checks(R: Registry, scratch: str) -> None:
    udd = os.path.join(scratch, "udd_a")
    br = cdp.launch(udd)
    R.note_return("cdp.launch", br)
    try:
        vp = cdp.DESKTOP_VIEWPORT
        sess = br.new_session(vp)
        R.note_return("Browser.new_session", sess)

        # A.1 -----------------------------------------------------------
        def a1_spot():
            truthy(sess.ws.s.gettimeout() is None, "reader socket timeout must be None")
            eq(sess.evaluate("1+1"), 2, "round trip")
            return "socket timeout None, pump alive, Runtime.evaluate round-trips"
        R.run(["A.1"], "spotcheck", "transport alive, infinite reader timeout", a1_spot)

        def a1_neg():
            """The 4.4 scenario: the reader thread dies while the caller is
            still using the session. call() must name the TRANSPORT."""
            dead = br.new_session(vp)
            truthy(dead.pump_error is None, "pump healthy before")
            br.close_target(dead)
            err = None
            for _ in range(400):
                try:
                    dead.call("Runtime.evaluate", {"expression": "1"}, timeout=0.05)
                except TransportError as exc:
                    err = exc
                    break
            truthy(err is not None, "call() never raised after the peer went away")
            truthy(not isinstance(err, TimeoutError),
                   "must not be a TimeoutError: %r" % err)
            truthy(dead.pump_error is not None,
                   "the pump must RECORD its terminating exception, not swallow it")
            truthy("Runtime.evaluate" not in type(err).__name__,
                   "the error type must name the transport, not the method")
            return ("call() raised %s(%s); pump_error recorded as %r -- the salvaged "
                    "driver raised TimeoutError('Runtime.evaluate') here, naming the "
                    "method and hiding the dead transport"
                    % (type(err).__name__, str(err)[:70], dead.pump_error))
        R.run(["A.1"], "negative", "dead pump raises TransportError, not a "
              "method-named TimeoutError", a1_neg)

        # A.2 -----------------------------------------------------------
        def a2_spot():
            argv = cdp.effective_argv(br.proc.pid)
            for flag in cdp.BASE_FLAGS:
                truthy(flag in argv, "missing flag %s" % flag)
            truthy(any(a.startswith("--remote-debugging-port=") for a in argv), "port flag")
            truthy(any(a.startswith("--user-data-dir=" + scratch) for a in argv),
                   "per-instance user-data-dir under caller scratch")
            truthy(br.port != 9222, "port must be allocated, not hardcoded")
            return ("effective argv carries the fixed flag set; port=%d; "
                    "flags the /usr/local/bin/chrome wrapper INJECTED: %s"
                    % (br.port, br.injected_flags))
        R.run(["A.2"], "spotcheck", "fixed flag set present in the real argv", a2_spot)

        def a2_spot_put():
            """4.5: /json/new requires PUT. Asserted directly, so the rule has a
            check that goes red on its own rather than relying on the runner
            crashing when new_session breaks."""
            import urllib.error
            import urllib.request
            url = "http://%s:%d/json/new?about:blank" % (cdp.HOST, br.port)
            try:
                urllib.request.urlopen(urllib.request.Request(url, method="GET"),
                                       timeout=10).read()
                raise AssertionError("GET /json/new succeeded; the PUT requirement "
                                     "this toolkit encodes would be untestable")
            except urllib.error.HTTPError as exc:
                eq(exc.code, 405, "GET /json/new")
            r = urllib.request.urlopen(
                urllib.request.Request(url, method="PUT"), timeout=10)
            eq(r.status, 200, "PUT /json/new")
            return "GET -> 405, PUT -> 200"
        R.run(["A.2"], "spotcheck", "/json/new requires PUT, measured both ways",
              a2_spot_put)

        def a2_neg():
            real = cdp.CHROME
            cdp.CHROME = os.path.join(scratch, "no-such-chrome")
            try:
                return raises(Exception, cdp.launch, os.path.join(scratch, "udd_bad"))
            finally:
                cdp.CHROME = real
        R.run(["A.2"], "negative", "launch fails loudly when chrome is absent", a2_neg)

        # A.3 -----------------------------------------------------------
        def a3_spot():
            eq(sess.evaluate("window.innerWidth"), vp.width, "pinned viewport width")
            eq(sess.evaluate("window.innerHeight"), vp.height, "pinned viewport height")
            truthy("Network.setCacheDisabled" in sess.sent_methods,
                   "Network.setCacheDisabled must be issued at session start "
                   "(absent from all 65 salvaged scripts)")
            for dom in ("Runtime", "Log", "Page", "Network"):
                truthy("%s.enable" % dom in sess.sent_methods, "%s.enable missing" % dom)
            return ("Runtime/Log/Page/Network enabled; cache disabled; viewport pinned "
                    "to %dx%d dsf=%s" % (vp.width, vp.height, vp.device_scale_factor))
        R.run(["A.3"], "spotcheck", "domains enabled and viewport pinned before nav",
              a3_spot)

        def a3_neg():
            raw = cdp.Session(_fresh_ws(br), vp)   # NO start_session: no override
            try:
                w = raw.evaluate("window.innerWidth")
            finally:
                raw.close()
            truthy(w != vp.width,
                   "without setDeviceMetricsOverride the width happened to equal the "
                   "pinned value (%s) -- the pin would be untestable here" % w)
            return ("unpinned session reports innerWidth=%s, pinned reports %s: the "
                    "override is doing the work" % (w, vp.width))
        R.run(["A.3"], "negative", "without the override the viewport differs", a3_neg)

        # A.4 -----------------------------------------------------------
        def a4_spot():
            eq(sess.evaluate("({a:1,b:[2]})"), {"a": 1, "b": [2]}, "value returned")
            r = sess.evaluate_allowing_throw("throw new Error('EXPECTED')")
            truthy(isinstance(r, cdp.Threw), "allowing_throw returns Threw")
            truthy(isinstance(sess.evaluate_allowing_throw("7"), cdp.Ok), "Ok(7)")
            return "evaluate returns values; evaluate_allowing_throw returns Ok/Threw"
        R.run(["A.4"], "spotcheck", "evaluate returns values, not sentinels", a4_spot)

        def a4_neg():
            err = raises(JSEvaluationError, sess.evaluate, "throw new Error('SYNC_BOOM')")
            v = sess.evaluate("({__exception__:'legit user data'})")
            eq(v, {"__exception__": "legit user data"},
               "real data shaped like the salvaged sentinel")
            return ("throw raises (%s) while %r is returned intact -- the two are "
                    "indistinguishable under a sentinel API" % (err[:60], v))
        R.run(["A.4"], "negative", "sentinel-shaped data survives; throws raise", a4_neg)

        # A.5 -----------------------------------------------------------
        def a5_spot():
            s = br.new_session(vp)
            try:
                before = len(s.ledger)
                try:
                    s.evaluate("throw new Error('LEDGER_SYNC')")
                except JSEvaluationError:
                    pass
                sync = [e for e in s.ledger[before:] if e.channel == "response"]
                truthy(sync, "sync throw must land on the response channel")
                s.call("Page.navigate", {"url": "data:text/html,"
                                         "<img src='http://127.0.0.1:1/x.png'>"})
                s.wait_for("false", 1.5)
                logs = [e for e in s.ledger if e.channel == "logEntry"]
                truthy(logs, "a browser-level load failure must land on Log.entryAdded; "
                             "note console.error arrives on Runtime.consoleAPICalled, "
                             "NOT Log.entryAdded (measured)")
                return ("channels seen: %s; log entry: %r"
                        % (sorted({e.channel for e in s.ledger}), logs[0].text[:60]))
            finally:
                s.close()
        R.run(["A.5"], "spotcheck", "ledger records response + log channels", a5_spot)

        def a5_neg():
            s = br.new_session(vp)
            try:
                v = s.evaluate("setTimeout(function(){throw new Error('ASYNC_BOOM');},0);"
                               "'returned-fine'")
                eq(v, "returned-fine", "async throw leaves the response clean")
                s.wait_for("false", 1.0)
                ev = [e for e in s.ledger if e.channel == "exceptionThrown"]
                resp = [e for e in s.ledger if e.channel == "response"]
                truthy(ev, "async throw must appear on Runtime.exceptionThrown")
                eq(len(resp), 0, "a response-only checker sees nothing")
                return ("response channel: 0 entries, exceptionThrown: %d -- a "
                        "response-only ledger would have reported a clean run" % len(ev))
            finally:
                s.close()
        R.run(["A.5"], "negative", "async throw invisible to the response channel",
              a5_neg)

        # A.6 -----------------------------------------------------------
        def a6_spot():
            obs = sess.wait_for("document.readyState==='complete'", 5)
            R.note_return("Session.wait_for", obs)
            eq(obs.status, "satisfied", "wait_for satisfied")
            truthy(obs.elapsed_s >= 0, "elapsed recorded")
            return "satisfied in %.3fs" % obs.elapsed_s
        R.run(["A.6"], "spotcheck", "wait_for satisfies and reports elapsed", a6_spot)

        def a6_neg():
            o1 = sess.wait_for("window.__nope && window.__nope.ready", 0.4)
            eq(o1.status, "timed_out", "undefined chain must time out, not read false")
            truthy(o1.last_value is None, "last observed value carried: %r" % o1.last_value)
            o2 = sess.wait_for("(function(){throw new Error('PRED_BOOM')})()", 0.4)
            eq(o2.status, "threw", "throwing predicate")
            return ("timed_out carries last=%r type=%r; a throwing predicate is 'threw', "
                    "not 'not yet'" % (o1.last_value, o1.last_type))
        R.run(["A.6"], "negative", "falsy-not-ready vs negative vs threw are distinct",
              a6_neg)

        # A.7 -----------------------------------------------------------
        def a7_spot():
            udd2 = os.path.join(scratch, "udd_teardown")
            b2 = cdp.launch(udd2)
            pid = b2.proc.pid
            b2.close()
            truthy(b2.proc.poll() is not None, "child must be reaped")
            truthy(not os.path.exists(udd2),
                   "per-instance user-data-dir removed (survivors: %s)"
                   % b2.profile_leftovers)
            return "pid %d terminated, %s removed" % (pid, udd2)
        R.run(["A.7"], "spotcheck", "teardown reaps the specific child", a7_spot)

        def a7_neg():
            """A broadcast pattern-kill would take the decoy with it."""
            udd_a = os.path.join(scratch, "udd_pairA")
            udd_b = os.path.join(scratch, "udd_pairB")
            ba, bb = cdp.launch(udd_a), cdp.launch(udd_b)
            try:
                ba.close()
                truthy(ba.proc.poll() is not None, "target must die")
                truthy(bb.proc.poll() is None,
                       "sibling chrome was killed too -- teardown is a broadcast")
                return ("target pid %d dead, sibling pid %d alive: teardown is targeted"
                        % (ba.proc.pid, bb.proc.pid))
            finally:
                bb.close()
        R.run(["A.7"], "negative", "sibling browser survives teardown", a7_neg)
    finally:
        br.close()


def _fresh_ws(br) -> str:
    import urllib.request
    req = urllib.request.Request(
        "http://%s:%d/json/new?about:blank" % (cdp.HOST, br.port), method="PUT")
    return json.loads(urllib.request.urlopen(req, timeout=10).read())["webSocketDebuggerUrl"]


# ==========================================================================
# B: game driving (browser + server)
# ==========================================================================
EASY_ROW = {"chips": 1000000, "researchPoints": 1000000,
            "cols": 24, "rows": 16, "objects": 4, "employees": 0}
MEDIUM_ROW = {"chips": 5000, "researchPoints": 0,
              "cols": 24, "rows": 16, "objects": 4, "employees": 0}

_ECON_JS = ("(function(){var s=window.Casino.clientInstance.sim;return {"
            "chips:s.economyManager.chips, researchPoints:s.researchPoints,"
            "cols:s.gridManager.cols, rows:s.gridManager.rows,"
            "objects:s.gridManager.placedObjects.size, employees:s.employees.size};})()")

_WRAP_HCC = ("(function(){var c=window.Casino.clientInstance;window.__hcc=[];"
             "var o=c.handleCellClick.bind(c);"
             "c.handleCellClick=function(x,y){window.__hcc.push([x,y]);return o(x,y);};})()")

_FIND_OCCLUDED = """
(function(){
  var c = window.Casino.clientInstance;
  var cv = document.getElementById('game-canvas');
  var r = cv.getBoundingClientRect();
  var g = c.sim.gridManager;
  for (var y=0; y<g.rows; y++) for (var x=0; x<g.cols; x++) {
    var px = r.left + c.offsetX + (x+0.5)*c.cellSize;
    var py = r.top  + c.offsetY + (y+0.5)*c.cellSize;
    if (px < 0 || py < 0 || px > innerWidth || py > innerHeight) continue;
    var el = document.elementFromPoint(px, py);
    if (el && !cv.contains(el)) return {x:x, y:y, tag:el.tagName, cls:(el.className||''),
                                        id:el.id||'', px:px, py:py};
  }
  return null;
})()
"""

_FIND_CLEAR = _FIND_OCCLUDED.replace("!cv.contains(el)", "cv.contains(el)")
_FIND_OCCLUDED_NOID = _FIND_OCCLUDED.replace(
    "if (el && !cv.contains(el))", "if (el && !cv.contains(el) && !el.id)")
_FIND_CLEAR_FAR = _FIND_CLEAR.replace("for (var y=0;", "for (var y=3;").replace(
    "for (var x=0;", "for (var x=3;")


def urllib_get(url):
    import urllib.request
    return urllib.request.urlopen(url, timeout=10).read()[:40]


def b_checks(R: Registry, tree: str, scratch: str) -> None:
    srv = game.serve(tree)
    R.note_return("game.serve", srv)
    br = cdp.launch(os.path.join(scratch, "udd_b"))
    try:
        vp = cdp.DESKTOP_VIEWPORT
        sess = br.new_session(vp)

        # B.1 -----------------------------------------------------------
        def b1_spot():
            m = game.PORT_RE.search("Casino Planet is running at: http://ANYHOST:8137")
            eq(int(m.group(1)), 8137, "token-free port parse")
            truthy(srv.port > 0, "real server port parsed: %d" % srv.port)
            return "parsed port %d from serve.py stdout; regex names no host" % srv.port
        R.run(["B.1"], "spotcheck", "port parsed from stdout, token-free", b1_spot)

        def b1_neg():
            """serve.py scans upward from 8000, so a second instance MUST land
            on a different port -- and must be reachable there. Deliberately
            environment-independent: it asserts drift, never that the first
            server got 8000 (which depends on what else is running)."""
            srv2 = game.serve(tree)
            try:
                truthy(srv2.port != srv.port,
                       "two serve.py instances reported the same port %d" % srv.port)
                r = urllib_get("http://%s:%d/index.html" % (cdp.HOST, srv2.port))
                truthy(r, "the drifted port must actually serve")
                return ("two servers bound %d and %d and both serve; "
                        "run_integration_tests.py hardcodes 8000 and would point the "
                        "browser at whichever one happened to get it"
                        % (srv.port, srv2.port))
            finally:
                srv2.close()
        R.run(["B.1"], "negative", "port drift when 8000 is occupied", b1_neg)

        # B.2 -----------------------------------------------------------
        def b2_spot():
            obs = game.boot(sess, srv, "index.html", "easy")
            R.note_return("game.boot", obs)
            truthy(obs.had_overlay, "index.html must show the difficulty overlay")
            eq(sess.evaluate(_ECON_JS), EASY_ROW, "easy economy row")
            return "booted index.html at easy in %.1fs; viewport %s" % (obs.elapsed_s,
                                                                       obs.viewport)
        R.run(["B.2"], "spotcheck", "desktop boot at easy matches the measured row",
              b2_spot)

        def b2_neg():
            s2 = br.new_session(cdp.MOBILE_VIEWPORT)
            try:
                err = raises(BootError, game.boot, s2, srv, "mobile.html", "easy")
                s3 = br.new_session(cdp.MOBILE_VIEWPORT)
                try:
                    game.boot(s3, srv, "mobile.html", None)
                    eq(s3.evaluate(_ECON_JS), MEDIUM_ROW, "mobile effective economy")
                finally:
                    s3.close()
                s4 = br.new_session(vp)
                try:
                    raises(BootError, game.boot, s4, srv, "index.html", None)
                    raises(TypeError, game.boot, s4, srv, "index.html")
                finally:
                    s4.close()
                return ("mobile+difficulty -> BootError; mobile+None boots and matches "
                        "the medium row; desktop+None -> BootError; OMITTING the "
                        "argument -> TypeError, so there is no silent default")
            finally:
                s2.close()
        R.run(["B.2"], "negative", "overlay/difficulty mismatch raises both ways", b2_neg)

        # B.4 -----------------------------------------------------------
        def b4_spot():
            g = game.grid(sess)
            R.note_return("game.grid", g)
            eq((g.cols, g.rows), (24, 16), "authoritative grid at easy")
            return "sim.gridManager reports %dx%d" % (g.cols, g.rows)
        R.run(["B.4"], "spotcheck", "grid read from sim.gridManager", b4_spot)

        def b4_neg():
            s = br.new_session(vp)
            try:
                s.call("Page.navigate", {"url": srv.url("index.html")})
                s.wait_for("!!(window.Casino && window.Casino.clientInstance)", 20)
                pre = s.evaluate("(function(){var c=window.Casino.clientInstance;"
                                 "return {sim:c.sim, grid:c.state.grid};})()")
                eq(pre["sim"], None, "sim is null before the solo click")
                eq([pre["grid"]["cols"], pre["grid"]["rows"]], [24, 16],
                   "the PLACEHOLDER already reads 24x16")
                err = raises(SceneError, game.grid, s)
                return ("pre-boot placeholder reads 24x16 while sim is null; grid() "
                        "refuses (%s) where a `||24` fallback would have agreed" % err[:60])
            finally:
                s.close()
        R.run(["B.4"], "negative", "pre-boot placeholder must not be readable", b4_neg)

        # B.5 -----------------------------------------------------------
        def b5_spot():
            pts = []
            for (gx, gy) in [(0, 0), (5, 3), (12, 9), (23, 15)]:
                p = game.cell_to_point(sess, gx, gy)
                R.note_return("game.cell_to_point", p)
                eq(game.point_to_cell(sess, p.x, p.y), (gx, gy), "round trip (%d,%d)" % (gx, gy))
                pts.append(p)
            truthy(pts[0].viewport == vp, "geometry must carry its viewport")
            return ("round-trip exact for 4 cells; cellSize=%d offsetX=%d offsetY=%d "
                    "canvas=%gx%g at viewport %s"
                    % (pts[0].cell_size, pts[0].offset_x, pts[0].offset_y,
                       pts[0].canvas_css_w, pts[0].canvas_css_h, vp))
        R.run(["B.5"], "spotcheck", "grid->pixel round-trips, viewport recorded", b5_spot)

        def b5_spot_reread():
            """4.8: cellSize/offsetX/offsetY are derived per resize and change
            mid-run, so cell_to_point must RE-READ them, never cache. Executed by
            changing the viewport under a live session.

            Also checks the viewport amendment's clause 4 -- that the round-trip
            property is viewport-INDEPENDENT while the constants are
            viewport-bound. The suite otherwise round-trips at one viewport only,
            which cannot tell a viewport-independent property from a coincidence."""
            small = cdp.Viewport(900, 700, 1, False)
            a = game.cell_to_point(sess, 5, 3)
            sess.set_viewport(small)
            sess.wait_for("window.innerWidth===%d" % small.width, 5)
            sess.evaluate("window.Casino.clientInstance.resizeCanvas()")
            b = game.cell_to_point(sess, 5, 3)
            rt_small = [game.point_to_cell(sess, *_p) for _p in
                        [(game.cell_to_point(sess, gx, gy).x,
                          game.cell_to_point(sess, gx, gy).y)
                         for (gx, gy) in [(0, 0), (5, 3), (12, 9), (23, 15)]]]
            sess.set_viewport(vp)
            sess.wait_for("window.innerWidth===%d" % vp.width, 5)
            sess.evaluate("window.Casino.clientInstance.resizeCanvas()")
            c = game.cell_to_point(sess, 5, 3)
            truthy(b.cell_size != a.cell_size,
                   "geometry was NOT re-read: cellSize stayed %d across a "
                   "%s -> %s viewport change" % (a.cell_size, vp, small))
            eq(c.cell_size, a.cell_size, "geometry restored with the viewport")
            eq(rt_small, [(0, 0), (5, 3), (12, 9), (23, 15)],
               "round-trip at the SECOND viewport (amendment clause 4)")
            eq(b.viewport, small, "the record must carry the viewport in force")
            return ("cellSize %d @%dx%d -> %d @%dx%d -> %d: re-read per call, never "
                    "cached; round-trip exact at BOTH viewports, so the property is "
                    "viewport-independent while the constants are not"
                    % (a.cell_size, vp.width, vp.height, b.cell_size,
                       small.width, small.height, c.cell_size))
        R.run(["B.5"], "spotcheck", "geometry re-read per call, not cached",
              b5_spot_reread)

        def b5_neg_stale_viewport_label():
            """Geometry must never be reported under a viewport it was not
            measured at (amendment clause 2). `Point.viewport` is a stored label,
            so moving the metrics override behind the toolkit's back used to
            relabel every subsequent measurement silently -- which is the
            unreproducible-geometry failure the amendment exists to stop."""
            other = cdp.Viewport(1024, 640, 1, False)
            sess.call("Emulation.setDeviceMetricsOverride", other.as_dict())
            sess.wait_for("window.innerWidth===%d" % other.width, 5)
            try:
                err = raises(GeometryError, game.cell_to_point, sess, 5, 3)
                truthy("1024x640" in err and str(vp) in err,
                       "the error must name both the live viewport and the stale "
                       "label: %s" % err)
                return err
            finally:
                sess.set_viewport(vp)
                sess.wait_for("window.innerWidth===%d" % vp.width, 5)
                sess.evaluate("window.Casino.clientInstance.resizeCanvas()")
        R.run(["B.5"], "negative", "geometry refuses to be reported under a stale "
              "viewport label", b5_neg_stale_viewport_label)

        def b5_neg():
            """Make rect.width and parentElement.clientWidth diverge, so the two
            candidate preconditions disagree. Only the rect one catches it."""
            sess.evaluate("(function(){var s=document.createElement('style');"
                          "s.id='__vpad';s.textContent='#game-container{padding:40px;}';"
                          "document.head.appendChild(s);"
                          "window.Casino.clientInstance.resizeCanvas();})()")
            try:
                g = sess.evaluate(game._GEOM_JS)
                truthy(g["attrW"] == g["parentW"],
                       "parent-based precondition should STILL hold (%s vs %s)"
                       % (g["attrW"], g["parentW"]))
                truthy(g["attrW"] != g["rectW"],
                       "rect-based precondition must now fail (%s vs %s)"
                       % (g["attrW"], g["rectW"]))
                err = raises(GeometryError, game.cell_to_point, sess, 5, 3)
                return ("with 40px container padding: canvas.width=%s parent.clientWidth=%s "
                        "rect.width=%s -> the parentElement predicate stays GREEN while "
                        "the rect predicate raises (%s)"
                        % (g["attrW"], g["parentW"], g["rectW"], err[:60]))
            finally:
                sess.evaluate("(function(){var s=document.getElementById('__vpad');"
                              "if(s)s.remove();window.Casino.clientInstance.resizeCanvas();})()")
        R.run(["B.5"], "negative", "the two candidate preconditions are separable",
              b5_neg)

        # B.6 / B.7 -----------------------------------------------------
        def b6_spot():
            clear = sess.evaluate(_FIND_CLEAR)
            truthy(clear, "no unoccluded cell found at viewport %s" % (vp,))
            sess.evaluate(_WRAP_HCC)
            game.install_counters(sess, ["mousedown", "mouseup", "click", "mousemove"])
            obs = game.click_cell(sess, clear["x"], clear["y"])
            R.note_return("game.click_cell", obs)
            hcc = sess.evaluate("window.__hcc")
            eq(hcc[-1], [clear["x"], clear["y"]], "handleCellClick cell")
            return "click at (%d,%d) reached handleCellClick; viewport %s" % (
                clear["x"], clear["y"], vp)
        R.run(["B.6"], "spotcheck", "click_cell reaches handleCellClick", b6_spot)

        def b6_neg_mousemove():
            """A FRESH page: InputHandler.mouseGridX/Y start at 0,0 and are
            updated only by mousemove, so a click without one lands on (0,0)."""
            s = br.new_session(vp)
            try:
                game.boot(s, srv, "index.html", "easy")
                s.evaluate(_WRAP_HCC)
                clear = s.evaluate(_FIND_CLEAR_FAR)
                truthy(clear, "no unoccluded cell away from the origin")
                p = game.cell_to_point(s, clear["x"], clear["y"])
                for t in ("mousePressed", "mouseReleased"):
                    s.call("Input.dispatchMouseEvent", {"type": t, "x": p.x, "y": p.y,
                                                        "button": "left",
                                                        "clickCount": 1})
                hcc = s.evaluate("window.__hcc")
                truthy(hcc, "mousedown must still fire the handler")
                eq(hcc[-1], [0, 0], "without mouseMoved the game acts on cell (0,0)")
                return ("aimed at cell (%d,%d), delivered (0,0) -- a confident wrong "
                        "answer, and (0,0) is a wall tile so nothing visibly happens"
                        % (clear["x"], clear["y"]))
            finally:
                s.close()
        R.run(["B.6"], "negative", "omitting mouseMoved acts on cell (0,0)",
              b6_neg_mousemove)

        def b6_neg_occluded():
            occ = sess.evaluate(_FIND_OCCLUDED)
            truthy(occ, "no occluded cell exists at viewport %s -- the occlusion "
                        "fixture cannot be written here and must not be skipped" % (vp,))
            err = raises(OccludedError, game.click_cell, sess, occ["x"], occ["y"])
            truthy("width=%d" % vp.width in err,
                   "error must record the viewport it was measured at: %s" % err)
            if not occ["id"]:
                named = err.split("intercepted by")[1][:80]
                truthy("." in named,
                       "an id-less occluder must be named by tag+class chain, else the "
                       "message degrades to a bare DIV: %r" % named)
            return ("cell (%d,%d) intercepted by <%s class=%r id=%r>; error: %s"
                    % (occ["x"], occ["y"], occ["tag"], occ["cls"], occ["id"], err[:110]))
        R.run(["B.6"], "negative", "occluded cell raises and names the occluder",
              b6_neg_occluded)

        def b6_neg_noid():
            """4.8's occluder is <div class="hud-right"> with NO id, so the
            message must degrade to a class chain rather than a bare DIV."""
            occ = sess.evaluate(_FIND_OCCLUDED_NOID)
            truthy(occ, "no id-less occluder found at viewport %s -- the class-chain "
                        "branch would be untested and must not be skipped" % (vp,))
            err = raises(OccludedError, game.click_cell, sess, occ["x"], occ["y"])
            named = err.split("intercepted by")[1].split("(ancestors")[0]
            truthy("." in named and "#" not in named,
                   "id-less occluder must be named tag.class...: %r" % named)
            return ("cell (%d,%d) intercepted by%s at viewport %s"
                    % (occ["x"], occ["y"], named.rstrip(), vp))
        R.run(["B.6"], "negative", "id-less occluder named by class chain",
              b6_neg_noid)

        def b6_neg_tap_occluded():
            """Both occlusion negatives above drive click_cell, so tap_cell --
            B.6's DEFAULT MOBILE PRIMITIVE -- had no check on its hit-test at all
            and `_require_hit` could be deleted from it with the suite still
            green. The hit-test runs before any dispatch, so the desktop session
            (where an occluded cell is known to exist at this viewport) exercises
            the same guard without needing touch emulation."""
            occ = sess.evaluate(_FIND_OCCLUDED)
            truthy(occ, "no occluded cell at viewport %s -- must not be skipped" % (vp,))
            err = raises(OccludedError, game.tap_cell, sess, occ["x"], occ["y"])
            truthy("width=%d" % vp.width in err,
                   "error must record the viewport it was measured at: %s" % err)
            return ("tap_cell refuses cell (%d,%d), intercepted by <%s>: %s"
                    % (occ["x"], occ["y"], occ["tag"], err[:100]))
        R.run(["B.6"], "negative", "tap_cell refuses an occluded cell too",
              b6_neg_tap_occluded)

        def b6_spot_touch():
            """4.10: mobile is driven by the touch tap, which reaches
            handleCellClick through Chrome's compat layer -- the only path a
            real mobile user takes. Raw mouse dispatch bypasses that layer."""
            m = br.new_session(cdp.MOBILE_VIEWPORT)
            try:
                game.boot(m, srv, "mobile.html", None)
                m.evaluate(_WRAP_HCC)
                game.install_counters(m, ["touchstart", "touchend", "mousemove",
                                          "mousedown", "mouseup", "click"])
                clear = m.evaluate(_FIND_CLEAR)
                truthy(clear, "no unoccluded cell on mobile at %s"
                       % (cdp.MOBILE_VIEWPORT,))
                game.tap_cell(m, clear["x"], clear["y"])
                m.wait_for("(window.__hcc||[]).length>0", 3)
                hcc = m.evaluate("window.__hcc")
                c = game.count_events(m)
                eq(hcc[-1], [clear["x"], clear["y"]], "tap must reach handleCellClick")
                eq(c["touchstart"], 1, "touch dispatched")
                eq(c["mousedown"], 0 if c["mousemove"] == 0 else c["mousedown"],
                   "sanity")
                truthy(c["mousemove"] >= 1,
                       "Chrome's compat layer must synthesise the mousemove that "
                       "InputHandler requires; counters: %s" % c)
                return ("pure Input.dispatchTouchEvent at cell (%d,%d) reached "
                        "handleCellClick; capture counters %s at viewport %s"
                        % (clear["x"], clear["y"], c, cdp.MOBILE_VIEWPORT))
            finally:
                m.close()
        R.run(["B.6"], "spotcheck", "mobile touch tap drives the game", b6_spot_touch)

        def b6_spot_key():
            f = game.focus_target(sess)
            eq(f.sink, False, "a booted page must not start with a text sink "
                              "focused; focus is <%s>" % f.description)
            game.press_key(sess, "e", "KeyE", 69)
            down = sess.evaluate("!!%s.inputHandler.keys['e']" % game.CG)
            eq(down, False, "keyUp must clear the key after the pair")
            sess.call("Input.dispatchKeyEvent", {"type": "keyDown", "key": "e",
                                                 "code": "KeyE",
                                                 "windowsVirtualKeyCode": 69,
                                                 "nativeVirtualKeyCode": 69})
            held = sess.evaluate("!!%s.inputHandler.keys['e']" % game.CG)
            sess.call("Input.dispatchKeyEvent", {"type": "keyUp", "key": "e",
                                                 "code": "KeyE",
                                                 "windowsVirtualKeyCode": 69,
                                                 "nativeVirtualKeyCode": 69})
            truthy(held, "a lone keyDown must leave InputHandler.keys['e'] true")
            return ("press_key leaves keys['e']=False (pair complete); a lone keyDown "
                    "leaves it True -- the pair is what makes it a press")
        R.run(["B.6"], "spotcheck", "press_key issues a complete pair", b6_spot_key)

        def b6_neg_key_sink():
            """press_key's precondition, exercised, and the harm it refuses,
            measured rather than asserted. A text input is planted and focused --
            the ordinary way this happens is a chat field holding focus. Then the
            raw dispatch press_key would have made is issued anyway, and BOTH
            destinations are read back: the field's value and a window-bound
            listener's record of the event. Two destinations is the whole reason
            the guard exists, so if only one fires this check must fail rather
            than pass on a guard protecting nothing."""
            sess.evaluate(
                "(function(){var i=document.createElement('input');"
                "i.id='__vc_sink';i.type='text';document.body.appendChild(i);"
                "window.__vc_seen=[];window.addEventListener('keydown',"
                "function(e){window.__vc_seen.push(e.target.tagName);},false);"
                "i.focus();})()")
            try:
                f = game.focus_target(sess)
                truthy(f.sink, "planted <input> must read as a sink, got %r"
                       % f.description)
                err = raises(InputSinkError, game.press_key, sess, "e", "KeyE", 69)
                truthy("__vc_sink" in err, "error must name the sink: %s" % err)
                for t in ("keyDown", "keyUp"):
                    ev = {"type": t, "key": "e", "code": "KeyE",
                          "windowsVirtualKeyCode": 69, "nativeVirtualKeyCode": 69}
                    if t == "keyDown":
                        ev["text"] = "e"
                    sess.call("Input.dispatchKeyEvent", ev)
                landed = sess.evaluate("document.getElementById('__vc_sink').value")
                seen = sess.evaluate("window.__vc_seen")
                eq(landed, "e", "destination 1: the character reaches the field")
                eq(seen, ["INPUT"],
                   "destination 2: the same keydown reaches a window listener, so "
                   "the field does NOT shield the page -- the ambiguity is real")
                return ("press_key refused (%s); dispatching anyway put %r in the "
                        "field AND delivered keydown to window with target=%s"
                        % (err[:58], landed, seen))
            finally:
                sess.evaluate(
                    "(function(){var i=document.getElementById('__vc_sink');"
                    "if(i){i.blur();i.remove();}delete window.__vc_seen;})()")
        R.run(["B.6"], "negative", "press_key refuses a focused text sink, which "
              "has two destinations", b6_neg_key_sink)

        def b7_spot():
            clear = sess.evaluate(_FIND_CLEAR)
            game.install_counters(sess, ["mousedown", "mouseup", "click"])
            game.click_cell(sess, clear["x"], clear["y"])
            c = game.count_events(sess)
            R.note_return("game.count_events", c)
            eq({k: c[k] for k in ("mousedown", "mouseup", "click")},
               {"mousedown": 1, "mouseup": 1, "click": 1}, "capture counters")
            return "counters after one click: %s" % c
        R.run(["B.7"], "spotcheck", "capture-phase counters count", b7_spot)

        def b7_neg():
            occ = sess.evaluate(_FIND_OCCLUDED)
            truthy(occ, "no occluded cell at this viewport")
            sess.evaluate(_WRAP_HCC)
            game.install_counters(sess, ["mousedown", "mouseup", "click", "mousemove"])
            p = game.cell_to_point(sess, occ["x"], occ["y"])
            for t, b in (("mouseMoved", "none"), ("mousePressed", "left"),
                         ("mouseReleased", "left")):
                sess.call("Input.dispatchMouseEvent", {"type": t, "x": p.x, "y": p.y,
                                                       "button": b, "clickCount": 1})
            c = game.count_events(sess)
            hcc = sess.evaluate("window.__hcc")
            truthy(c.get("mousedown") and c.get("click"),
                   "counters must look healthy: %s" % c)
            eq(hcc, [], "handleCellClick must NOT have fired")
            return ("occluded dispatch produced %s while handleCellClick fired 0 times "
                    "-- an event-counter oracle would have passed" % c)
        R.run(["B.7"], "negative", "healthy counters with zero game effect", b7_neg)

        # B.3 -----------------------------------------------------------
        def b3_spot():
            cell = game.find_legal_cell(sess, "slots")
            R.note_return("game.find_legal_cell", cell)
            truthy(cell, "no legal cell found for slots")
            out = game.act(sess, "PLACE_OBJECT",
                           {"type": "slots", "gridX": cell[0], "gridY": cell[1]}, settle=2.0)
            R.note_return("game.act", out)
            eq(out.changed, True, "placement at a legal cell")
            eq(out.after["placedObjects"] - out.before["placedObjects"], 1, "delta")
            return "PLACE_OBJECT at legal cell %s: placedObjects %d -> %d in %.2fs" % (
                cell, out.before["placedObjects"], out.after["placedObjects"],
                out.settled_after_s)
        R.run(["B.3"], "spotcheck", "act places at a canPlaceObject cell", b3_spot)

        def b3_neg():
            out = game.act(sess, "PLACE_OBJECT",
                           {"type": "slots", "gridX": 3, "gridY": 3}, settle=1.0)
            eq(out.changed, False, "spacing rule rejects (3,3)")
            eq(out.preconditions["cellIsNull"], True,
               "the forbidden precondition would have predicted SUCCESS")
            eq(out.preconditions["canPlaceObject"], False, "the game's own verdict")
            eq(out.preconditions["unlocked"], True, "tech gate is not the cause")
            hire = game.act(sess, "HIRE_EMPLOYEE", {"role": "chef"}, settle=1.0)
            eq(hire.changed, False, "chef is tech-gated")
            bogus = game.act(sess, "HIRE_EMPLOYEE", {"role": "wizard"}, settle=1.0)
            eq(bogus.changed, True, "bogus role is accepted -- no validation")
            return ("(3,3): cellIsNull=True canPlaceObject=False unlocked=True -> the "
                    "grid[y][x]===null precondition predicts success and observes "
                    "failure; chef rejected silently (changed=False); role 'wizard' "
                    "ACCEPTED (employees %d->%d); unscoped drift seen this run: %s"
                    % (bogus.before["employees"], bogus.after["employees"],
                       bogus.unscoped_drift))
        R.run(["B.3"], "negative", "silent rejection and bogus acceptance are visible",
              b3_neg)

        # success criterion 3 ---------------------------------------------
        def reference_runs():
            ref = os.path.join(tree, "tools", "verify", "examples",
                               "reference_check.py")
            p = subprocess.run([sys.executable, ref, scratch], cwd=tree,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               text=True, timeout=180)
            if p.returncode != 0:
                raise AssertionError("reference task rc=%d:\n%s"
                                     % (p.returncode, p.stdout[-600:]))
            return p.stdout.strip().splitlines()[-1]
        R.run(["8.3"], "spotcheck", "reference task passes end to end", reference_runs)

        def reference_claim_is_falsifiable():
            """The claim must be able to be false: swap the roles and the same
            assertions must fail."""
            s = br.new_session(vp)
            try:
                game.boot(s, srv, "index.html", "easy")
                chef = game.act(s, "HIRE_EMPLOYEE", {"role": "chef"}, settle=1.5)
                eq(chef.changed, False, "chef must NOT hire")
                dealer = game.act(s, "HIRE_EMPLOYEE", {"role": "dealer"}, settle=1.5)
                eq(dealer.changed, True, "dealer must hire")
                waitress = game.act(s, "HIRE_EMPLOYEE", {"role": "waitress"},
                                    settle=1.5)
                eq(waitress.changed, True,
                   "waitress is UNGATED too -- only 8 of 10 roles are gated")
                return ("chef changed=False, dealer changed=True, waitress "
                        "changed=True (ungated); the assertions discriminate")
            finally:
                s.close()
        R.run(["8.3"], "negative", "reference claim discriminates roles",
              reference_claim_is_falsifiable)

        # B.8 -----------------------------------------------------------
        def b8_spot():
            obs = game.sim_progress(sess, 1.0)
            R.note_return("game.sim_progress", obs)
            truthy(obs.d_day_timer < 0, "dayTimer must decrease while running: %s" % obs)
            return ("samples %s -> %s (d_dayTimer=%.3f d_currentDay=%d); the verdict "
                    "rule is the caller's" % (obs.first, obs.second, obs.d_day_timer,
                                              obs.d_current_day))
        R.run(["B.8"], "spotcheck", "progress samples move while running", b8_spot)

        def b8_neg():
            sess.evaluate("window.Casino.clientInstance.sim.isRunning=false")
            try:
                obs = game.sim_progress(sess, 1.0)
                eq(obs.d_day_timer, 0, "halted sim must not advance dayTimer")
                eq(obs.d_current_day, 0, "halted sim must not advance currentDay")
                return ("with isRunning=false both deltas are 0, so a caller applying "
                        "the 4.11 rule concludes 'not advanced'")
            finally:
                sess.evaluate("window.Casino.clientInstance.sim.isRunning=true;"
                              "window.Casino.clientInstance.sim.start&&"
                              "window.Casino.clientInstance.sim.start()")
        R.run(["B.8"], "negative", "halted sim reports zero deltas", b8_neg)
    finally:
        br.close()
        srv.close()


# ==========================================================================
def newly_dirty(before: set, after: set) -> list:
    return sorted(after - before)


def main() -> int:
    default_tree = os.path.dirname(os.path.dirname(VERIFY))
    ap = argparse.ArgumentParser()
    ap.add_argument("--tree", default=default_tree,
                    help="tree holding tools/verify and the pages (default: this repo)")
    ap.add_argument("--repo", default=None,
                    help="git repo for archive/ls-files (default: --tree)")
    ap.add_argument("--scratch", default=None, help="default: a fresh temp dir")
    ap.add_argument("--salvage", default="",
                    help="optional: salvage root, enables fixture-provenance "
                         "cross-checking. Absent -> provenance reported UNVERIFIED.")
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    args.repo = args.repo or args.tree
    args.scratch = args.scratch or tempfile.mkdtemp(prefix="verify-selfcheck-")
    os.makedirs(args.scratch, exist_ok=True)

    # Criterion 7 is a DELTA, taken around the whole run and evaluated LAST.
    # Taken as an absolute assertion, and placed 8th of 57, it passed while a
    # toolkit function was appending to a tracked file (measured).
    # This arm covers a --repo that is NOT the package's own tree; the
    # import-time arm (DIRTY_BEFORE_IMPORT, above) covers the tree we imported.
    dirty_before = git_dirty(args.repo)

    R = Registry()
    print("tree=%s repo=%s scratch=%s salvage=%s"
          % (args.tree, args.repo, args.scratch, args.salvage or "(none)"))

    def group(name, items, fn, *a):
        """A group that cannot start is a FAILED CHECK, not a crashed process.
        Without this, a mutation that breaks session setup killed the runner
        before any check ran, and the 'kill' was an unhandled traceback rather
        than a check going red."""
        try:
            fn(*a)
        except Exception as exc:
            R.results.append((items, "spotcheck", "%s group could not start" % name,
                              False, "%s: %s" % (type(exc).__name__, exc)))
            if os.environ.get("VERIFY_TRACE"):
                traceback.print_exc()

    if args.only in ("", "static"):
        group("static", ["C.1"], static_checks, R, args.repo, args.tree,
              args.scratch, args.salvage)
    if args.only in ("", "a"):
        group("A", ["A.2"], a_checks, R, args.scratch)
    if args.only in ("", "b"):
        group("B", ["B.2"], b_checks, R, args.tree, args.scratch)

    # ---- success criterion 7, evaluated after everything else -------------
    added = newly_dirty(dirty_before, git_dirty(args.repo))
    added_at_import = newly_dirty(DIRTY_BEFORE_IMPORT, git_dirty(REPO_ROOT))
    import_only = [p for p in added_at_import if p not in added]
    all_added = sorted(set(added) | set(added_at_import))
    R.results.append((["8.7"], "spotcheck", "toolkit dirtied no tracked file",
                      not all_added,
                      ("files dirtied during this run: %s%s" %
                       (all_added,
                        "; of those, %s were already dirty when main() started, so "
                        "they were written at IMPORT time" % import_only
                        if import_only else ""))
                      if all_added else
                      "0 paths newly dirty in %s (%d already dirty before the run, "
                      "which is not this suite's business); 0 newly dirty in %s "
                      "measured from BEFORE the package import, so import-time "
                      "writes are inside the window too"
                      % (args.repo, len(dirty_before), REPO_ROOT)))

    def clean_delta_can_fire():
        """Prove the delta detector is not vacuous, in a throwaway repo."""
        rp = os.path.join(args.scratch, "cleanprobe")
        os.makedirs(rp, exist_ok=True)
        for cmd in (["git", "init", "-q"], ["git", "config", "user.email", "a@b"],
                    ["git", "config", "user.name", "t"]):
            subprocess.run(cmd, cwd=rp, stdout=subprocess.DEVNULL)
        open(os.path.join(rp, "tracked.txt"), "w").write("one\n")
        subprocess.run(["git", "add", "-A"], cwd=rp, stdout=subprocess.DEVNULL)
        subprocess.run(["git", "commit", "-qm", "x"], cwd=rp, stdout=subprocess.DEVNULL)
        b = git_dirty(rp)
        open(os.path.join(rp, "tracked.txt"), "a").write("two\n")
        a = git_dirty(rp)
        got = newly_dirty(b, a)
        if got != ["tracked.txt"]:
            raise AssertionError("delta detector did not see the write: %r" % got)
        return "writing a tracked file in a throwaway repo yields %r" % got
    R.run(["8.7"], "negative", "clean-tree delta detector fires on a real write",
          clean_delta_can_fire)

    # 7.3 rule 2, dynamic arm
    runtime_problems = scan.runtime_return_problems(R.returns)
    R.results.append((["7.3"], "negative", "no observed bare-bool return",
                      not runtime_problems, "; ".join(runtime_problems)
                      or "%d public returns inspected, none a bare bool" % len(R.returns)))

    width = max(len(n) for _i, _k, n, _o, _d in R.results)
    print("=" * 100)
    for items, kind, name, ok, detail in R.results:
        print("%-4s %-9s %-*s  %s" % ("ok" if ok else "FAIL", kind, width, name,
                                      ",".join(items)))
        if detail:
            print("       %s" % str(detail).replace("\n", "\n       "))
    print("=" * 100)

    spot = {}
    neg = {}
    for items, kind, _n, ok, _d in R.results:
        for it in items:
            (spot if kind == "spotcheck" else neg).setdefault(it, []).append(ok)

    print("coverage map (spotcheck / negative-control per numbered component):")
    gaps = []
    for it in ITEMS:
        s, n = len(spot.get(it, [])), len(neg.get(it, []))
        flag = "" if (s and n) else "   <-- GAP"
        if not (s and n):
            gaps.append(it)
        print("  %-5s spot=%d neg=%d%s" % (it, s, n, flag))
    extra = sorted(set(spot) | set(neg) - set(ITEMS) - set(spot))
    for it in sorted((set(spot) | set(neg)) - set(ITEMS)):
        print("  %-5s spot=%d neg=%d   (success criterion, not a numbered item)"
              % (it, len(spot.get(it, [])), len(neg.get(it, []))))

    failed = [n for _i, _k, n, ok, _d in R.results if not ok]
    n_neg = sum(1 for _i, k, _n, _o, _d in R.results if k == "negative")
    print("-" * 100)
    print("checks run           : %d" % len(R.results))
    print("negative controls    : %d" % n_neg)
    print("numbered items       : %d of %d fully covered" % (len(ITEMS) - len(gaps),
                                                             len(ITEMS)))
    print("failures             : %d %s" % (len(failed), failed or ""))

    rc = 0
    if failed:
        rc = 1
    if n_neg == 0:
        print("FAIL: zero negative controls -- a run with no negative control is a "
              "failed run (spec 7.5)")
        rc = 1
    if gaps and not args.only:
        print("FAIL: numbered items without both a spotcheck and a negative control: %s"
              % gaps)
        rc = 1
    print("RESULT: %s" % ("PASS" if rc == 0 else "FAIL"))
    print("SCOPE: %s. The specific gaps are named, one heading each, in %s -- do "
          "not quote this run as proof that a banned pattern is absent."
          % (RATCHET_SENTENCE, os.path.relpath(DOC, REPO_ROOT)))
    return rc


if __name__ == "__main__":
    sys.exit(main())
