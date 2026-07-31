# Mutations — success criterion 2

The authoritative list is `mutations.json`, which `mutate.py` executes. This file
explains why each entry exists. **If the two disagree, the JSON is what runs**;
`mutate.py` refuses to start when an anchor is missing or non-unique, so the list
cannot silently rot.

Run:

```
python3 tools/verify/selfcheck/mutate.py \
    --tree <repo> --repo <repo> --salvage <salvage dir> --work <scratch>
```

Each mutation is applied to a fresh copy of the tree; `run.py` must exit
**non-zero**. A mutation that leaves the suite green is reported as `SURVIVED`
and makes `mutate.py` itself exit non-zero.

| id | what it breaks | which check must go red |
|---|---|---|
| M01 | `evaluate()` returns a sentinel instead of raising | A.4 negative; 7.4 `evaluate-sentinel` |
| M02 | restores the `\|\|24`/`\|\|16` grid fallback | B.4 negative; 7.4 `grid-fallback` |
| M03 | removes `Network.setCacheDisabled` | A.3 spotcheck |
| M04 | gives the reader socket a finite timeout | A.1 spotcheck |
| M05 | drops the `mouseMoved` before `mousePressed` | B.6 spotcheck |
| M06 | removes `cell_to_point`'s geometry precondition | B.5 negative |
| M07 | weakens it to `parentElement.clientWidth` | B.5 negative |
| M08 | replaces `canPlaceObject` with `grid[gy][gx] === null` | B.3 negative |
| M09 | removes the hit-test from the input primitives | B.6 negatives |
| M10 | gives `boot()` a default difficulty | B.2 negative |
| M11 | downgrades the recursive-copy detector to a substring | 7.4 |
| M12 | makes `sim_progress()` return a bare `bool` | 7.3 both arms; B.8 spotcheck |
| M13 | puts an exemption marker in non-fixture code | 7.4 `stray-marker` |
| M14 | excludes the fixture directory from the scan wholesale | 7.4 `pattern-uncovered` |
| M15 | drops the viewport pin | A.3 spotcheck |
| M16 | adds a second blocking-wait call site | 7.4 `sleep-sites` |
| M17 | renames a build observation to a verdict-shaped name | 7.3 name rule |
| M18 | uses GET instead of PUT on `/json/new` | *"A/B group could not start"* — **not** a check written for the PUT rule; see limit **L4** in `../README.md` |
| M19 | ledger stops reading `Log.entryAdded` | A.5 spotcheck |
| M20 | `wait_for` reports a throwing predicate as "not ready" | A.6 negative |
| M21 | teardown leaks the per-instance user-data-dir | A.7 spotcheck |
| M22 | `serve()` hardcodes 8000 instead of parsing | B.1 negative |
| M23 | `count_events` returns an empty dict | B.7 spotcheck |
| M24 | `sandbox()` accepts a tree containing `.git` | C.1 negative |
| M25 | `id_contract()` stops parsing the checker's verdict | C.2 spotcheck |
| M26 | `split_row` drops pipe-escape handling | C.4 negative |
| M27 | `strip_inline_scripts` becomes a no-op | C.5 spotcheck + negative |
| M28 | build keeps the stale output instead of deleting it first | C.3 negative |
| M29 | renames the one permitted blocking-wait helper | 7.4 `sleep-home` (function name) |
| M30 | calls that helper 50 times in a row | 7.4 `poll-callers` |
| M31 | adds `Session.sim_advanced() -> bool` (a METHOD) | 7.3 both rules |
| M32 | puts a verdict word in the MIDDLE of a name | 7.3 name rule |
| M33 | makes a toolkit function write a tracked file | 8.7 clean-tree delta |
| M34 | points a fixture's provenance at a missing file | 7.4 `bad-provenance` |
| M35 | makes the sample hook gate on the id contract's verdict | 8.5 hook spotcheck |
| M36 | caches derived geometry instead of re-reading it | B.5 re-read spotcheck |
| M37 | hides a fixed sleep behind `import time as _clock` | 7.4 `sleep-sites` |
| M38 | launders a violation through the fixture tree | 7.4 `caller-tree-import` |
| M39 | hides a bare bool behind `Verdict = bool` | 7.3 return rule |
| M40 | makes the sample hook unrunnable | 8.5 spotcheck **and negative** |
| M41 | replaces discovered module coverage with a hardcoded four-filename list | 7.3 spotcheck + discovery negative |
| M42 | removes run-time-import detection, reopening the fixture tree | 7.4 `caller-tree-import` negative |
| M43 | samples criterion 7's baseline *after* the package import | 8.7 import-time negative |
| M44 | downgrades the documented ratchet limit to "best-effort" | AM2 spotcheck |
| M45 | lets the run write byte-code caches | 8.7 spotcheck |
| M46 | makes the hook read an unparseable id-contract verdict as `0` | 8.5 ratchet negative |
| M47 | reports geometry under a stale viewport label | B.5 stale-label negative |

