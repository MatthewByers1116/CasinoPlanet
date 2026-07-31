"""Negative-control fixtures for the banned-pattern scan (spec 7.2/7.4).

Every line below is a deliberate violation that the scan MUST flag. Each is an
inline literal, never a reference to live source, so it cannot self-invalidate
when the code it describes is fixed (spec 4.12's lesson).

Each carries `src=` provenance. `src=<root>/<file>:<line>` is verified by the
scan: the cited line's text must be literally contained in the fixture line, so
"quoted verbatim from the salvage" is an executed check. `src=none:<reason>` is
allowed, counted, and reported by run.py, because two of the banned patterns
have ZERO instances in the 65 salvaged scripts (measured) and a fixture that
claimed salvage provenance it does not have would be a straw man.

Nothing in this module is ever called.
"""
import shutil
import subprocess
import time

SALVAGE = "salvage"


def _salvage_recursive_copy(SRC, D1):
    subprocess.run(["rm", "-rf", D1]); subprocess.run(["cp", "-r", SRC, D1])  # BANNED-FIXTURE: copy-tree src=salvage/2558875c-a459-4e88-9338-1a8a688e0b1d__d1.py:10


def _library_recursive_copy(src, dst):
    shutil.copytree(src, dst)  # BANNED-FIXTURE: copy-tree src=none:no-salvage-instance-the-five-observed-uses-are-all-shell-list-form


def _salvage_spin_wait():
    while True:
        time.sleep(0.01)  # BANNED-FIXTURE: sleep src=salvage/87686510-95b5-4e9b-b2b1-afc516554de8__specloop-mobile2__cdp.py:120


def evaluate_salvage_sentinel(res):
    """The truthy error sentinel of spec 4.1 #3: indistinguishable from real
    data, because evaluating ({__exception__:'x'}) returns exactly this."""
    if res:
        return {"__exception__": res["exceptionDetails"]}  # BANNED-FIXTURE: evaluate-sentinel src=salvage/87686510-95b5-4e9b-b2b1-afc516554de8__specloop-mobile2__cdp.py:130
    return None


GRID_FALLBACK_ATTR = "const G=CG.state.grid;const Wd=G.width||24,Hd=G.height||16;"  # BANNED-FIXTURE: grid-fallback src=salvage/2558875c-a459-4e88-9338-1a8a688e0b1d__desk2.py:38

GRID_FALLBACK_PAREN = "const W=(G&&(G.width||G.cols))||24,H=(G&&(G.height||G.rows))||16; let ok=0,tot=0;"  # BANNED-FIXTURE: grid-fallback src=salvage/2558875c-a459-4e88-9338-1a8a688e0b1d__mob.py:70

BROADCAST_KILL = 'pkill -f "remote-debugging-port=9401"'  # BANNED-FIXTURE: proc-kill src=none:zero-instances-in-65-salvaged-scripts-hazard-reproduced-as-a-shell-command-spec-4.5

SERVE_PORT_LINE = 'print(f"Casino Planet is running at: http://localhost:{free_port}")'  # BANNED-FIXTURE: loopback-host src=repo/serve.py:55
