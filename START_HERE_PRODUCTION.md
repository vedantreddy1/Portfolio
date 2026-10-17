# Kawalpreet Studio V2 — Production setup (Windows + Cloudflare Pages)

**What you get:** The original portfolio design, searchable server-rendered HTML, real project pages, a private creator dashboard, approved signup, login, email verification, authenticator-app MFA, protected media and enquiries, content revisions, sitemap, and editable SEO/FAQ content.

**Important:** Source code alone is not a deployed or audited production service. Complete all external setup, run the production build, deploy, and execute the launch tests below. No domain, login, Supabase project, Turnstile keys or real media have been supplied, so those cannot be preconfigured.

## 1. Prerequisites

- Node.js 22 LTS, VS Code, a GitHub account, Cloudflare account and Supabase account.
- A **single canonical HTTPS domain** for the portfolio (custom domain recommended; registration costs extra).
- A real email address for the creator. Use it only in Supabase Dashboard and the invitation SQL; do not hardcode passwords.
- A free Cloudflare Turnstile widget for the production hostname and a Supabase project.
- Approved portrait, real campaign covers/videos and a correct business contact address.

## 2. Extract and install

Open the folder containing `package.json` in VS Code and run:

```powershell
Copy-Item .env.example .env.local
npm install
npm run test
npm run dev
```

`npm run dev` serves the Vite frontend at `http://localhost:5173`. To test **Pages Functions, SSR and the secure enquiry API** locally, copy `.dev.vars.example` to `.dev.vars`, replace placeholders with local/test runtime keys, and run `npm run dev:pages` (typically `http://localhost:8788`). Never commit `.dev.vars`. Or deploy to Cloudflare. The Vite-only development server cannot execute Pages Functions. `/studio` remains locked without Supabase configuration.

## 3. Create the database — exact order matters

1. In https://supabase.com/dashboard create a new project.
2. Open **SQL Editor**. Run `sql/setup.sql` once (creates initial tables and storage).
3. Run `sql/production_v2.sql` (upgrades RLS, adds invitations, mandatory MFA, revisions, optimistic concurrency, Turnstile-only enquiry writes and an optional signup-blocking hook).
4. Preapprove **her real email** using this SQL (replace the example):

```sql
insert into public.portfolio_editor_invites (email)
values ('her-real-email@example.com')
on conflict (email) do update
set expires_at = now() + interval '14 days', used_at = null;
```

5. In **Authentication > Hooks**, enable **Before User Created** using the Postgres function `public.portfolio_before_user_created`. This step is required to block the creation of *any* uninvited Supabase Auth accounts. Without the hook, unauthorized people may register a Supabase Auth account but cannot enter Studio or access private data.
6. In **Authentication > Providers > Email**, keep **Confirm Email** enabled. Keep email/password signups enabled only while onboarding; if no new editors are expected, you can disable signup after the owner has registered. The hook should remain active if signup is enabled.
7. In **Authentication > Bot and Abuse Protection**, enable Cloudflare Turnstile CAPTCHA and enter the **Turnstile secret** (the browser passes tokens to Supabase Auth).
8. In **Authentication > URL Configuration**, set the canonical website URL and add `https://YOUR-DOMAIN/studio` to allowed redirect URLs. Add local development redirect only when testing.
9. Configure a reliable **custom SMTP sender** if needed for production email confirmation/password reset. Supabase's default email service has restrictions and is not intended for reliable business delivery.
10. In **Authentication > Security/Attack Protection**, enable leaked-password protection if available, configure reasonable rate limits and session timeouts, and review the auth logs.

**Existing V1 owners:** If a user was manually inserted into `portfolio_editors` before V2, their role remains. They must still enroll/verify MFA before editing or reading enquiries. If you want the before-user-created hook to allow a new owner, insert the invitation **before** attempting signup.

## 4. Create Cloudflare Turnstile widget

In Cloudflare > Turnstile, create a widget for the **actual site hostname**. Copy:
- **Site key** (public, used by Vite on login/signup/contact).
- **Secret key** (private, stored only in Cloudflare Pages Functions runtime and Supabase Auth CAPTCHA settings).

For localhost testing, use separate test keys or configure a supported local hostname. The production Turnstile hostname must match the site sending the form. Tokens are checked **on the server**, not only in the browser.

## 5. Configure local frontend

Put only the following public values in `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
VITE_TURNSTILE_SITE_KEY=YOUR_PUBLIC_TURNSTILE_SITE_KEY
```

**Never** put `SUPABASE_SECRET_KEY`, `TURNSTILE_SECRET_KEY`, a database password or SMTP password in any `VITE_` variable or in a Git commit.

## 6. Deploy to Cloudflare Pages (Git integration)

Push the project folder to a **private GitHub repository** (or another repo with protected branches). Do not commit `.env.local` or `.dev.vars`.

Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git:

| Field | Value |
|---|---|
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | Folder containing `package.json` |
| Node.js | 22 |

