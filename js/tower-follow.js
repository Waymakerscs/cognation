/**
 * CGN-007 — Tower professional Follow button.
 * Hook: [data-tower-follow] + data-profile-id
 * Persists via CognationCommuneSwipe follows (cognation.commune.follows.v1).
 */
(function () {
  "use strict";

  function swipeApi() {
    return window.CognationCommuneSwipe || null;
  }

  function activeProfile() {
    try {
      if (window.CognationTowerProfileStore && window.CognationTowerProfileStore.get) {
        return window.CognationTowerProfileStore.get();
      }
    } catch (e) {}
    return null;
  }

  function resolveProfileId(btn) {
    var id = btn.getAttribute("data-profile-id");
    if (id) return id;
    var p = activeProfile();
    if (p && p._profileId) return String(p._profileId);
    return "";
  }

  function isProfessionalContext(btn) {
    var root = btn.closest("[data-tower-root], [data-tower-app], #panel-tower") || document;
    var kindBtn = root.querySelector('[data-tower-profile-kind="professional"][aria-selected="true"]');
    if (kindBtn) return true;
    /* When the public page selector is visible, it is the source of truth.
       The signed-in profile can remain professional while viewing Personal. */
    if (root.querySelector("[data-tower-profile-kind]")) return false;
    var p = activeProfile();
    if (p && (p._profileKind === "professional" || p.kind === "professional")) return true;
    /* Show follow on public professional pages even if personal selected? Prefer kind from profile */
    return !!(p && p._profileKind === "professional");
  }

  function syncButton(btn) {
    var api = swipeApi();
    var id = resolveProfileId(btn);
    if (id) btn.setAttribute("data-profile-id", id);
    var row = btn.closest("[data-tower-follow-row]");
    var pro = isProfessionalContext(btn);
    if (row) row.hidden = false;
    btn.hidden = false;
    if (!id || !api) {
      btn.setAttribute("aria-pressed", "false");
      btn.classList.remove("is-following");
      btn.textContent = pro ? "Follow" : "Add friend";
      return;
    }
    var following = api.isFollowing(id);
    btn.setAttribute("aria-pressed", following ? "true" : "false");
    btn.classList.toggle("is-following", following);
    btn.textContent = pro
      ? (following ? "Following" : "Follow")
      : (following ? "Friend added" : "Add friend");
    btn.setAttribute("aria-label", pro
      ? (following ? "Unfollow this professional profile" : "Follow this professional profile")
      : (following ? "Remove this friend" : "Add this person as a friend"));
  }

  function syncAll() {
    document.querySelectorAll("[data-tower-follow]").forEach(syncButton);
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest && ev.target.closest("[data-tower-follow]");
    if (!btn) return;
    ev.preventDefault();
    var api = swipeApi();
    if (!api) return;
    var id = resolveProfileId(btn);
    if (!id) {
      btn.setAttribute("aria-label", "Follow unavailable — no profile id");
      return;
    }
    btn.setAttribute("data-profile-id", id);
    api.toggleFollow(id);
    syncButton(btn);
    if (api.rebuild) {
      try {
        api.rebuild();
      } catch (e) {}
    }
  });

  document.addEventListener("cognation:commune-follows-changed", syncAll);
  document.addEventListener("cognation:session-started", syncAll);
  document.addEventListener("cognation:tower-profile-updated", syncAll);

  function boot() {
    syncAll();
    /* Re-sync when professional/personal tabs change */
    document.addEventListener("click", function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest("[data-tower-profile-kind]")) {
        window.setTimeout(syncAll, 30);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