M29-M40 exist because independent reviewers broke the first versions of these rules by
hand — M36-M40 correspond to mutations a reviewer wrote that SURVIVED. Each is now a
standing test rather than an argument.

M41-M43 are the three ratchet defects a reviewer executed against the previous
version: a module the fixed list never named, `importlib.import_module` reaching
past the static import walk, and an import-time write landing outside criterion
7's window. Each fails against a **cooperating** author — no evasion needed — so
each is a fixed defect with a mutation rather than a documented limit. M44/M45
guard the two things that fix made binding: the scope statement in
`tools/verify/README.md`, and the byte-code suppression that makes criterion 7's
literal wording satisfiable at all. **M46** is iteration-3 finding 5 (the hook's
ratchet disabling itself when it cannot read a count), and **M47** came from
re-verifying the never-reviewed viewport amendment instead of inheriting it:
`Point.viewport` is a stored label, so geometry could be reported under a viewport
it was not measured at.

**Scope reminder.** Every detector these mutations protect is a RATCHET, not a sound
gate. A mutation being killed shows the rule catches the ordinary spelling of the
defect; it does not show the rule cannot be worked around. The specific gaps are
named, one heading each, in `../README.md` (L1-L8).

Every one of the 20 numbered components now has at least one mutation:
A.1 M04 · A.2 M18 · A.3 M03/M15 · A.4 M01 · A.5 M19 · A.6 M20 · A.7 M21 ·
B.1 M22 · B.2 M10 · B.3 M08 · B.4 M02 · B.5 M06/M07 · B.6 M05/M09 · B.7 M23 ·
B.8 M12 · C.1 M24 · C.2 M25 · C.3 M28/M17 · C.4 M26 · C.5 M27.

## Mutations deliberately NOT on this list

**A canvas-scale term.** Spec 4.8 removed it because `canvas.width / rect.width`
is 1.0 at every `deviceScaleFactor` measured, so both branches compute identical
values and the mutation could not fail. It is replaced by M06/M07, which *can*:
40px of padding on `#game-container` makes `rect.width` (1200) diverge from
`canvas.width` (1280) while `parentElement.clientWidth` stays at 1280, so the
two candidate preconditions are separable at runtime and the weaker one is
provably weaker.

**"Teardown must terminate the specific child."** The *property* is demonstrated by
A.7's negative control (launch two browsers, close one, assert the sibling is still
alive), not by a mutation: a mutation that skips `terminate()` leaves headless
chrome processes running for the rest of the mutation run, and reaping them would
need exactly the argv-substring matcher spec 4.5 forbids. M21 mutates the
user-data-dir cleanup instead, which is falsifiable without leaking. Stated rather
than papered over.

**"`--window-size` must not be passed."** Unenforceable as stated on this
machine: the running chrome carries `--noerrdialogs --ozone-platform=headless
--ozone-override-screen-size=800,600 --use-angle=swiftshader-webgl`, none of
which we passed. The source is **Chrome's own headless re-exec**, not the
`/usr/local/bin/chrome -> /usr/bin/google-chrome-stable` wrapper: that wrapper is
the stock one, ends in `exec -a "$0" "$HERE/chrome" "$@"`, injects nothing, and
there is no `/etc/chromium.d` and no chrome env var set (verified). A.2 asserts
`BASE_FLAGS ⊆ effective argv` and *records* the injected set instead.
