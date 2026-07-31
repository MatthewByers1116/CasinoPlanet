# Node + Playwright Test-Execution Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python browser-driving test stack with `@playwright/test`, giving the suite real per-case pass/fail and real exit codes, per the approved spec at `docs/specs/node-playwright-migration.md`.

**Architecture:** Playwright's `webServer` launches the existing `python3 serve.py`; a results bridge (`window.__testResults`) in `test_runner.html` exposes the 31 runtime cases to `tests/integration.spec.js`; `tools/verify/game.py`'s observation helpers port to `tests/helpers/game.js`; a permanent sabotage selfcheck proves the harness can fail; `run_integration_tests.py` and all of `tools/verify/` are deleted.

**Tech Stack:** Node v22.23.1 (installed), `@playwright/test` (latest), Playwright-managed Chromium (fallback: system Chrome 150 at `/usr/local/bin/chrome` via `CP_CHROME` env), `python3` (NOT `python` — it does not exist on this box) for the untouched `serve.py`.

## Global Constraints (from the spec — every task inherits these)

- Helpers return observations/records; assertions live only in `tests/*.spec.js`. `tests/helpers/` must never import `expect` from `@playwright/test`.
- No fixed sleeps in `playwright.config.js` or `tests/**`: every wait is `page.waitForFunction`/auto-wait. The single sanctioned fixed-duration construct is `elapsedWindow()` in `tests/helpers/game.js`, called only from `simProgress` (spec D3 disclosure).
- SC3 gate (run before every commit of harness code): `git grep -nE "waitForTimeout|\bsleep\b|setTimeout\([^,)]+,\s*[0-9]+" -- playwright.config.js tests/` must return zero hits. The pattern matches comments too — do not write the banned words in comments.
- `test_runner.html` cases are NOT rewritten; the only change there is the results object. Its pre-existing internal `setTimeout` pacing is out of scope.
- No game-logic changes. `serve.py`, `build_single_file*.py`, `tools/check_id_contract.py` + waiver are untouched.
- `MIN_CASES = 31` is a ratcheted floor: raise when cases are added, never lower.
- Launch flags include `--disable-gpu`.
- All work on branch `feat/node-playwright-migration` (repo is on `main`; SSH push works, `gh pr create` 403s — hand the PR URL composition to the user or use SSH push + web UI).
- On this box: use `git grep`, never plain `grep -r` (plain recursive grep hangs in this working copy).
- **Exit-code evidence idiom** — NEVER `cmd | tail -N; echo "exit: $?"` ($? is tail's status, always 0). Always capture to a log first:
  ```bash
  <cmd> > /tmp/cp-run.log 2>&1; echo "exit: $?"; tail -30 /tmp/cp-run.log
  ```
- **PORT-WAIT (run before EVERY suite invocation)** — after a previous run exits, TIME_WAIT sockets on 8000 make `serve.py`'s plain-bind probe drift to 8001 for ~60s, which the fixed-URL webServer hard-fails. Wait until 8000 is bindable by the same probe serve.py uses:
  ```bash
  until python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',8000))" 2>/dev/null; do sleep 2; done
  ```
  (The `sleep` here is shell orchestration in this plan, outside SC3's `playwright.config.js`/`tests/` scope. `tests/selfcheck.mjs` performs the same wait itself.)
- Run each task's SC3 gate AFTER `git add` (git grep skips untracked files; an un-added new file is invisible to the gate).

---

### Task 1: Node scaffold — package.json, .gitignore, Playwright install, config, server smoke spec

**Files:**
- Modify: `package.json` (full rewrite, content below)
- Modify: `.gitignore` (append 4 lines)
- Create: `playwright.config.js`
- Create: `tests/server.spec.js`

**Interfaces:**
- Produces: `playwright.config.js` exporting a config whose `webServer` serves the repo root (or `CP_SERVE_ROOT` when set) at `http://127.0.0.1:8000` with `baseURL` set; `use.launchOptions.args` includes `--disable-gpu`; `CP_CHROME` env optionally overrides `executablePath`. Task 2/3/4 specs rely on `baseURL` and the `CP_SERVE_ROOT` override.

- [ ] **Step 1: Branch**

```bash
git checkout -b feat/node-playwright-migration
```

- [ ] **Step 2: Rewrite package.json**

Replace the entire file with:

```json
{
  "name": "casino-planet",
  "version": "1.0.0",
  "description": "Grid-Based Casino Manager & Interactive Arcade",
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:selfcheck": "node tests/selfcheck.mjs"
  }
}
```

(vite scripts, vite devDependency, and `ws` are gone per spec D5. `npm i -D` in Step 4 adds the `devDependencies` block with the actual installed version — do not hand-write a version number.)

- [ ] **Step 3: Append to .gitignore**

Append these lines to the existing `.gitignore` (which currently holds `__pycache__/` and `*.py[cod]`):

```
node_modules/
playwright-report/
test-results/
test_report.md
```

- [ ] **Step 4: Install Playwright and a browser**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium 2>&1 | tail -5
```

Expected: both exit 0. If `npx playwright install chromium` fails (download or missing OS deps), do NOT run `install-deps`; instead export `CP_CHROME=/usr/local/bin/chrome` for every subsequent `npm test` invocation and record that in the task notes — the config below supports it.

- [ ] **Step 5: Create playwright.config.js**

```js
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

// CP_SERVE_ROOT: the selfcheck (tests/selfcheck.mjs) points this at a mutated
// copy of the tree; unset, we serve the real repo.
const serveRoot = process.env.CP_SERVE_ROOT || repoRoot;

// Port-identity invariant (spec D1): serve.py auto-increments off a busy 8000,
// so a fixed url + reuseExistingServer:false is load-bearing. If 8000 is
// already taken, Playwright refuses to start (hard error) rather than silently
// testing against whatever is squatting there; if serve.py were to bind 8001
// in a race, the url check times out — also a hard error. Either way the URL
// we target is provably the server this run started.
export default defineConfig({
  testDir: './tests',
  timeout: 300_000,
  use: {
    baseURL: 'http://127.0.0.1:8000',
    launchOptions: {
      // CP_CHROME=/usr/local/bin/chrome uses the system Chrome 150 when the
      // Playwright-managed Chromium is unavailable (spec D1 fallback).
      executablePath: process.env.CP_CHROME || undefined,
      args: ['--disable-gpu'],
    },
  },
  webServer: {
    command: 'python3 serve.py',
    cwd: serveRoot,
    url: 'http://127.0.0.1:8000/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
```

- [ ] **Step 6: Write the server smoke spec (failing first)**

`tests/server.spec.js`:

```js
import { test, expect } from '@playwright/test';

test('webServer serves the suite page', async ({ request }) => {
  const res = await request.get('/test_runner.html');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('runTestCase');
});
```

- [ ] **Step 7: Run it**

```bash
npm test -- tests/server.spec.js > /tmp/cp-run.log 2>&1; echo "exit: $?"; tail -15 /tmp/cp-run.log
```

Expected: exit 0, 1 passed. If it errors with "port 8000 is used": either something is genuinely squatting (free it), or a previous run's TIME_WAIT socket is lingering — run the PORT-WAIT loop from Global Constraints and retry.

- [ ] **Step 8: Add, SC3 gate, commit**

```bash
git add package.json package-lock.json .gitignore playwright.config.js tests/server.spec.js
git grep -nE "waitForTimeout|\bsleep\b|setTimeout\([^,)]+,\s*[0-9]+" -- playwright.config.js tests/
```

Expected: gate prints nothing (exit 1). Then:

```bash
git commit -m "feat: Node+Playwright test scaffold with port-identity webServer"
```

---

### Task 2: Results bridge in test_runner.html + integration spec

**Files:**
- Modify: `test_runner.html` (three surgical edits: ~line 163, ~lines 199-209, ~line 1876)
- Create: `tests/integration.spec.js`

**Interfaces:**
- Consumes: `baseURL` from Task 1's config.
- Produces: `window.__testResults = { done: boolean, cases: [{name: string, status: 'pass'|'fail', message: string}] }` on `test_runner.html`; `tests/integration.spec.js` asserting the `MIN_CASES = 31` floor. Task 4's selfcheck mutates a case and relies on this spec failing with the case named.

- [ ] **Step 1: Add the results object**

In `test_runner.html`, find:

```js
    let summaryRows = [];
    let detailLogs = [];
```

Replace with:

```js
    let summaryRows = [];
    let detailLogs = [];
    window.__testResults = { done: false, cases: [] };
```

- [ ] **Step 2: Record each case**

Find (inside `runTestCase`):

```js
      try {
        await fn();
        el.querySelector('span:last-child').className = 'pass';
        el.querySelector('span:last-child').innerText = 'PASS';
        summaryRows.push(`| ${name} | ✅ PASS | |`);
      } catch (err) {
        el.querySelector('span:last-child').className = 'fail';
        el.querySelector('span:last-child').innerText = 'FAIL';
        summaryRows.push(`| ${name} | ❌ FAIL | ${err.message} |`);
        writeToLog(`\n### ERROR: ${name} Failed\n\`\`\`\n${err.stack}\n\`\`\`\n`);
      }
```

Replace with:

```js
      try {
        await fn();
        el.querySelector('span:last-child').className = 'pass';
        el.querySelector('span:last-child').innerText = 'PASS';
        summaryRows.push(`| ${name} | ✅ PASS | |`);
        window.__testResults.cases.push({ name, status: 'pass', message: '' });
      } catch (err) {
        el.querySelector('span:last-child').className = 'fail';
        el.querySelector('span:last-child').innerText = 'FAIL';
        summaryRows.push(`| ${name} | ❌ FAIL | ${err.message} |`);
        writeToLog(`\n### ERROR: ${name} Failed\n\`\`\`\n${err.stack}\n\`\`\`\n`);
        window.__testResults.cases.push({ name, status: 'fail', message: err.message });
      }
```

- [ ] **Step 3: Set done after the report is assembled**

Find (end of the IIFE, after the `/save_report` fetch chain):

```js
    }).catch(err => {
      document.getElementById('status-msg').style.color = '#ff4d4d';
      document.getElementById('status-msg').innerText = 'Error saving report: ' + err.message;
    });
```

Replace with:

```js
    }).catch(err => {
      document.getElementById('status-msg').style.color = '#ff4d4d';
      document.getElementById('status-msg').innerText = 'Error saving report: ' + err.message;
    });

    window.__testResults.done = true;
```

(`done` must not wait on the fetch: all cases are already recorded, and the manual `/save_report` path's success or failure is not this bridge's concern.)

- [ ] **Step 4: Write the integration spec**

`tests/integration.spec.js`:

```js
import { test, expect } from '@playwright/test';

// Ratchet floor, not an exact count: raise when cases are added; never lower.
// Below the floor means the suite silently shrank — the always-green failure
// mode this migration exists to kill (spec D2).
const MIN_CASES = 31;

test('test_runner.html full suite', async ({ page }) => {
  // Inline ledger: Task 3's exceptionLedger helper does not exist yet at this
  // point in the sequence, and this spec must stay self-contained.
  const ledger = { pageErrors: [], consoleErrors: [] };
  page.on('pageerror', (e) => ledger.pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') ledger.consoleErrors.push(m.text()); });

  await page.goto('/test_runner.html');
  await page.waitForFunction(
    () => window.__testResults && window.__testResults.done,
    null,
    { timeout: 280_000, polling: 500 },
  );
  const results = await page.evaluate(() => window.__testResults);

  await test.info().attach('pageerror-ledger', {
    body: JSON.stringify(ledger, null, 2),
    contentType: 'application/json',
  });

  expect(results.cases.length,
    `suite ran ${results.cases.length} cases; floor is ${MIN_CASES} (ratchet — see spec D2)`,
  ).toBeGreaterThanOrEqual(MIN_CASES);

  for (const c of results.cases) {
    await test.step(`${c.name}`, async () => {
      expect.soft(c.status, `${c.name}: ${c.message}`).toBe('pass');
    });
  }
});
```

(`expect.soft` so EVERY failing case is named, not just the first; any soft failure still fails the test and the run.)

- [ ] **Step 5: Run the full suite — record the honest baseline**

Run the PORT-WAIT loop from Global Constraints, then:

```bash
npm test > /tmp/cp-baseline.log 2>&1; echo "exit: $?"; tail -30 /tmp/cp-baseline.log
```

Expected: the suite runs (~2-4 min). The last committed report (from the original author's Windows machine) says 31/31 PASS, but this is the FIRST honest run on this box — if cases fail, that is a real finding about the game or environment, NOT a defect in this migration. Record the outcome verbatim in the task notes either way. A red baseline does not block the remaining tasks (SC1 requires exit 0 "when green").

- [ ] **Step 6: Add, SC3 gate, commit the bridge (BEFORE the sabotage check — the next step's `git checkout` must have a committed bridge to restore)**

```bash
git add test_runner.html tests/integration.spec.js
git grep -nE "waitForTimeout|\bsleep\b|setTimeout\([^,)]+,\s*[0-9]+" -- playwright.config.js tests/
git commit -m "feat: window.__testResults bridge + integration spec with MIN_CASES floor"
```

Expected: gate prints nothing; commit succeeds.

- [ ] **Step 7: Manual sabotage check (SC2, first half)**

Run the PORT-WAIT loop, then:

```bash
node -e "
const fs = require('fs');
const f = 'test_runner.html';
const src = fs.readFileSync(f, 'utf8');
const anchor = 'await runTestCase(\"Lobby Settings & Difficulty Selection\", () => {';
if (src.split(anchor).length !== 2) { console.error('anchor not unique'); process.exit(2); }
fs.writeFileSync(f, src.replace(anchor, anchor + ' throw new Error(\"SABOTAGE\");'));
console.log('mutated');
"
npm test > /tmp/cp-sabotage.log 2>&1; echo "exit: $?"
grep -c "Lobby Settings" /tmp/cp-sabotage.log
git checkout -- test_runner.html
```

Expected: `echo "exit: $?"` prints a NON-zero exit, and `/tmp/cp-sabotage.log` names `Lobby Settings & Difficulty Selection`. The `git checkout` restores the COMMITTED bridge (Step 6) and discards only the mutation. This is the manual half of SC2 — the direct kill of the "31 FAIL exits 0" class. If the exit is 0, STOP: the bridge is broken; do not proceed.

---

### Task 3: Port game.py observation helpers to tests/helpers/game.js + geometry spotcheck

**Files:**
- Create: `tests/helpers/game.js`
- Create: `tests/game-helpers.spec.js`
- Reference (source of the port, deleted in Task 5): `tools/verify/game.py`

**Interfaces:**
- Consumes: `baseURL` from Task 1.
- Produces (for future native specs): `boot(page, {pagePath?, difficulty, timeoutMs?})`, `gridShape(page)`, `cellToPoint(page, gx, gy)`, `pointToCell(page, x, y)`, `hitTest(page, x, y, expectedId?)`, `clickCell(page, gx, gy)`, `tapCell(page, gx, gy)`, `focusTarget(page)`, `pressKey(page, key)`, `installCounters(page, types)`, `countEvents(page)`, `act(page, action, payload, settleMs, fields?)`, `findLegalCell(page, objType)`, `simProgress(page, windowMs)`, `elapsedWindow(page, ms)`, error classes `BootError/SceneError/GeometryError/OccludedError/InputSinkError`. All return plain observation records; none asserts.

- [ ] **Step 1: Write the helper module**

`tests/helpers/game.js` — complete content (a faithful port of `tools/verify/game.py`; observations only, no `expect` import — the Task 4 selfcheck enforces this):

```js
// Observation helpers for driving CasinoPlanet from Playwright specs.
// Every export returns a record; assertions belong to the calling spec
// (spec constraint: observations-not-verdicts).
// Ported from the retired Python toolkit's game module, deleted by this
// migration. (Do not name that module's path here: the SC4 dangling-reference
// grep must stay clean over code.)

export class BootError extends Error {}
export class SceneError extends Error {}
export class GeometryError extends Error {}
export class OccludedError extends Error {}
export class InputSinkError extends Error {}

const CANVAS_ID = 'game-canvas';
const DIFFICULTIES = ['easy', 'medium', 'hard', 'gambler'];

async function need(page, pred, timeoutMs, what) {
  try {
    await page.waitForFunction(pred, null, { timeout: timeoutMs, polling: 100 });
  } catch (e) {
    throw new BootError(`boot stalled at ${what}: ${e.message}`);
  }
}

// difficulty is REQUIRED: pass null explicitly for pages with no overlay
// (mobile.html); omitting it is an error, mirroring game.py's positional arg.
export async function boot(page, opts = {}) {
  if (!('difficulty' in opts)) {
    throw new BootError("boot requires 'difficulty' (pass null for pages without an overlay)");
  }
  const { pagePath = 'index.html', difficulty, timeoutMs = 30_000 } = opts;
  if (difficulty !== null && !DIFFICULTIES.includes(difficulty)) {
    throw new BootError(`unknown difficulty ${JSON.stringify(difficulty)}`);
  }
  const t0 = Date.now();
  await page.goto('/' + pagePath);
  await need(page, "document.readyState === 'complete'", timeoutMs, 'readyState');
  await need(page, '!!(window.Casino && window.Casino.clientInstance)', timeoutMs, 'clientInstance');
  await page.evaluate(() => document.getElementById('mode-solo-btn').click());
  await need(page,
    '!!(window.Casino.clientInstance.sim && window.Casino.clientInstance.sim.isRunning)',
    timeoutMs, 'sim.isRunning');

  // Branch on OVERLAY presence, never on button presence: mobile.html ships
  // dead unbound #difficulty-*-btn markup (game.py B.2).
  const hasOverlay = await page.evaluate(() => !!document.getElementById('difficulty-overlay'));
  if (hasOverlay) {
    if (difficulty === null) {
      throw new BootError(`${pagePath} has a difficulty overlay; difficulty=null is invalid`);
    }
    await page.evaluate((d) => document.getElementById(`difficulty-${d}-btn`).click(), difficulty);
    await need(page,
      "getComputedStyle(document.getElementById('difficulty-overlay')).display === 'none'",
      timeoutMs, 'overlay dismissed');
  } else if (difficulty !== null) {
    throw new BootError(`${pagePath} has no #difficulty-overlay; pass difficulty=null explicitly`);
  }
  return {
    page: pagePath,
    difficulty,
    viewport: page.viewportSize(),
    hadOverlay: hasOverlay,
    elapsedS: (Date.now() - t0) / 1000,
  };
}

// Authoritative sim.gridManager only — no fallback shape (game.py B.4).
export async function gridShape(page) {
  const v = await page.evaluate(() => {
    const c = window.Casino && window.Casino.clientInstance;
    if (!c || !c.sim || !c.sim.gridManager) return null;
    const g = c.sim.gridManager;
    return { cols: g.cols, rows: g.rows };
  });
  if (!v || v.cols == null || v.rows == null) {
    throw new SceneError('sim.gridManager.cols/rows unavailable (sim booted?)');
  }
  return v;
}

async function geometry(page) {
  const g = await page.evaluate((canvasId) => {
    const c = window.Casino && window.Casino.clientInstance;
    const cv = document.getElementById(canvasId);
    if (!c || !cv) return null;
    const r = cv.getBoundingClientRect();
    return {
      cell: c.cellSize, ox: c.offsetX, oy: c.offsetY,
      left: r.left, top: r.top, rectW: r.width, rectH: r.height,
      attrW: cv.width, attrH: cv.height,
      innerW: window.innerWidth, innerH: window.innerHeight,
    };
  }, CANVAS_ID);
  if (!g) throw new GeometryError('canvas/clientInstance not available');
  const vp = page.viewportSize();
  if (vp && (g.innerW !== vp.width || g.innerH !== vp.height)) {
    throw new GeometryError(
      `live viewport is ${g.innerW}x${g.innerH} but the page is labelled ` +
      `${vp.width}x${vp.height} — geometry would be recorded under the wrong viewport`);
  }
  return g;
}

// Precondition: canvas.width === boundingRect width — the quantity
// InputHandler.js divides by; without it the no-scale-term transform is
// invalid (game.py B.5).
export async function cellToPoint(page, gx, gy) {
  const g = await geometry(page);
  if (g.attrW !== g.rectW) {
    throw new GeometryError(
      `canvas.width (${g.attrW}) != boundingRect width (${g.rectW}); ` +
      'the no-scale-term transform is invalid here');
  }
  return {
    x: g.left + g.ox + (gx + 0.5) * g.cell,
    y: g.top + g.oy + (gy + 0.5) * g.cell,
    cellSize: g.cell, offsetX: g.ox, offsetY: g.oy,
    canvasCssW: g.rectW, canvasCssH: g.rectH,
    viewport: page.viewportSize(),
  };
}

export async function pointToCell(page, x, y) {
  const g = await geometry(page);
  return [
    Math.floor((x - g.left - g.ox) / g.cell),
    Math.floor((y - g.top - g.oy) / g.cell),
  ];
}

export async function hitTest(page, x, y, expectedId = CANVAS_ID) {
  const r = await page.evaluate(([px, py, id]) => {
    const el = document.elementFromPoint(px, py);
    const want = document.getElementById(id);
    if (!el) return { hit: false, desc: '(nothing at point)', chain: [] };
    // contains() covers self-or-descendant: a hit on a button's inner span
    // counts as hitting the button (game.py B.6).
    const ok = !!(want && want.contains(el));
    let d = el.tagName.toLowerCase();
    if (el.id) d += '#' + el.id;
    const cls = (el.className && el.className.baseVal !== undefined)
      ? el.className.baseVal : el.className;
    if (cls && typeof cls === 'string' && cls.trim()) d += '.' + cls.trim().split(/\s+/).join('.');
    const chain = [];
    let p = el.parentElement, n = 0;
    while (p && n < 3) {
      let s = p.tagName.toLowerCase();
      if (p.id) s += '#' + p.id;
      const pc = (typeof p.className === 'string') ? p.className : '';
      if (pc && pc.trim()) s += '.' + pc.trim().split(/\s+/).join('.');
      chain.push(s); p = p.parentElement; n++;
    }
    return { hit: ok, desc: d, chain };
  }, [x, y, expectedId]);
  return { hit: r.hit, description: r.desc, ancestors: r.chain };
}

async function requireHit(page, p, gx, gy, expectedId) {
  const h = await hitTest(page, p.x, p.y, expectedId);
  if (!h.hit) {
    throw new OccludedError(
      `cell (${gx},${gy}) -> client (${p.x.toFixed(1)},${p.y.toFixed(1)}) is ` +
      `intercepted by <${h.description}> (ancestors: ${h.ancestors.join(' < ')})`);
  }
}

async function mouseGrid(page) {
  const v = await page.evaluate(() => {
    const h = window.Casino.clientInstance.inputHandler;
    return h ? [h.mouseGridX, h.mouseGridY] : null;
  });
  return v || [];
}

// mouseMoved BEFORE mousePressed is mechanically required: mousedown reads
// InputHandler.mouseGridX/Y, updated only by mousemove (game.py B.6).
export async function clickCell(page, gx, gy) {
  const p = await cellToPoint(page, gx, gy);
  await requireHit(page, p, gx, gy, CANVAS_ID);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
  return { gx, gy, point: p, kind: 'mouse', mouseGridAfter: await mouseGrid(page) };
}

// Back-to-back touchstart/touchend with no inter-event delay (game.py B.6).
// Requires a context created with { hasTouch: true }.
export async function tapCell(page, gx, gy) {
  const p = await cellToPoint(page, gx, gy);
  await requireHit(page, p, gx, gy, CANVAS_ID);
  await page.touchscreen.tap(p.x, p.y);
  return { gx, gy, point: p, kind: 'touch', mouseGridAfter: await mouseGrid(page) };
}

export async function focusTarget(page) {
  const r = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { sink: false, desc: 'body' };
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute && el.getAttribute('type')) || 'text';
    const sink = !!el.isContentEditable || tag === 'textarea' || tag === 'select' ||
      (tag === 'input' &&
       !/^(button|submit|reset|checkbox|radio|file|image|range|color)$/i.test(type));
    let d = tag;
    if (el.id) d += '#' + el.id;
    const cls = (typeof el.className === 'string') ? el.className : '';
    if (cls && cls.trim()) d += '.' + cls.trim().split(/\s+/).join('.');
    if (tag === 'input') d += '[type=' + type + ']';
    return { sink, desc: d };
  });
  return { sink: r.sink, description: r.desc };
}

