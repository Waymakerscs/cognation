/**
 * Small browser client for Cognation's Supabase project.
 * The UI can progressively adopt this API while the legacy demo stores remain
 * available during migration.
 */
(function () {
  "use strict";

  var config = window.CognationConfig || {};
  var url = String(config.supabaseUrl || "").replace(/\/$/, "");
  var key = String(config.supabasePublishableKey || "");
  var SESSION_KEY = "cognation.supabase.session.v1";
  var EMAIL_BOOK_KEY = "cognation.account.emails.v1";

  function configured() {
    return /^https:\/\//.test(url) && /^sb_publishable_/.test(key);
  }

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function writeSession(session) {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function supabaseErrorMessage(body, status) {
    var msg = "";
    var code = "";
    if (typeof body === "string") msg = body.trim();
    else if (body && typeof body === "object") {
      msg = body.msg || body.message || body.error_description || body.error || "";
      code = body.error_code || "";
    }
    msg = String(msg || "").trim();
    if (code === "over_email_send_rate_limit" || /rate limit/i.test(msg)) {
      return "Supabase email rate limit exceeded, so the account was not created. In the Supabase dashboard, wait for the limit to reset, or turn off Confirm email under Authentication, Providers, Email.";
    }
    if (msg) return msg;
    return "Supabase request failed (" + status + ").";
  }

  function request(path, options) {
    if (!configured()) return Promise.reject(new Error("Supabase is not configured."));
    options = options || {};
    var session = readSession();
    var headers = Object.assign(
      {
        apikey: key,
        "Content-Type": "application/json",
      },
      options.headers || {}
    );
    if (session && session.access_token) {
      headers.Authorization = "Bearer " + session.access_token;
    }
    return fetch(url + path, Object.assign({}, options, { headers: headers })).then(function (response) {
      return response.text().then(function (text) {
        var body = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch (e) {
          body = text;
        }
        if (!response.ok) {
          var error = new Error(supabaseErrorMessage(body, response.status));
          error.status = response.status;
          error.body = body;
          throw error;
        }
        return body;
      });
    });
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function readEmailBook() {
    try {
      return JSON.parse(localStorage.getItem(EMAIL_BOOK_KEY) || "null") || {};
    } catch (e) {
      return {};
    }
  }

  function writeEmailBook(book) {
    try {
      localStorage.setItem(EMAIL_BOOK_KEY, JSON.stringify(book || {}));
    } catch (e) {}
    return book;
  }

  function professionalHandle(handle) {
    var base = String(handle || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 36);
    if (base.length < 3) base = "member";
    return (base + "-pro").slice(0, 40);
  }

  function signUp(fields) {
    fields = fields || {};
    var personal = normalizeEmail(fields.personalEmail || "");
    var professional = normalizeEmail(fields.professionalEmail || "");
    var loginEmail = normalizeEmail(fields.email || personal || professional);
    if (!loginEmail) {
      return Promise.reject(new Error("Enter a personal or professional email."));
    }
    if (personal && professional && personal === professional) {
      return Promise.reject(new Error("Use two different emails, or leave one blank."));
    }
    return request("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({
        email: loginEmail,
        password: fields.password,
        data: {
          username: loginEmail,
          handle: fields.handle || fields.username,
          display_name: fields.displayName,
          personal_email: personal,
          professional_email: professional,
        },
      }),
    }).then(function (result) {
      if (result && result.session) writeSession(result.session);
      else if (result && result.access_token) writeSession(result);
      var user = (result && result.user) || result;
      writeEmailBook({
        userId: user && user.id ? user.id : "",
        personalEmail: personal,
        professionalEmail: professional,
        loginEmail: loginEmail,
      });
      if (!readSession()) return result;
      return ensureAccountEmails({
        personalEmail: personal,
        professionalEmail: professional,
        handle: fields.handle || fields.username,
        displayName: fields.displayName || fields.username,
      })
        .catch(function () {
          return null;
        })
        .then(function () {
          return result;
        });
    });
  }

  function patchProfileEmail(id, email) {
    if (!id || !email) return Promise.resolve(null);
    return rest("profiles", {
      method: "PATCH",
      query: "id=eq." + encodeURIComponent(id),
      body: { email: email },
    }).catch(function () {
      return null;
    });
  }

  function ensureAccountEmails(fields) {
    if (!readSession()) return Promise.resolve(null);
    fields = fields || {};
    return getUser().then(function (user) {
      if (!user || !user.id) return null;
      var meta = user.user_metadata || {};
      var book = readEmailBook();
      var personal = normalizeEmail(
        fields.personalEmail || book.personalEmail || meta.personal_email || user.email
      );
      var professional = normalizeEmail(
        fields.professionalEmail || book.professionalEmail || meta.professional_email
      );
      writeEmailBook({
        userId: user.id,
        personalEmail: personal,
        professionalEmail: professional,
      });
      return rest("profiles", {
        query: "select=id,kind,handle,user_id&user_id=eq." + encodeURIComponent(user.id),
      }).then(function (rows) {
        rows = Array.isArray(rows) ? rows : [];
        var personalRow = null;
        var professionalRow = null;
        rows.forEach(function (row) {
          if (row.kind === "professional") professionalRow = row;
          else personalRow = row;
        });
        var tasks = [patchProfileEmail(personalRow && personalRow.id, personal)];
        if (!professionalRow && professional) {
          var handle = professionalHandle(
            fields.handle || (personalRow && personalRow.handle) || meta.handle
          );
          var displayName = String(fields.displayName || meta.display_name || "Professional page").slice(0, 80);
          function insertProfessional(nextHandle) {
            return rest("profiles", {
              method: "POST",
              body: {
                user_id: user.id,
                kind: "professional",
                handle: nextHandle,
                display_name: displayName,
                bio: "",
              },
            });
          }
          tasks.push(
            insertProfessional(handle)
              .catch(function () {
                var alt = (
                  handle.replace(/-pro$/, "").slice(0, 32) +
                  "-" +
                  String(user.id).replace(/-/g, "").slice(0, 4)
                ).slice(0, 40);
                if (alt === handle) return null;
                return insertProfessional(alt);
              })
              .then(function (created) {
                var row = Array.isArray(created) ? created[0] : created;
                return patchProfileEmail(row && row.id, professional);
              })
              .catch(function () {
                return null;
              })
          );
        } else {
          tasks.push(patchProfileEmail(professionalRow && professionalRow.id, professional));
        }
        return Promise.all(tasks).then(function () {
          return { personalEmail: personal, professionalEmail: professional };
        });
      });
    });
  }

  function signIn(email, password) {
    return request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: email, password: password }),
    }).then(function (result) {
      if (result && result.access_token) writeSession(result);
      return result;
    });
  }

  function signOut() {
    return request("/auth/v1/logout", { method: "POST" }).finally(function () {
      writeSession(null);
    });
  }

  function getUser() {
    return request("/auth/v1/user", { method: "GET" });
  }

  function rest(table, options) {
    options = options || {};
    var suffix = options.query ? "?" + options.query : "";
    return request("/rest/v1/" + encodeURIComponent(table) + suffix, {
      method: options.method || "GET",
      body: options.body == null ? undefined : JSON.stringify(options.body),
      headers: Object.assign(
        { Prefer: options.prefer || "return=representation" },
        options.headers || {}
      ),
    });
  }

  function rpc(name, params) {
    return request("/rest/v1/rpc/" + encodeURIComponent(name), {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
  }

  window.CognationSupabase = {
    configured: configured,
    getSession: readSession,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    getUser: getUser,
    rest: rest,
    rpc: rpc,
    ensureAccountEmails: ensureAccountEmails,
    readEmailBook: readEmailBook,
  };
})();
