import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeoPage, realProjects, projectPath, renderPublicHtml, escapeHtml } from '../functions/_lib/seo.js';
import { DEFAULT_CONTENT } from '../src/data/defaultContent.js';
const req = new Request('https://portfolio.example/');
const env = { PUBLIC_SITE_URL: 'https://portfolio.example' };

test('escapes HTML and excludes placeholders from indexable work', () => {
  const data = structuredClone(DEFAULT_CONTENT);
  data.profile.name = '<img src=x onerror=alert(1)>';
  data.projects.push({ id:'real-1',title:'Real & Verified',description:'<script>alert(1)</script>',placeholder:false });
  const result = buildSeoPage({request:req,env,content:data,source:'published',nonce:'test'});
  assert.ok(!result.body.includes('<script>alert(1)</script>'));
  assert.match(result.body, /&lt;img src=x/);
  assert.match(result.body, /Real &amp; Verified/);
  assert.ok(!result.body.includes('Food, but make it a story'));
  assert.equal(realProjects(data).length,1);
  assert.equal(projectPath(data.projects.at(-1)), '/work/real-1');
});

test('outputs canonical, JSON-LD and robots metadata without fake OG image', () => {
  const result = buildSeoPage({request:req,env,content:DEFAULT_CONTENT,source:'published',nonce:'abc'});
  assert.match(result.head,/rel="canonical" href="https:\/\/portfolio.example\/"/);
  assert.match(result.head,/application\/ld\+json/);
  assert.match(result.head,/nonce="abc"/);
  assert.match(result.head,/schema.org/);
  assert.doesNotMatch(result.head,/property="og:image"/);
  assert.equal(result.robots,'index, follow, max-image-preview:large');
});

test('preview domains and unpublished content are noindex', () => {
  const preview = buildSeoPage({request:new Request('https://branch.pages.dev/'),env,content:DEFAULT_CONTENT,source:'published'});
  assert.equal(preview.robots,'noindex, nofollow');
  const unpublished = buildSeoPage({request:req,env,content:DEFAULT_CONTENT,source:'fallback'});
  assert.equal(unpublished.robots,'noindex, nofollow');
});

test('project page uses unique title, canonical, and CreativeWork entity', () => {
  const project = {id:'video123',title:'My food campaign',description:'An approved video',brand:'Example',placeholder:false};
  const result = buildSeoPage({request:req,env,content:DEFAULT_CONTENT,project,source:'published'});
  assert.match(result.head,/\/work\/video123/);
  assert.match(result.head,/CreativeWork/);
  assert.match(result.body,/My food campaign/);
});

test('public HTML contains crawlable snapshot and React mount', async () => {
  const html = '<html><head><!-- DYNAMIC_SEO_HEAD --><title>Fallback</title></head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>';
  const response = await renderPublicHtml({request:req,env:{...env,ASSETS:{fetch:async()=>new Response(html,{headers:{'Content-Type':'text/html'}})}}});
  const body = await response.text();
  assert.match(body,/seo-snapshot/);
  assert.match(body,/id="root"/);
  assert.match(body,/src="\/assets\/index.js"/);
  assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
  assert.match(response.headers.get('Content-Security-Policy'),/nonce-/);
});

test('HTML encoder neutralizes attribute injection', () => assert.equal(escapeHtml('"<>&\''),'&quot;&lt;&gt;&amp;&#39;'));

test('published Supabase content produces indexable edge HTML with dynamic FAQ', async () => {
  const original = global.fetch;
  const data = structuredClone(DEFAULT_CONTENT);
  data.profile.seoTitle = 'Updated creator title';
  data.projects.push({id:'real-2',title:'Approved Reel',description:'Actual campaign story',placeholder:false});
  global.fetch = async () => new Response(JSON.stringify([{data,updated_at:'2026-10-17T00:00:00Z'}]),{status:200});
  try {
    const response = await renderPublicHtml({request:req,env:{...env,SUPABASE_URL:'https://db.example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',ASSETS:{fetch:async()=>new Response('<html><head><!-- DYNAMIC_SEO_HEAD --><title>Old</title></head><body><div id="root"></div></body></html>')}}});
    const body = await response.text();
    assert.equal(response.status,200);
    assert.equal(response.headers.get('X-Robots-Tag'),'index, follow, max-image-preview:large');
    assert.match(body,/Updated creator title/);
    assert.match(body,/\/work\/real-2/);
    assert.match(body,/What type of UGC/);
    assert.doesNotMatch(body,/<title>Old<\/title>/);
  } finally { global.fetch = original; }
});

test('transient database failure yields 503 rather than noindex fake content', async()=>{
  const original = global.fetch;
  global.fetch = async()=>{throw new Error('offline');};
  try {
    const response = await renderPublicHtml({request:req,env:{...env,SUPABASE_URL:'https://db.example',SUPABASE_PUBLISHABLE_KEY:'public'}});
    assert.equal(response.status,503);
    assert.equal(response.headers.get('Retry-After'),'300');
  } finally {global.fetch=original;}
});

test('VideoObject is only emitted with real thumbnail, date and video',()=>{
  const p = {id:'video-1',title:'Food video',description:'Real',coverUrl:'https://example.com/cover.webp',videoUrl:'https://youtu.be/dQw4w9WgXcQ',publishedAt:'2026-10-01',placeholder:false};
  const yes = buildSeoPage({request:req,env,content:DEFAULT_CONTENT,project:p,source:'published'});
  assert.match(yes.head,/VideoObject/);
  assert.match(yes.head,/youtube-nocookie.com/);
  const no = buildSeoPage({request:req,env,content:DEFAULT_CONTENT,project:{...p,publishedAt:''},source:'published'});
  assert.doesNotMatch(no.head,/VideoObject/);
});
