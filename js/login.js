/**
 * Cognation login gate — required username/password (client-side gate on Pages).
 * Not a substitute for server auth; fine for a private $0 preview.
 *
 * After credentials succeed, if the account has 2 Tower profiles, show a
 * Choose profile step (Personal / Professional). Session records
 * activeProfileId + profileKind.
 *
 * Session: cognation.session.v2
 * Demo storage disclaimer: in-browser registry only — not production identity.
 */
(function () {
  "use strict";

  var SESSION_KEY = "cognation.session.v2";
  var EXPECTED_USER = "alexa";
  var EXPECTED_PASS = "TowerCommune26";

  var API_BASE =
    (window.CognationConfig && window.CognationConfig.apiBaseUrl) || "/api";

  var gate = document.getElementById("login-gate");
  var form = document.getElementById("login-form");
  var statusEl = document.getElementById("login-status");
  var openBtn = document.querySelector("[data-login-open]");
  var pickerEl = document.getElementById("login-profile-picker");
  var pickerList = document.getElementById("login-profile-picker-list");
  var pickerContinue = document.getElementById("login-profile-continue");
  var pickerBack = document.getElementById("login-profile-back");
  var credentialsStep = document.getElementById("login-credentials-step");

  if (!gate) return;

  var lastFocus = null;
  var pendingUsername = null;
  var pendingProfiles = null;
  var pendingAuth = null;

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-error", !!isError);
    statusEl.setAttribute("role", message ? "status" : "none");
  }

  function readLocalSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeLocalSession(data) {
    try {
      if (!data) localStorage.removeItem(SESSION_KEY);
      else localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function showCredentialsStep() {
    if (credentialsStep) credentialsStep.hidden = false;
    if (pickerEl) pickerEl.hidden = true;
    gate.classList.remove("login-gate--picker");
    pendingUsername = null;
    pendingProfiles = null;
    pendingAuth = null;
  }

  function showPickerStep(username, profiles) {
    pendingUsername = username;
    pendingProfiles = profiles || [];
    if (credentialsStep) credentialsStep.hidden = true;
    if (pickerEl) pickerEl.hidden = false;
    gate.classList.add("login-gate--picker");
    renderPicker(pendingProfiles);
    setStatus("");
    window.setTimeout(function () {
      var first =
        (pickerList && pickerList.querySelector('input[name="loginProfile"]')) ||
        pickerContinue;
      if (first && typeof first.focus === "function") first.focus();
    }, 10);
  }

  function renderPicker(profiles) {
    if (!pickerList) return;
    pickerList.innerHTML = "";
    profiles.forEach(function (p, idx) {
      var id = "login-profile-" + (p.id || idx);
      var label = document.createElement("label");
      label.className = "login-profile-card";
      label.setAttribute("for", id);

      var input = document.createElement("input");
      input.type = "radio";
      input.name = "loginProfile";
      input.id = id;
      input.value = p.id;
      if (idx === 0) input.checked = true;

      var kind = p.kind === "professional" ? "Professional" : "Personal";
      var title = document.createElement("span");
      title.className = "login-profile-card-kind";
      title.textContent = kind + " page";

      var name = document.createElement("span");
      name.className = "login-profile-card-name";
      name.textContent = p.displayName || kind;

      var handle = document.createElement("span");
      handle.className = "login-profile-card-handle";
      var h = String(p.handle || "").replace(/^@/, "");
      handle.textContent = h ? "@" + h : "No handle yet";

      var email = document.createElement("span");
      email.className = "login-profile-card-email";
      email.textContent = p.email || "";
      if (!p.email) email.hidden = true;

      label.appendChild(input);
      label.appendChild(title);
      label.appendChild(name);
      label.appendChild(handle);
      label.appendChild(email);
      pickerList.appendChild(label);
    });
  }

  function openGate(opts) {
    opts = opts || {};
    lastFocus = document.activeElement;
    gate.hidden = false;
    gate.setAttribute("aria-hidden", "false");
    document.body.classList.add("login-gate-open");
    showCredentialsStep();
    if (opts.message) setStatus(opts.message, !!opts.isError);
    else setStatus("");
    var first = form && (form.querySelector('input[name="email"]') || form.querySelector('input[name="username"]'));
    if (first) {
      window.setTimeout(function () {
        first.focus();
      }, 10);
    }
    document.dispatchEvent(new CustomEvent("cognation:session-ended"));
  }

  function isAuthScreen() {
    var path = String(location.pathname || "").replace(/\/+$/, "");
    return /\/(signin|signup)(\.html)?$/.test(path);
  }

  function closeGate() {
    if (isAuthScreen()) {
      location.replace("index.html");
      return;
    }
    gate.hidden = true;
    gate.setAttribute("aria-hidden", "true");
    document.body.classList.remove("login-gate-open");
    gate.classList.remove("login-gate--picker");
    setStatus("");
    showCredentialsStep();
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    else if (openBtn) openBtn.focus();
    document.dispatchEvent(new CustomEvent("cognation:session-started"));
  }

  function buildSession(username, profile, auth) {
    var session = {
      username: username,
      source: (auth && auth.source) || "password",
      startedAt: Date.now(),
    };
    if (auth && auth.supabaseUserId) session.supabaseUserId = auth.supabaseUserId;
    if (profile) {
      session.activeProfileId = profile.id;
      session.profileKind = profile.kind === "professional" ? "professional" : "personal";
      session.profileHandle = profile.handle || "";
      session.profileDisplayName = profile.displayName || "";
    }
    return session;
  }

  function establishSession(username, profile, auth) {
    var session = buildSession(username, profile, auth);
    writeLocalSession(session);
    closeGate();
    return session;
  }

  function normalizeLoginUser(raw) {
    var u = String(raw || "").trim().toLowerCase();
    if (!u) return "";
    if (u.charAt(0) === "@") u = u.slice(1);
    /* Accept common Alexa identity spellings as the demo account */
    var alexaAliases = {
      alexa: true,
      "alexa thomas": true,
      "alexa j thomas": true,
      "alexa j. thomas": true,
      "alexa-thomas": true,
      "alexa.thomas": true,
      "alexathomas": true,
    };
    if (alexaAliases[u]) return EXPECTED_USER;
    return u;
  }

  function loadProfilesForUser(username) {
    if (window.CognationAccounts && typeof window.CognationAccounts.profilesForLogin === "function") {
      return window.CognationAccounts.profilesForLogin(username) || [];
    }
    return [];
  }

  function mapSupabaseProfile(profile) {
    return {
      id: profile.id,
      kind: profile.kind,
      handle: profile.handle,
      displayName: profile.display_name || profile.displayName || "",
      userId: profile.user_id || "",
      email: profile.email || "",
    };
  }

  function applyStoredEmails(profiles, user) {
    var book = {};
    if (window.CognationSupabase && window.CognationSupabase.readEmailBook) {
      book = window.CognationSupabase.readEmailBook() || {};
    }
    var meta = (user && user.user_metadata) || {};
    var personal = String(book.personalEmail || meta.personal_email || (user && user.email) || "")
      .trim()
      .toLowerCase();
    var professional = String(book.professionalEmail || meta.professional_email || "")
      .trim()
      .toLowerCase();
    return (profiles || []).map(function (profile) {
      if (!profile.email) {
        profile.email = profile.kind === "professional" ? professional : personal;
      }
      return profile;
    });
  }

  function loadSupabaseProfiles(user) {
    if (!window.CognationSupabase || !user || !user.id) return Promise.resolve([]);
    var id = encodeURIComponent(user.id);
    function load(query) {
      return window.CognationSupabase.rest("profiles", { query: query });
    }
    return load("select=id,kind,handle,display_name,user_id,email&user_id=eq." + id)
      .catch(function () {
        return load("select=id,kind,handle,display_name,user_id&user_id=eq." + id);
      })
      .then(function (profiles) {
        var mapped = Array.isArray(profiles) ? profiles.map(mapSupabaseProfile) : [];
        return applyStoredEmails(mapped, user);
      });
  }

  function finishWithProfileChoice(username, profiles, auth) {
    profiles = profiles || [];
    if (profiles.length <= 1) {
      return establishSession(username, profiles[0] || null, auth);
    }
    if (auth) {
      pendingAuth = auth;
    }
    showPickerStep(username, profiles);
    return null;
  }

  function login(username, password) {
    username = normalizeLoginUser(username);
    password = String(password || "").trim();
    if (
      window.CognationSupabase &&
      window.CognationSupabase.configured &&
      window.CognationSupabase.configured()
    ) {
      if (username.indexOf("@") <= 0) {
        return Promise.reject(new Error("Enter the email address for your Cognation account."));
      }
      return window.CognationSupabase.signIn(username, password).then(function (result) {
        var user = result && result.user;
        if (!user) throw new Error("bad credentials");
        var ensure =
          window.CognationSupabase.ensureAccountEmails
            ? window.CognationSupabase.ensureAccountEmails({}).catch(function () {
                return null;
              })
            : Promise.resolve(null);
        return ensure.then(function () {
          return loadSupabaseProfiles(user).then(function (profiles) {
            return {
              username: user.email || username,
              profiles: profiles,
              source: "supabase",
              supabaseUserId: user.id,
            };
          });
        });
      });
    }
    return Promise.reject(new Error("Cognation sign-in is not configured."));
  }

  function logout(opts) {
    opts = opts || {};
    var remote =
      window.CognationSupabase &&
      window.CognationSupabase.configured &&
      window.CognationSupabase.configured()
        ? window.CognationSupabase.signOut().catch(function () {})
        : Promise.resolve();
    return remote.then(function () {
      writeLocalSession(null);
      openGate({
        message: opts.message || "Signed out. Sign in to continue.",
        isError: !!opts.isError,
      });
    });
  }

  function isAuthenticated() {
    var current = readLocalSession();
    if (
      window.CognationSupabase &&
      window.CognationSupabase.configured &&
      window.CognationSupabase.configured()
    ) {
      return !!(current && current.source === "supabase" && current.supabaseUserId);
    }
    return !!current;
  }

  function setActiveProfile(profileId) {
    var session = readLocalSession();
    if (!session) return null;
    var profile =
      window.CognationAccounts && window.CognationAccounts.getProfileById
        ? window.CognationAccounts.getProfileById(profileId)
        : null;
    if (!profile) return null;
    session.activeProfileId = profile.id;
    session.profileKind = profile.kind === "professional" ? "professional" : "personal";
    session.profileHandle = profile.handle || "";
    session.profileDisplayName = profile.displayName || "";
    writeLocalSession(session);
    document.dispatchEvent(
      new CustomEvent("cognation:active-profile-changed", {
        detail: { profileId: profile.id, kind: session.profileKind },
      })
    );
    return session;
  }

  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    var userInput = form.querySelector('input[name="email"]') || form.querySelector('input[name="username"]');
    var passInput = form.querySelector('input[name="password"]');
    var countryInput = form.querySelector('select[name="country"]');
    var username = userInput ? userInput.value.trim() : "";
    var password = passInput ? passInput.value : "";
    var country = countryInput ? countryInput.value : "United States";
    setStatus("Signing in…", false);
    login(username, password).then(
      function (result) {
        try {
          localStorage.setItem("cognation.member.country.v1", country || "United States");
        } catch (err) {}
        if (window.CognationMemberCountry) {
          window.CognationMemberCountry.set(country || "United States");
        }
        setStatus("");
        finishWithProfileChoice(result.username, result.profiles, result);
      },
      function (error) {
        setStatus(
          (error && error.message) || "Wrong email or password.",
          true
        );
      }
    );
  });

  if (pickerContinue) {
    pickerContinue.addEventListener("click", function () {
      if (!pendingUsername || !pendingProfiles || !pendingProfiles.length) return;
      var chosen = null;
      var selected = pickerList && pickerList.querySelector('input[name="loginProfile"]:checked');
      if (selected) {
        for (var i = 0; i < pendingProfiles.length; i++) {
          if (pendingProfiles[i].id === selected.value) {
            chosen = pendingProfiles[i];
            break;
          }
        }
      }
      if (!chosen) chosen = pendingProfiles[0];
      establishSession(pendingUsername, chosen, pendingAuth || null);
      pendingAuth = null;
    });
  }

  if (pickerBack) {
    pickerBack.addEventListener("click", function () {
      showCredentialsStep();
      setStatus("");
      var first = form && (form.querySelector('input[name="email"]') || form.querySelector('input[name="username"]'));
      if (first) first.focus();
    });
  }

  if (openBtn) {
    openBtn.addEventListener("click", function () {
      openGate();
    });
  }

  /* Escape does not skip login */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !gate.hidden) {
      e.preventDefault();
    }
  });

  gate.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || gate.hidden) return;
    var focusable = gate.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  window.CognationAuth = {
    openGate: openGate,
    closeGate: closeGate,
    login: function (u, p) {
      return login(u, p == null ? "" : p).then(function (result) {
        var session = finishWithProfileChoice(result.username, result.profiles, result);
        return session || readLocalSession();
      });
    },
    logout: logout,
    isAuthenticated: isAuthenticated,
    getSession: readLocalSession,
    setActiveProfile: setActiveProfile,
    SESSION_KEY: SESSION_KEY,
    apiBaseUrl: API_BASE,
  };

  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest && ev.target.closest("[data-cognation-logout]");
    if (!btn) return;
    ev.preventDefault();
    logout({ message: "Signed out. Sign in to continue." });
  });

  function hydrateSessionProfile(session) {
    if (!session || !session.username) return session;
    if (window.CognationAccounts) {
      try {
        window.CognationAccounts.ensureSeeded();
      } catch (e) {}
    }
    if (session.activeProfileId) {
      var still =
        window.CognationAccounts && window.CognationAccounts.getProfileById
          ? window.CognationAccounts.getProfileById(session.activeProfileId)
          : null;
      if (still) {
        session.profileKind = still.kind === "professional" ? "professional" : "personal";
        session.profileHandle = still.handle || "";
        session.profileDisplayName = still.displayName || "";
        writeLocalSession(session);
        return session;
      }
    }
    var profiles = loadProfilesForUser(session.username);
    if (profiles.length) {
      var prefer =
        profiles.filter(function (p) {
          return p.kind === (session.profileKind || "personal");
        })[0] || profiles[0];
      session.activeProfileId = prefer.id;
      session.profileKind = prefer.kind === "professional" ? "professional" : "personal";
      session.profileHandle = prefer.handle || "";
      session.profileDisplayName = prefer.displayName || "";
      writeLocalSession(session);
    }
    return session;
  }

  function boot() {
    /* Clear old demo sessions so they cannot bypass */
    try {
      localStorage.removeItem("cognation.session.demo.v1");
    } catch (e) {}
    var session = readLocalSession();
    var remoteConfigured =
      window.CognationSupabase &&
      window.CognationSupabase.configured &&
      window.CognationSupabase.configured();
    if (remoteConfigured && (!session || session.source !== "supabase")) {
      writeLocalSession(null);
      openGate();
      return;
    }
    if (session) {
      if (remoteConfigured) {
        window.CognationSupabase
          .getUser()
          .then(function (user) {
            if (!user || !user.id) throw new Error("Session expired.");
            session.supabaseUserId = user.id;
            writeLocalSession(session);
            hydrateSessionProfile(session);
            closeGate();
          })
          .catch(function () {
            writeLocalSession(null);
            openGate({
              message: "Your session ended. Sign in again to continue.",
              isError: true,
            });
          });
        return;
      }
      hydrateSessionProfile(session);
      closeGate();
    } else {
      openGate();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
