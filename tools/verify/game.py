"""Game driving and scene setup (spec component B).

Infrastructure only. Every public entry point returns an *observation*; none
returns a pass/fail judgement about game behaviour (spec 7.3).
"""
from __future__ import annotations

import re
import subprocess
import sys
import threading
from dataclasses import dataclass, field
from typing import Any, Optional

from .cdp import DESKTOP_VIEWPORT, HOST, MOBILE_VIEWPORT, Session, Viewport
from .errors import (BootError, GeometryError, InputSinkError, OccludedError,
                     SceneError)

CANVAS_ID = "game-canvas"
CG = "window.Casino.clientInstance"

# B.1 -- token-free: extracts the port without naming the host (7.4 bans the
# literal host token inside tools/verify/).
PORT_RE = re.compile(r"running at:\s*https?://[^:/]+:(\d+)")


@dataclass
class Server:
    proc: subprocess.Popen
    port: int
    root: str

    def url(self, page: str) -> str:
        return "http://%s:%d/%s" % (HOST, self.port, page)

    def close(self) -> None:
        self.proc.terminate()
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait(timeout=10)


def serve(root: str, timeout: float = 20.0) -> Server:
    """B.1 -- start serve.py with sys.executable and parse the port it prints."""
    proc = subprocess.Popen([sys.executable, "serve.py"], cwd=root,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    box: dict[str, Any] = {}
    done = threading.Event()

    def read() -> None:
        for line in proc.stdout:                      # type: ignore[union-attr]
            m = PORT_RE.search(line)
            if m:
                box["port"] = int(m.group(1))
                done.set()
                break
    t = threading.Thread(target=read, daemon=True)
    t.start()
    if not done.wait(timeout):
        proc.kill()
        raise BootError("serve.py did not print a port line within %.0fs" % timeout)
    return Server(proc, box["port"], root)


# --------------------------------------------------------------------------
# B.2 boot
# --------------------------------------------------------------------------
_DIFFICULTIES = ("easy", "medium", "hard", "gambler")


@dataclass
class BootObservation:
    page: str
    difficulty: Optional[str]
    viewport: Viewport
    had_overlay: bool
    elapsed_s: float


def boot(sess: Session, server: Server, page: str, difficulty: Optional[str],
         timeout: float = 30.0) -> BootObservation:
    """B.2 -- `difficulty` is positional-required. Passing None is how a page
    with no difficulty overlay (mobile.html) is booted; omitting it is a
    TypeError from Python itself."""
    if difficulty is not None and difficulty not in _DIFFICULTIES:
        raise BootError("unknown difficulty %r" % (difficulty,))
    t0 = _now()
    sess.call("Page.navigate", {"url": server.url(page)})
    _need(sess, "document.readyState==='complete'", timeout, "readyState")
    _need(sess, "!!(window.Casino && window.Casino.clientInstance)", timeout, "clientInstance")
    sess.evaluate("document.getElementById('mode-solo-btn').click()")
    _need(sess, "!!(%s.sim && %s.sim.isRunning)" % (CG, CG), timeout, "sim.isRunning")

    # Branch on OVERLAY presence, never on button presence: mobile.html ships
    # dead unbound #difficulty-*-btn markup (spec 4.7).
    has_overlay = bool(sess.evaluate(
        "!!document.getElementById('difficulty-overlay')"))
    if has_overlay:
        if difficulty is None:
            raise BootError("%s has a difficulty overlay; difficulty=None is invalid" % page)
        sess.evaluate("document.getElementById('difficulty-%s-btn').click()" % difficulty)
        _need(sess,
              "getComputedStyle(document.getElementById('difficulty-overlay')).display==='none'",
              timeout, "overlay dismissed")
    else:
        if difficulty is not None:
            raise BootError(
                "%s has no #difficulty-overlay; pass difficulty=None explicitly" % page)
    return BootObservation(page, difficulty, sess.viewport, has_overlay, _now() - t0)


def _need(sess: Session, pred: str, timeout: float, what: str) -> None:
    obs = sess.wait_for(pred, timeout)
    if obs.status != "satisfied":
        raise BootError("boot stalled at %s: %s (last=%r after %.1fs)"
                        % (what, obs.status, obs.last_value, obs.elapsed_s))


def _now() -> float:
    import time
    return time.monotonic()


# --------------------------------------------------------------------------
# B.4 grid
# --------------------------------------------------------------------------
@dataclass
class GridObservation:
    cols: int
    rows: int


def grid(sess: Session) -> GridObservation:
    """B.4 -- authoritative sim.gridManager only. No `|| 24` fallback."""
    v = sess.evaluate(
        "(function(){var c=%s;if(!c||!c.sim||!c.sim.gridManager)return null;"
        "var g=c.sim.gridManager;return {cols:g.cols,rows:g.rows};})()" % CG)
    if not v or v.get("cols") is None or v.get("rows") is None:
        raise SceneError("sim.gridManager.cols/rows unavailable (sim booted?)")
    return GridObservation(int(v["cols"]), int(v["rows"]))


# --------------------------------------------------------------------------
# B.5 geometry
# --------------------------------------------------------------------------
@dataclass
class Point:
    x: float
    y: float
    cell_size: int
    offset_x: int
    offset_y: int
    canvas_css_w: float
    canvas_css_h: float
    viewport: Viewport          # amendment clause 2: geometry carries its viewport


_GEOM_JS = """
(function(){
  var c = %s;
  var cv = document.getElementById('%s');
  if(!c || !cv) return null;
  var r = cv.getBoundingClientRect();
  return {cell:c.cellSize, ox:c.offsetX, oy:c.offsetY,
          left:r.left, top:r.top, rectW:r.width, rectH:r.height,
          attrW:cv.width, attrH:cv.height,
          parentW:cv.parentElement.clientWidth,
          innerW:window.innerWidth, innerH:window.innerHeight};
})()
""" % (CG, CANVAS_ID)


def _geometry(sess: Session) -> dict:
    """Read the derived geometry, and refuse to report it under a viewport label
    that is not the one in force.

    Amendment clause 2 requires geometry to carry its viewport. `Point.viewport`
    is `sess.viewport`, a STORED value, so anything that moves the metrics
    override without updating it -- e.g. a caller issuing
    `Emulation.setDeviceMetricsOverride` directly, which was the only way to
    change viewport before `Session.set_viewport()` existed -- makes every
    subsequent record claim a viewport it was not measured at. That is precisely
    the unreproducible-geometry failure the amendment was written about, so the
    mismatch RAISES instead of being recorded wrongly.
    """
    g = sess.evaluate(_GEOM_JS)
    if not g:
        raise GeometryError("canvas/clientInstance not available")
    vp = sess.viewport
    if (g["innerW"], g["innerH"]) != (vp.width, vp.height):
        raise GeometryError(
            "the live viewport is %dx%d but this session is labelled %s -- geometry "
            "measured now would be recorded under the wrong viewport. Change "
            "viewport with Session.set_viewport(), which updates the label."
            % (g["innerW"], g["innerH"], vp))
    return g


def cell_to_point(sess: Session, gx: int, gy: int) -> Point:
    """B.5 -- geometry re-read per call; no canvas-scale term.

    The precondition is `canvas.width === canvas.getBoundingClientRect().width`
    -- the quantity InputHandler.js:46-48 actually divides by. See plan D1.
    """
    g = _geometry(sess)
    if g["attrW"] != g["rectW"]:
        raise GeometryError(
            "canvas.width (%s) != getBoundingClientRect().width (%s) at viewport %s; "
            "the game divides by rect.width (InputHandler.js:46-48) so the "
            "no-scale-term transform is invalid here"
            % (g["attrW"], g["rectW"], sess.viewport))
    return Point(
        x=g["left"] + g["ox"] + (gx + 0.5) * g["cell"],
        y=g["top"] + g["oy"] + (gy + 0.5) * g["cell"],
        cell_size=g["cell"], offset_x=g["ox"], offset_y=g["oy"],
        canvas_css_w=g["rectW"], canvas_css_h=g["rectH"], viewport=sess.viewport)


def point_to_cell(sess: Session, x: float, y: float) -> tuple[int, int]:
    g = _geometry(sess)
    import math
    return (math.floor((x - g["left"] - g["ox"]) / g["cell"]),
            math.floor((y - g["top"] - g["oy"]) / g["cell"]))


# --------------------------------------------------------------------------
# B.6 input
# --------------------------------------------------------------------------
_HITTEST_JS = """
(function(x,y,id){
  var el = document.elementFromPoint(x,y);
  var want = document.getElementById(id);
  if(!el) return {hit:false, desc:'(nothing at point)'};
  var ok = !!(want && want.contains(el));
  var d = el.tagName.toLowerCase();
  if(el.id) d += '#'+el.id;
  var cls = (el.className && el.className.baseVal!==undefined)
            ? el.className.baseVal : el.className;
  if(cls && typeof cls === 'string' && cls.trim()) d += '.'+cls.trim().split(/\\s+/).join('.');
  var chain=[], p=el.parentElement, n=0;
  while(p && n<3){ var s=p.tagName.toLowerCase(); if(p.id) s+='#'+p.id;
    var pc=(typeof p.className==='string')?p.className:'';
    if(pc && pc.trim()) s+='.'+pc.trim().split(/\\s+/).join('.');
    chain.push(s); p=p.parentElement; n++; }
  return {hit:ok, desc:d, chain:chain};
})(%r,%r,%r)
"""


@dataclass
class HitTest:
    hit: bool
    description: str
    ancestors: list


def hit_test(sess: Session, x: float, y: float, expected_id: str = CANVAS_ID) -> HitTest:
    r = sess.evaluate(_HITTEST_JS % (x, y, expected_id))
    return HitTest(bool(r["hit"]), r["desc"], r.get("chain") or [])


def _require_hit(sess: Session, p: Point, gx: int, gy: int, expected_id: str) -> None:
    h = hit_test(sess, p.x, p.y, expected_id)
    if not h.hit:
        raise OccludedError(
            "cell (%d,%d) -> client (%.1f,%.1f) is intercepted by <%s> (ancestors: %s) "
            "at viewport %s" % (gx, gy, p.x, p.y, h.description, " < ".join(h.ancestors),
                                p.viewport))


@dataclass
class InputObservation:
    gx: int
    gy: int
    point: Point
    kind: str
    mouse_grid_after: tuple


def click_cell(sess: Session, gx: int, gy: int) -> InputObservation:
    """B.6 -- mouseMoved BEFORE mousePressed is mechanically required: mousedown
    reads InputHandler.mouseGridX/Y, updated only by mousemove (spec 4.8)."""
    p = cell_to_point(sess, gx, gy)
    _require_hit(sess, p, gx, gy, CANVAS_ID)
    sess.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": p.x, "y": p.y,
                                           "button": "none", "clickCount": 0})
    sess.call("Input.dispatchMouseEvent", {"type": "mousePressed", "x": p.x, "y": p.y,
                                           "button": "left", "clickCount": 1})
    sess.call("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": p.x, "y": p.y,
                                           "button": "left", "clickCount": 1})
    return InputObservation(gx, gy, p, "mouse", _mouse_grid(sess))


