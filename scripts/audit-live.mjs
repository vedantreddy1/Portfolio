// Usage: npm run audit:live -- https://your-canonical-domain.com
// Read-only checks. Does not submit enquiries, access credentials, or mutate data.
const input = process.argv[2];
if (!input || !/^https:\/\//i.test(input)) {
  console.error('Usage: npm run audit:live -- https://your-canonical-domain.com');
  process.exit(2);
}
const root = input.replace(/\/$/, '');
let failures = 0;
const check = (name, okay, note = '') => {
  console.log(`${okay ? 'PASS' : 'FAIL'}  ${name}${note ? ` — ${note}` : ''}`);
  if (!okay) failures++;
};
async function get(path) {
  try {
    const response = await fetch(root + path, { headers: { 'User-Agent': 'KawalpreetStudioV2Audit/1.0' }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
    return { status: response.status, headers: response.headers, body: await response.text(), url: response.url };
  } catch (e) { return { status: 0, headers: new Headers(), body: '', error: e.message }; }
}
const home = await get('/');
check('Homepage responds 200', home.status === 200, home.error || String(home.status));
check('Homepage includes server-rendered text', home.body.includes('seo-snapshot') && home.body.includes('UGC Creator'));
check('Homepage has canonical', home.body.includes(`rel="canonical" href="${root}/"`));
check('Homepage includes structured data', home.body.includes('application/ld+json') && home.body.includes('schema.org'));
check('Homepage indexable', !(home.headers.get('X-Robots-Tag') || '').includes('noindex'));
check('Security headers', Boolean(home.headers.get('Content-Security-Policy') && home.headers.get('X-Content-Type-Options') === 'nosniff' && home.headers.get('X-Frame-Options') === 'DENY'));
const sitemap = await get('/sitemap.xml');
check('Dynamic sitemap available', sitemap.status === 200 && sitemap.body.includes('<urlset'));
check('Sitemap uses canonical domain', sitemap.body.includes(root + '/'));
const robots = await get('/robots.txt');
check('Robots points to sitemap', robots.status === 200 && robots.body.includes(`${root}/sitemap.xml`));
const privacy = await get('/privacy');
check('Privacy page available', privacy.status === 200 && privacy.body.includes('Privacy'));
const studio = await get('/studio');
check('Studio is noindex', studio.status === 200 && (studio.headers.get('X-Robots-Tag') || '').includes('noindex'));
check('Studio is not cached', (studio.headers.get('Cache-Control') || '').includes('no-store'));
const unknown = await get('/this-should-not-exist-audit-v2');
check('Unknown URLs are true 404s', unknown.status === 404);
const api = await get('/api/enquiry');
check('Enquiry endpoint disallows GET', api.status === 405);
console.log(`\n${failures ? `${failures} check(s) failed. Do not launch yet.` : 'Basic public checks passed. Continue manual Auth/RLS/Turnstile tests.'}`);
process.exitCode = failures ? 1 : 0;
