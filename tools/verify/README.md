# `tools/verify/` — shared agent verification toolkit

Infrastructure for driving this game from an agent: CDP plumbing and Chrome
lifecycle (`cdp.py`), boot/scene/input (`game.py`), sandbox + build + report
scanning (`static.py`), and the toolkit's own structural scans (`scan.py`).

Everything here returns **observations** — values, ledgers, counts, elapsed
times, records. Nothing here returns a verdict about game behaviour; the caller
writes the assertion. That separation is what `scan.py` enforces.

```sh
python3 tools/verify/selfcheck/run.py                 # the self-check suite; exits non-zero on any failure
python3 tools/verify/selfcheck/mutate.py --tree . --work <scratch>
```

`hooks/pre-commit.sample` is **not installed**. Wire it yourself if you want it.

---

## What "structurally enforced" means here — READ THIS BEFORE QUOTING A GREEN RUN

**Scope of the claim: this suite is a RATCHET, not a sound gate: it catches the
idiomatic spelling a cooperating author would write, not a deliberate bypass by
an author who knows the detector.**

- A **ratchet** reliably catches the pattern as a cooperating author would
  accidentally write it: `time.sleep(0.5)`, a new module with a `-> bool`
  oracle in it, a `cp -r` sandbox, a `grid.width || 24` fallback.
- A **sound gate** would resist an author who knows the detector and is trying
  to get around it. **This suite is not one, and no finite set of AST heuristics
  can be one.** Three review rounds each produced a fresh bypass of the previous
  round's rules; that is the regress the ratchet scope exists to end.

So: a green run means *no ordinary spelling of a banned pattern is present in
the tree that was scanned*. It does **not** mean the pattern is absent. Every
run prints this same scope line under `RESULT:` so it cannot be read off as a
gate, and `selfcheck/run.py` fails if this document stops stating it.

The gaps are named below, one heading each, with the spelling that defeats each
detector. A limit written as "best-effort" would be worthless; each of these
says what specifically gets through.

---

## Named limits

### L1 — the fixed-sleep ban is name-based, so an indirect reference to the sleep function escapes it

`scan.detect_sleep` flags a call whose terminal attribute is `sleep` on `time`
or `asyncio`, resolving aliases that the *same module* introduces
(`import time as _clock`, `from time import sleep as nap`). Anything that
reaches the same function without producing that name in that module's own
imports is invisible: aliasing through a plain assignment (`_c = time`, then
`_c.sleep(1)`), re-export through a third module (`from .util import clock`),
`getattr(time, "sl" + "eep")(1)`, `__import__("time").sleep(1)`.

The ban's *intent* is wider than any of this: it is "no fixed blocking wait".
The detector does not cover other ways to block at all —
`threading.Event().wait(1.0)`, `subprocess.run(["sleep", "1"])`,
`select.select([], [], [], 1.0)`, `socket.settimeout` + a blocking read,
`os.system`. The enforcement requirements name `time.sleep` as the detector, so
the implementation matches what was asked; the ban is phrased more broadly than
the detector can enforce, and that difference is this limit.

Not a limit: the single permitted call site. `sleep-sites` / `sleep-home` /
`poll-callers` do pin the one blocking wait to `cdp.py::_poll_interval` and its
two callers, so *renaming the helper* and *calling it in a loop* are both
caught (M29, M30).

### L2 — the bare-bool return rule compares annotation names, so a bool alias it cannot see escapes it

7.3 rule 2 rejects a public function annotated `-> bool`, including through
module-level aliases resolved transitively (`Verdict = bool` then
`-> Verdict`; M39). It resolves aliases **defined in the module being scanned**
and only as a plain `Name`. These get through: an alias imported from elsewhere
(`from .types import Verdict`), a stringised annotation (`-> "Verdict"`), a
subscripted one (`-> Optional[bool]`, `-> Union[bool, None]`), `typing.NewType`,
a subclass of `bool`, and a function annotated as something else that returns a
bool anyway.

