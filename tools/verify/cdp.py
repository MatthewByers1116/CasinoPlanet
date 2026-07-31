"""CDP plumbing and Chrome lifecycle (spec component A).

Infrastructure only: this module drives the browser and reports observations.
It contains no assertion, threshold or oracle about game behaviour.
"""
from __future__ import annotations

import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import threading
import time
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Optional, Sequence

from .errors import JSEvaluationError, TransportError

CHROME = "/usr/local/bin/chrome"
HOST = "127.0.0.1"

# A.2 -- one flag set, fixed by decision (spec 4.13: no converged set exists).
BASE_FLAGS = (
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--disable-dev-shm-usage",
)

POLL_INTERVAL_S = 0.02


def _poll_interval() -> None:
    """The single permitted blocking-wait call site in tools/verify/.

    scan.py asserts there is exactly one `time.sleep` call site outside the
    fixtures tree and that it is this function.
    """
    time.sleep(POLL_INTERVAL_S)


# --------------------------------------------------------------------------
# Viewport (orchestrator amendment: geometry is meaningless unpinned)
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class Viewport:
    width: int
    height: int
    device_scale_factor: float
    mobile: bool

    def as_dict(self) -> dict:
        return {
            "width": self.width,
            "height": self.height,
            "deviceScaleFactor": self.device_scale_factor,
            "mobile": self.mobile,
        }


DESKTOP_VIEWPORT = Viewport(1280, 800, 1, False)
MOBILE_VIEWPORT = Viewport(390, 844, 3, True)


# --------------------------------------------------------------------------
# A.1 transport
# --------------------------------------------------------------------------
class _WS:
    """RFC6455 client. The reader socket timeout is set once, to None, during
    construction; nothing afterwards mutates it (A.1)."""

    def __init__(self, url: str, connect_timeout: float = 10.0):
        if not url.startswith("ws://"):
            raise TransportError("not a ws:// url: %r" % (url,))
        rest = url[5:]
        hostport, _, path = rest.partition("/")
        path = "/" + path
        host, _, port = hostport.partition(":")
        self.s = socket.create_connection((host, int(port or 80)), timeout=connect_timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            "GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\n"
            "Connection: Upgrade\r\nSec-WebSocket-Key: %s\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n" % (path, hostport, key)
        )
        self.s.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = self.s.recv(4096)
            if not chunk:
                raise TransportError("websocket handshake closed early")
            buf += chunk
        head, _, tail = buf.partition(b"\r\n\r\n")
        if b"101" not in head.split(b"\r\n")[0]:
            raise TransportError("websocket handshake failed: %s" % head.decode("utf-8", "replace"))
        self.buf = tail
        # Set once, here. A finite reader timeout is the 4.4 defect.
        self.s.settimeout(None)
        self._send_lock = threading.Lock()

    def _recv_exact(self, n: int) -> bytes:
        while len(self.buf) < n:
            chunk = self.s.recv(65536)
            if not chunk:
                raise TransportError("websocket closed by peer")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send(self, text: str) -> None:
        payload = text.encode()
        hdr = bytearray([0x81])
        n = len(payload)
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126)
            hdr += struct.pack(">H", n)
        else:
            hdr.append(0x80 | 127)
            hdr += struct.pack(">Q", n)
        mask = os.urandom(4)
        hdr += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        with self._send_lock:
            try:
                self.s.sendall(bytes(hdr) + masked)
            except OSError as exc:
                raise TransportError("websocket send failed: %r" % (exc,)) from exc

    def recv(self) -> str:
        while True:
            b0, b1 = self._recv_exact(2)
            opcode = b0 & 0x0F
            ln = b1 & 0x7F
            if ln == 126:
                ln = struct.unpack(">H", self._recv_exact(2))[0]
            elif ln == 127:
                ln = struct.unpack(">Q", self._recv_exact(8))[0]
            data = self._recv_exact(ln)
            if opcode == 0x8:
                raise TransportError("websocket close frame")
            if opcode == 0x9:
                continue
            if opcode in (0x1, 0x2):
                return data.decode("utf-8", "replace")

    def close(self) -> None:
        try:
            self.s.close()
        except OSError:
            pass


