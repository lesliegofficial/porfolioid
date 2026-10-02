# Supabase Auth rollout

This change replaces the custom password comparison and unverified profile cache with Supabase Auth access and refresh tokens. The Netlify functions validate each protected request against `/auth/v1/user`, resolve the verified email to the existing account, and enforce primary/secondary profile ownership. Existing RLS remains deny-by-default; no direct browser database access or new permissive policies are introduced. Public EPK reads and media delivery remain public.

## Required project configuration

In Supabase Authentication → URL Configuration for project `oiqxybthvcnwheajtxxo`, set the Site URL to `https://porfolioid.com/login.html` and allow `https://porfolioid.com/login.html` as an exact redirect URL. If the app is used on a www domain, redirect it to the canonical porfolioid.com domain so browser token storage and email callbacks share an origin. Use the default confirmation/recovery email templates with `{{ .ConfirmationURL }}`. Verify email signups are enabled, password policy is compatible, and production email delivery is configured. Preview sign-in can use the same backend, but email callbacks always return to the canonical production login page.

The connected Supabase tools cannot read or update URL configuration or SMTP settings. These settings must be verified before merging/deploying. No account passwords or live Auth users were changed while preparing this branch.

## Deployment and account transition

Keep the current server-only `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` Netlify environment variables; never put the service key in browser files. Deploy frontend and functions together. Existing browser display sessions alone are no longer accepted; users must sign in again.

The first successful existing-account sign-in verifies its legacy credentials, creates a confirmed Supabase Auth account, obtains a session, and replaces the legacy password with a noncredential marker. Migration is attempted only on Supabase's invalid-credentials response; it cannot bypass rate limiting. If an Auth account already exists, migration will not overwrite it. Password recovery for a legacy account starts working after this first sign-in; a user who has forgotten the legacy password needs an administrator-assisted account recovery. New signups store no plaintext password and require email confirmation when enabled in Supabase.

Account ownership currently resolves a verified Auth email to the legacy `users.email` because the existing tables use text IDs/slugs. Changing an Auth email requires updating the corresponding application account email through a trusted server/admin workflow. A future explicit `auth_user_id` migration should replace this compatibility mapping when email-change support is added.

## Validation

Run `node --test tests/auth.test.js`. Tests cover forged and expired tokens, unconfirmed emails, primary/secondary ownership, cross-account saves/analytics/profile operations, legacy migration, rate limits, frontend guards, and keeping tokens away from third-party upload/CDN URLs.

Before production release, test with a preview and a disposable account: sign up → email confirmation → onboarding → dashboard, refresh an expired session, sign out, reset password, save a profile, upload a PDF and R2 asset, and reject edits to another profile. Then verify the existing account can sign in and retain its primary and secondary profiles. These live email/session/upload flows have not been exercised by the local mocked tests.

Dashboard/onboarding HTML are static shells; the client guard hides the UI until verified, while server checks protect the operations and user-specific data. This does not make HTML/source code private. Access tokens remain browser-local, matching this static app architecture. Sign-out revokes refresh sessions; already issued access tokens can remain valid until their expiry. No instant JWT revocation guarantee is implied.