The dynamic arm is a partial backstop: bare-bool returns actually *observed*
during a run are rejected whatever the annotation said — but it only sees the
public returns the suite happens to exercise (22 of them on the last run), not
every public function.

### L3 — the fixture-tree exemption is closed by an import ban, which is itself name-based

Deliberate violations live under `selfcheck/fixtures/` with a per-line
`BANNED-FIXTURE:` marker. Nothing stops that exempt code from being *called*
from a shipped module, which would make the per-line exemption a
directory-wide one — measured: a marked helper there, called from
`game.boot()`, slept a real 1.00 s while the scan reported clean and the
laundered line *raised* reported coverage 1 → 2.

`scan.caller_tree_import_problems` closes the reachable spellings: a static
`import`/`from ... import` naming `selfcheck`/`fixtures`/`examples`, and a
run-time import via a call whose terminal name is one of `import_module`,
`__import__`, `spec_from_file_location`, `module_from_spec`, `exec_module`,
`load_module`, `run_module`, `run_path` (matched on the terminal name, so
`import importlib as il; il.import_module(...)` is caught, and a dynamic import
with a non-literal argument is rejected outright).

What still gets through: reaching the code without any import at all —
`exec(open("selfcheck/fixtures/util.py").read())`, an `importlib` call built by
`getattr`, a `sys.path` edit plus an import spelled in a string, or simply
copying the fixture's text into a shipped module (which the pattern detectors
would then flag on its own line, so this last one is only a laundering path for
patterns whose detector has its own gap above).

### L4 — A.2's `PUT /json/new` rule has no mutation that can turn it red

The rule (any new target uses **PUT**, never GET) is asserted directly: the
suite measures `GET /json/new` → 405 and `PUT` → 200. That assertion is about
**Chrome**, not about this toolkit, so no edit to `tools/verify/` can falsify
it, and `M18-json-new-uses-get` is killed by the *group could not start*
failure rather than by a check written for the rule. Per this toolkit's own
standard — every rule is a check plus a mutation that has been run and shown to
fail — the rule is therefore **dropped from the falsifiable set** and kept only
as a recorded observation of Chrome's behaviour on this machine. If Chrome ever
starts accepting GET, the spotcheck goes red for a reason unrelated to any
change here.

### L5 — success criterion 8.1 (per-item coverage) carries no mutation

`run.py` prints the spotcheck/negative-control map over the 20 numbered
components and exits non-zero if any item lacks either kind. That is the
runner's own bookkeeping over its own registry: any mutation of it is a
mutation of the reporting code, not of a toolkit behaviour, so there is no
edit to `cdp.py`/`game.py`/`static.py`/`scan.py` that makes it fail. Stated as
an omission rather than counted as an enforced rule.

### L6 — success criterion 8.3 (the reference task) carries no mutation

`examples/reference_check.py` verifies one real behavioural claim end to end
and is asserted to be ≤ 40 lines. The claim discriminates (`dealer` hires,
`chef` is silently rejected, `waitress` is ungated), which is what makes the
example worth shipping — but a mutation of the *toolkit* does not make a
31-line file exceed 40 lines, and mutating the example is mutating a caller,
not the infrastructure. No mutation is claimed for this row.

### L7 — success criterion 8.4 (no browser plumbing in the caller) carries no mutation

The thinness detector and its negative control deliberately share one
implementation (`thin_report`), so a broken spotcheck cannot hide behind a
healthy-looking control. The cost of that choice is that the row has no
independent mutation: the only way to make it red is to edit the example
caller, which no mutation in `mutations.json` does.

### L8 — the 7.3 exports scan does not scan the two caller-side subtrees

Module coverage is discovered by walking `tools/verify/`, so a newly added
module is scanned with no edit to any list (this replaced a hardcoded
four-filename tuple under which the shipped `errors.py` was never scanned at
all). Two subtrees are excluded: `selfcheck/` and `examples/`. They are
caller-side code whose job is to write assertions, so the name rule and the
return rule would ban exactly what the design requires them to contain.

