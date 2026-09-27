# Security model

Nutag is a portfolio demo, not a traffic-routing VPN. Its public clients only use the Supabase publishable key; no service-role key, server key, WireGuard key, or payment credential belongs in this repository.

## Data access

Every exposed table uses RLS. Users can read only their own rows. They can create only an inactive subscription-interest record and their own open connection-session record. The hardening migration makes session identity fields immutable and permits an open session only to be closed.

## Client protections

- Browser sessions are stored only in extension-local storage, checked for expiry at launch, and cleared on logout or invalid authorization.
- Mobile configuration is supplied by ignored `EXPO_PUBLIC_` environment variables; the publishable key is expected, while privileged keys are forbidden.
- Clients validate basic email/password input, avoid HTML interpolation of account data, and display server errors without exposing secrets.

## Before inviting public users

Configure Supabase Auth rate limits and CAPTCHA in the dashboard, use a custom SMTP provider, retain email confirmation, and review the Database Security Advisor. Do not enable real VPN traffic until a server-side provisioning service and native WireGuard integrations are reviewed.

