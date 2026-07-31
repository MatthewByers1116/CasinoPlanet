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