// A focused text field does not shield the page (listeners bind on window) —
// it creates a SECOND destination, so what follows cannot be attributed.
// Refuse on ambiguity (game.py B.6 press_key precondition).
export async function pressKey(page, key) {
  const f = await focusTarget(page);
  if (f.sink) {
    throw new InputSinkError(
      `key ${JSON.stringify(key)} has two destinations: focused text-entry ` +
      `<${f.description}> AND the page's own listeners; blur it first`);
  }
  await page.keyboard.press(key);
  return key;
}

// Idempotent: re-installing must not double-count (game.py B.7).
export async function installCounters(page, types) {
  await page.evaluate((ts) => {
    if (window.__vcH) {
      window.__vcH.forEach(([t, f]) => document.removeEventListener(t, f, true));
    }
    window.__vc = {};
    window.__vcH = [];
    ts.forEach((t) => {
      window.__vc[t] = 0;
      const f = () => { window.__vc[t]++; };
      window.__vcH.push([t, f]);
      document.addEventListener(t, f, true);
    });
  }, types);
}

// Distinguishes 'never fired' from 'handler no-op'ed' (game.py B.7).
export async function countEvents(page) {
  return (await page.evaluate(() => window.__vc || {})) || {};
}

const SNAP = () => {
  const c = window.Casino && window.Casino.clientInstance;
  const s = c && c.sim;
  if (!s) return null;
  return {
    chips: s.economyManager.chips,
    placedObjects: s.gridManager.placedObjects.size,
    employees: s.employees.size,
    guests: s.guests.size,
  };
};

