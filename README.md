# Nutag VPN demo

A static demo dashboard for Nutag: email/password authentication, per-user connection session history, and a placeholder plan-interest flow backed by Supabase.

## Run locally

Serve this directory with any static web server (for example, `npx serve .`). Set the Supabase project's **Site URL** and allowed redirect URLs to the local address you use, then open `index.html` through that server.

## Production deployment

Deploy the root directory to any static host (GitHub Pages, Netlify, or Cloudflare Pages). In the Supabase Auth settings, set the Site URL and add these redirect URLs:

- `https://YOUR-DOMAIN/auth.html`
- `https://YOUR-DOMAIN/dashboard.html`

The browser only contains the Supabase publishable key. Never put a `service_role` key in this project.

## Database

The canonical schema is in `supabase/migrations/20260927000000_initial_schema.sql`. Apply it through the Supabase SQL Editor or with the Supabase CLI after linking the project. It creates the `profiles`, `subscriptions`, and `connection_sessions` tables, grants only required access, and enables per-user RLS policies.

Paid subscriptions are deliberately not activated by the browser. A payment-webhook backend should create `active` subscription rows with a server-only/service-role credential.

