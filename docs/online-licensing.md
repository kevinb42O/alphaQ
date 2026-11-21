# AQx online licensing

Production site: `https://aqxmenu.vercel.app`. Management: `/admin/`. API: `POST /api/license`.

The public website remains static. Vercel's API function uses production Secret environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (accepts a modern Supabase secret key), `AQX_ADMIN_SECRET` (40+ character session signing secret), `AQX_ADMIN_EMAIL`, and `AQX_ADMIN_PASSWORD_HASH`. The password hash uses salted scrypt; the plaintext password belongs only in the owner's private credential store. `APP_ORIGIN` optionally overrides the production same-origin administrator check. No server credential is present in the public assets or desktop app.

Apply `supabase/001_licensing.sql` to install the schema. All license, rate-limit and audit tables use RLS and deny direct `anon` / `authenticated` access. Only the backend service role may use the verification, rate and management functions. These are security-invoker functions with an empty search path.

## License behavior

Keys have 128 random bits; only SHA-256 key hashes are stored. Allowed durations: 1, 3, 7 (legacy), 30 days or 0 for permanent owner access. New keys are unactivated. The first successful key/device check atomically assigns a device, activation time and expiry using database time. Row locks prevent two PCs from claiming one new key concurrently. A reset clears only the device binding and preserves activation and expiry. Revocation blocks future checks. Restoration does not extend an expired license.

The native launcher sends the key and a SHA-256 device identifier over certificate-validated HTTPS. Raw MachineGuid values are not sent. No offline fallback exists in the online edition. Local DPAPI storage remembers the key, not an entitlement. The service is checked again before each new launch, including permanent owner keys. Existing offline builds and extracted components remain independent. Already-running game sessions are not stopped at expiry.

## Administration

The administrator email/password is separate from the owner's permanent application key. Sign in at `/admin/`; the server issues a signed Secure, HttpOnly, SameSite=Strict cookie valid for one hour. Administrator requests require same-origin JSON. Session signatures change if the signing secret, email or password hash changes. Login attempts and license requests have persistent database rate limits. Legacy secret-only login is disabled.

Generate keys, save the CSV immediately, and deliver individual keys through Discord. Plaintext generated keys are returned only to the authenticated administrator and are not retained on the server. You can revoke/restore a key or reset its device binding. Labels allow customer tracking without saving keys in plaintext. Avoid putting sensitive customer information into labels.

## Checks

`npm test` checks key generation/normalization and administrator-session signing and expiry. `npm run check` / `npm run build` validate the existing website. Live acceptance must additionally cover unused activation, repeat checks, wrong-device denial, revocation/restoration, reset without expiry extension, expiry, permanent keys, concurrency, access denial to public Supabase roles, failed administrator login and native Windows verification.

The old offline key batch can be imported by hash with original durations, but its local activation dates cannot be inferred by the server. Its online timers therefore start on first online activation. A new 3-day batch matches the current website pricing. Keep private key exports outside this repository.