// Which snapshot fields a command can affect; `changed` is computed over these
// ONLY — the sim free-runs, so unscoped diffs report changed for everything.
const ACTION_FIELDS = {
  PLACE_OBJECT: ['placedObjects'],
  HIRE_EMPLOYEE: ['employees'],
};

async function preconditions(page, action, payload) {
  if (action === 'PLACE_OBJECT') {
    return page.evaluate(([t, x, y]) => {
      const s = window.Casino.clientInstance.sim;
      return {
        unlocked: s.unlockedTechs.indexOf(t) >= 0,
        canPlaceObject: !!s.gridManager.canPlaceObject(t, x, y),
        cellIsNull: s.gridManager.grid[y][x] === null,
        chips: s.economyManager.chips,
      };
    }, [payload.type, payload.gridX, payload.gridY]);
  }
  if (action === 'HIRE_EMPLOYEE') {
    return page.evaluate((r) => {
      const s = window.Casino.clientInstance.sim;
      const gated = ['chef', 'scientist', 'manager', 'security', 'tech_support',
        'entertainer', 'stocker', 'janitor'];
      const cost = s.getDynamicStaffHiringCost(r);
      return {
        roleIsGated: gated.indexOf(r) >= 0,
        unlocked: s.unlockedTechs.indexOf(r) >= 0,
        cost,
        affordable: !!s.economyManager.canAfford(cost),
        chips: s.economyManager.chips,
      };
    }, payload.role);
  }
  return {};
}

