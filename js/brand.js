/**
 * Rename brand here (single source of truth).
 * Change SITE_BRAND (and optional SITE_TAGLINE), then reload.
 * HTML uses [data-brand], [data-brand-mark], and title/meta data attributes.
 */
(function () {
  "use strict";

  var SITE_BRAND = "COGNATION";
  var SITE_TAGLINE = "A social wellness concierge";

  window.SITE_BRAND = SITE_BRAND;
  window.SITE_TAGLINE = SITE_TAGLINE;

  function applyBrand() {
    var mark = SITE_BRAND.charAt(0);

    document.querySelectorAll("[data-brand]").forEach(function (el) {
      el.textContent = SITE_BRAND;
    });

    document.querySelectorAll("[data-brand-mark]").forEach(function (el) {
      el.textContent = mark;
    });

    document.querySelectorAll("[data-brand-tagline]").forEach(function (el) {
      el.textContent = SITE_TAGLINE;
    });

    var titleEl = document.querySelector("title[data-brand-page]");
    if (titleEl) {
      var page = titleEl.getAttribute("data-brand-page") || "";
      document.title = page ? SITE_BRAND + " — " + page : SITE_BRAND;
    }

    var meta = document.querySelector('meta[name="description"][data-brand-meta]');
    if (meta) {
      var template = meta.getAttribute("data-brand-meta") || "";
      meta.setAttribute(
        "content",
        template.split("{brand}").join(SITE_BRAND).split("{tagline}").join(SITE_TAGLINE)
      );
    }

    var yearEl = document.getElementById("year");
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyBrand);
  } else {
    applyBrand();
  }
})();
