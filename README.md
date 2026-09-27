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

## Stripe Billing

Paid access is implemented with Stripe Checkout, Stripe Billing invoices, the Stripe Customer Portal, and a signed Stripe webhook. Browser code never receives a Stripe secret, price ID, webhook secret, or service-role key.

1. Create the $6/month and $48/year recurring Prices in Stripe, then configure the Edge Function secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, and `APP_URL`. Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions.
2. Apply `20260927020000_stripe_billing.sql`, then deploy `create-checkout-session`, `create-billing-portal-session`, and `stripe-webhook`. The webhook is intentionally configured with `verify_jwt = false`; it instead verifies Stripe's `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET` using the untouched request body.
3. In Stripe, send `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and invoice events (at minimum `invoice.paid`, `invoice.payment_failed`, and `invoice.voided`) to `/functions/v1/stripe-webhook`.

Stripe is authoritative. The webhook idempotently mirrors subscription status and invoice links into Supabase and grants a `vpn_entitlements` row only for current `active` or `trialing` subscriptions. Any future WireGuard/control-plane API must validate that table with its service credential before provisioning or permitting traffic; never rely on the browser's Connect button.

## Client foundations

- `clients/extension` is a standards-based WebExtension companion for Chrome, Edge, and Firefox (Safari wrapping comes later). It authenticates against Supabase and records the same demo connection sessions; it does **not** route browser traffic.
- `clients/mobile` is an Expo foundation for Android and iPhone. Copy `.env.example` to `.env`, use the project publishable key, run `npm install`, then `npm run android` or `npm run ios`. It shares the Supabase demo session state.

Real VPN traffic needs a WireGuard server/control plane and native platform integration before it can replace the demo Connect controls.
