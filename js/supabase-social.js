/**
 * Cognation's live social data layer.
 *
 * This is intentionally framework-free because the existing site is static.
 * It owns the network boundary; Tower continues to render its established UI
 * from a short-lived in-browser cache populated only by Supabase.
 */
(function () {
  "use strict";

  var state = {
    profiles: {},
    handles: {},
    myProfiles: [],
    feed: [],
    initialized: false,
  };

  function client() {
    return window.CognationSupabase || null;
  }

  function session() {
    return window.CognationAuth && window.CognationAuth.getSession
      ? window.CognationAuth.getSession()
      : null;
  }

  function identity() {
    var current = session();
    if (
      !current ||
      current.source !== "supabase" ||
      !current.supabaseUserId ||
      !client() ||
      !client().configured()
    ) {
      return null;
    }
    return current;
  }

  function active() {
    return !!identity();
  }

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function normalizeHandle(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 40);
  }

  function accountEmailBook() {
    if (client() && client().readEmailBook) return client().readEmailBook() || {};
    try {
      return JSON.parse(localStorage.getItem("cognation.account.emails.v1") || "null") || {};
    } catch (e) {
      return {};
    }
  }

  function emailForProfile(profile) {
    var stored = String(profile.email || "").trim().toLowerCase();
    if (stored) return stored;
    var book = accountEmailBook();
    if (!book || !profile.user_id || String(book.userId || "") !== String(profile.user_id)) return "";
    return profile.kind === "professional"
      ? String(book.professionalEmail || "").trim().toLowerCase()
      : String(book.personalEmail || "").trim().toLowerCase();
  }

  function cacheProfile(profile) {
    if (!profile || !profile.id) return null;
    var item = {
      id: String(profile.id),
      user_id: String(profile.user_id || ""),
      kind: profile.kind === "professional" ? "professional" : "personal",
      handle: normalizeHandle(profile.handle),
      display_name: String(profile.display_name || "Member").slice(0, 80),
      bio: String(profile.bio || "").slice(0, 280),
      email: emailForProfile(profile),
    };
    state.profiles[item.id] = item;
    if (item.handle) state.handles[item.handle] = item.id;
    return item;
  }

  function cacheProfiles(rows) {
    (Array.isArray(rows) ? rows : []).forEach(cacheProfile);
    return rows;
  }

  function profileForId(id) {
    return state.profiles[String(id || "")] || null;
  }

  function profileForHandle(handle) {
    var id = state.handles[normalizeHandle(handle)];
    return id ? profileForId(id) : null;
  }

  function profileForUser(userId, kind) {
    var all = Object.keys(state.profiles).map(function (id) {
      return state.profiles[id];
    });
    return (
      all.filter(function (profile) {
        return profile.user_id === userId && (!kind || profile.kind === kind);
      })[0] || null
    );
  }

  function selectProfiles() {
    return client()
      .rest("profiles", {
        query:
          "select=id,user_id,kind,handle,display_name,bio&order=created_at.asc&limit=250",
      })
      .then(cacheProfiles);
  }

  function refreshMyProfiles() {
    var me = identity();
    if (!me) return Promise.resolve([]);
    return client()
      .rest("profiles", {
        query:
          "select=id,user_id,kind,handle,display_name,bio&user_id=eq." +
          encodeURIComponent(me.supabaseUserId),
      })
      .then(function (rows) {
        state.myProfiles = (Array.isArray(rows) ? rows : []).map(cacheProfile);
        return state.myProfiles;
      });
  }

  function currentProfileId() {
    var current = identity();
    return current && current.activeProfileId ? current.activeProfileId : "";
  }

  function viewedProfileId() {
    var hash = String(location.hash || "").replace(/^#tower-profile-/, "");
    var byHash = hash ? profileForHandle(decodeURIComponent(hash)) : null;
    return byHash ? byHash.id : currentProfileId();
  }

  function toTowerProfile(profile) {
    if (!profile) return null;
    return {
      _profileId: profile.id,
      _profileKind: profile.kind,
      _remote: true,
      displayName: profile.display_name,
      handle: profile.handle,
      slogan: profile.bio,
      profileEmail: profile.email || "",
      socialLinks: {},
      avatarDataUrl: "",
      badges: { role: "", interest: "", status: "" },
      featuredFriendIds: [],
      friendsDisplayCount: 3,
      /* Same scrapbook widgets as the demo page, on both profile kinds. */
      publicWidgets: {
        identity: true,
        slogan: true,
        social: true,
        music: true,
        badges: true,
        friends: true,
        html: true,
        calendar: true,
      },
      widgetLayout: null,
      customHtml: "",
      musicUrl: "",
      musicEnabled: true,
      awardedBadges: null,
      badgeVisibility: null,
      quoteStickers: [],
      backgroundCollage: { layoutId: "none", cells: [] },
    };
  }

  function setActiveProfile(profile) {
    if (!profile || !profile.id) return null;
    var current = session();
    if (!current) return null;
    current.activeProfileId = profile.id;
    current.profileKind = profile.kind;
    current.profileHandle = profile.handle;
    current.profileDisplayName = profile.display_name;
    try {
      localStorage.setItem("cognation.session.v2", JSON.stringify(current));
    } catch (e) {}
    emit("cognation:active-profile-changed", {
      profileId: profile.id,
      kind: profile.kind,
    });
    return current;
  }

  function openProfile(profile) {
    if (!profile || !profile.handle) return;
    location.hash = "tower-profile-" + encodeURIComponent(profile.handle);
    var tower = document.getElementById("tab-tower");
    if (tower) tower.click();
    emit("cognation:remote-profile-loaded", { profileId: profile.id });
  }

  function mapPost(row) {
    var embedded = row && row.profiles;
    if (Array.isArray(embedded)) embedded = embedded[0];
    if (embedded && embedded.id) cacheProfile(embedded);
    var author = profileForId(row.author_profile_id) || (embedded && embedded.id ? embedded : null);
    return {
      id: row.id,
      _remote: true,
      authorProfileId: row.author_profile_id,
      authorUserId: author ? String(author.user_id || "") : "",
      authorName: author ? author.display_name : "Cognation member",
      handle: author ? author.handle : "",
      body: row.body || "",
      createdAt: row.created_at,
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      likes: 0,
      reactions: {},
      visibility: row.visibility || "friends",
    };
  }

  function replaceTowerFeed(posts) {
    state.feed = posts;
    if (
      window.CognationTowerStore &&
      typeof window.CognationTowerStore.setRemotePosts === "function"
    ) {
      window.CognationTowerStore.setRemotePosts(posts);
    }
    emit("cognation:remote-feed-loaded", { count: posts.length });
  }

  function sameId(left, right) {
    var a = String(left || "").trim().toLowerCase();
    var b = String(right || "").trim().toLowerCase();
    return !!a && a === b;
  }

  function addProfileId(ids, id) {
    id = String(id || "");
    if (!id) return;
    if (!ids.some(function (existing) { return sameId(existing, id); })) ids.push(id);
  }

  function rememberedProfileIds() {
    var me = identity();
    if (!me || !me.supabaseUserId) return [];
    try {
      var raw = JSON.parse(localStorage.getItem("cognation.my-profile-ids.v1") || "null");
      if (!raw || !sameId(raw.userId, me.supabaseUserId) || !Array.isArray(raw.ids)) return [];
      return raw.ids;
    } catch (e) {
      return [];
    }
  }

  function rememberProfileIds(ids) {
    var me = identity();
    if (!me || !me.supabaseUserId) return;
    try {
      localStorage.setItem(
        "cognation.my-profile-ids.v1",
        JSON.stringify({ userId: me.supabaseUserId, ids: ids || [] })
      );
    } catch (e) {}
  }

  function ownedProfileIds() {
    var ids = [];
    var me = identity();
    (state.myProfiles || []).forEach(function (profile) {
      if (profile) addProfileId(ids, profile.id);
    });
    if (me && me.supabaseUserId) {
      Object.keys(state.profiles).forEach(function (id) {
        var profile = state.profiles[id];
        if (profile && sameId(profile.user_id, me.supabaseUserId)) addProfileId(ids, profile.id);
      });
    }
    rememberedProfileIds().forEach(function (id) {
      addProfileId(ids, id);
    });
    return ids;
  }

  function myProfileIds() {
    var ids = ownedProfileIds();
    var me = identity();
    if (me && me.activeProfileId) addProfileId(ids, me.activeProfileId);
    return ids;
  }

  function namesForSession(me) {
    var names = [];
    function add(value) {
      var text = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^@/, "");
      if (text && names.indexOf(text) < 0) names.push(text);
    }
    if (me) {
      add(me.profileDisplayName);
      add(me.profileHandle);
    }
    (state.myProfiles || []).forEach(function (profile) {
      if (!profile) return;
      add(profile.display_name);
      add(profile.handle);
    });
    return names;
  }

  function ownsPost(post) {
    if (!post || !active()) return false;
    var me = identity();
    var authorId = String(post.authorProfileId || post.author_profile_id || "");
    var knownIds = ownedProfileIds();
    var authorUser = String(post.authorUserId || post.author_user_id || "");
    if (!authorUser && authorId) {
      var author = profileForId(authorId);
      if (author) authorUser = String(author.user_id || "");
    }
    if (authorId && knownIds.some(function (id) { return sameId(id, authorId); })) return true;
    if (me && authorId && sameId(me.activeProfileId, authorId)) return true;
    if (authorUser) return !!(me && sameId(authorUser, me.supabaseUserId));
    /* An author id that is not hers belongs to someone else. Name matching is
       only for posts that never received an author id. */
    if (authorId) return false;
    var handle = normalizeHandle(post.handle || "");
    var authorName = String(post.authorName || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    var names = namesForSession(me);
    if (handle && names.indexOf(handle) >= 0) return true;
    if (authorName && authorName !== "cognation member" && names.indexOf(authorName) >= 0) return true;
    if (authorName === "you") return true;
    return false;
  }

  function deleteTowerPost(postId) {
    var me = identity();
    postId = String(postId || "");
    if (!me) return Promise.reject(new Error("Sign in before deleting a post."));
    if (!/^[0-9a-f-]{36}$/i.test(postId)) {
      return Promise.reject(new Error("That post cannot be deleted."));
    }
    return client()
      .rest("tower_posts", {
        method: "DELETE",
        query: "id=eq." + encodeURIComponent(postId),
        prefer: "return=representation",
      })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) {
          return Promise.reject(
            new Error("The post was not deleted. Authors are not allowed to delete posts yet.")
          );
        }
        return refreshFeed();
      });
  }

  function refreshFeed() {
    if (!active()) return Promise.resolve([]);
    var columns =
      "id,author_profile_id,body,visibility,attachments,created_at,profiles(id,user_id,handle,display_name,kind)";
    var plain = "id,author_profile_id,body,visibility,attachments,created_at";
    function load(select) {
      return client().rest("tower_posts", {
        query: "select=" + select + "&order=created_at.desc&limit=100",
      });
    }
    return load(columns)
      .catch(function () {
        return load(plain);
      })
      .then(function (rows) {
        var posts = (Array.isArray(rows) ? rows : []).map(mapPost);
        replaceTowerFeed(posts);
        return posts;
      });
  }

  function attachmentIsPicture(attachment) {
    var kind = String((attachment && attachment.kind) || "");
    var type = String((attachment && attachment.type) || "");
    var name = String((attachment && (attachment.name || attachment.label)) || "");
    var src = String((attachment && (attachment.src || attachment.url || attachment.dataUrl)) || "");
    if (kind === "photo" || kind === "art") return true;
    if (/^image\//i.test(type)) return true;
    if (/^data:image\//i.test(src)) return true;
    return /\.(png|jpe?g|gif|webp|bmp|avif|svg|heic|heif)$/i.test(name);
  }

  function createTowerPost(fields) {
    var me = identity();
    var body = String((fields && fields.body) || "").trim();
    var profileId = me && me.activeProfileId;
    if (!me || !profileId) {
      return Promise.reject(new Error("Sign in before posting to Tower."));
    }
    var attachments = Array.isArray(fields && fields.attachments)
      ? fields.attachments.map(function (attachment) {
          var item = {
            kind: String(attachment.kind || "document"),
            label: String(attachment.label || attachment.name || "Attachment").slice(0, 160),
            name: String(attachment.name || attachment.label || "").slice(0, 160),
            type: String(attachment.type || "").slice(0, 80),
          };
          if (attachment.size != null) item.size = attachment.size;
          if (attachment.src) item.src = String(attachment.src);
          return item;
        })
      : [];
    /* tower_posts_body_check is char_length(body) between 1 and 2000.
       A picture does not need a status. One space satisfies the check and
       is not shown as a caption. The picture stays in attachments. */
    if (!body && attachments.some(attachmentIsPicture)) body = " ";
    else if (!body && attachments.length) body = "Shared a file";
    else body = Array.from(body).slice(0, 2000).join("");
    if (!body) {
      return Promise.reject(new Error("Add a written update or a picture."));
    }
    return client()
      .rest("tower_posts", {
        method: "POST",
        body: {
          author_profile_id: profileId,
          body: body,
          visibility: "friends",
          attachments: attachments,
        },
      })
      .then(function () {
        return refreshFeed();
      });
  }

  function updateCurrentProfile(data) {
    var me = identity();
    if (!me || !me.activeProfileId) {
      return Promise.reject(new Error("Sign in before editing your profile."));
    }
    var changes = {};
    if (data && Object.prototype.hasOwnProperty.call(data, "displayName")) {
      changes.display_name = String(data.displayName || "").trim().slice(0, 80) || "Member";
    }
    if (data && Object.prototype.hasOwnProperty.call(data, "handle")) {
      changes.handle = normalizeHandle(data.handle);
    }
    if (data && Object.prototype.hasOwnProperty.call(data, "bio")) {
      changes.bio = String(data.bio || "").trim().slice(0, 280);
    }
    if (!Object.keys(changes).length) return Promise.resolve(profileForId(me.activeProfileId));
    return client()
      .rest("profiles", {
        method: "PATCH",
        query: "id=eq." + encodeURIComponent(me.activeProfileId),
        body: changes,
      })
      .then(function (rows) {
        var profile = cacheProfile(Array.isArray(rows) ? rows[0] : null);
        if (profile) setActiveProfile(profile);
        emit("cognation:remote-profile-loaded", { profileId: me.activeProfileId });
        return profile;
      });
  }

  function createProfessionalProfile(fields) {
    var me = identity();
    if (!me) return Promise.reject(new Error("Sign in before creating a professional page."));
    var base = normalizeHandle(fields && fields.handle);
    if (!base) base = "member-" + me.supabaseUserId.slice(0, 8);
    return client()
      .rest("profiles", {
        method: "POST",
        body: {
          user_id: me.supabaseUserId,
          kind: "professional",
          handle: base.slice(0, 40),
          display_name: String((fields && fields.displayName) || "Professional page").slice(0, 80),
          bio: String((fields && fields.bio) || "").slice(0, 280),
        },
      })
      .then(function (rows) {
        var profile = cacheProfile(Array.isArray(rows) ? rows[0] : null);
        if (!profile) throw new Error("Could not create a professional page.");
        state.myProfiles.push(profile);
        setActiveProfile(profile);
        return profile;
      });
  }

  function memberResults(query) {
    var term = String(query || "").trim().toLowerCase();
    var me = identity();
    var list = Object.keys(state.profiles)
      .map(function (id) {
        return state.profiles[id];
      })
      .filter(function (profile) {
        if (!term) return false;
        return (
          profile.display_name.toLowerCase().indexOf(term) >= 0 ||
          profile.handle.toLowerCase().indexOf(term) >= 0
        );
      })
      .filter(function (profile) {
        return !me || profile.user_id !== me.supabaseUserId;
      });
    return list.slice(0, 8);
  }

  function profilesForUsers(userIds) {
    var ids = (userIds || []).filter(Boolean);
    if (!ids.length) return Promise.resolve([]);
    var needed = ids.filter(function (id) {
      return !profileForUser(id, "personal");
    });
    if (!needed.length) return Promise.resolve(ids.map(function (id) {
      return profileForUser(id, "personal");
    }).filter(Boolean));
    return selectProfiles().then(function () {
      return ids
        .map(function (id) {
          return profileForUser(id, "personal");
        })
        .filter(Boolean);
    });
  }

  function clearElement(element) {
    while (element && element.firstChild) element.removeChild(element.firstChild);
  }

  function textNode(tag, text, className) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function openMemberButton(profile) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-secondary";
    button.textContent = "Open";
    button.addEventListener("click", function () {
      openProfile(profile);
    });
    return button;
  }

  function renderFriends(profiles) {
    document.querySelectorAll("[data-tower-friends-browse-list]").forEach(function (list) {
      clearElement(list);
      if (!profiles.length) {
        list.appendChild(textNode("li", "No friends yet. Search members to connect."));
        return;
      }
      profiles.forEach(function (profile) {
        var item = document.createElement("li");
        item.appendChild(textNode("span", profile.display_name + " @" + profile.handle));
        item.appendChild(openMemberButton(profile));
        list.appendChild(item);
      });
    });
  }

  function renderConnections(payload) {
    var requests = payload.requests || [];
    var notifications = payload.notifications || [];
    document.querySelectorAll("[data-remote-social]").forEach(function (root) {
      var requestsEl = root.querySelector("[data-remote-friend-requests]");
      var notificationsEl = root.querySelector("[data-remote-notifications]");
      root.hidden = !requests.length && !notifications.length;
      if (requestsEl) {
        clearElement(requestsEl);
        if (requests.length) {
          requestsEl.appendChild(textNode("h5", "Friend requests"));
          var requestList = document.createElement("ul");
          requestList.className = "tower-remote-list";
          requests.forEach(function (request) {
            var sender = profileForUser(request.sender_user_id, "personal");
            var item = document.createElement("li");
            item.appendChild(
              textNode(
                "span",
                (sender ? sender.display_name : "A member") + " wants to connect"
              )
            );
            var accept = document.createElement("button");
            accept.type = "button";
            accept.className = "btn btn-primary";
            accept.textContent = "Accept";
            accept.addEventListener("click", function () {
              accept.disabled = true;
              accept.textContent = "Accepting…";
              acceptFriendRequest(request.id).catch(function () {
                accept.disabled = false;
                accept.textContent = "Try again";
              });
            });
            item.appendChild(accept);
            requestList.appendChild(item);
          });
          requestsEl.appendChild(requestList);
        }
      }
      if (notificationsEl) {
        clearElement(notificationsEl);
        if (notifications.length) {
          notificationsEl.appendChild(textNode("h5", "Updates"));
          var notificationList = document.createElement("ul");
          notificationList.className = "tower-remote-list";
          notifications.slice(0, 6).forEach(function (notification) {
            notificationList.appendChild(textNode("li", notification.body));
          });
          notificationsEl.appendChild(notificationList);
        }
      }
    });
  }

  function refreshFriends() {
    var me = identity();
    if (!me) return Promise.resolve([]);
    return client()
      .rest("friendships", {
        query:
          "select=friend_user_id&user_id=eq." + encodeURIComponent(me.supabaseUserId),
      })
      .then(function (rows) {
        return profilesForUsers(
          (Array.isArray(rows) ? rows : []).map(function (row) {
            return row.friend_user_id;
          })
        );
      })
      .then(function (profiles) {
        renderFriends(profiles);
        emit("cognation:remote-friends-loaded", { profiles: profiles });
        return profiles;
      });
  }

  function deliverNotificationEmails(notifications) {
    var config = window.CognationConfig || {};
    var book = accountEmailBook();
    var me = identity();
    var personal = String(
      book.personalEmail || (me && me.username) || ""
    )
      .trim()
      .toLowerCase();
    var professional = String(book.professionalEmail || "")
      .trim()
      .toLowerCase();
    var emails = [];
    if (personal.indexOf("@") > 0) emails.push(personal);
    if (professional.indexOf("@") > 0 && emails.indexOf(professional) < 0) {
      emails.push(professional);
    }
    var pending = (notifications || []).filter(function (note) {
      return note && !note.read_at;
    });
    if (!pending.length || !emails.length) {
      return { ok: true, sent: 0, emails: emails };
    }
    /* The app stores notifications in Supabase and renders them in Tower.
       There is no mail provider in this project to deliver those as email. */
    if (!config.emailApiUrl || !config.emailApiKey) {
      return {
        ok: false,
        sent: 0,
        emails: emails,
        missing:
          "No email provider or API key. In-app notifications are stored, but they are not emailed to the personal and professional addresses.",
      };
    }
    return {
      ok: false,
      sent: 0,
      emails: emails,
      missing: "Email settings are present but this project has no mail sender to call.",
    };
  }

  function refreshNotifications() {
    var me = identity();
    if (!me) return Promise.resolve({ notifications: [], requests: [] });
    return Promise.all([
      client().rest("notifications", {
        query:
          "select=id,actor_user_id,type,body,resource_id,read_at,created_at&recipient_user_id=eq." +
          encodeURIComponent(me.supabaseUserId) +
          "&order=created_at.desc&limit=30",
      }),
      client().rest("friend_requests", {
        query:
          "select=id,sender_user_id,created_at&recipient_user_id=eq." +
          encodeURIComponent(me.supabaseUserId) +
          "&status=eq.pending&order=created_at.desc",
      }),
    ]).then(function (result) {
      return profilesForUsers(
        (Array.isArray(result[1]) ? result[1] : []).map(function (request) {
          return request.sender_user_id;
        })
      ).then(function () {
        var payload = {
          notifications: Array.isArray(result[0]) ? result[0] : [],
          requests: Array.isArray(result[1]) ? result[1] : [],
        };
        renderConnections(payload);
        state.emailDelivery = deliverNotificationEmails(payload.notifications);
        emit("cognation:remote-notifications-loaded", payload);
        return payload;
      });
    });
  }

  function acceptFriendRequest(id) {
    return client()
      .rpc("accept_friend_request", { request_id: id })
      .then(function () {
        return Promise.all([refreshFriends(), refreshNotifications()]);
      });
  }

  function refresh() {
    if (!active()) return Promise.resolve(null);
    return selectProfiles()
      .then(refreshMyProfiles)
      .then(function () {
        rememberProfileIds(ownedProfileIds());
        var current = session();
        var known = ownedProfileIds();
        var activeIsMine =
          current &&
          known.some(function (id) { return sameId(id, current.activeProfileId); });
        if (!activeIsMine && state.myProfiles[0]) {
          var prefer =
            state.myProfiles.filter(function (profile) {
              return profile && profile.kind === ((current && current.profileKind) || "personal");
            })[0] || state.myProfiles[0];
          setActiveProfile(prefer);
        }
        return Promise.all([refreshFeed(), refreshFriends(), refreshNotifications()]);
      })
      .then(function () {
        emit("cognation:remote-profile-loaded", {
          profileId: viewedProfileId(),
        });
        return state;
      });
  }

  function boot() {
    if (state.initialized) return;
    state.initialized = true;
    window.addEventListener("hashchange", function () {
      emit("cognation:remote-profile-loaded", { profileId: viewedProfileId() });
      refreshFeed();
    });
    document.addEventListener("cognation:session-started", refresh);
    if (active()) refresh();
  }

  window.CognationSupabaseSocial = {
    active: active,
    refresh: refresh,
    refreshFeed: refreshFeed,
    refreshFriends: refreshFriends,
    refreshNotifications: refreshNotifications,
    createTowerPost: createTowerPost,
    deleteTowerPost: deleteTowerPost,
    ownsPost: ownsPost,
    updateCurrentProfile: updateCurrentProfile,
    createProfessionalProfile: createProfessionalProfile,
    acceptFriendRequest: acceptFriendRequest,
    memberResults: memberResults,
    openProfile: openProfile,
    getProfile: profileForId,
    getProfileForHandle: profileForHandle,
    getProfileForUser: profileForUser,
    getMyProfiles: function () {
      return state.myProfiles.slice();
    },
    getViewedProfileId: viewedProfileId,
    getTowerProfile: function (id) {
      return toTowerProfile(profileForId(id));
    },
    setActiveProfile: setActiveProfile,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
