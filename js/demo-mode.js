/**
 * Non-secret local demo flag.
 *
 * Production default: window.__COGNATION_DEMO__ is unset (false).
 * Do not assign a password or one-time code here.
 *
 * Demo unlock is explicit:
 *   - button sets localStorage cognation.demo.unlock.v1
 *   - ?demo=1 sets a tab session flag
 *   - window.__COGNATION_DEMO__ === true (build-time only; default off)
 */
(function () {
  "use strict";

  var STORAGE_KEY = "cognation.demo.unlock.v1";
  var QUERY_KEY = "cognation.demo.query.v1";
  var CHROME_TEXT = "Demo — not production auth";

  function flagFromWindow() {
    return window.__COGNATION_DEMO__ === true;
  }

  function flagFromQuery() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      if (params.get("demo") === "1") {
        try {
          sessionStorage.setItem(QUERY_KEY, "1");
        } catch (e) {}
        return true;
      }
      return sessionStorage.getItem(QUERY_KEY) === "1";
    } catch (e2) {
      return false;
    }
  }

  function flagFromStorage() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function isUnlocked() {
    return flagFromWindow() || flagFromQuery() || flagFromStorage();
  }

  function ensureChrome() {
    if (!isUnlocked()) return;
    document.documentElement.setAttribute("data-cognation-demo", "1");
    document.body.classList.add("cognation-demo-on");
    var el = document.getElementById("cognation-demo-chrome");
    if (!el) {
      el = document.createElement("p");
      el.id = "cognation-demo-chrome";
      el.className = "cognation-demo-chrome";
      el.setAttribute("role", "status");
      el.textContent = CHROME_TEXT;
      document.body.appendChild(el);
    }
    el.hidden = false;
  }

  function hideChrome() {
    document.body.classList.remove("cognation-demo-on");
    var el = document.getElementById("cognation-demo-chrome");
    if (el) el.hidden = true;
  }

  function syncChrome(session) {
    if (session && session.source && session.source !== "demo") {
      hideChrome();
      return;
    }
    if ((session && session.source === "demo") || isUnlocked()) {
      ensureChrome();
      return;
    }
    hideChrome();
  }

  function unlock() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (e) {}
    ensureChrome();
    return true;
  }

  window.CognationDemo = {
    STORAGE_KEY: STORAGE_KEY,
    label: CHROME_TEXT,
    isUnlocked: isUnlocked,
    unlock: unlock,
    ensureChrome: ensureChrome,
    hideChrome: hideChrome,
    syncChrome: syncChrome,
  };

  function boot() {
    syncChrome(null);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