Consequence: a verdict-shaped, bool-returning oracle placed in
`selfcheck/` or `examples/` is not flagged by the exports scan. What keeps that
from being a laundering route is L3's import ban — a shipped module may not
import from either subtree — so such an oracle cannot become part of the API
7.3 protects. Widening `CALLER_SUBTREES` would widen this hole, and nothing
here detects that; it would show up only as the scanned-module count dropping,
which every run prints.

---

## Known defects, recorded rather than hidden

- **A.7's `teardown reaps the specific child` is environmentally flaky.** The
  failing assertion is `per-instance user-data-dir removed`, not the reap:
  `Browser.close()` reaps its own `Popen` child (never a pattern-matching
  process killer) and then removes the profile directory, and under load
  Chrome's shutdown can leave files behind. Observed here roughly 1 run in 10
  when other Chrome instances are alive; **the mechanism was not captured** — 28
  launch/close cycles under instrumentation (8 with a session, 10 bare, 10 with a
  second browser and a live session open) reproduced it 0 times, and in-check
  instrumentation never fired in 6 further runs, so the retry now in
  `Browser.close()` is a hardening, not a verified fix. `close()` records what
  survived in `profile_leftovers` so the next occurrence is diagnosable instead
  of mysterious. Do not read a single green run as proof this is fixed.
- **Byte-code caches.** Importing the package writes
  `tools/**/__pycache__/`, which is untracked, so criterion 7's literal wording
  ("`git status --porcelain` is empty") is unsatisfiable once `tools/verify/` is
  tracked. `run.py` sets `sys.dont_write_bytecode` and exports
  `PYTHONDONTWRITEBYTECODE=1` to every subprocess *before* importing the
  package, rather than excluding `__pycache__` from the criterion-7 delta — an
  exclusion would be a hole in the one check that catches stray writes.
- **Fixture provenance is unverified without `--salvage`.** The salvage lives in
  an ephemeral agent-artifacts directory. Without the root, salvage-rooted
  provenance is skipped and every run prints `provenance UNVERIFIED for N
  fixture(s)`; the `repo`-rooted arm still resolves everywhere.
- **Three of the six banned patterns have no salvage instance to quote.** The
  broadcast process killer (`proc-kill`, spelled out only in
  `selfcheck/fixtures/patterns.json` — naming it here would trip the scan on
  this file), the loopback hostname (`loopback-host`) and `shutil.copytree`
  occur **0** times across the 65 salvaged scripts, so their fixtures carry an
  explicit `none:<reason>`
  provenance and the run prints the unsourced count. The bans stay (the
  process-killer hazard was reproduced first-hand, exit 144), but the fixtures
  are prospective, not evidential.
- **`M03-no-cache-disable` is caught structurally, not behaviourally.** The
  check asserts `Network.setCacheDisabled` was *issued*, not that a second load
  missed the cache; no reliable cache-hit signal from a fresh headless profile
  was established.

## Machine facts this toolkit depends on

Bare `python` does not exist here (`python3` is 3.12.3). Chrome 150 is at
`/usr/local/bin/chrome`, and its **effective argv is not the argv you pass** —
it re-execs for headless and injects `--noerrdialogs`,
`--ozone-platform=headless`, `--ozone-override-screen-size=800,600`,
`--use-angle=swiftshader-webgl`. That injected screen size is why unpinned
geometry measurements did not reproduce, which is why every session pins a
`Viewport` via `Emulation.setDeviceMetricsOverride` **before** navigating and
every geometry-bearing record carries it. `/json/new` needs PUT, not GET.
Always `127.0.0.1`. `console.error` arrives on `Runtime.consoleAPICalled`, not
`Log.entryAdded`. An argv-substring process matcher matches its own invoking
shell and kills it (exit 144), so teardown holds the `Popen` handle.

`run_integration_tests.py` sets `success` solely from
`"Detailed Step Logs" in content` and cannot report failure. It is not invoked
by this toolkit or by any of its evidence, and must not be quoted as one.
