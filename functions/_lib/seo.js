import { DEFAULT_CONTENT } from '../../src/data/defaultContent.js';

const text = (value, limit = 3000) => String(value ?? '').slice(0, limit);
export const escapeHtml = (value) => text(value, 20000).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const e = escapeHtml;
const allowedHttp = (value) => {
  try { const u = new URL(String(value || '')); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
};
export const projectPath = (project) => `/work/${encodeURIComponent(String(project.id || ''))}`;
export const realProjects = (data) => (Array.isArray(data?.projects) ? data.projects : []).filter(p => !p.placeholder && p.id && p.title);
export const originFor = (request, env) => {
  const configured = allowedHttp(env.PUBLIC_SITE_URL);
  return (configured || new URL(request.url).origin).replace(/\/$/, '');
};
export const nonCanonicalHost = (request, env) => {
  const canonical = allowedHttp(env.PUBLIC_SITE_URL);
  return Boolean(canonical && new URL(request.url).host !== new URL(canonical).host);
};

export async function getPublicContent(env) {
  const url = allowedHttp(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { data: DEFAULT_CONTENT, updated_at: null, source: 'fallback' };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    let response;
    try {
      response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/portfolio_content?id=eq.1&select=data,updated_at`, {
        headers: { apikey: key, Accept: 'application/json' }, signal: controller.signal
      });
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error('Content API unavailable');
    const rows = await response.json();
    if (rows?.[0]?.data) {
      const saved = rows[0].data;
      return { data: { ...DEFAULT_CONTENT, ...saved, profile: { ...DEFAULT_CONTENT.profile, ...(saved.profile || {}) }, faqs: Array.isArray(saved.faqs) ? saved.faqs : DEFAULT_CONTENT.faqs }, updated_at: rows[0].updated_at, source: 'published' };
    }
    return { data: DEFAULT_CONTENT, updated_at: null, source: 'unpublished' };
  } catch { return { data: DEFAULT_CONTENT, updated_at: null, source: 'unavailable' }; }
}

const safeJson = (object) => JSON.stringify(object).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const meta = (name, value, property = false) => value ? `<meta ${property ? 'property' : 'name'}="${e(name)}" content="${e(value)}">` : '';
const paragraph = (value) => `<p>${e(value)}</p>`;
const section = (id, heading, body) => `<section id="${e(id)}"><h2>${e(heading)}</h2>${body}</section>`;

export function buildSeoPage({ request, env, content, project = null, privacy = false, updated_at = null, source = 'published', nonce = '' }) {
  const profile = content.profile || DEFAULT_CONTENT.profile;
  const origin = originFor(request, env);
  const url = `${origin}${project ? projectPath(project) : privacy ? '/privacy' : '/'}`;
  const name = text(profile.name || DEFAULT_CONTENT.profile.name, 120);
  const title = privacy ? `Privacy & enquiries | ${name}` : project ? `${text(project.title, 80)} | ${name} — UGC Case Study` : text(profile.seoTitle || `${name} | UGC Creator & Content Strategist`, 110);
  const description = privacy ? `How ${name}'s portfolio handles brand enquiries and personal information.` : project ? text(project.seoDescription || project.description || `${project.title} by ${name}`, 170) : text(profile.seoDescription || profile.intro, 170);
  const image = allowedHttp(project?.coverUrl || profile.ogImageUrl || profile.portraitUrl || profile.heroImageUrl);
  const sameAs = [profile.instagram, profile.youtube, profile.linkedin, profile.snapchat].map(allowedHttp).filter(Boolean);
  const person = {
    '@type': 'Person', '@id': `${origin}/#creator`, name,
    description: text(profile.bio, 1200), url: `${origin}/`,
    ...(image ? { image } : {}), ...(sameAs.length ? { sameAs } : {}),
    ...(profile.location ? { homeLocation: { '@type': 'Place', name: text(profile.location, 100) } } : {}),
    knowsAbout: ['User-generated content', 'Short-form video', 'Food content', 'Lifestyle content', 'Travel content', 'Technology reviews']
  };
  const nodes = [
    { '@type': 'WebSite', '@id': `${origin}/#website`, name: `${name} — Portfolio`, url: `${origin}/`, inLanguage: 'en' },
    person,
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: 'en', isPartOf: { '@id': `${origin}/#website` }, about: { '@id': `${origin}/#creator` }, ...(updated_at ? { dateModified: updated_at } : {}) }
  ];
  if (project) nodes.push({ '@type': 'CreativeWork', '@id': `${url}#project`, name: text(project.title, 150), description: text(project.description, 1500), url, creator: { '@id': `${origin}/#creator` }, ...(image ? { image } : {}), ...(project.brand ? { about: text(project.brand, 100) } : {}) });
  // Google VideoObject needs a real thumbnail, a real published date and an accessible video.
  // Never synthesize those values for placeholder campaigns.
  if (project && image && /^\d{4}-\d{2}-\d{2}$/.test(project.publishedAt || '')) {
    const videoUrl = allowedHttp(project.videoUrl);
    if (videoUrl) {
      const direct = /\.(mp4|webm|ogg)(?:[?#]|$)/i.test(videoUrl);
      const video = new URL(videoUrl);
      const host = video.hostname.toLowerCase().replace(/^www\./,'');
      const youtubeId = host === 'youtu.be' ? video.pathname.slice(1).split('/')[0] : (host === 'youtube.com' || host === 'm.youtube.com') ? (video.searchParams.get('v') || video.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]) : '';
      const embed = /^[A-Za-z0-9_-]{11}$/.test(youtubeId || '') ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : '';
      if (direct || embed) nodes.push({ '@type': 'VideoObject', name: text(project.title, 150), description: text(project.description, 1500), thumbnailUrl: image, uploadDate: project.publishedAt, ...(direct ? { contentUrl: videoUrl } : { embedUrl: embed }), creator: { '@id': `${origin}/#creator` } });
    }
  }
  const robots = source !== 'published' || !allowedHttp(env.PUBLIC_SITE_URL) || nonCanonicalHost(request, env) ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
  const head = [
    `<title>${e(title)}</title>`, meta('description', description), meta('robots', robots),
    `<link rel="canonical" href="${e(url)}">`,
    meta('og:type', project ? 'article' : 'website', true), meta('og:title', title, true),
    meta('og:description', description, true), meta('og:url', url, true), meta('og:site_name', `${name} Portfolio`, true), meta('og:locale', 'en_IN', true),
    meta('twitter:card', image ? 'summary_large_image' : 'summary'), meta('twitter:title', title), meta('twitter:description', description),
    image ? meta('og:image', image, true) + meta('og:image:alt', project?.title || `Creator portrait of ${name}`, true) + meta('twitter:image', image) : '',
    `<script type="application/ld+json" nonce="${e(nonce)}">${safeJson({ '@context': 'https://schema.org', '@graph': nodes })}</script>`
  ].join('\n');
  let body = '';
  if (privacy) {
    body = `<article class="seo-snapshot"><h1>Privacy & enquiries</h1><p>When you send a collaboration enquiry, your name, email, optional company, service, and message are stored to respond to your request. Cloudflare Turnstile is used for spam prevention. Contact the portfolio owner through the website to request removal of an enquiry.</p><p><a href="/">Return to portfolio</a></p></article>`;
  } else if (project) {
    body = `<article class="seo-snapshot"><nav aria-label="Breadcrumb"><a href="/">Portfolio</a> / Work</nav><h1>${e(project.title)}</h1>${paragraph(project.description)}${project.brand ? paragraph(`Brand: ${project.brand}`) : ''}${project.format ? paragraph(`Format: ${project.format}`) : ''}${project.result ? paragraph(`Reported result: ${project.result}`) : ''}${image ? `<img src="${e(image)}" alt="${e(project.title)}" width="720" height="450">` : ''}<p><a href="/">Explore the full portfolio</a></p></article>`;
  } else {
    const services = (content.services || []).filter(s => s.title).map(s => `<li><strong>${e(s.title)}</strong> — ${e(s.description)}</li>`).join('');
    const projects = realProjects(content).map(p => `<li><a href="${e(projectPath(p))}">${e(p.title)}</a>${p.description ? ` — ${e(p.description)}` : ''}</li>`).join('');
    const brands = (content.brands || []).filter(b => b.name).map(b => `<li>${e(b.name)}</li>`).join('');
    const faqs = (content.faqs || []).filter(f => f.question && f.answer).map(f => `<div><h3>${e(f.question)}</h3>${paragraph(f.answer)}</div>`).join('');
    const press = (content.press || []).filter(p => p.title && allowedHttp(p.url)).map(p => `<li><a href="${e(allowedHttp(p.url))}">${e(p.title)}</a> — ${e(p.outlet)}</li>`).join('');
    body = `<div class="seo-snapshot"><header><h1>${e(name)} — UGC Creator & Content Strategist</h1>${paragraph(profile.intro)}</header>${section('about', 'About the creator', paragraph(profile.bio))}${section('services', 'UGC creation services', `<ul>${services}</ul>`)}${projects ? section('work', 'Selected portfolio projects', `<ul>${projects}</ul>`) : ''}${section('brands', 'Brand collaborations', `<ul>${brands}</ul>`)}${faqs ? section('faq', 'Frequently asked questions', faqs) : ''}${press ? section('press', 'Published coverage', `<ul>${press}</ul>`) : ''}${section('contact', 'Collaborate with Kawalpreet', `${paragraph(content.contact?.subheading || 'Enquire about UGC projects and brand collaborations.')}${profile.email ? `<a href="mailto:${e(profile.email)}">Email for collaborations</a>` : ''}`)}</div>`;
  }
  return { head, body, robots, title, url };
}

export async function renderPublicHtml(context, project = null, privacy = false) {
  const { request, env } = context;
  const { data, updated_at, source } = await getPublicContent(env);
  if (source === 'unavailable') return new Response('Temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  if (project) {
    project = realProjects(data).find(p => String(p.id) === String(project.id));
    if (!project) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
  }
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const page = buildSeoPage({ request, env, content: data, project, privacy, updated_at, source, nonce });
  const asset = await env.ASSETS.fetch(new Request(new URL('/', request.url)));
  if (!asset.ok) return asset;
  let html = await asset.text();
  html = html.replace(/<meta name="description"[^>]*>\s*/i, '')
    .replace(/<meta property="og:[^>]*>\s*/gi, '')
    .replace(/<title>[^<]*<\/title>\s*/i, '')
    .replace('<!-- DYNAMIC_SEO_HEAD -->', page.head)
    .replace('<div id="root"></div>', `<div id="root">${page.body}</div>`);
  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=120, stale-while-revalidate=300');
  headers.set('X-Robots-Tag', page.robots);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  const supabaseOrigin = allowedHttp(env.SUPABASE_URL || env.VITE_SUPABASE_URL) ? new URL(env.SUPABASE_URL || env.VITE_SUPABASE_URL).origin : '';
  const wsOrigin = supabaseOrigin.replace(/^https:/, 'wss:');
  headers.set('Content-Security-Policy', `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data: blob:; font-src 'self' https://fonts.gstatic.com; media-src 'self' https: blob:; connect-src 'self' ${supabaseOrigin} ${wsOrigin} https://challenges.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com; frame-src https://www.youtube-nocookie.com https://challenges.cloudflare.com; upgrade-insecure-requests`);
  return new Response(html, { status: 200, headers });
}
