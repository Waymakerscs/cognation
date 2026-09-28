/**
 * CGN-007 — Login/signup shell behavior.
 * Mode: [data-login-mode]="signin|signup" on [data-login-credentials-step]
 * Signup fields: age, country, phone, personal email, professional email.
 * Both emails belong to one account. Personal email is the sign-in address
 * and the personal profile page. Professional email is the professional page.
 * Persists member profile for COMMUNE age / dating gates.
 */
(function () {
  "use strict";

  var MEMBER_PROFILE_KEY = "cognation.member.profile.v1";

  var step = document.querySelector("[data-login-credentials-step]");
  var form = document.getElementById("login-form");
  if (!step || !form) return;

  var toggleBtn = form.querySelector("[data-login-mode-toggle]");
  var signupFields = form.querySelector("[data-login-signup-fields]");
  var signinCountry = form.querySelector("[data-login-signin-country]");
  var signinCountrySelect = form.querySelector("[data-login-signin-country-select]");
  var signupCountrySelect = form.querySelector("[data-login-signup-country-select]");
  var submitBtn = form.querySelector("[data-login-submit]");
  var titleEl = document.getElementById("login-gate-title");
  var descEl = document.getElementById("login-gate-desc");
  var statusEl = document.getElementById("login-status");
  var demoHint = form.querySelector("[data-login-demo-hint]");
  var passwordInput = form.querySelector("#login-password");
  var usernameInput = form.querySelector("#login-username");
  var usernameLabel = form.querySelector('label[for="login-username"]');
  var usernameHint = form.querySelector("#login-email-hint");

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("is-error", !!isError);
  }

  function readProfile() {
    try {
      var raw = localStorage.getItem(MEMBER_PROFILE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeProfile(fields) {
    var next = Object.assign({}, readProfile(), fields || {});
    delete next.state;
    try {
      localStorage.setItem(MEMBER_PROFILE_KEY, JSON.stringify(next));
    } catch (e) {}
    if (next.country) {
      try {
        localStorage.setItem("cognation.member.country.v1", String(next.country));
      } catch (e2) {}
    }
    if (window.CognationCommuneSwipe && window.CognationCommuneSwipe.setMemberProfile) {
      try {
        window.CognationCommuneSwipe.setMemberProfile(next);
      } catch (e3) {}
    }
    document.dispatchEvent(
      new CustomEvent("cognation:member-profile-updated", { detail: next })
    );
    return next;
  }

  function setMode(mode) {
    mode = mode === "signup" ? "signup" : "signin";
    step.setAttribute("data-login-mode", mode);
    var isSignup = mode === "signup";

    if (signupFields) signupFields.hidden = !isSignup;
    if (signinCountry) signinCountry.hidden = isSignup;

    if (signinCountrySelect) {
      signinCountrySelect.disabled = isSignup;
      if (isSignup) signinCountrySelect.removeAttribute("name");
      else signinCountrySelect.setAttribute("name", "country");
    }
    if (signupCountrySelect) {
      signupCountrySelect.disabled = !isSignup;
      if (isSignup) signupCountrySelect.setAttribute("name", "country");
      else signupCountrySelect.removeAttribute("name");
    }

    form.querySelectorAll("[data-login-signup-fields] input, [data-login-signup-fields] select").forEach(function (el) {
      if (el === signupCountrySelect) return;
      el.disabled = !isSignup;
    });

    if (passwordInput) {
      passwordInput.setAttribute("autocomplete", isSignup ? "new-password" : "current-password");
    }
    if (submitBtn) submitBtn.textContent = isSignup ? "Sign up" : "Sign in";
    if (toggleBtn) {
      toggleBtn.textContent = isSignup
        ? "Have an account? Sign in"
        : "Need an account? Sign up";
    }
    document.querySelectorAll("[data-login-open-mode]").forEach(function (btn) {
      var on = btn.getAttribute("data-login-open-mode") === mode;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.classList.toggle("is-selected", on);
    });
    if (titleEl) titleEl.textContent = isSignup ? "Sign up" : "Sign in";
    if (descEl) {
      descEl.innerHTML = isSignup
        ? 'Enter at least one email. If you enter both, the personal email signs in.'
        : 'Welcome to <span data-brand>COGNATION</span>. Sign in with your personal email to continue.';
    }
    if (demoHint) demoHint.hidden = true;
    setStatus("");
  }

  function markInvalid(el, bad) {
    if (!el) return;
    el.setAttribute("aria-invalid", bad ? "true" : "false");
  }

  function validateSignup() {
    var ok = true;
    var age = form.querySelector("#age");
    var phone = form.querySelector("#phone");
    var personalEmail = form.querySelector("#email-personal");
    var professionalEmail = form.querySelector("#email-professional");
    var pass = form.querySelector("#login-password");
    var country = signupCountrySelect;

    function req(el, check) {
      var bad = !check(el);
      markInvalid(el, bad);
      if (bad) ok = false;
    }

    req(pass, function (el) {
      return el && el.value.length > 0;
    });
    req(age, function (el) {
      if (!el || el.value === "") return false;
      var n = Number(el.value);
      return n >= 13 && n <= 120;
    });
    req(country, function (el) {
      return el && el.value;
    });
    req(phone, function (el) {
      return el && el.value.trim().length >= 7;
    });
    function emailOk(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    }
    var personalValue = personalEmail ? personalEmail.value.trim() : "";
    var professionalValue = professionalEmail ? professionalEmail.value.trim() : "";
    var personalBad = personalValue ? !emailOk(personalValue) : !professionalValue;
    var professionalBad = professionalValue ? !emailOk(professionalValue) : !personalValue;
    if (
      personalValue &&
      professionalValue &&
      emailOk(personalValue) &&
      emailOk(professionalValue) &&
      personalValue.toLowerCase() === professionalValue.toLowerCase()
    ) {
      professionalBad = true;
    }
    markInvalid(personalEmail, personalBad);
    markInvalid(professionalEmail, professionalBad);
    if (personalBad || professionalBad) ok = false;
    return ok;
  }

  function collectSignupProfile() {
    var ageEl = form.querySelector("#age");
    var phoneEl = form.querySelector("#phone");
    var personalEl = form.querySelector("#email-personal");
    var professionalEl = form.querySelector("#email-professional");
    var country =
      (signupCountrySelect && signupCountrySelect.value) ||
      "United States";
    var personal = personalEl ? personalEl.value.trim() : "";
    var professional = professionalEl ? professionalEl.value.trim() : "";
    var loginEmail = personal || professional;
    return {
      age: ageEl ? parseInt(ageEl.value, 10) : null,
      country: country,
      phone: phoneEl ? phoneEl.value.trim() : "",
      personalEmail: personal,
      professionalEmail: professional,
      email: loginEmail,
      loginEmail: loginEmail,
      displayName: displayNameFromEmail(loginEmail),
      handle: handleFromEmail(loginEmail),
      updatedAt: Date.now(),
    };
  }

  function displayNameFromEmail(email) {
    var local = String(email || "").split("@")[0] || "";
    var words = local.replace(/[._-]+/g, " ").replace(/[^a-zA-Z0-9 ]/g, " ").trim();
    if (!words) return "Member";
    return words
      .split(/\s+/)
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ")
      .slice(0, 80);
  }

  function handleFromEmail(email) {
    var local = String(email || "")
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 32);
    if (local.length < 3) local = ("member" + local).slice(0, 40);
    return local || "member";
  }

  function requestLiveLocation() {
    if (!window.CognationLocation || !window.CognationLocation.request) return;
    window.CognationLocation.request().then(function () {}, function () {});
  }

  /* Create a real account when Supabase is configured; retain local capture
     only for the offline demo. */
  form.addEventListener(
    "submit",
    function (e) {
      var mode = step.getAttribute("data-login-mode") || "signin";
      requestLiveLocation();
      if (mode === "signup") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!validateSignup()) {
          setStatus("Enter at least one email and fix any highlighted fields.", true);
          return;
        }
        var profile = collectSignupProfile();
        var password = (form.querySelector("#login-password") || {}).value || "";
        var handle = profile.handle || handleFromEmail(profile.loginEmail);
        requestLiveLocation();
        try {
          if (profile.country) {
            localStorage.setItem("cognation.member.country.v1", profile.country);
          }
        } catch (err) {}
        if (
          window.CognationSupabase &&
          window.CognationSupabase.configured &&
          window.CognationSupabase.configured()
        ) {
          setStatus("Creating your Cognation account…", false);
          window.CognationSupabase
            .signUp({
              email: profile.loginEmail,
              personalEmail: profile.personalEmail,
              professionalEmail: profile.professionalEmail,
              password: password,
              username: profile.loginEmail,
              handle: handle,
              displayName: profile.displayName,
            })
            .then(function (result) {
              writeProfile(profile);
              var signedIn =
                result &&
                (result.access_token ||
                  (result.session && result.session.access_token));
              if (signedIn && window.CognationAuth) {
                return window.CognationAuth.login(profile.loginEmail, password).then(function (session) {
                  if (session) location.replace("index.html");
                });
              }
              setStatus(
                "The account was not signed in. Supabase is still set to send a confirmation email. Turn off Confirm email under Authentication, Providers, Email. The next successful signup opens the signed-in home.",
                true
              );
              return null;
            })
            .catch(function (error) {
              setStatus(
                (error && error.message) || "Could not create your account. Please try again.",
                true
              );
            });
          return;
        }
        setStatus("Account sign-up is not configured. Please try again later.", true);
        return;
      }

      /* Sign-in: also capture country + keep any existing age */
      var countryInput = form.querySelector(
        '[data-login-signin-country-select], select[name="country"]'
      );
      var patch = {};
      if (countryInput && countryInput.value) patch.country = countryInput.value;
      /* If age field somehow visible/filled, keep it */
      var ageEl = form.querySelector("#age");
      if (ageEl && ageEl.value && !ageEl.disabled) {
        patch.age = parseInt(ageEl.value, 10);
      }
      if (Object.keys(patch).length) writeProfile(patch);
    },
    true
  );

  /* Hydrate from existing profile */
  (function hydrate() {
    var p = readProfile();
    var ageEl = form.querySelector("#age");
    var phoneEl = form.querySelector("#phone");
    var personalEl = form.querySelector("#email-personal");
    var professionalEl = form.querySelector("#email-professional");
    if (ageEl && p.age != null) ageEl.value = p.age;
    if (phoneEl && p.phone) phoneEl.value = p.phone;
    if (personalEl && (p.personalEmail || p.email)) personalEl.value = p.personalEmail || p.email;
    if (professionalEl && p.professionalEmail) professionalEl.value = p.professionalEmail;
    if (signupCountrySelect && p.country) signupCountrySelect.value = p.country;
    if (signinCountrySelect && p.country) {
      try {
        signinCountrySelect.value = p.country;
      } catch (e) {}
    }
  })();

  setMode(step.getAttribute("data-login-mode") === "signup" ? "signup" : "signin");
  requestLiveLocation();
})();
