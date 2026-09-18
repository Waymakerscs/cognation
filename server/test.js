/**
 * Smoke / integration checks for session service (no long-running daemon).
 * Uses SCREEN_LIMIT_MS=50 and BREAK_MS=80 for fast assertions.
 */
"use strict";

process.env.PORT = process.env.PORT || "0";
process.env.SCREEN_LIMIT_MS = "50";
process.env.BREAK_MS = "80";
process.env.COOKIE_SECURE = "false";

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

    console.log("ok — all session smoke tests passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
