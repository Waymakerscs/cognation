/**
 * COGNATION session + screen-break service (v1)
 * In-memory store — process restart clears all sessions.
 *
 * Env:
 *   PORT              default 3001
 *   ORIGIN            CORS allowlist (comma-separated); empty = reflect request Origin when same-ish
 *   SCREEN_LIMIT_MS   cumulative active ms before break (default 1200000 = 20 min)
 *   BREAK_MS          grace window to complete break (default 15000)
 *   COOKIE_SECURE     "1"/"true" to set Secure on cookie (use behind HTTPS)
 *   COOKIE_NAME       default cognation_sid
 *   TRUST_PROXY       "1"/"true" when behind nginx
 */
"use strict";

const crypto = require("crypto");
const express = require("express");
const socialStore = require("./social-store");

const PORT = Number(process.env.PORT) || 3001;
const SCREEN_LIMIT_MS = Number(process.env.SCREEN_LIMIT_MS) || 20 * 60 * 1000;
const BREAK_MS = Number(process.env.BREAK_MS) || 15000;
const COOKIE_NAME = process.env.COOKIE_NAME || "cognation_sid";
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "1" || process.env.COOKIE_SECURE === "true";
const ORIGIN_LIST = (process.env.ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** @type {Map<string, Session>} */
const sessions = new Map();

/**
 * @typedef {object} Session
 * @property {string} id
 * @property {string} username
 * @property {number} createdAt
 * @property {number} activeMs
 * @property {number} lastBeatAt
 * @property {boolean} breakRequired
 * @property {number|null} breakDeadline
 */

function now() {
  return Date.now();
}

function newId() {
  return crypto.randomBytes(24).toString("hex");
}

function parseCookies(header) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!header) return out;
  String(header)
    .split(";")
    .forEach((part) => {
      const i = part.indexOf("=");
      if (i < 0) return;
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    });
  return out;
}

function setSessionCookie(res, sid) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sid)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (COOKIE_SECURE) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (COOKIE_SECURE) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

/**
 * Load session from cookie; expire if break deadline passed.
 * @returns {Session|null}
 */
function getLiveSession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[COOKIE_NAME];
  if (!sid) return null;
  const sess = sessions.get(sid);
  if (!sess) return null;

  if (
    sess.breakRequired &&
    sess.breakDeadline != null &&
    now() > sess.breakDeadline
  ) {
    sessions.delete(sid);
    clearSessionCookie(res);
    return null;
  }
  return sess;
}

function destroySession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[COOKIE_NAME];
  if (sid) sessions.delete(sid);
  clearSessionCookie(res);
}

function statusPayload(sess) {
  if (!sess) {
    return {
      authenticated: false,
      breakRequired: false,
      breakDeadline: null,
      secondsRemaining: null,
      username: null,
    };
  }
  let secondsRemaining = null;
  if (sess.breakRequired && sess.breakDeadline != null) {
    secondsRemaining = Math.max(
      0,
      Math.ceil((sess.breakDeadline - now()) / 1000)
    );
  }
  return {
    authenticated: true,
    breakRequired: !!sess.breakRequired,
    breakDeadline: sess.breakDeadline,
    secondsRemaining,
    username: sess.username,
  };
}

function createAuthenticatedSession(user) {
  const id = newId();
  const sess = {
    id,
    userId: user.id,
    username: user.username,
    createdAt: now(),
    activeMs: 0,
    lastBeatAt: now(),
    breakRequired: false,
    breakDeadline: null,
  };
  sessions.set(id, sess);
  return sess;
}

function requireAuthenticatedUser(req, res, next) {
  const sess = getLiveSession(req, res);
  if (!sess || !sess.userId) {
    return res.status(401).json({ error: "authentication_required" });
  }
  req.user = { id: sess.userId, username: sess.username };
  return next();
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return; // same-origin / non-browser

  let allow = false;
  if (ORIGIN_LIST.length === 0) {
    // Dev-friendly: allow any Origin (credentials need explicit reflect)
    allow = true;
  } else {
    allow = ORIGIN_LIST.includes(origin);
  }

  if (allow) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );
    res.setHeader("Vary", "Origin");
  }
}

