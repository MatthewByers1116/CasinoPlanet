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


def apply_edits(root: str, edits: list) -> list:
    applied = []
    for rel, old, new in edits:
        old = old.replace("@@MARKER@@", MARKER_TOKEN)
        new = new.replace("@@MARKER@@", MARKER_TOKEN)
        path = os.path.join(root, rel)
        text = open(path, encoding="utf-8").read()
        if old not in text:
            raise SystemExit("ANCHOR MISSING in %s:\n%r" % (rel, old[:160]))
        if text.count(old) != 1:
            raise SystemExit("ANCHOR NOT UNIQUE (%d) in %s: %r"
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
    for mut in load():
        if args.only and args.only not in mut["id"]:
            continue
        root = os.path.join(args.work, mut["id"])
        scratch = os.path.join(args.work, mut["id"] + "-scratch")
        subprocess.run(["rm", "-rf", root, scratch])
        copy_tree(args.tree, root)
        applied = apply_edits(root, mut["edits"])
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
    print("mutations applied : %d" % len(rows))
    print("killed            : %d" % (len(rows) - len(survived)))
    print("SURVIVED          : %d %s" % (len(survived), survived))
    return 1 if survived else 0


if __name__ == "__main__":
    sys.exit(main())
