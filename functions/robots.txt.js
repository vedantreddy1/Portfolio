import { originFor } from './_lib/seo.js';
export const onRequestGet = ({ request, env }) => new Response(`User-agent: *\nAllow: /\nSitemap: ${originFor(request, env)}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
