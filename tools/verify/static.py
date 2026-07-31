"""Static analysis, sandboxing and build verification (spec component C).

Every entry point returns an observation record. No function name or return
value encodes a pass/fail judgement (spec 7.3); `identical`/`wrote` are
*fields* of a record describing what happened.
"""
from __future__ import annotations

import hashlib
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Optional

from .errors import SandboxError


# --------------------------------------------------------------------------
# C.1 sandbox
# --------------------------------------------------------------------------
@dataclass
class SandboxObservation:
    path: str
    source: str            # 'HEAD' | 'worktree'
    file_count: int
    has_dot_git: bool


def sandbox(repo: str, dst: str) -> SandboxObservation:
    """C.1 -- `git archive HEAD | tar -x`. cp -r is forbidden: it nests
    directories and drags .git along as payload."""
    os.makedirs(dst, exist_ok=True)
    ar = subprocess.run(["git", "archive", "HEAD"], cwd=repo,
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if ar.returncode != 0:
        raise SandboxError("git archive failed: %s" % ar.stderr.decode("utf-8", "replace")[:200])
    tar = subprocess.run(["tar", "-x", "-C", dst], input=ar.stdout,
                         stderr=subprocess.PIPE)
    if tar.returncode != 0:
        raise SandboxError("tar -x failed: %s" % tar.stderr.decode("utf-8", "replace")[:200])
    return _observe_tree(dst, "HEAD")


def sandbox_worktree(repo: str, dst: str) -> SandboxObservation:
    """C.3 -- git archive cannot see uncommitted edits, so the worktree sandbox
    is populated from `git ls-files -z`, preserving paths."""
    os.makedirs(dst, exist_ok=True)
    ls = subprocess.run(["git", "ls-files", "-z"], cwd=repo,
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if ls.returncode != 0:
        raise SandboxError("git ls-files failed")
    for rel in ls.stdout.split(b"\0"):
        if not rel:
            continue
        r = rel.decode()
        src = os.path.join(repo, r)
        if not os.path.exists(src):
            continue
        out = os.path.join(dst, r)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(src, "rb") as fh, open(out, "wb") as oh:
            oh.write(fh.read())
    return _observe_tree(dst, "worktree")


def _observe_tree(dst: str, source: str) -> SandboxObservation:
    n = 0
    has_git = os.path.exists(os.path.join(dst, ".git"))
    for _root, dirs, files in os.walk(dst):
        if ".git" in dirs:
            has_git = True
        n += len(files)
    if has_git:
        raise SandboxError("sandbox at %s contains .git -- not a clean export" % dst)
    return SandboxObservation(dst, source, n, has_git)


# --------------------------------------------------------------------------
# C.2 id contract -- invoke the committed checker, do not reimplement it
# --------------------------------------------------------------------------
@dataclass
class IdContractObservation:
    returncode: int
    problem_count: Optional[int]
    tier1: list
    tier2_unwaived: list
    fixtures_line: Optional[str]
    stdout: str


_PROBLEMS_RE = re.compile(r"FAILED \((\d+) problem\(s\)\)")
_T1_RE = re.compile(r"^\s*\* TIER 1 (.+)$", re.M)
_T2_RE = re.compile(r"^\s*\* TIER 2 (.+)$", re.M)
_FIX_RE = re.compile(r"^classifier fixtures\s*:.*$", re.M)


def id_contract(root: str) -> IdContractObservation:
    p = subprocess.run([sys.executable, "tools/check_id_contract.py"], cwd=root,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    m = _PROBLEMS_RE.search(p.stdout)
    fx = _FIX_RE.search(p.stdout)
    return IdContractObservation(
        p.returncode, int(m.group(1)) if m else (0 if p.returncode == 0 else None),
        _T1_RE.findall(p.stdout), _T2_RE.findall(p.stdout),
        fx.group(0).strip() if fx else None, p.stdout)


# --------------------------------------------------------------------------
# C.3 build observations
# --------------------------------------------------------------------------
@dataclass
class BuildObservation:
    question: str            # human-readable: which question this answers
    script: str
    output: str
    wrote: bool              # did the script actually create the file this run?
    returncode: int          # recorded, NEVER gated on (spec 4.1 #5)
    output_md5: Optional[str]
    tracked_md5: Optional[str]
    identical: Optional[bool]
    stderr_tail: str = ""


def _md5(path: str) -> Optional[str]:
    if not os.path.exists(path):
        return None
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _run_build(root: str, script: str, output: str, question: str) -> BuildObservation:
    out = os.path.join(root, output)
    tracked = _md5(out)
    if os.path.exists(out):
        os.remove(out)                     # so a silent no-op cannot look clean
    p = subprocess.run([sys.executable, script], cwd=root,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    wrote = os.path.exists(out)
    got = _md5(out)
    return BuildObservation(question, script, output, wrote, p.returncode, got, tracked,
                            None if (got is None or tracked is None) else got == tracked,
                            (p.stderr or "")[-400:])


def build_from_head(sandbox_root: str) -> BuildObservation:
    """Answers: does HEAD's source reproduce HEAD's committed artifact?
    Blind to uncommitted work -- see build_from_worktree."""
    return _run_build(sandbox_root, "build_single_file.py", "CasinoPlanet.html",
                      "does HEAD's source reproduce HEAD's committed artifact?")


def build_from_worktree(sandbox_root: str) -> BuildObservation:
    """Answers: do the *current working-tree* sources reproduce the tracked
    artifact? Requires a sandbox built by sandbox_worktree()."""
    return _run_build(sandbox_root, "build_single_file.py", "CasinoPlanet.html",
                      "do my current edits reproduce the tracked artifact?")


# --------------------------------------------------------------------------
# C.4 report parsing -- ASCII status word, pipe-escape aware
# --------------------------------------------------------------------------
@dataclass
class ReportObservation:
    rows: list
    failing: list
    statuses: dict = field(default_factory=dict)


def split_row(line: str) -> list:
    """C.4 defect fix: a note containing an *escaped* pipe must not truncate."""
    cells, cur, i = [], [], 0
    while i < len(line):
        ch = line[i]
        if ch == "\\" and i + 1 < len(line) and line[i + 1] == "|":
            cur.append("|")
            i += 2
            continue
        if ch == "|":
            cells.append("".join(cur).strip())
            cur = []
            i += 1
            continue
        cur.append(ch)
        i += 1
    cells.append("".join(cur).strip())
    if cells and cells[0] == "":
        cells.pop(0)
    if cells and cells[-1] == "":
        cells.pop()
    return cells


def parse_report(text: str) -> ReportObservation:
    """Keys on the ASCII word inside status.upper(), so encoding damage around
    it is irrelevant. Only the table section is read; a 'FAIL' appearing solely
    in the log prose must not register (negative control `log_only`)."""
    rows, failing, statuses = [], [], {}
    body = text.split("Detailed Step Logs")[0]
    for line in body.splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = split_row(line)
        if len(cells) < 2:
            continue
        if set("".join(cells).replace(" ", "")) <= set("-:"):
            continue
        name, status = cells[0], cells[1]
        up = status.upper()
        if "PASS" in up:
            kind = "PASS"
        elif "FAIL" in up:
            kind = "FAIL"
        else:
            continue
        rows.append((name, kind, cells[2:] if len(cells) > 2 else []))
        statuses[name] = kind
        if kind == "FAIL":
            failing.append(name)
    return ReportObservation(rows, failing, statuses)


# --------------------------------------------------------------------------
# C.5 HTML id scanner that really strips inline <script>
# --------------------------------------------------------------------------
_SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script\s*>", re.S | re.I)
_ID_RE = re.compile(r"""\bid\s*=\s*["']([^"']+)["']""")


def strip_inline_scripts(html: str) -> str:
    return _SCRIPT_RE.sub("", html)


@dataclass
class HtmlIdObservation:
    ids: set
    ids_including_scripts: set
    stripped_chars: int


def page_ids(html: str) -> HtmlIdObservation:
    """C.5 -- the comment and the body must agree: ids that appear only inside
    an inline <script> are runtime-injected markup, not page markup."""
    stripped = strip_inline_scripts(html)
    return HtmlIdObservation(set(_ID_RE.findall(stripped)),
                             set(_ID_RE.findall(html)),
                             len(html) - len(stripped))
