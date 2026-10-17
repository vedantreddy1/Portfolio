import { getPublicContent, originFor, realProjects, projectPath, escapeHtml, nonCanonicalHost } from './_lib/seo.js';
export async function onRequestGet({ request, env }) {
  const { data, updated_at, source } = await getPublicContent(env);
  if (source === 'unavailable') return new Response('Temporarily unavailable', { status: 503, headers: { 'Retry-After': '300' } });
  const origin = originFor(request, env);
  const links = [`${origin}/`, `${origin}/privacy`, ...realProjects(data).map(p => origin + projectPath(p))];
  const lastmod = updated_at ? `<lastmod>${escapeHtml(updated_at.slice(0, 10))}</lastmod>` : '';
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${links.map(url => `<url><loc>${escapeHtml(url)}</loc>${lastmod}</url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=300', 'X-Robots-Tag': source !== 'published' || !env.PUBLIC_SITE_URL || nonCanonicalHost(request, env) ? 'noindex' : 'index' } });
}
