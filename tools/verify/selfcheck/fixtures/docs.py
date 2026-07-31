"""Inline-literal fixtures for the report parser (C.4) and HTML scanner (C.5).

Inline literals, never references to live repo source (spec 7.2).
"""

# --- C.5: an id that exists ONLY inside an inline <script> -----------------
HTML_WITH_SCRIPT_ONLY_ID = """<!doctype html>
<html><body>
  <div id="real-panel"></div>
  <script>
    var d = document.createElement('div');
    d.id = "runtime-only-id";
    document.body.innerHTML += '<span id="injected-by-script"></span>';
  </script>
  <div id="another-real"></div>
</body></html>
"""
SCRIPT_ONLY_IDS = {"injected-by-script"}
STATIC_IDS = {"real-panel", "another-real"}


# --- C.4: report fixtures --------------------------------------------------
REPORT_CLEAN = """# Test Report

| Step | Status | Notes |
|---|---|---|
| boot | PASS | fine |
| click | PASS | fine |

## Detailed Step Logs
nothing to see
"""

REPORT_DIRTY = """# Test Report

| Step | Status | Notes |
|---|---|---|
| boot | PASS | fine |
| click | FAIL | did not land |

## Detailed Step Logs
"""

# Negative control: FAIL appears only in the prose log, never in the table.
REPORT_LOG_ONLY = """# Test Report

| Step | Status | Notes |
|---|---|---|
| boot | PASS | fine |

## Detailed Step Logs
[12:00:01] step 'boot' -> would FAIL if the tolerance were tighter
"""

# Negative control: an exception string in a note must not read as a status.
REPORT_EXC = """# Test Report

| Step | Status | Notes |
|---|---|---|
| boot | PASS | caught error: TypeError |

## Detailed Step Logs
"""

# The pipe-escaping defect of spec 4.12: this note must survive whole.
REPORT_PIPED = """# Test Report

| Step | Status | Notes |
|---|---|---|
| boot | PASS | caught error: a\\|b |

## Detailed Step Logs
"""
PIPED_NOTE = "caught error: a|b"

# Encoding damage around the status word must be irrelevant.
REPORT_MOJIBAKE = """# Test Report

| Step | Status | Notes |
|---|---|---|
| boot | ✗ FAIL â€” | mangled |

## Detailed Step Logs
"""