// Scene-population entry point: returns an observation and never raises on
// 'the action had no effect' — that judgement belongs to the caller.
// settleMs is a bounded change-poll, not a fixed wait: it returns the moment
// a watched field changes (game.py B.3).
export async function act(page, action, payload, settleMs, fields = null) {
  const watch = fields || ACTION_FIELDS[action];
  if (!watch) throw new SceneError(`no scoped fields known for ${action}; pass fields=[...]`);
  const pre = await preconditions(page, action, payload);
  const before = await page.evaluate(SNAP);
  if (before === null) throw new SceneError('sim is null; cannot act');
  await page.evaluate((b) => { window.__vsnap = b; }, before);
  await page.evaluate(([a, p]) => {
    const c = window.Casino.clientInstance;
    c.sendAction(window.Casino.Protocol.Commands[a], p);
  }, [action, payload]);
  const t0 = Date.now();
  let satisfied = true;
  try {
    await page.waitForFunction((keys) => {
      const c = window.Casino && window.Casino.clientInstance;
      const s = c && c.sim;
      if (!s) return false;
      const a = {
        chips: s.economyManager.chips,
        placedObjects: s.gridManager.placedObjects.size,
        employees: s.employees.size,
        guests: s.guests.size,
      };
      return keys.some((k) => a[k] !== window.__vsnap[k]);
    }, watch, { timeout: settleMs, polling: 50 });
  } catch (e) {
    if (e.name !== 'TimeoutError') throw e;
    satisfied = false;
  }
  const settledAfterS = (Date.now() - t0) / 1000;
  const after = await page.evaluate(SNAP);
  const changedFields = watch.filter((k) => after[k] !== before[k]);
  const drift = Object.keys(before)
    .filter((k) => !watch.includes(k) && after[k] !== before[k]);
  return {
    action, payload, before, after,
    changed: changedFields.length > 0,
    settledAfterS,
    preconditions: pre,
    fieldsChanged: changedFields,
    unscopedDrift: drift,
    settleSatisfied: satisfied,
  };
}