@dataclass
class LedgerEntry:
    channel: str          # 'response' | 'exceptionThrown' | 'logEntry'
    text: str
    detail: Any = None
    seq: int = 0


@dataclass
class Ok:
    value: Any


@dataclass
class Threw:
    details: dict


@dataclass
class WaitObservation:
    status: str            # 'satisfied' | 'timed_out' | 'threw'
    elapsed_s: float
    last_value: Any = None
    last_type: Optional[str] = None
    error: Optional[str] = None


class Session:
    """One CDP page session."""

    def __init__(self, ws_url: str, viewport: Viewport):
        self.viewport = viewport
        self.target_id = ""
        self.sent_methods: list = []
        self.ws = _WS(ws_url)
        self._id = 0
        self._lock = threading.Lock()
        self._pending: dict[int, dict] = {}
        self._events: list[dict] = []
        self._waiters: dict[int, threading.Event] = {}
        self._seq = 0
        self.ledger: list[LedgerEntry] = []
        self.pump_error: Optional[BaseException] = None
        self._stop = False
        self._thread = threading.Thread(target=self._pump, daemon=True, name="cdp-pump")
        self._thread.start()

    # -- A.1 pump records its terminating exception -------------------------
    def _pump(self) -> None:
        try:
            while not self._stop:
                msg = json.loads(self.ws.recv())
                with self._lock:
                    self._seq += 1
                    seq = self._seq
                    if "id" in msg:
                        self._pending[msg["id"]] = msg
                        ev = self._waiters.get(msg["id"])
                    else:
                        ev = None
                        self._events.append(msg)
                        self._record_event(msg, seq)
                if ev is not None:
                    ev.set()
        except BaseException as exc:          # recorded, never swallowed
            self.pump_error = exc
            with self._lock:
                waiters = list(self._waiters.values())
            for ev in waiters:
                ev.set()

    # -- A.5 exception ledger, both channels + Log --------------------------
    def _record_event(self, msg: dict, seq: int) -> None:
        method = msg.get("method")
        if method == "Runtime.exceptionThrown":
            det = msg["params"]["exceptionDetails"]
            self.ledger.append(LedgerEntry("exceptionThrown", _describe(det), det, seq))
        elif method == "Log.entryAdded":
            entry = msg["params"]["entry"]
            if entry.get("level") == "error":
                self.ledger.append(LedgerEntry("logEntry", entry.get("text", ""), entry, seq))

    def _pump_alive(self) -> bool:
        return self._thread.is_alive() and self.pump_error is None

    def call(self, method: str, params: Optional[dict] = None, timeout: float = 20.0) -> dict:
        if not self._pump_alive():
            raise TransportError(
                "CDP reader thread is dead (%r); transport unusable" % (self.pump_error,))
        ev = threading.Event()
        with self._lock:
            self._id += 1
            mid = self._id
            self._waiters[mid] = ev
        self.sent_methods.append(method)
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        ev.wait(timeout)
        with self._lock:
            self._waiters.pop(mid, None)
            msg = self._pending.pop(mid, None)
        if msg is None:
            if not self._pump_alive():
                raise TransportError(
                    "CDP reader thread died while awaiting %s: %r" % (method, self.pump_error))
            raise TransportError("no CDP response for %s within %.1fs" % (method, timeout))
        return msg

    # -- A.4 evaluate raises; never returns a sentinel ----------------------
    def evaluate(self, expr: str, await_promise: bool = False, timeout: float = 20.0) -> Any:
        r = self.call("Runtime.evaluate", {
            "expression": expr, "returnByValue": True,
            "awaitPromise": await_promise, "userGesture": True,
        }, timeout=timeout)
        res = r.get("result", {})
        if "exceptionDetails" in res:
            det = res["exceptionDetails"]
            with self._lock:
                self._seq += 1
                self.ledger.append(LedgerEntry("response", _describe(det), det, self._seq))
            raise JSEvaluationError(_describe(det))
        return res.get("result", {}).get("value")

    def evaluate_allowing_throw(self, expr: str, timeout: float = 20.0) -> Ok | Threw:
        r = self.call("Runtime.evaluate", {
            "expression": expr, "returnByValue": True, "userGesture": True,
        }, timeout=timeout)
        res = r.get("result", {})
        if "exceptionDetails" in res:
            return Threw(res["exceptionDetails"])
        return Ok(res.get("result", {}).get("value"))

    # -- A.6 wait_for -------------------------------------------------------
    def wait_for(self, predicate_js: str, timeout: float) -> WaitObservation:
        t0 = time.monotonic()
        last_value: Any = None
        last_type: Optional[str] = None
        while True:
            r = self.call("Runtime.evaluate", {
                "expression": "(function(){try{return {v:(%s)};}catch(e){"
                              "return {err:String(e)};}})()" % predicate_js,
                "returnByValue": True,
            })
            res = r.get("result", {})
            if "exceptionDetails" in res:
                return WaitObservation("threw", time.monotonic() - t0,
                                       error=_describe(res["exceptionDetails"]))
            val = res.get("result", {}).get("value") or {}
            if "err" in val:
                return WaitObservation("threw", time.monotonic() - t0, error=val["err"])
            last_value = val.get("v")
            last_type = type(last_value).__name__ if last_value is not None else "undefined/null"
            if last_value is True:
                return WaitObservation("satisfied", time.monotonic() - t0, last_value, last_type)
            if time.monotonic() - t0 >= timeout:
                return WaitObservation("timed_out", time.monotonic() - t0, last_value, last_type)
            _poll_interval()

    def drain_events(self, methods: Optional[Sequence[str]] = None) -> list[dict]:
        with self._lock:
            evs = list(self._events)
        if methods:
            evs = [e for e in evs if e.get("method") in methods]
        return evs

    def set_viewport(self, viewport: Viewport) -> None:
        """Move the pinned viewport AND the label geometry is recorded under, in
        one call. Issuing `Emulation.setDeviceMetricsOverride` directly leaves
        `self.viewport` stale, and then every geometry record names a viewport it
        was not measured at -- `game._geometry()` raises rather than let that
        happen, so this is the supported way to change it mid-session."""
        self.call("Emulation.setDeviceMetricsOverride", viewport.as_dict())
        if viewport.mobile:
            self.call("Emulation.setTouchEmulationEnabled", {"enabled": True})
        self.viewport = viewport

    def close(self) -> None:
        self._stop = True
        self.ws.close()


