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
