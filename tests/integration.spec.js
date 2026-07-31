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