def tap_cell(sess: Session, gx: int, gy: int) -> InputObservation:
    """B.6 -- two-call touch sequence; the real mobile user path (spec 4.10).
    Requires Emulation.setTouchEmulationEnabled, done in start_session for a
    mobile viewport."""
    p = cell_to_point(sess, gx, gy)
    _require_hit(sess, p, gx, gy, CANVAS_ID)
    tp = [{"x": p.x, "y": p.y, "radiusX": 5, "radiusY": 5, "force": 1}]
    sess.call("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": tp})
    sess.call("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    return InputObservation(gx, gy, p, "touch", _mouse_grid(sess))


_FOCUS_JS = """
(function(){
  var el = document.activeElement;
  if (!el || el === document.body) return {sink:false, desc:'body'};
  var tag = el.tagName.toLowerCase();
  var type = (el.getAttribute && el.getAttribute('type')) || 'text';
  var sink = !!el.isContentEditable || tag === 'textarea' || tag === 'select' ||
    (tag === 'input' &&
     !/^(button|submit|reset|checkbox|radio|file|image|range|color)$/i.test(type));
  var d = tag;
  if (el.id) d += '#' + el.id;
  var cls = (typeof el.className === 'string') ? el.className : '';
  if (cls && cls.trim()) d += '.' + cls.trim().split(/\\s+/).join('.');
  if (tag === 'input') d += '[type=' + type + ']';
  return {sink: sink, desc: d};
})()
"""


@dataclass
class FocusTarget:
    sink: bool
    description: str


def focus_target(sess: Session) -> FocusTarget:
    """Who will receive the next key event, and would it swallow it."""
    r = sess.evaluate(_FOCUS_JS)
    return FocusTarget(bool(r["sink"]), r["desc"])


def _require_no_sink(sess: Session, key: str) -> FocusTarget:
    f = focus_target(sess)
    if f.sink:
        raise InputSinkError(
            "key %r has two destinations: the focused text-entry element <%s> AND "
            "the page's own listeners. Blur it before dispatching, or nothing "
            "measured afterwards can be attributed to one or the other."
            % (key, f.description))
    return f


def press_key(sess: Session, key: str, code: str, vk: int) -> str:
    """B.6's third input primitive.

    PRECONDITION SEMANTICS. A key event carries no coordinates, so the point
    hit-test the two pointer primitives perform has no meaning here; the
    equivalent question is *who receives it*. A key goes to
    `document.activeElement` and bubbles up from there, so a focused text field
    does NOT shield the page -- measured on this game, whose InputHandler binds
    keydown/keyup on `window` (`src/client/InputHandler.js:27,37`): with an
    <input> focused, the character lands in the field AND the window listener
    fires with `target=INPUT`. The refusal is therefore about ambiguity, not
    interception: two destinations, no way to attribute what follows.

    This is deliberately narrower than the pointer hit-test and is NOT a claim
    that the game has a listener bound for this key -- nothing here can know
    that. Previously the function dispatched with no precondition at all while
    the plan described all three input primitives as guarded before dispatch;
    stating and enforcing this one is the resolution."""
    _require_no_sink(sess, key)
    for t in ("keyDown", "keyUp"):
        sess.call("Input.dispatchKeyEvent", {"type": t, "key": key, "code": code,
                                             "windowsVirtualKeyCode": vk,
                                             "nativeVirtualKeyCode": vk})
    return key


def _mouse_grid(sess: Session) -> tuple:
    v = sess.evaluate(
        "(function(){var h=%s.inputHandler;return h?[h.mouseGridX,h.mouseGridY]:null;})()" % CG)
    return tuple(v) if v else ()


# --------------------------------------------------------------------------
# B.7 capture-phase event counters
# --------------------------------------------------------------------------
def install_counters(sess: Session, types: list) -> None:
    """Idempotent: re-installing must not double-count. (Found by the B.7
    spotcheck, which read 2 after two installs.)"""
    sess.evaluate(
        "(function(){if(window.__vcH){window.__vcH.forEach(function(h){"
        "document.removeEventListener(h[0],h[1],true);});}"
        "window.__vc={};window.__vcH=[];var ts=%s;ts.forEach(function(t){"
        "window.__vc[t]=0;var f=function(){window.__vc[t]++;};"
        "window.__vcH.push([t,f]);document.addEventListener(t,f,true);});})()"
        % (list(types),))


def count_events(sess: Session) -> dict:
    """B.7 -- distinguishes 'never fired' from 'handler no-op'ed' (spec 4.13)."""
    return sess.evaluate("window.__vc || {}") or {}


# --------------------------------------------------------------------------
# B.3 act / preconditions / find_legal_cell
# --------------------------------------------------------------------------
_SNAP_JS = """
(function(){
  var s = %s.sim; if(!s) return null;
  return {chips: s.economyManager.chips,
          placedObjects: s.gridManager.placedObjects.size,
          employees: s.employees.size,
          guests: s.guests.size};
})()
""" % CG


@dataclass
class ActionOutcome:
    action: str
    payload: dict
    before: dict
    after: dict
    changed: bool
    settled_after_s: float
    preconditions: dict
    fields_changed: list = field(default_factory=list)
    unscoped_drift: list = field(default_factory=list)


def _preconditions(sess: Session, action: str, payload: dict) -> dict:
    if action == "PLACE_OBJECT":
        js = ("(function(t,x,y){var s=%s.sim;"
              "return {unlocked: s.unlockedTechs.indexOf(t)>=0,"
              " canPlaceObject: !!s.gridManager.canPlaceObject(t,x,y),"
              " cellIsNull: s.gridManager.grid[y][x]===null,"
              " chips: s.economyManager.chips};})(%r,%r,%r)"
              % (CG, payload["type"], payload["gridX"], payload["gridY"]))
        return sess.evaluate(js)
    if action == "HIRE_EMPLOYEE":
        js = ("(function(r){var s=%s.sim;"
              "var gated=['chef','scientist','manager','security','tech_support',"
              "'entertainer','stocker','janitor'];"
              "var cost=s.getDynamicStaffHiringCost(r);"
              "return {roleIsGated: gated.indexOf(r)>=0,"
              " unlocked: s.unlockedTechs.indexOf(r)>=0,"
              " cost: cost, affordable: !!s.economyManager.canAfford(cost),"
              " chips: s.economyManager.chips};})(%r)" % (CG, payload["role"]))
        return sess.evaluate(js)
    return {}


# Which snapshot fields a command can affect. `changed` is computed over these
# ONLY: the sim free-runs, so guests.size (and chips, via income/salary) drift
# on their own and an unscoped diff reports "changed" for every action.
ACTION_FIELDS = {
    "PLACE_OBJECT": ("placedObjects",),
    "HIRE_EMPLOYEE": ("employees",),
}


def act(sess: Session, action: str, payload: dict, settle: float,
        fields: Optional[tuple] = None) -> ActionOutcome:
    """B.3 -- the scene-population entry point. Returns an observation and never
    raises on 'the action had no effect'; that judgement belongs to the caller.

    `settle` is a wait_for window, not a sleep: the poll exits early the moment
    the snapshot changes, and reports `changed=False` if it never does.
    """
    watch = fields or ACTION_FIELDS.get(action)
    if not watch:
        raise SceneError("no scoped fields known for %r; pass fields=(...)" % action)
    pre = _preconditions(sess, action, payload)
    before = sess.evaluate(_SNAP_JS)
    if before is None:
        raise SceneError("sim is null; cannot act")
    sess.evaluate("window.__vsnap=%s" % _json(before))
    cmd = ("window.Casino.Protocol.Commands.%s" % action)
    sess.evaluate("%s.sendAction(%s, %s)" % (CG, cmd, _json(payload)))
    changed_js = ("(function(){var a=(%s), b=window.__vsnap;"
                  "if(!a) return false;"
                  "return %s.some(function(k){return a[k]!==b[k];});})()"
                  % (_SNAP_JS.strip(), _json(list(watch))))
    obs = sess.wait_for(changed_js, settle)
    after = sess.evaluate(_SNAP_JS)
    diff = [k for k in watch if after.get(k) != before.get(k)]
    drift = [k for k in before if k not in watch and after.get(k) != before.get(k)]
    return ActionOutcome(action, payload, before, after, bool(diff), obs.elapsed_s,
                         pre, diff, drift)


def find_legal_cell(sess: Session, obj_type: str) -> Optional[tuple]:
    """B.3 -- scans with the game's own canPlaceObject, never `grid[y][x]===null`
    (that predicts success for cells the 1-tile-diagonal rule rejects)."""
    v = sess.evaluate(
        "(function(t){var g=%s.sim.gridManager;"
        "for(var y=0;y<g.rows;y++)for(var x=0;x<g.cols;x++)"
        "if(g.canPlaceObject(t,x,y))return [x,y];return null;})(%r)" % (CG, obj_type))
    return tuple(v) if v else None


# --------------------------------------------------------------------------
# B.8 sim progress -- samples only, never the verdict (spec 7.3 / 4.11)
# --------------------------------------------------------------------------
@dataclass
class ProgressObservation:
    first: dict
    second: dict
    d_day_timer: float
    d_current_day: int
    window_s: float


def sim_progress(sess: Session, window: float) -> ProgressObservation:
    js = ("(function(){var s=%s.sim;return s?{dayTimer:s.dayTimer,"
          "currentDay:s.currentDay}:null;})()" % CG)
    a = sess.evaluate(js)
    if a is None:
        raise SceneError("sim is null; cannot sample progress")
    sess.wait_for("false", window)      # a poll window, not a sleep
    b = sess.evaluate(js)
    return ProgressObservation(a, b, b["dayTimer"] - a["dayTimer"],
                               b["currentDay"] - a["currentDay"], window)


def _json(obj: Any) -> str:
    import json
    return json.dumps(obj)


DESKTOP = DESKTOP_VIEWPORT
MOBILE = MOBILE_VIEWPORT