// Scans with the game's own canPlaceObject, never grid[y][x]===null — that
// predicts success for cells the 1-tile-diagonal rule rejects (game.py B.3).
export async function findLegalCell(page, objType) {
  const v = await page.evaluate((t) => {
    const g = window.Casino.clientInstance.sim.gridManager;
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        if (g.canPlaceObject(t, x, y)) return [x, y];
      }
    }
    return null;
  }, objType);
  return v || null;
}

// The single sanctioned fixed-duration construct in the harness (spec D3
// disclosure): a MEASUREMENT window for sampling sim-state deltas, not a
// readiness wait. Do not add other call sites.
export async function elapsedWindow(page, ms) {
  const deadline = Date.now() + ms;
  await page.waitForFunction((d) => Date.now() >= d, deadline, { polling: 100 });
}

// Exception ledger (spec D3): installs listeners once and returns a live
// record the calling spec can read or attach. Observation only.
export function exceptionLedger(page) {
  const record = { pageErrors: [], consoleErrors: [] };
  page.on('pageerror', (e) => record.pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') record.consoleErrors.push(m.text()); });
  return record;
}

// Samples only, never the verdict (game.py B.8).
export async function simProgress(page, windowMs) {
  const sample = () => page.evaluate(() => {
    const c = window.Casino && window.Casino.clientInstance;
    const s = c && c.sim;
    return s ? { dayTimer: s.dayTimer, currentDay: s.currentDay } : null;
  });
  const a = await sample();
  if (a === null) throw new SceneError('sim is null; cannot sample progress');
  await elapsedWindow(page, windowMs);
  const b = await sample();
  return {
    first: a, second: b,
    dDayTimer: b.dayTimer - a.dayTimer,
    dCurrentDay: b.currentDay - a.currentDay,
    windowS: windowMs / 1000,
  };
}
```

- [ ] **Step 2: Write the geometry spotcheck spec (known-answer, per spec D4)**

`tests/game-helpers.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { boot, gridShape, cellToPoint, pointToCell } from './helpers/game.js';

test('geometry helpers: known-answer round-trip', async ({ page }) => {
  const obs = await boot(page, { difficulty: 'medium' });
  expect(obs.hadOverlay).toBe(true);

  const g = await gridShape(page);
  expect(g.cols).toBeGreaterThan(0);
  expect(g.rows).toBeGreaterThan(0);

  for (const [gx, gy] of [[0, 0], [3, 5], [g.cols - 1, g.rows - 1]]) {
    const p = await cellToPoint(page, gx, gy);
    const back = await pointToCell(page, p.x, p.y);
    expect(back, `round-trip for cell (${gx},${gy})`).toEqual([gx, gy]);
  }
});
```

- [ ] **Step 3: Run it — expect a real failure first if the port is wrong**

Run the PORT-WAIT loop, then:

```bash
npm test -- tests/game-helpers.spec.js > /tmp/cp-run.log 2>&1; echo "exit: $?"; tail -15 /tmp/cp-run.log
```

Expected: exit 0. If `GeometryError: canvas.width != boundingRect width` — that is the helper's own precondition guard working; investigate the default Playwright viewport (1280x720) vs the game's canvas sizing before touching helper code. Do NOT weaken the guard.

- [ ] **Step 4: Add, SC3 gate, commit**

```bash
git add tests/helpers/game.js tests/game-helpers.spec.js
git grep -nE "waitForTimeout|\bsleep\b|setTimeout\([^,)]+,\s*[0-9]+" -- playwright.config.js tests/
git commit -m "feat: port game observation helpers to Playwright + geometry spotcheck"
```

---

### Task 4: Permanent selfcheck — sabotage negative control + helpers-no-expect tier

**Files:**
- Create: `tests/selfcheck.mjs`

**Interfaces:**
- Consumes: `CP_SERVE_ROOT` support in Task 1's config; the anchor string `await runTestCase("Lobby Settings & Difficulty Selection", () => {` in `test_runner.html`; Task 2's integration spec.
- Produces: `npm run test:selfcheck` exiting 0 only when (a) helpers do not import `expect` and (b) a sabotaged copy of the suite makes `npm test` fail naming the case.

- [ ] **Step 1: Write the selfcheck script**

`tests/selfcheck.mjs`:

```js
// Selfcheck for the Playwright harness (spec D4).
// Tier 1: tests/helpers/ must not import expect (observations-not-verdicts).
// Tier 2: negative control — a sabotaged copy of the suite MUST fail the run
// and name the sabotaged case. Exit 0 only if both hold.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as backoff } from 'node:timers/promises';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fail = (msg, code = 1) => { console.error(`SELFCHECK FAIL: ${msg}`); process.exit(code); };

// Predicate poll, not a fixed wait: serve.py's plain-bind port probe sees
// TIME_WAIT sockets from a previous run and drifts to 8001, which the
// fixed-URL config hard-fails. Wait until 8000 is bindable by the SAME kind
// of probe serve.py uses (node's own listen() sets SO_REUSEADDR and would
// lie here), exiting the moment the predicate holds.
async function waitForPortBindable(port, timeoutMs = 90_000) {
  const probe = () => spawnSync('python3', ['-c',
    `import socket,sys\ns=socket.socket()\ntry:\n s.bind(('127.0.0.1',${port}))\nexcept OSError:\n sys.exit(1)`,
  ]).status === 0;
  const t0 = Date.now();
  while (!probe()) {
    if (Date.now() - t0 > timeoutMs) fail(`port ${port} not bindable after ${timeoutMs}ms`);
    await backoff(500);
  }
}

// ---- Tier 1: helpers must not import expect --------------------------------
const helpersDir = path.join(repoRoot, 'tests', 'helpers');
for (const f of fs.readdirSync(helpersDir)) {
  const src = fs.readFileSync(path.join(helpersDir, f), 'utf8');
  if (/import\s*\{[^}]*\bexpect\b[^}]*\}\s*from\s*['"]@playwright\/test['"]/.test(src)) {
    fail(`tests/helpers/${f} imports expect — helpers return observations, specs assert`);
  }
}
console.log('selfcheck tier 1 OK: no expect import in tests/helpers/');

// ---- Tier 2: sabotage negative control -------------------------------------
// Environment-equivalence invariant (spec D4): the mutated copy is a full
// working-tree copy served at the same root layout, so src/, style.css and
// /save_report all behave as in a real run. A bare file copy would not.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-selfcheck-'));
process.on('exit', () => { fs.rmSync(scratch, { recursive: true, force: true }); });
const EXCLUDE = new Set(['.git', 'node_modules', 'playwright-report', 'test-results', 'docs']);
fs.cpSync(repoRoot, scratch, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(repoRoot, src);
    return rel === '' || !EXCLUDE.has(rel.split(path.sep)[0]);
  },
});

