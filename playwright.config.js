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
