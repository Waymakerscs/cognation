# Cognation Supabase setup

The browser is configured for Cognation's Supabase project. Before enabling
multi-user UI flows, create the database objects:

1. In Supabase, open **SQL Editor** → **New query**.
2. Paste and run `migrations/20260924_cognation_social.sql`.
3. Paste and run `migrations/20260925_profile_emails.sql` so each profile page stores its email. Signup still creates one auth user: the personal email is the login, and the professional email is stored on the professional profile.
4. In **Authentication** → **Providers** → **Email**, enable email/password.
5. For the initial preview, turn off **Confirm email** only if you need
   immediate test logins. Turn it back on before inviting real users.
6. Add the deployed Cognation address in **Authentication** → **URL
   Configuration** → **Site URL** and **Redirect URLs**.

The publishable key in `js/cognation-config.js` is safe to ship to the browser.
Never place the Supabase `service_role` secret in frontend JavaScript or commit
it to the repository.