const CASE_NAME = 'Lobby Settings & Difficulty Selection';
const anchor = `await runTestCase("${CASE_NAME}", () => {`;
const runnerPath = path.join(scratch, 'test_runner.html');
const runner = fs.readFileSync(runnerPath, 'utf8');
if (runner.split(anchor).length !== 2) {
  fail(`mutation anchor not found exactly once in test_runner.html — update the anchor in tests/selfcheck.mjs`, 2);
}
fs.writeFileSync(runnerPath, runner.replace(anchor, `${anchor} throw new Error('SELFCHECK_MUTATION');`));
console.log(`selfcheck tier 2: sabotaged "${CASE_NAME}" in ${scratch}`);

await waitForPortBindable(8000);
const run = spawnSync('npx', ['playwright', 'test', 'tests/integration.spec.js'], {
  cwd: repoRoot,
  env: { ...process.env, CP_SERVE_ROOT: scratch },
  encoding: 'utf8',
});
const output = `${run.stdout || ''}\n${run.stderr || ''}`;
fs.rmSync(scratch, { recursive: true, force: true });

// On any tier-2 failure, print the child's output — an undiagnosable
// selfcheck is the exact defect class this harness exists to kill.
if (run.status === 0) {
  console.error(output.slice(-3000));
  fail('sabotaged suite exited 0 — the harness cannot report failure');
}
if (!output.includes(CASE_NAME)) {
  console.error(output.slice(-3000));
  fail(`sabotaged run failed (exit ${run.status}) but did not name "${CASE_NAME}"`);
}
console.log(`selfcheck tier 2 OK: sabotaged run exited ${run.status} and named the case`);
console.log('SELFCHECK PASS');
```

- [ ] **Step 2: Run it**

```bash
npm run test:selfcheck > /tmp/cp-selfcheck.log 2>&1; echo "exit: $?"; tail -10 /tmp/cp-selfcheck.log
```

Expected: exit 0, both tiers print OK, `SELFCHECK PASS`. Takes a full suite duration (~2-4 min) because it really runs the sabotaged suite (it performs its own port wait first).

- [ ] **Step 3: Prove the selfcheck itself can fail (negative control of the negative control)**

Temporarily add `import { expect } from '@playwright/test';` as the first line of `tests/helpers/game.js`, run `npm run test:selfcheck; echo "exit: $?"`, expect exit 1 with the tier-1 message. Revert the line (`git checkout -- tests/helpers/game.js`).

- [ ] **Step 4: Add, SC3 gate, commit**

```bash
git add tests/selfcheck.mjs
git grep -nE "waitForTimeout|\bsleep\b|setTimeout\([^,)]+,\s*[0-9]+" -- playwright.config.js tests/
git commit -m "feat: permanent sabotage selfcheck + helpers-no-expect tier"
```

---

### Task 5: Deletions, untracking, CLAUDE.md — the honesty pass

**Files:**
- Delete: `run_integration_tests.py`, `tools/verify/` (entire package)
- Untrack: `test_report.md`
- Modify: `CLAUDE.md` (repo-specifics sentence)
- Commit (new): `docs/specs/node-playwright-migration.md`, `docs/plans/2026-07-31-node-playwright-migration.md`

- [ ] **Step 1: Delete and untrack**

```bash
git rm run_integration_tests.py
git rm -r tools/verify
rm -rf tools/verify
git rm --cached test_report.md
```

(`test_report.md` stays on disk — the manual browser flow still writes it; it is gitignored since Task 1. The extra `rm -rf` clears the gitignored `__pycache__` residue `git rm` leaves behind.)

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`, find:

