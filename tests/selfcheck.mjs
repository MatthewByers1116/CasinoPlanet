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
