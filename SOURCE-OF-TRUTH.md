# Cognation source of truth

## Canonical source of truth

The canonical source of truth is the **cognation-site** content that lives in GitHub `Waymakerscs/cognation` (this repository).

Head Hancho (HH) redeploys that content to Cloudflare Pages project `cognation` (`cognation-3md.pages.dev`).

## pages-deploy is a deploy artifact only

`/workspace/cognation-pages-deploy` is a deploy artifact. It may be stale. Do not edit it as source of truth.

Do not treat parallel box zips or mirrors as an editable source of truth. Change the GitHub repository, then HH redeploys Pages from GitHub.

## Cognation is not Waymakers

Never mix Cognation with Waymakers:

- GitHub: `Waymakerscs/waymakers`
- Pages: `waymakers.pages.dev`
- The Supabase project used for Waymakers

Cognation has its own repository, Pages project, and data. Do not copy Waymakers credentials, project refs, or deploy targets into this repo.

## Runtime config (no secrets in git)

The Supabase URL and publishable key are not stored in this repository. Cloudflare Pages injects them at request time from environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

`/runtime-config` (Pages Function `functions/runtime-config.js`) writes those values onto `window.CognationConfig` for the browser. If the variables are unset, sign-in stays unconfigured. Do not commit either value, and do not commit a Supabase `service_role` secret.

## What Cloudflare Pages cannot run

This site is static hosting on Cloudflare Pages, plus the small Functions already in `functions/`.

- Pages cannot run the Express app in `server/`. The session and screen-break routes in that server (`/api/session/*`) are not a live backend on Pages. The screen-break surface is labeled **local demo only**.
- A moderation queue write from the browser to the box path (`/workspace/news-moderation/`) is not available on Pages. NEWS report actions stay in this browser (`localStorage`). That path is labeled **local demo only**.
- Moderation Function ingest is deferred. Do not add a Pages Function that accepts moderation reports until that work is explicitly in scope. Labels only.

Go-live / WebRTC, payment controls (including Buy / tip; there is no Apple Pay charge), and calendar OAuth are UI stubs. Those surfaces keep a visible local-demo label. Demo chrome stays on those stubs and on the explicit demo unlock control. It is not production authentication.

## Demo access (no shared password)

Public builds do not ship a shared password or WELL one-time code.

- Production sign-in uses the configured Cognation account provider when runtime config is present.
- Local preview uses an explicit **Demo unlock — not real auth** control, a `?demo=1` query flag, or a build-time `window.__COGNATION_DEMO__` flag. That flag defaults to false (unset) for production. Do not set it in the Pages build.
- That path is not production authentication.