```
serves index.html and the browser-based test_runner.html); `python build_single_file.py` /
`python build_single_file_mobile.py` (package src/**/*.js + style.css into standalone
CasinoPlanet.html / CasinoPlanetMobile.html — both git-tracked, expect a diff when rebuilding);
`python run_integration_tests.py` (headless-Chrome run of the full test_runner.html suite,
writes test_report.md); `python3 tools/check_id_contract.py` (static check that every DOM id
```

Replace with:

```
serves index.html and the browser-based test_runner.html); `python build_single_file.py` /
`python build_single_file_mobile.py` (package src/**/*.js + style.css into standalone
CasinoPlanet.html / CasinoPlanetMobile.html — both git-tracked, expect a diff when rebuilding);
`npm test` (Playwright run of the full test_runner.html suite — real per-case pass/fail and
exit codes; config launches serve.py itself); `npm run test:selfcheck` (harness negative
control: proves a failing case fails the run; run it after touching the harness);
`python3 tools/check_id_contract.py` (static check that every DOM id
```

Then find:

```
No npm/vite workflow is actually used despite package.json listing
vite scripts.
```

(the sentence may be wrapped differently — match on the sentence text) and replace that sentence with:

```
The npm workflow is real: Playwright test tooling only, no bundler.
```

- [ ] **Step 3: Commit the docs**

```bash
git add CLAUDE.md docs/specs/node-playwright-migration.md docs/plans/2026-07-31-node-playwright-migration.md
git commit -m "feat: delete Python browser-driving stack; npm test is canonical"
```

- [ ] **Step 4: Verify SC4 (no dangling references)**

```bash
git grep -n "tools.verify\|tools/verify\|run_integration_tests"
```

Expected: hits ONLY under `docs/` (the spec and this plan). Any hit in code, config, or CLAUDE.md is a defect — fix it before proceeding.

Recorded reading of spec SC4 (planning-loop ambiguity resolution, stated openly rather than silently applied): the spec's "hits only in `docs/specs/` (this document…)" was written before the methodology's committed implementation plan existed as a second document with the same strings; this plan reads the criterion's intent as "hits only under committed design docs (`docs/`), none in code, config, or CLAUDE.md".

---

### Task 6: Final verification sweep — every success criterion, with evidence

