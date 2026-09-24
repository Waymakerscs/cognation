# Cognation Supabase setup

The browser is configured for Cognation's Supabase project. Before enabling
multi-user UI flows, create the database objects:

1. In Supabase, open **SQL Editor** → **New query**.
2. Paste and run `migrations/20260924_cognation_social.sql`.
3. In **Authentication** → **Providers** → **Email**, enable email/password.
4. For the initial preview, turn off **Confirm email** only if you need
   immediate test logins. Turn it back on before inviting real users.
5. Add the deployed Cognation address in **Authentication** → **URL
   Configuration** → **Site URL** and **Redirect URLs**.

The publishable key in `js/cognation-config.js` is safe to ship to the browser.
Never place the Supabase `service_role` secret in frontend JavaScript or commit
it to the repository.
