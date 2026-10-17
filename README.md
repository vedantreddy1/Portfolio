# Kawalpreet Studio V2 — Production-ready architecture starter

**Preserves the V1 design.** React + Vite frontend, Supabase PostgreSQL/Auth/Storage, Cloudflare Pages Functions, Cloudflare Turnstile.

## Start here

1. **[START_HERE_PRODUCTION.md](./START_HERE_PRODUCTION.md)** — exact Windows commands, Supabase SQL order, approved signup/login/MFA, Cloudflare variables, launch tests.
2. **[ARCHITECTURE_SECURITY_SEO.md](./ARCHITECTURE_SECURITY_SEO.md)** — logical/physical architecture, security boundaries, SEO/GEO/AEO behavior, costs and limits.
3. `sql/setup.sql` then `sql/production_v2.sql` — database creation and V2 security migration.
4. `npm run test` — unit tests for SEO rendering, escaping, Turnstile API authorization and failures.
5. `sql/security_smoke_checks.sql` — read-only post-migration database checks.
6. `CHANGELOG_V2.md` and `TEST_REPORT.md` — changes and verified limitations.

## Features

- Dynamic, responsive creator portfolio and private Studio with an editable profile, brands, projects, metrics, services, press, FAQ, media uploads, and enquiry inbox.
- Invitation-only signup when the Supabase Before User Created hook is enabled; email verification; password login/reset; Cloudflare Turnstile Auth CAPTCHA; mandatory TOTP MFA for all private database operations.
- Versioned publishing with concurrency checks, private revision history and restore-to-draft.
- Server-rendered crawlable public HTML and dynamic SEO/OG/JSON-LD; approved project detail pages; sitemap, robots, noindex preview/admin, 404 handling and optional llms.txt.
- Contact form routed through a Pages Function with server-side Turnstile verification; service-role key never exposed to the browser; RLS blocks anonymous database inserts.
- Privacy page, security headers and public media limits.

**Not included or not yet verified:** Live credentials, a custom domain, real creator media, deployment, Search Console ownership, legal approval of privacy text, npm production build or a live penetration test. The ZIP contains code and configuration, not a running production service.

### Quick local commands

```powershell
Copy-Item .env.example .env.local
npm install
npm run test
npm run dev
```

After configuring Cloudflare runtime bindings, use `npm run dev:pages` to test Pages Functions locally, or deploy through Cloudflare Pages. `npm run dev` alone does not execute `/api/enquiry` or edge SEO functions.

The original supplied PDF is available as `public/media-kit.pdf`; replace it if the creator wants an updated public media kit.