- [ ] **Step 1: SC1 + SC7** — PORT-WAIT loop, then `npm test > /tmp/cp-sc1.log 2>&1; echo "exit: $?"; tail -15 /tmp/cp-sc1.log` then `git status --porcelain`. Expected: suite runs all 31+ cases; exit 0 if the Task 2 baseline was green (if the baseline was red, the same cases fail — record that this matches the baseline, which satisfies the harness's honesty even though the suite itself is red); `git status --porcelain` prints nothing (test_report.md is untracked+ignored).
- [ ] **Step 2: SC1 shrinkage clause** — mutate, run, revert:

```bash
node -e "
const fs = require('fs');
const f = 'test_runner.html';
const src = fs.readFileSync(f, 'utf8');
const anchor = \"      { type: 'plinko', payload: { betAmount: 20 }, actions: [] },\";
if (src.split(anchor).length !== 2) { console.error('anchor not unique'); process.exit(2); }
fs.writeFileSync(f, src.replace(anchor, ''));
console.log('shrunk: plinko case removed');
"
npm test > /tmp/cp-shrink.log 2>&1; echo "exit: $?"
grep -c "floor is 31" /tmp/cp-shrink.log
git checkout -- test_runner.html
```

(Run the PORT-WAIT loop before the `npm test`.) Expected: NON-zero exit and the log contains `suite ran 30 cases; floor is 31`.
- [ ] **Step 3: SC2** — `npm run test:selfcheck > /tmp/cp-sc2.log 2>&1; echo "exit: $?"; tail -5 /tmp/cp-sc2.log`. Expected: exit 0, `SELFCHECK PASS`.
- [ ] **Step 4: SC3** — `git grep -nE "waitForTimeout|\bsleep\b|setTimeout\([^,)]+,\s*[0-9]+" -- playwright.config.js tests/`. Expected: no output.
- [ ] **Step 5: SC4** — `git grep -n "tools.verify\|tools/verify\|run_integration_tests"`. Expected: docs/ hits only.
- [ ] **Step 6: SC5 (baseline-relativized per the spec's post-PASS repair)** — `python3 tools/check_id_contract.py > /tmp/cp-idcheck.log 2>&1; echo "exit: $?"; tail -10 /tmp/cp-idcheck.log`. Expected: exit 1 with EXACTLY the six pre-existing problems (tier-1 `scorecard-content` at ClientGame.js:1380 + five unwaived tier-2 scorecard/unstuck ids) — identical to main's output; any new or vanished problem is a regression caused by this work. Then `python3 build_single_file.py && python3 build_single_file_mobile.py; echo "exit: $?"`. Expected: exit 0. Then `git checkout -- CasinoPlanet.html CasinoPlanetMobile.html` if the rebuild dirtied them (documented behavior, not part of this change).
- [ ] **Step 7: SC6** — read `package.json`; confirm every script and dependency is exercised by this plan (`test`, `test:selfcheck`, `@playwright/test`). Expected: nothing else present.
- [ ] **Step 8: Record the evidence** — paste each command's actual output into the task notes / final report. No claim without its output.
- [ ] **Step 9: Push the branch**

```bash
git push -u origin feat/node-playwright-migration
```

(SSH push works; `gh pr create` 403s on this box — give the user the compare URL: `https://github.com/MatthewByers1116/CasinoPlanet/compare/main...feat/node-playwright-migration`)

---

## Plan loop ledger
- Iteration 1: SPEC-DEFECT (reviewer executed the full plan in a sandbox; green path, bridge, floor, sabotage, selfcheck, helper port all verified working). Halting finding: spec SC5 ("python3 tools/check_id_contract.py … still run clean") is unsatisfiable — the checker exits 1 on untouched main (tier-1 scorecard-content gap at ClientGame.js:1380 + 5 unwaived tier-2 scorecard ids, all pre-existing) and the spec's own constraints forbid every legal fix. Escalated to user per planning-loop terminal behavior. Plan-owned findings queued for the re-cut: (1) Task 2 Step 6's `git checkout` reverts the uncommitted bridge — commit before sabotage or revert surgically; (2) `| tail -N; echo "exit: $?"` reports tail's status, never the suite's — use pipestatus/pipefail; (4) consecutive runs flake: serve.py's port probe sees TIME_WAIT from the previous run and binds 8001 → 30s webServer timeout; selfcheck must print child output on failure and the docs must describe the ~60s TIME_WAIT wait; (5) the helpers header comment "Ported from tools/verify/game.py" trips the plan's own SC4 grep — reword it; state explicitly that SC4's "docs/specs/" is being read as "docs/" to admit the committed plan; (6) run per-task SC3 gates after `git add` (git grep skips untracked); (7) also fix the now-false "No npm/vite workflow is actually used" sentence in CLAUDE.md; (8) add a shrinkage check to Task 6's evidence; (9) rm leftover tools/verify/__pycache__ after git rm.
- Re-cut after the user-authorized SC5 spec repair (baseline-relativized): all 9 queued plan findings folded — bridge now committed before the sabotage check; log-capture exit idiom made a Global Constraint and applied to every run step; PORT-WAIT loop documented and selfcheck.mjs given a python-bind port probe (node's own listen() sets SO_REUSEADDR and would lie) plus child-output-on-failure; helpers header comment no longer trips the SC4 grep; SC4's docs/ reading recorded openly; per-task SC3 gates moved after git add; CLAUDE.md vite sentence replaced; Task 6 gained the shrinkage evidence step and the baseline-relativized SC5 expectation; pycache residue removed. Ready for iteration 2.
- Iteration 2: PASS — full literal execution in a fresh sandbox: every anchor exact, every expectation matched on the first attempt with zero deviations (baseline 31/31 green in 2.2 min; sabotage exit 1 naming the case; shrinkage exit 1 "floor is 31"; selfcheck PASS and its negative control fails correctly; SC5 output byte-identical to main's). Reviewer's own probes all failed safe: foreign-case sabotage caught, selfcheck cannot be gamed by deleting the spec file, port-squatting look-alike server hard-errored. 5 non-plan-changing observations recorded (mislabelled "failing first" step; transient tracked test_report.md dirt between Tasks 2-5 is expected and self-resolving; tests/server.spec.js and the docs/ SC4 reading are disclosed scope; geometry round-trip proves mutual inverses per spec D4's own prescription). PROCEED TO IMPLEMENTATION.