const app = express();
if (
  process.env.TRUST_PROXY === "1" ||
  process.env.TRUST_PROXY === "true"
) {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "32kb" }));

app.use((req, res, next) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    sessions: sessions.size,
    screenLimitMs: SCREEN_LIMIT_MS,
    breakMs: BREAK_MS,
  });
});

app.post("/api/auth/register", (req, res, next) => {
  try {
    const body = req.body || {};
    const result = socialStore.createUser({
      username: body.username,
      password: body.password,
      displayName: body.displayName,
      handle: body.handle,
    });
    if (!result.ok) return res.status(400).json(result);
    const user = result.user;
    const sess = createAuthenticatedSession(user);
    setSessionCookie(res, sess.id);
    return res.status(201).json({
      user,
      profiles: [result.profile],
      ...statusPayload(sess),
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/login", (req, res) => {
  const body = req.body || {};
  const user = socialStore.authenticate(body.username, body.password);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  const sess = createAuthenticatedSession(user);
  setSessionCookie(res, sess.id);
  return res.json({
    user,
    profiles: socialStore.listProfilesForUser(user.id),
    ...statusPayload(sess),
  });
});

app.post("/api/auth/logout", (req, res) => {
  destroySession(req, res);
  return res.json(statusPayload(null));
});

app.get("/api/auth/me", requireAuthenticatedUser, (req, res) => {
  return res.json({
    user: req.user,
    profiles: socialStore.listProfilesForUser(req.user.id),
  });
});

app.post("/api/profiles", requireAuthenticatedUser, (req, res) => {
  const body = req.body || {};
  if (body.kind !== "professional") {
    return res.status(400).json({ error: "unsupported_profile_kind" });
  }
  const result = socialStore.createProfessionalProfile({
    userId: req.user.id,
    displayName: body.displayName,
    handle: body.handle,
    bio: body.bio,
  });
  if (!result.ok) return res.status(400).json(result);
  return res.status(201).json(result);
});

app.get("/api/profiles/:handle", (req, res) => {
  const profile = socialStore.getPublicProfileByHandle(req.params.handle);
  if (!profile) return res.status(404).json({ error: "profile_not_found" });
  return res.json({ profile });
});

app.post("/api/profiles/:profileId/follow", requireAuthenticatedUser, (req, res) => {
  const result = socialStore.toggleFollow({
    followerUserId: req.user.id,
    profileId: req.params.profileId,
  });
  if (!result.ok) return res.status(400).json(result);
  return res.json(result);
});

app.post(
  "/api/profiles/:profileId/friend-requests",
  requireAuthenticatedUser,
  (req, res) => {
    const result = socialStore.sendFriendRequest({
      senderUserId: req.user.id,
      recipientProfileId: req.params.profileId,
    });
    if (!result.ok) return res.status(400).json(result);
    return res.status(201).json(result);
  }
);

app.get("/api/friend-requests/incoming", requireAuthenticatedUser, (req, res) => {
  return res.json({ requests: socialStore.listFriendRequests(req.user.id) });
});

app.post(
  "/api/friend-requests/:requestId/accept",
  requireAuthenticatedUser,
  (req, res) => {
    const result = socialStore.acceptFriendRequest({
      requestId: req.params.requestId,
      recipientUserId: req.user.id,
    });
    if (!result.ok) return res.status(404).json(result);
    return res.json(result);
  }
);

app.get("/api/friends", requireAuthenticatedUser, (req, res) => {
  return res.json({ friends: socialStore.listFriends(req.user.id) });
});

app.get("/api/notifications", requireAuthenticatedUser, (req, res) => {
  return res.json({ notifications: socialStore.listNotifications(req.user.id) });
});

app.get("/api/tower/feed", requireAuthenticatedUser, (req, res) => {
  return res.json({ posts: socialStore.listTowerFeed(req.user.id) });
});

app.post("/api/tower/posts", requireAuthenticatedUser, (req, res) => {
  const body = req.body || {};
  const result = socialStore.createPost({
    authorUserId: req.user.id,
    authorProfileId: body.authorProfileId,
    body: body.body,
    visibility: body.visibility,
  });
  if (!result.ok) return res.status(400).json(result);
  return res.status(201).json(result);
});

app.post("/api/session/login", (req, res) => {
  const body = req.body || {};
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  // password accepted for API shape but never logged or stored
  if (!username) {
    return res.status(400).json({ error: "username_required" });
  }

  const id = newId();
  /** @type {Session} */
  const sess = {
    id,
    username,
    createdAt: now(),
    activeMs: 0,
    lastBeatAt: now(),
    breakRequired: false,
    breakDeadline: null,
  };
  sessions.set(id, sess);
  setSessionCookie(res, id);
  // Do not log password; username only for ops visibility
  console.log(`[login] user=${JSON.stringify(username)} sid=${id.slice(0, 8)}…`);
  return res.json(statusPayload(sess));
});

app.get("/api/session/status", (req, res) => {
  const sess = getLiveSession(req, res);
  return res.json(statusPayload(sess));
});

app.post("/api/session/activity", (req, res) => {
  const sess = getLiveSession(req, res);
  if (!sess) {
    return res.status(401).json(statusPayload(null));
  }

  const t = now();

  if (sess.breakRequired) {
    // Still in break window (else getLiveSession would have cleared)
    return res.json(statusPayload(sess));
  }

  // Accumulate time since last beat (cap gap so a stale tab doesn't dump hours)
  const gap = Math.max(0, t - sess.lastBeatAt);
  const MAX_GAP = 60 * 1000; // ignore gaps > 1 min as idle/background
  sess.activeMs += Math.min(gap, MAX_GAP);
  sess.lastBeatAt = t;

  if (sess.activeMs >= SCREEN_LIMIT_MS) {
    sess.breakRequired = true;
    sess.breakDeadline = t + BREAK_MS;
    console.log(
      `[break] user=${JSON.stringify(sess.username)} deadline=+${BREAK_MS}ms`
    );
  }

  return res.json(statusPayload(sess));
});

app.post("/api/session/break/complete", (req, res) => {
  const sess = getLiveSession(req, res);
  if (!sess) {
    return res.status(401).json(statusPayload(null));
  }

  if (
    sess.breakRequired &&
    sess.breakDeadline != null &&
    now() > sess.breakDeadline
  ) {
    destroySession(req, res);
    return res.status(401).json(statusPayload(null));
  }

  if (!sess.breakRequired) {
    return res.json(statusPayload(sess));
  }

  const token =
    req.body && typeof req.body.puzzleToken === "string"
      ? req.body.puzzleToken.trim()
      : "";
  if (!token) {
    return res.status(400).json({ error: "puzzle_token_required", ...statusPayload(sess) });
  }

  // Demo: any non-empty token clears the break
  sess.breakRequired = false;
  sess.breakDeadline = null;
  sess.activeMs = 0;
  sess.lastBeatAt = now();
  console.log(`[break-complete] user=${JSON.stringify(sess.username)}`);
  return res.json(statusPayload(sess));
});

app.post("/api/session/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[COOKIE_NAME];
  if (sid && sessions.has(sid)) {
    const u = sessions.get(sid).username;
    sessions.delete(sid);
    console.log(`[logout] user=${JSON.stringify(u)}`);
  }
  clearSessionCookie(res);
  return res.json(statusPayload(null));
});

app.use((err, _req, res, _next) => {
  console.error("[error]", err && err.message ? err.message : err);
  res.status(500).json({ error: "internal" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `cognation-session listening on :${PORT} SCREEN_LIMIT_MS=${SCREEN_LIMIT_MS} BREAK_MS=${BREAK_MS} COOKIE_SECURE=${COOKIE_SECURE}`
    );
    console.log(
      "Note: in-memory sessions — restart clears all sessions."
    );
  });
}

module.exports = {
  app,
  sessions,
  SCREEN_LIMIT_MS,
  BREAK_MS,
  COOKIE_NAME,
};
