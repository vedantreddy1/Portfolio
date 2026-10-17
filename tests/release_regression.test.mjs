import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('signup URL selects signup and login actions use route navigation', () => {
  const studio = read('../src/components/Studio.jsx');
  const app = read('../src/App.jsx');
  assert.match(studio, /route === "\/studio\/signup" \? "signup" : "login"/);
  assert.match(studio, /navigate\(mode === "login" \? "\/studio\/signup" : "\/studio"\)/);
  assert.match(app, /route=\{route\}/);
});

test('private enquiry messages are not editable by regular authenticated clients', () => {
  const migration = read('../sql/production_v2_2_hardening.sql');
  assert.match(migration, /revoke update on public\.portfolio_inquiries from authenticated/i);
  assert.match(migration, /grant update \(status\) on public\.portfolio_inquiries to authenticated/i);
});

test('reproducible CI uses committed dependency lockfile', () => {
  const workflow = read('../.github/workflows/quality.yml');
  const lock = JSON.parse(read('../package-lock.json'));
  assert.match(workflow, /run: npm ci --no-fund/);
  assert.equal(lock.lockfileVersion, 3);
});
