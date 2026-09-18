/**
 * WELL second authentication lock + demo 2FA (step-up gate).
 *
 * Separate from Cognation site login (alexa / TowerCommune26).
 * Session: sessionStorage cognation.well.auth.v1 (clears on tab close).
 *
 * Demo only — not a real EHR · not HIPAA-certified · no PHI leaves the browser.
 */
(function () {
  "use strict";

  var AUTH_KEY = "cognation.well.auth.v1";
  var TTL_MS = 4 * 60 * 60 * 1000; /* optional soft TTL note; tab close still ends session */
  var EXPECTED_USERS = { "well-alexa": true, alexa: true };
  var EXPECTED_PASS = "WellLock26";
  var DEMO_OTP = "246801";

  var pendingOtp = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function readSession() {
    try {
      var raw = sessionStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.ok || !data.at) return null;
      if (TTL_MS && Date.now() - data.at > TTL_MS) {
        sessionStorage.removeItem(AUTH_KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeSession(data) {
    try {
      if (!data) sessionStorage.removeItem(AUTH_KEY);
      else sessionStorage.setItem(AUTH_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function isAuthenticated() {
    return !!readSession();
  }

  function setStatus(root, which, message, isError) {
    var el = $(('[data-well-auth-status="' + which + '"]'), root);
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.classList.toggle("is-error", !!isError);
  }

  function setStep(root, step) {
    root.setAttribute("data-well-auth-step", String(step));
    $all("[data-well-auth-step-indicator]", root).forEach(function (el) {
      var n = el.getAttribute("data-well-auth-step-indicator");
      el.classList.toggle("is-active", n === String(step));
      el.classList.toggle("is-done", Number(n) < step);
    });
    var cred = $('[data-well-auth-form="credentials"]', root);
    var otp = $('[data-well-auth-form="otp"]', root);
    if (cred) cred.hidden = step !== 1;
    if (otp) otp.hidden = step !== 2;
    if (step === 1) {
      pendingOtp = null;
      var display = $("[data-well-auth-code-display]", root);
      if (display) display.textContent = "————";
      var otpInput = $("#well-auth-otp", root);
      if (otpInput) otpInput.value = "";
      setStatus(root, "otp", "");
      window.setTimeout(function () {
        var u = $("#well-auth-username", root);
        if (u) u.focus();
      }, 30);
    } else if (step === 2) {
      pendingOtp = DEMO_OTP;
      var codeEl = $("[data-well-auth-code-display]", root);
      if (codeEl) codeEl.textContent = pendingOtp;
      setStatus(root, "credentials", "");
      window.setTimeout(function () {
        var o = $("#well-auth-otp", root);
        if (o) o.focus();
      }, 30);
    }
  }

  function setLockedUi(root, locked) {
    root.classList.toggle("is-locked", locked);
    root.setAttribute("data-well-auth-state", locked ? "locked" : "unlocked");

    var lock = $("[data-well-auth-lock]", root);
    var secured = $("[data-well-secured]", root);
    var sessionBar = $("[data-well-session-bar]", root);
    var sideToggle = $("[data-well-side-toggle]", root);

    if (lock) {
      lock.hidden = !locked;
      lock.setAttribute("aria-hidden", locked ? "false" : "true");
    }

    if (secured) {
      if (locked) {
        secured.setAttribute("aria-hidden", "true");
        secured.setAttribute("inert", "");
        secured.hidden = false; /* keep in DOM for well.js queries, but inert */
      } else {
        secured.removeAttribute("aria-hidden");
        secured.removeAttribute("inert");
      }
      /* Patient/provider roots stay queryable; visually hide via CSS when locked */
    }

    /* Hide chart roots from AT while locked */
    $all("[data-well-patient-root], [data-well-provider-root]", root).forEach(function (el) {
      if (locked) {
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("inert", "");
      } else {
        el.removeAttribute("aria-hidden");
        el.removeAttribute("inert");
      }
    });

    if (sessionBar) sessionBar.hidden = locked;
    if (sideToggle) {
      sideToggle.hidden = locked;
      sideToggle.setAttribute("aria-hidden", locked ? "true" : "false");
      $all("button", sideToggle).forEach(function (btn) {
        btn.disabled = locked;
        if (locked) {
          btn.tabIndex = -1;
        } else {
          btn.tabIndex = btn.getAttribute("aria-selected") === "true" ? 0 : -1;
        }
      });
    }

    if (locked) setStep(root, 1);
  }

  function unlock(root, username) {
    writeSession({
      ok: true,
      user: username,
      at: Date.now(),
      factor: "password+otp",
      note: "sessionStorage · expires on tab close · soft TTL 4h",
    });
    pendingOtp = null;
    setLockedUi(root, false);
    document.dispatchEvent(
      new CustomEvent("cognation:well-auth", { detail: { unlocked: true, user: username } })
    );
  }

  function lock(root, opts) {
    opts = opts || {};
    writeSession(null);
    pendingOtp = null;
    if (!root) {
      $all("[data-well-app]").forEach(function (r) {
        setLockedUi(r, true);
        setStatus(r, "credentials", opts.message || "");
        setStatus(r, "otp", "");
      });
    } else {
      setLockedUi(root, true);
      setStatus(root, "credentials", opts.message || "", !!opts.isError);
      setStatus(root, "otp", "");
    }
    document.dispatchEvent(
      new CustomEvent("cognation:well-auth", { detail: { unlocked: false } })
    );
  }

  function normalizeUser(raw) {
    var u = String(raw || "").trim().toLowerCase();
    if (u.charAt(0) === "@") u = u.slice(1);
    return u;
  }

  function ensureGate(root) {
    root = root || $("[data-well-app]");
    if (!root) return isAuthenticated();
    if (isAuthenticated()) {
      setLockedUi(root, false);
      return true;
    }
    setLockedUi(root, true);
    return false;
  }

  function onWellPanelShown() {
    $all("[data-well-app]").forEach(function (root) {
      ensureGate(root);
    });
  }

  function wireRoot(root) {
    if (!root || root.__wellAuthWired) return;
    root.__wellAuthWired = true;

    var credForm = $('[data-well-auth-form="credentials"]', root);
    var otpForm = $('[data-well-auth-form="otp"]', root);
    var backBtn = $("[data-well-auth-back]", root);
    var lockBtn = $("[data-well-lock-btn]", root);

    if (credForm) {
      credForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var user = normalizeUser(($("#well-auth-username", root) || {}).value);
        var pass = String(($("#well-auth-password", root) || {}).value || "");
        if (!EXPECTED_USERS[user] || pass !== EXPECTED_PASS) {
          setStatus(root, "credentials", "Wrong WELL username or password.", true);
          return;
        }
        setStatus(root, "credentials", "");
        setStep(root, 2);
      });
    }

    if (otpForm) {
      otpForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = $("#well-auth-otp", root);
        var code = String((input && input.value) || "").replace(/\s+/g, "");
        var expected = pendingOtp || DEMO_OTP;
        if (!/^\d{6}$/.test(code) || code !== expected) {
          setStatus(root, "otp", "Wrong verification code. Try the demo authenticator code shown above.", true);
          return;
        }
        var userEl = $("#well-auth-username", root);
        unlock(root, normalizeUser(userEl && userEl.value) || "well-alexa");
        setStatus(root, "otp", "");
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        setStep(root, 1);
        setStatus(root, "credentials", "");
      });
    }

    if (lockBtn) {
      lockBtn.addEventListener("click", function () {
        lock(root, { message: "WELL locked. Sign in again to open the chart." });
      });
    }

    /* OTP: digits only */
    var otpInput = $("#well-auth-otp", root);
    if (otpInput) {
      otpInput.addEventListener("input", function () {
        otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
      });
    }
  }

  function boot() {
    $all("[data-well-app]").forEach(function (root) {
      wireRoot(root);
      ensureGate(root);
    });

    /* When main site logs out, also clear WELL clinical session */
    document.addEventListener("cognation:session-ended", function () {
      lock(null);
    });
  }

  window.CognationWellAuth = {
    AUTH_KEY: AUTH_KEY,
    isAuthenticated: isAuthenticated,
    ensureGate: ensureGate,
    lock: function () {
      lock(null);
    },
    unlockSession: function (username) {
      var root = $("[data-well-app]");
      if (root) unlock(root, username || "well-alexa");
    },
    onWellPanelShown: onWellPanelShown,
    getSession: readSession,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
