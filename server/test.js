/**
 * Smoke / integration checks for session service (no long-running daemon).
 * Uses SCREEN_LIMIT_MS=50 and BREAK_MS=80 for fast assertions.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

process.env.PORT = process.env.PORT || "0";
process.env.SCREEN_LIMIT_MS = "50";
process.env.BREAK_MS = "80";
process.env.COOKIE_SECURE = "false";
process.env.COGNATION_DB_PATH = path.join(
  os.tmpdir(),
  `cognation-api-test-${process.pid}.db`
);
try {
  fs.unlinkSync(process.env.COGNATION_DB_PATH);
} catch {}

const http = require("http");
const { app, sessions, COOKIE_NAME } = require("./server");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function request(server, method, path, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const payload = body != null ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: "127.0.0.1",
        port: addr.port,
        path,
        method,
        headers: {
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          Origin: "http://localhost:8080",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          const setCookie = res.headers["set-cookie"] || [];
          resolve({ status: res.statusCode, json, setCookie, headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sidFromSetCookie(setCookie) {
  const line = setCookie.find((c) => c.startsWith(COOKIE_NAME + "="));
  if (!line) return null;
  const m = line.match(new RegExp("^" + COOKIE_NAME + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  try {
    // health
    let r = await request(server, "GET", "/healthz");
    assert(r.status === 200 && r.json.ok, "healthz");

    // login rejects empty
    r = await request(server, "POST", "/api/session/login", { body: { username: "  " } });
    assert(r.status === 400, "empty username rejected");

    // login accepts any username; password not required
    r = await request(server, "POST", "/api/session/login", {
      body: { username: "alexa", password: "secret-should-not-appear-in-logs" },
    });
    assert(r.status === 200 && r.json.authenticated === true, "login ok");
    assert(r.json.username === "alexa", "username echoed");
    assert(r.headers["access-control-allow-origin"] === "http://localhost:8080", "cors");
    const sid = sidFromSetCookie(r.setCookie);
    assert(sid, "session cookie set");
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(sid)}`;
    assert(
      r.setCookie.some((c) => /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c)),
      "cookie flags"
    );

    // status
    r = await request(server, "GET", "/api/session/status", { cookie });
    assert(r.json.authenticated && !r.json.breakRequired, "status authed");

    // activity until break
    r = await request(server, "POST", "/api/session/activity", { cookie });
    assert(!r.json.breakRequired, "first beat no break yet");
    await sleep(60);
    r = await request(server, "POST", "/api/session/activity", { cookie });
    assert(r.json.breakRequired === true, "break required after limit");
    assert(typeof r.json.breakDeadline === "number", "deadline set");
    assert(r.json.secondsRemaining != null && r.json.secondsRemaining >= 0, "secondsRemaining");

    // complete without token
    r = await request(server, "POST", "/api/session/break/complete", {
      cookie,
      body: { puzzleToken: "" },
    });
    assert(r.status === 400, "empty token rejected");

    // complete with token
    r = await request(server, "POST", "/api/session/break/complete", {
      cookie,
      body: { puzzleToken: "demo-ok" },
    });
    assert(r.status === 200 && !r.json.breakRequired, "break cleared");
    assert(r.json.authenticated, "still authed after break");

    // force break again then miss deadline → logout
    await sleep(60);
    r = await request(server, "POST", "/api/session/activity", { cookie });
    assert(r.json.breakRequired, "second break");
    await sleep(100);
    r = await request(server, "GET", "/api/session/status", { cookie });
    assert(r.json.authenticated === false, "auto-logout after missed break");
    assert(!sessions.has(sid), "session removed from store");

    // fresh login + logout
    r = await request(server, "POST", "/api/session/login", { body: { username: "bob" } });
    const sid2 = sidFromSetCookie(r.setCookie);
    r = await request(server, "POST", "/api/session/logout", {
      cookie: `${COOKIE_NAME}=${encodeURIComponent(sid2)}`,
    });
    assert(r.json.authenticated === false, "logout");
    assert(!sessions.has(sid2), "session destroyed");

    // Register two persistent users, then exercise the social graph.
    r = await request(server, "POST", "/api/auth/register", {
      body: {
        username: "alice",
        password: "alice-social-pass",
        displayName: "Alice Example",
        handle: "alice-example",
      },
    });
    assert(r.status === 201, "Alice registered");
    const aliceCookie = `${COOKIE_NAME}=${encodeURIComponent(sidFromSetCookie(r.setCookie))}`;
    const alicePersonal = r.json.profiles[0];

    r = await request(server, "POST", "/api/auth/register", {
      body: {
        username: "bob",
        password: "bob-social-pass",
        displayName: "Bob Example",
        handle: "bob-example",
      },
    });
    assert(r.status === 201, "Bob registered");
    const bobCookie = `${COOKIE_NAME}=${encodeURIComponent(sidFromSetCookie(r.setCookie))}`;
    const bobPersonal = r.json.profiles[0];

    r = await request(server, "POST", "/api/profiles", {
      cookie: bobCookie,
      body: {
        kind: "professional",
        displayName: "Bob Coaching",
        handle: "bob-coaching",
        bio: "Practical coaching for neighborhood projects.",
      },
    });
    assert(r.status === 201, "professional profile created");
    const bobProfessional = r.json.profile;

    r = await request(server, "POST", `/api/profiles/${bobPersonal.id}/friend-requests`, {
      cookie: aliceCookie,
    });
    assert(r.status === 201 && r.json.pending, "friend request created");

    r = await request(server, "GET", "/api/friend-requests/incoming", { cookie: bobCookie });
    assert(r.json.requests.length === 1, "Bob sees incoming request");
    const requestId = r.json.requests[0].id;

    r = await request(server, "POST", `/api/friend-requests/${requestId}/accept`, {
      cookie: bobCookie,
    });
    assert(r.status === 200 && r.json.ok, "friend request accepted");

    r = await request(server, "GET", "/api/friends", { cookie: aliceCookie });
    assert(r.json.friends.some((friend) => friend.username === "bob"), "friendship persisted");

    r = await request(server, "POST", "/api/tower/posts", {
      cookie: aliceCookie,
      body: {
        authorProfileId: alicePersonal.id,
        body: "Building the real multi-user Tower.",
        visibility: "friends",
      },
    });
    assert(r.status === 201 && r.json.post.body, "Tower post created");

    r = await request(server, "GET", "/api/tower/feed", { cookie: bobCookie });
    assert(
      r.json.posts.some((post) => post.body === "Building the real multi-user Tower."),
      "friends feed is shared"
    );

    r = await request(server, "POST", `/api/profiles/${bobProfessional.id}/follow`, {
      cookie: aliceCookie,
    });
    assert(r.status === 200 && r.json.following && r.json.followerCount === 1, "follow persisted");

    r = await request(server, "GET", "/api/notifications", { cookie: bobCookie });
    assert(
      r.json.notifications.some((notification) => notification.type === "professional_follow"),
      "follow notification created"
    );

    r = await request(server, "GET", "/api/profiles/bob-coaching");
    assert(r.json.profile.followerCount === 1, "public follower count");

    console.log("ok — session and multi-user social API tests passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
