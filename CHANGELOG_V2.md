# V2 production upgrade — what changed from the original portfolio

## SEO / GEO / AEO
- Added Cloudflare Pages Functions for server-generated, crawler-readable HTML on `/`, `/privacy`, and real `/work/:id` case studies.
- Dynamic canonical URLs, title/description, Open Graph/Twitter previews, Person/WebSite/WebPage/CreativeWork JSON-LD; conditional VideoObject with real video, cover and publication date.
- Dynamic `/sitemap.xml`, `/robots.txt`, optional `/llms.txt`; noindex on previews/unpublished content; true 404 for unknown pages.
- Editable FAQ content, SEO title and social image; practical SEO content readiness checklist in Studio.
- Updated public project cards to be real links, while preserving the original modal interactions and visual design.

## Authentication and security
- Locked `/studio` when Supabase is not configured (removed open local editing in production).
- Added preapproved email signup, email verification, login, password reset, Turnstile CAPTCHA and mandatory TOTP MFA.
- Added a Supabase Before User Created hook for strict invite-only account creation (must be enabled in Dashboard).
- Database-level MFA authorization (`aal2`) for publishing, private enquiries and media uploads.
- Moved enquiry inserts from anonymous direct Supabase writes to a Cloudflare Pages Function with server-side Turnstile verification and a server-only Supabase secret key.
- Added email-based enquiry throttling, CSP, security headers, noindex/no-store on Studio and a privacy notice.

## Publishing reliability
- Added version-checked publishing RPC to avoid silent overwrites by multiple editors.
- Added private revision history (up to 50 versions), restore-to-draft, and content size guard.
- Improved image upload validation and best-effort WebP compression for large JPEG/PNG/WebP files.
- Added Cloudflare Pages runtime configuration, local `.dev.vars` template, GitHub Actions CI, Dependabot, unit tests and a read-only live deployment audit script.

## Preserved
- Original color palette, typography, layout, hero, gallery, services, brand cards, about section, contact styling, responsive design and Studio navigation.
- Original supplied media kit PDF and PDF-derived facts. No new fictitious projects, testimonials, analytics, emails or contact information were added.

## Not verified or included
- npm install / production Vite build (npm registry DNS was unavailable in the authoring environment).
- Running SQL against a real Supabase project, SMTP email delivery, Turnstile live challenges, production deployment, custom domain, Search Console ownership, actual brand assets, real end-to-end auth or penetration testing.
- A guarantee of SEO rankings, Google rich results, AI citations, zero cost under all traffic conditions, or resistance to all attacks.