def _describe(details: dict) -> str:
    exc = details.get("exception") or {}
    return (exc.get("description") or exc.get("value")
            or details.get("text") or json.dumps(details)[:200])


# --------------------------------------------------------------------------
# A.2 launch / A.3 session start / A.7 teardown
# --------------------------------------------------------------------------
def effective_argv(pid: int) -> list:
    """The argv the chrome process actually carries.

    Chrome RE-EXECS ITSELF for headless and injects flags of its own; measured on
    this machine it adds --noerrdialogs, --ozone-platform=headless,
    --ozone-override-screen-size=800,600 and --use-angle=swiftshader-webgl, and
    the re-exec joins argv with spaces rather than NULs. It is not the
    /usr/local/bin/chrome -> /usr/bin/google-chrome-stable wrapper doing it: that
    is the stock wrapper, it ends in `exec -a "$0" "$HERE/chrome" "$@"`, and
    there is no /etc/chromium.d and no chrome env var set (verified).
    Asserting on the argv we *constructed* would therefore be a tautology that
    hides the injection, so A.2 asserts on this instead.
    """
    raw = open("/proc/%d/cmdline" % pid, "rb").read()
    parts = [p.decode("utf-8", "replace") for p in raw.split(b"\0") if p]
    if len(parts) == 1:
        parts = parts[0].split()
    return parts


