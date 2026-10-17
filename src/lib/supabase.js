import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const isConfigured = Boolean(url && key);
export const supabase = isConfigured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

export function cleanUrl(input) {
  if (!input || typeof input !== 'string') return '';
  try {
    const url = new URL(input.trim());
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function youtubeEmbed(url) {
  const safe = cleanUrl(url);
  if (!safe) return null;
  try {
    const u = new URL(safe);
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    let id = '';
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    if (h === 'youtube.com' || h === 'm.youtube.com') {
      id = u.searchParams.get('v') || '';
      if (!id) id = u.pathname.match(/^\/(shorts|embed)\/([^/]+)/)?.[2] || '';
    }
    return /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

export function safeLink(url) {
  if (typeof url === 'string' && /^\/[A-Za-z0-9_./-]+$/.test(url) && !url.includes('..')) return url;
  return cleanUrl(url);
}

export function safeAsset(url) {
  if (typeof url === 'string' && /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) return url;
  return cleanUrl(url) || '';
}
