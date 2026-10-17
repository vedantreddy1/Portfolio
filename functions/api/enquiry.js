// Server-only Cloudflare Pages Function. SUPABASE_SECRET_KEY must NEVER be prefixed VITE_.
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex', 'Content-Security-Policy': "default-src 'none'" }
});
const string = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit + 1) : '';
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 200;

export async function onRequestPost({ request, env }) {
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY; // legacy JWT fallback
  if (!env.TURNSTILE_SECRET_KEY || !secretKey || !env.SUPABASE_URL) return json({ error: 'Contact form is not configured.' }, 503);
  const origin = request.headers.get('Origin');
  const actual = new URL(request.url).origin;
  const allowed = new Set([actual, ...(env.PUBLIC_SITE_URL ? [new URL(env.PUBLIC_SITE_URL).origin] : [])]);
  if (!origin || !allowed.has(origin)) return json({ error: 'Request not allowed.' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'JSON required.' }, 415);
  if (Number(request.headers.get('content-length') || 0) > 12000) return json({ error: 'Request too large.' }, 413);
  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return json({ error: 'Request too large.' }, 413);
    payload = JSON.parse(raw);
  } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({ error: 'Invalid request.' }, 400);
  if (payload.website) return json({ ok: true }); // honeypot; never store
  const name = string(payload.name, 100);
  const email = string(payload.email, 200).toLowerCase();
  const company = string(payload.company, 120);
  const service = string(payload.service, 120);
  const message = string(payload.message, 3000);
  const token = string(payload.turnstileToken, 2048);
  if (!name || name.length > 100 || !validEmail(email) || company.length > 120 || service.length > 120 || message.length < 10 || message.length > 3000 || !token || token.length > 2048) return json({ error: 'Please check the enquiry fields and verification.' }, 400);
  let verified;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) body.set('remoteip', ip);
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    verified = result.ok ? await result.json() : null;
  } catch { return json({ error: 'Verification service unavailable. Please try again.' }, 503); }
  if (!verified?.success || verified.hostname !== new URL(origin).hostname) return json({ error: 'Verification expired or failed. Please retry.' }, 403);
  try {
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/portfolio_inquiries`, {
      method: 'POST', headers: {
        apikey: secretKey,
        ...(secretKey.startsWith('eyJ') ? { Authorization: `Bearer ${secretKey}` } : {}),
        'Content-Type': 'application/json', Prefer: 'return=minimal'
      }, body: JSON.stringify({ name, email, company, service, message })
    });
    if (!response.ok) {
      // Do not expose database error or account details.
      if (response.status === 409 || response.status === 400) return json({ error: 'Please wait before sending another enquiry.' }, 429);
      return json({ error: 'Unable to send right now. Please try again later.' }, 503);
    }
    return json({ ok: true }, 201);
  } catch { return json({ error: 'Unable to send right now. Please try again later.' }, 503); }
}

export const onRequestGet = () => json({ error: 'Method not allowed.' }, 405);
