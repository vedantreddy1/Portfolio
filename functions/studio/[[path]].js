export async function onRequestGet({ request, env }) {
  const response = await env.ASSETS.fetch(new Request(new URL('/', request.url)));
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  const origin = env.SUPABASE_URL ? new URL(env.SUPABASE_URL).origin : '';
  headers.set('Content-Security-Policy', `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data: blob:; font-src 'self' https://fonts.gstatic.com; media-src 'self' https: blob:; connect-src 'self' ${origin} ${origin.replace(/^https:/,'wss:')} https://challenges.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com; frame-src https://www.youtube-nocookie.com https://challenges.cloudflare.com; upgrade-insecure-requests`);
  return new Response(response.body, { status: response.status, headers });
}