Add these **build-time public variables**:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
VITE_TURNSTILE_SITE_KEY=YOUR_PUBLIC_TURNSTILE_SITE_KEY
```

Add these **runtime variables/secrets for Pages Functions** in Cloudflare Pages Settings > Variables and Secrets (production environment):

```text
PUBLIC_SITE_URL=https://YOUR-CANONICAL-DOMAIN.com
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
TURNSTILE_SECRET_KEY=SECRET (encrypted secret)
SUPABASE_SECRET_KEY=SECRET (encrypted secret)
```

`PUBLIC_SITE_URL` **must** be the final canonical HTTPS domain, with no trailing slash. Never prefix the two secrets with `VITE_`. Check both the production and preview environment settings: preview sites are automatically `noindex` when the hostname differs from `PUBLIC_SITE_URL`.

Deploy. Add the custom domain in Cloudflare Pages and configure its DNS/HTTPS. Test both `www` and apex behavior; redirect one to the canonical host to avoid duplicate URLs. If no custom domain is used, set `PUBLIC_SITE_URL` to the permanent `https://PROJECT.pages.dev` address.

**Functions deployment:** The `functions/` directory must be at the project root, alongside `package.json`. The `public/_routes.json` file ensures static JS/CSS/media do not unnecessarily consume Function requests.

## 7. Creator signup, login, MFA

1. Visit `https://YOUR-DOMAIN/studio` and select **Have an invitation? Sign up**.
2. Enter the **preapproved** email and a strong password (12+ characters). Complete Turnstile.
3. Click the email confirmation link. If email doesn't arrive, check SMTP/Auth email logs and URL allowlist.
4. Sign in. The backend claims the editor role **only for an email on the allowlist that has been verified**.
5. On first entry, scan the QR code using an authenticator app, enter the 6-digit code, and enable MFA.
6. On later logins, the authenticator code is required again. Database RLS checks the JWT's `aal2` level, not just the UI.
7. In Studio, upload approved media, replace sample work, set contact details, and **Save changes**. Until the first publish, the edge-rendered fallback page is `noindex`.

If her authenticator device is lost, the site owner must use Supabase's supported account recovery/admin procedures; **never** create a public MFA bypass.

## 8. Enquiries

Visitors use Cloudflare Turnstile in the public contact form. The Pages Function `/api/enquiry` verifies the token, checks input/origin and sends a **server-only** database insert. The public Supabase anon role has **no enquiry insert permission**. Editors with MFA can view messages in Studio. The database additionally limits repeat enquiries by email.

**Test it:** Send one enquiry, see it in Studio, mark it read, try submitting without Turnstile (must fail), and try inserting into `portfolio_inquiries` directly with the public Supabase key (must fail). Do not test with real personal information until the privacy notice is reviewed.

## 9. SEO / GEO / AEO launch

1. In Studio > Settings, edit SEO title, description, social share image, and real FAQ answers.
2. Replace demo work cards with 6–12 approved projects, use descriptive project summaries and cover images, and set real video publication dates when known.
3. Verify `https://YOUR-DOMAIN/` HTML **View Source** contains readable text, canonical, Open Graph, JSON-LD and real project links **before JavaScript runs**.
4. Verify `https://YOUR-DOMAIN/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/privacy` and one real `/work/PROJECT_ID` URL.
5. Verify `/studio` has `X-Robots-Tag: noindex, nofollow` and a random unknown URL returns **404**.
6. Register the site with [Google Search Console](https://search.google.com/search-console/about), verify ownership, submit `/sitemap.xml`, inspect the homepage and a case study, and request indexing when ready. Optionally register in Bing Webmaster Tools.
7. Validate JSON-LD with [Google Rich Results Test](https://search.google.com/test/rich-results) and [Schema Markup Validator](https://validator.schema.org/). Not every schema type yields a Google rich result.
8. Run [PageSpeed Insights](https://pagespeed.web.dev/) and test Core Web Vitals on a real phone. Optimize images/video and keep external embeds lazy.
9. Use actual social profile URLs and consistently describe her expertise, services, location, collaborators, and verified outcomes. Do not fabricate testimonials, results, addresses or dates.
10. Check the rendered preview with a social sharing debugger after uploading an OG image.

**SEO** = search engine optimization. **AEO** = answer engine optimization. **GEO** = generative engine optimization. No magic tags or `llms.txt` file guarantee AI mentions. Google says foundational SEO, crawlability and helpful original content remain essential.

## 10. Final release gate

Do not announce a production launch until all of these are true:

- `npm install`, `npm run test` and `npm run build` pass on your machine or CI. After the first successful install, commit the generated `package-lock.json` and change CI to `npm ci` for deterministic builds. Run `npm run audit:live -- https://YOUR-DOMAIN` after deployment.
- Signup is invite-only (hook enabled), confirmed email is required, MFA is enforced, and non-editors cannot view enquiries or publish.
- Turnstile works on both Auth and the enquiry form, including server-side verification.
- Content edits appear publicly without redeploy; revision history works; simultaneous edit conflict is handled.
- Canonical URL, sitemap, SSR HTML, OG tags, robots and noindex behavior have been checked on the **deployed** site.
- Real creator media, contact details, privacy policy and brand permissions have been reviewed.
- Supabase and Cloudflare alerts/quotas, manual backups and credential rotation are planned.

This repository has automated unit tests and syntax checks, but a full npm build, live Supabase SQL migration, Auth/Turnstile flow, and deployed-site audit **cannot be certified from this offline environment**.
