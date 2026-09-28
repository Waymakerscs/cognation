# Cognation source of truth

This file is the canonical map for where Cognation code lives, what deploys it, and what this static site must not be confused with.

## Canonical repository and deploy

- **GitHub (source of truth for code):** `Waymakerscs/cognation`
- **Cloudflare Pages project:** `cognation`
- **Pages hostname:** `cognation-3md.pages.dev`

Head Hancho (HH) redeploys Cloudflare Pages from this GitHub repository. Treat this repo as the source of truth for code.

## Box deploy sync tree

A Box deploy sync tree historically lived at `/workspace/cognation-pages-deploy`. That tree may lag this repository. Do not edit it as if it were the source of truth. HH redeploys Pages from GitHub.

Do not treat parallel box zips or mirrors as an editable source of truth.

## Cognation is not Waymakers

Never mix Cognation with Waymakers:

- GitHub: `Waymakerscs/waymakers`
- Pages: `waymakers.pages.dev`
- The Supabase project used for Waymakers

Cognation has its own repository, Pages project, and data. Do not copy Waymakers credentials, project refs, or deploy targets into this repo.

## What Cloudflare Pages cannot run

This site is static hosting on Cloudflare Pages.

- Pages cannot run the Express app in `server/`. The session and screen-break routes in that server (`/api/session/*`) are not a live backend on Pages. Screen-break and session state in the browser are demo / local only.
- A moderation queue write from the browser to the box path (`/workspace/news-moderation/`) is not available on Pages. NEWS report actions stay in this browser (`localStorage`). They are not a live moderation backend.

Go-live / WebRTC, payment controls (including Buy / tip; there is no Apple Pay charge), and calendar OAuth are UI stubs. Each of those surfaces carries a visible **Demo / local only — not live backend** label.

## Demo access (no shared password)

Public builds do not ship a shared password or WELL one-time code.

- Production sign-in uses the configured Cognation account provider when it is present.
- Local preview uses an explicit **Demo unlock — not real auth** control, a `?demo=1` query flag, or a build-time `window.__COGNATION_DEMO__` flag. That flag defaults to false (unset) for production. Do not set it in the Pages build.
- When demo unlock is used, the site shows **Demo — not production auth**. That path is not production authentication.
