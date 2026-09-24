# COGNATION multi-user API

Node + Express API for persistent Cognation accounts, profiles, friend requests,
friendships, professional follows, notifications, and Tower posts. It also retains
the existing session-break endpoints.

**Persistent storage:** SQLite at `COGNATION_DB_PATH` (defaults to
`server/cognation.db`). Back up this file in production. Screen-break sessions
remain in-memory for now, so a process restart signs users out.

No paid cloud services are required — runs on a free-tier / Always Free OCI Ampere VM (or any small Ubuntu box) behind nginx serving the static site.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/session/login` | Body `{ username, password? }`. Demo: any non-empty username. Sets `HttpOnly; SameSite=Lax` cookie (`Secure` optional). Password is accepted for shape only — **never stored or logged**. |
| `GET` | `/api/session/status` | `{ authenticated, breakRequired, breakDeadline, secondsRemaining, username }` |
| `POST` | `/api/session/activity` | Heartbeat; accumulates active time. After `SCREEN_LIMIT_MS` sets `breakRequired` and `breakDeadline = now + BREAK_MS`. |
| `POST` | `/api/session/break/complete` | Body `{ puzzleToken }`. Non-empty token (demo) clears break and resets the activity timer. If `breakDeadline` already passed → session invalidated. |
| `POST` | `/api/session/logout` | Destroy session + clear cookie. |
| `GET` | `/healthz` | Liveness + current timer config. |

If `breakDeadline` passes without a successful complete, the next request that loads the session **invalidates** it (auto-logout).

## Multi-user API

All endpoints below use the secure cookie created by `POST /api/auth/login` or
`POST /api/auth/register`.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/register` | Create a user and personal profile. Requires username, password (10+ chars), displayName, and handle. |
| `POST` | `/api/auth/login` | Authenticate a persistent user. |
| `POST` | `/api/auth/logout` | End the authenticated session. |
| `GET` | `/api/auth/me` | Current user and profiles. |
| `POST` | `/api/profiles` | Create the current user’s professional profile. |
| `GET` | `/api/profiles/:handle` | Read a public profile and follower count. |
| `POST` | `/api/profiles/:profileId/follow` | Follow or unfollow a profile; creates a notification on follow. |
| `POST` | `/api/profiles/:profileId/friend-requests` | Send a friend request to a personal profile. |
| `GET` | `/api/friend-requests/incoming` | List pending requests for the current user. |
| `POST` | `/api/friend-requests/:requestId/accept` | Accept a request and create a friendship. |
| `GET` | `/api/friends` | List the current user’s friends. |
| `GET` | `/api/notifications` | List the current user’s notifications. |
| `POST` | `/api/tower/posts` | Create a Tower post (`authorProfileId`, `body`, optional `visibility`). |
| `GET` | `/api/tower/feed` | Read the current user’s shared Tower feed. |

## Defaults

| Variable | Default | Meaning |
|----------|---------|---------|
| `PORT` | `3001` | Listen port |
| `SCREEN_LIMIT_MS` | `1200000` (20 min) | Cumulative active ms before a break is required |
| `BREAK_MS` | `15000` (15 s) | Window to finish the break puzzle |
| `COOKIE_SECURE` | unset / false | Set `true`/`1` when served over HTTPS |
| `COOKIE_NAME` | `cognation_sid` | Session cookie name |
| `ORIGIN` | empty | Comma-separated CORS allowlist; empty reflects any `Origin` (dev). Set to your site origin in prod, e.g. `https://cognation.example` |
| `TRUST_PROXY` | unset | Set `true`/`1` behind nginx |

## Run locally

```bash
cd /path/to/cognation-site/server
npm install
npm start
# or: ./start.sh
```

Service listens on `http://127.0.0.1:3001`. Point the static site (or a local static server) at the same host via nginx, or set `ORIGIN=http://localhost:5500` and call with `credentials: 'include'`.

Smoke tests (short; no daemon left running):

```bash
npm test
```

## nginx reverse-proxy (`/api/`)

Serve the static files from the site root and proxy the API to Node on localhost:

```nginx
server {
    listen 80;
    server_name cognation.example;
    root /var/www/cognation-site;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

With TLS (Let’s Encrypt / OCI LB), set `COOKIE_SECURE=true` and `TRUST_PROXY=true` on the Node unit. Behind a local tunnel without HTTPS, leave `COOKIE_SECURE` unset.

## systemd unit sketch (Ubuntu on OCI)

`/etc/systemd/system/cognation-session.service`:

```ini
[Unit]
Description=COGNATION session/break API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/cognation-site/server
Environment=PORT=3001
Environment=ORIGIN=https://cognation.example
Environment=SCREEN_LIMIT_MS=1200000
Environment=BREAK_MS=15000
Environment=COOKIE_SECURE=true
Environment=TRUST_PROXY=true
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cognation-session
sudo systemctl status cognation-session
```

Install Node 18+ via NodeSource or distro packages; `npm install --omit=dev` once in `WorkingDirectory`.

## $0 / OCI note

This service is a single Node process plus nginx static hosting. It fits on Oracle Cloud **Always Free** Ampere A1 (or the free micro shapes) with **no** paid Autonomous DB, Object Storage tiers, or Functions required for v1. Sessions are ephemeral RAM only — document that ops restarts log everyone out.

See also: [`../docs/oracle-session-break.md`](../docs/oracle-session-break.md).
