import { test, expect } from '@playwright/test';

test('webServer serves the suite page', async ({ request }) => {
  const res = await request.get('/test_runner.html');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('runTestCase');
});
