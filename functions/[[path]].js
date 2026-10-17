// Unknown public URLs return a real 404 instead of an SEO-damaging SPA soft 404.
export const onRequestGet = () => new Response('Page not found', {
  status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=60' }
});
