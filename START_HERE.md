# Start here — V2

Open **START_HERE_PRODUCTION.md** for the full, ordered production setup and **ARCHITECTURE_SECURITY_SEO.md** for system diagrams and security/SEO details.

For local UI only: `npm install`, `npm run test`, `npm run dev`.

**Security:** The Studio is locked until Supabase is configured. Run both SQL files in order, enable the invitation-only Auth hook, email confirmation, Turnstile Auth CAPTCHA and mandatory TOTP MFA. Do not deploy without the required runtime secrets, domain and real content.
