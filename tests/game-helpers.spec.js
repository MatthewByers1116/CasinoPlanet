import { test, expect } from '@playwright/test';
import { boot, gridShape, cellToPoint, pointToCell, clickCell } from './helpers/game.js';

// The round-trip loop below proves cellToPoint/pointToCell are mutual
// inverses (floor(gx+0.5) === gx holds regardless of offsets/cellSize) — it
// is a spec-mandated check but is algebraically tautological and does NOT
// validate the transform against the game. The clickCell call afterward is
// the genuine known-answer check: it drives a real mouse event through the
// game's own InputHandler and asserts the game resolved it to the intended
// cell.
test('geometry helpers: round-trip inversion + known-answer click resolution', async ({ page }) => {
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

  const clickObs = await clickCell(page, 3, 5);
  expect(clickObs.mouseGridAfter, 'game InputHandler resolved the click to the intended cell').toEqual([3, 5]);
});
