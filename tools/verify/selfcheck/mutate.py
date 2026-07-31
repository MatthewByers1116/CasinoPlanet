#!/usr/bin/env python3
"""Mutation runner (success criterion 2).

For each entry in mutations.json: copy the tree, apply the edit, run run.py
against the mutant, and require a NON-ZERO exit. A mutation that leaves the
suite green is reported as SURVIVED and makes this runner exit non-zero.

The mutation table is data, not source, because several replacement strings are
themselves banned patterns and would make the scan red in the file that merely
describes them.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MARKER_TOKEN = "# BANNED-" + "FIXTURE:"


def load() -> list:
    with open(os.path.join(HERE, "mutations.json"), encoding="utf-8") as fh:
        return json.load(fh)["mutations"]


def copy_tree(src: str, dst: str) -> None:
    os.makedirs(dst, exist_ok=True)
    tar = subprocess.Popen(["tar", "-C", src, "-cf", "-", "."],
                           stdout=subprocess.PIPE)
    untar = subprocess.Popen(["tar", "-C", dst, "-xf", "-"], stdin=tar.stdout)
    tar.stdout.close()
    untar.wait()
    tar.wait()


class BrokenAnchor(Exception):
    """The table names source text that is no longer there (or is now ambiguous).

    This is NOT the same failure as a surviving mutation and must never be
    reported as one. A survivor means the toolkit has a hole; a broken anchor
    means the table is stale after an ordinary edit. Raising SystemExit here --
    which is what this used to do -- aborted the whole sweep at the first stale
    row: the operator saw exit 1, identical to a survivor, while every later
    mutation silently never ran. Found the hard way, by editing an import line
    that M38 was anchored on.
    """


def apply_edits(root: str, edits: list) -> list:
    applied = []
    for rel, old, new in edits:
        old = old.replace("@@MARKER@@", MARKER_TOKEN)
        new = new.replace("@@MARKER@@", MARKER_TOKEN)
        path = os.path.join(root, rel)
        text = open(path, encoding="utf-8").read()
        if old not in text:
            raise BrokenAnchor("ANCHOR MISSING in %s: %r" % (rel, old[:160]))
        if text.count(old) != 1:
            raise BrokenAnchor("ANCHOR NOT UNIQUE (%d) in %s: %r"
                               % (text.count(old), rel, old[:120]))
        open(path, "w", encoding="utf-8").write(text.replace(old, new, 1))
        applied.append("%s (%d chars)" % (rel, len(old)))
    return applied


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tree", required=True)
    ap.add_argument("--repo", default="")
    ap.add_argument("--salvage", default="")
    ap.add_argument("--work", required=True)
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    rows = []
    broken = []
    selected = [m for m in load() if not args.only or args.only in m["id"]]
    for mut in selected:
        root = os.path.join(args.work, mut["id"])
        scratch = os.path.join(args.work, mut["id"] + "-scratch")
        subprocess.run(["rm", "-rf", root, scratch])
        copy_tree(args.tree, root)
        try:
            applied = apply_edits(root, mut["edits"])
        except BrokenAnchor as exc:
            # Report and keep going: one stale row must not cost the coverage of
            # every row after it.
            broken.append((mut["id"], str(exc)))
            print("%-38s *** BROKEN ANCHOR *** %s" % (mut["id"], exc))
            subprocess.run(["rm", "-rf", root, scratch])
            continue
        os.makedirs(scratch, exist_ok=True)
        # --tree is the mutant, and --repo DEFAULTS to it, so a mutation that
        # writes a tracked file lands in the disposable copy, never in the real
        # repo. --salvage is optional (provenance is reported UNVERIFIED without
        # it) so the suite stays runnable off this machine.
        cmd = [sys.executable, os.path.join(root, "tools/verify/selfcheck/run.py"),
               "--tree", root, "--scratch", scratch]
        if args.salvage:
            cmd += ["--salvage", args.salvage]
        p = subprocess.run(
            cmd,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=900)
        reds = [ln for ln in p.stdout.splitlines() if ln.startswith("FAIL")]
        killed = p.returncode != 0
        rows.append((mut["id"], killed, p.returncode, reds, mut["expect"]))
        print("%-38s rc=%-3d %s" % (mut["id"], p.returncode,
                                    "KILLED" if killed else "*** SURVIVED ***"))
        for r in reds[:6]:
            print("      %s" % r.rstrip())
        if not killed:
            print("      full output tail:\n%s" % p.stdout[-1500:])
        subprocess.run(["rm", "-rf", root, scratch])

    survived = [r[0] for r in rows if not r[1]]
    print("=" * 90)
    print("mutations selected: %d" % len(selected))
    print("mutations applied : %d" % len(rows))
    print("killed            : %d" % (len(rows) - len(survived)))
    print("SURVIVED          : %d %s" % (len(survived), survived))
    print("BROKEN ANCHORS    : %d %s" % (len(broken), [b[0] for b in broken]))
    for mid, msg in broken:
        print("      %s: %s" % (mid, msg))
    if len(rows) + len(broken) != len(selected):
        print("*** %d selected mutation(s) neither ran nor were reported broken"
              % (len(selected) - len(rows) - len(broken)))
        return 1
    # Both are failures, and they are different failures: a survivor means the
    # toolkit has a hole, a broken anchor means this table is stale. Never let
    # one be read as the other -- the exit code alone cannot tell them apart, so
    # the counts above are the report, not the return value.
    return 1 if (survived or broken) else 0


if __name__ == "__main__":
    sys.exit(main())