@dataclass
class Browser:
    proc: subprocess.Popen
    port: int
    user_data_dir: str
    requested_argv: list = field(default_factory=list)
    sessions: list = field(default_factory=list)
    profile_leftovers: list = field(default_factory=list)

    @property
    def injected_flags(self) -> list:
        got = effective_argv(self.proc.pid)
        return [a for a in got if a.startswith("--") and a not in self.requested_argv]

    def new_session(self, viewport: Viewport, enable_cache: bool = False) -> Session:
        # PUT, never GET (spec 4.5).
        req = urllib.request.Request(
            "http://%s:%d/json/new?about:blank" % (HOST, self.port), method="PUT")
        target = json.loads(urllib.request.urlopen(req, timeout=10).read())
        sess = start_session(target["webSocketDebuggerUrl"], viewport, enable_cache)
        sess.target_id = target["id"]
        self.sessions.append(sess)
        return sess

    def close_target(self, sess: "Session") -> str:
        """Close the page from the browser side, so the peer closes the socket
        under the reader thread. This is the 4.4 scenario, reproduced."""
        urllib.request.urlopen(
            "http://%s:%d/json/close/%s" % (HOST, self.port, sess.target_id),
            timeout=10).read()
        return sess.target_id

    # A.7 -- terminate this specific child by its Popen handle. The pattern-
    # matching broadcast process killer is forbidden toolkit-wide (spec 4.5):
    # it matches the invoking shell's own argv and kills the caller.
    def close(self) -> None:
        for s in self.sessions:
            s.close()
        self.proc.terminate()
        try:
            self.proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait(timeout=30)
        # A single ignore_errors pass leaves the profile behind if anything
        # recreates a file while rmtree is walking, and then A.7's spotcheck goes
        # red for an environmental reason (observed ~1 run in 10 with other
        # Chrome instances alive; NOT reproduced under instrumentation, so this
        # retry is a hardening, not a verified fix). Whatever survives is
        # recorded rather than swallowed, so the next occurrence is diagnosable.
        for _ in range(20):
            shutil.rmtree(self.user_data_dir, ignore_errors=True)
            if not os.path.exists(self.user_data_dir):
                self.profile_leftovers = []
                return
        left = []
        for dirpath, _dirnames, filenames in os.walk(self.user_data_dir):
            for fn in filenames:
                left.append(os.path.relpath(os.path.join(dirpath, fn),
                                            self.user_data_dir))
        self.profile_leftovers = sorted(left)[:12]


def start_session(ws_url: str, viewport: Viewport, enable_cache: bool = False) -> Session:
    """A.3 -- enable domains, disable cache by default, and pin the viewport
    BEFORE any navigation (orchestrator amendment clause 2)."""
    sess = Session(ws_url, viewport)
    for domain in ("Runtime", "Log", "Page", "Network"):
        sess.call("%s.enable" % domain)
    sess.call("Network.setCacheDisabled", {"cacheDisabled": not enable_cache})
    sess.call("Emulation.setDeviceMetricsOverride", viewport.as_dict())
    if viewport.mobile:
        sess.call("Emulation.setTouchEmulationEnabled", {"enabled": True})
    return sess


def free_port() -> int:
    s = socket.socket()
    s.bind((HOST, 0))
    port = s.getsockname()[1]
    s.close()
    return port


def launch(user_data_dir: str, extra_args: Sequence[str] = (), ready_timeout: float = 30.0
           ) -> Browser:
    port = free_port()
    os.makedirs(user_data_dir, exist_ok=True)
    args = [CHROME, *BASE_FLAGS,
            "--remote-debugging-port=%d" % port,
            "--user-data-dir=%s" % user_data_dir,
            *extra_args, "about:blank"]
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.monotonic() + ready_timeout
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            raise TransportError("chrome exited rc=%s during startup" % proc.returncode)
        try:
            urllib.request.urlopen(
                "http://%s:%d/json/list" % (HOST, port), timeout=2).read()
            return Browser(proc, port, user_data_dir, list(args))
        except Exception:
            _poll_interval()
    proc.kill()
    raise TransportError("chrome devtools endpoint never came up on port %d" % port)
