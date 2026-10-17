import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestGet as unknown } from '../functions/[[path]].js';
import { onRequestGet as studio } from '../functions/studio/index.js';

test('unknown paths are genuine 404s', async()=>{
  const response=unknown();assert.equal(response.status,404);assert.match(response.headers.get('X-Robots-Tag'),/noindex/);
});
test('studio sends noindex and no-store', async()=>{
  const response=await studio({request:new Request('https://portfolio.example/studio'),env:{ASSETS:{fetch:async()=>new Response('<html>Private login</html>')}}});
  assert.equal(response.status,200);assert.match(response.headers.get('X-Robots-Tag'),/noindex/);assert.match(response.headers.get('Cache-Control'),/no-store/);
});
test('migration enforces RLS, TOTP, private revisions and revokes direct writes',()=>{
  const sql=readFileSync(new URL('../sql/production_v2.sql',import.meta.url),'utf8');
  for(const requirement of ['is_portfolio_editor_mfa','portfolio_editor_invites','portfolio_before_user_created','claim_portfolio_editor','publish_portfolio','portfolio_content_revisions','revoke insert on public.portfolio_inquiries from anon, authenticated','revoke insert, update on public.portfolio_content from authenticated']) assert.ok(sql.includes(requirement),requirement);
  assert.match(sql,/coalesce\(auth\.jwt\(\)->>'aal', 'aal1'\) = 'aal2'/);
});
