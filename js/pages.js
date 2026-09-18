/**
 * PAGES — Cognation Yellow Pages (local business directory).
 *
 * Listings are created from local businesses within 15 miles of the person using
 * PAGES. This demo seeds Chicago-area businesses with lat/lng and filters with
 * haversine once browser geolocation is granted (or a downtown fallback).
 *
 * Do NOT call paid Google Places / Maps APIs from the client. A free backend can
 * replace fetchPagesListings() later; renderPages() already consumes that Promise.
 */
(function () {
  "use strict";

  var CATEGORIES = [
    "All categories",
    "Auto repair",
    "Barber",
    "Café",
    "Daycare",
    "Dentist",
    "Doctor",
    "Electrician",
    "Florist",
    "Groomer",
    "Handyman",
    "House cleaner",
    "Landscaper",
    "Lawyer",
    "Pet store",
    "Plumber",
    "Restaurant",
  ];

  var DEMO_LISTINGS = [
    { name: "Ashland Avenue Barber Co.", category: "Barber", blurb: "Classic cuts, hot towel shaves, walk-ins welcome.", phone: "(773) 555-0142", neighborhood: "Lincoln Park", lat: 41.94170, lng: -87.64920 },
    { name: "Belmont Pet Emporium", category: "Pet store", blurb: "Food, toys, and weekend adoption events.", phone: "(773) 555-0198", neighborhood: "Lakeview", lat: 41.92170, lng: -87.67070 },
    { name: "Bridgeport Bloom Florist", category: "Florist", blurb: "Same-day bouquets and funeral arrangements.", phone: "(312) 555-0177", neighborhood: "Bridgeport", lat: 41.82600, lng: -87.66700 },
    { name: "Bronzeville Family Dentistry", category: "Dentist", blurb: "Cleanings, crowns, and gentle care for kids.", phone: "(773) 555-0114", neighborhood: "Bronzeville", towerHandle: "bronzeville-dds", towerClaimed: true, lat: 41.83970, lng: -87.64510 },
    { name: "Clark Street Café", category: "Café", blurb: "Pour-overs, pastries, neighborhood Wi-Fi.", phone: "(312) 555-0160", neighborhood: "Andersonville", lat: 41.95960, lng: -87.67540 },
    { name: "Devon Spark Electric", category: "Electrician", blurb: "Panel upgrades, outlets, ceiling fans, licensed.", phone: "(773) 555-0133", neighborhood: "West Ridge", lat: 42.01720, lng: -87.70540 },
    { name: "Edgewater Handyman Pros", category: "Handyman", blurb: "Mounts, drywall, odd jobs — evenings OK.", phone: "(773) 555-0181", neighborhood: "Edgewater", lat: 41.96520, lng: -87.64860 },
    { name: "Garfield Park Landscaping", category: "Landscaper", blurb: "Mow, mulch, seasonal cleanups, small yards.", phone: "(773) 555-0125", neighborhood: "Garfield Park", lat: 41.89180, lng: -87.68070 },
    { name: "Halsted House Cleaners", category: "House cleaner", blurb: "Weekly/biweekly deep cleans, eco supplies.", phone: "(312) 555-0190", neighborhood: "Lincoln Square", lat: 41.99110, lng: -87.67210 },
    { name: "Hyde Park Family Medicine — Dr. Maya Chen", category: "Doctor", blurb: "WELL demo PCP · primary care, annual wellness, same-week sick slots.", phone: "(773) 555-0155", neighborhood: "Hyde Park", towerHandle: "maya-chen", towerClaimed: true, lat: 41.79080, lng: -87.61520 },
    { name: "Hyde Park Pediatric Care", category: "Doctor", blurb: "Well-child visits and same-week sick slots.", phone: "(773) 555-0156", neighborhood: "Hyde Park", lat: 41.77750, lng: -87.56830 },
    { name: "Irving Park Auto Works", category: "Auto repair", blurb: "Brakes, oil, diagnostics — honest estimates.", phone: "(773) 555-0108", neighborhood: "Irving Park", lat: 41.98230, lng: -87.73510 },
    { name: "Jefferson Park Plumbing", category: "Plumber", blurb: "Clogs, water heaters, emergency call-outs.", phone: "(773) 555-0149", neighborhood: "Jefferson Park", lat: 42.00570, lng: -87.73320 },
    { name: "Kedzie Kids Daycare", category: "Daycare", blurb: "Ages 2–5, outdoor yard, CPR-certified staff.", phone: "(773) 555-0172", neighborhood: "Logan Square", lat: 41.90490, lng: -87.69670 },
    { name: "Lakeview Legal Group", category: "Lawyer", blurb: "Wills, landlord-tenant, small claims help.", phone: "(312) 555-0119", neighborhood: "Lakeview", lat: 41.91890, lng: -87.69030 },
    { name: "Milwaukee Ave Grill", category: "Restaurant", blurb: "Burgers, shakes, late kitchen on weekends.", phone: "(773) 555-0166", neighborhood: "Wicker Park", lat: 41.91580, lng: -87.70060 },
    { name: "Northside Nail & Paw Groomer", category: "Groomer", blurb: "Dogs & cats, gentle baths, nail trims.", phone: "(773) 555-0138", neighborhood: "Ravenswood", lat: 41.93650, lng: -87.66890 },
    { name: "Oak Street Orthodontics", category: "Dentist", blurb: "Braces and clear aligners for teens & adults.", phone: "(312) 555-0184", neighborhood: "Near North", lat: 41.92330, lng: -87.61260 },
    { name: "Pilsen Pasta House", category: "Restaurant", blurb: "Handmade pasta, red-sauce classics, patio.", phone: "(312) 555-0121", neighborhood: "Pilsen", lat: 41.88840, lng: -87.64090 },
    { name: "Queen of Sheba Café", category: "Café", blurb: "Ethiopian coffee ceremony & light bites.", phone: "(773) 555-0152", neighborhood: "Uptown", lat: 41.95810, lng: -87.64210 },
    { name: "Roscoe Village Veterinary Grooming", category: "Groomer", blurb: "Full-service groom next door to the clinic.", phone: "(773) 555-0194", neighborhood: "Roscoe Village", lat: 41.92380, lng: -87.67680 },
    { name: "South Loop Sparkle Clean", category: "House cleaner", blurb: "Condo specialists, move-in/out packages.", phone: "(312) 555-0103", neighborhood: "South Loop", lat: 41.84560, lng: -87.59340 },
    { name: "Taylor Street Barber Shop", category: "Barber", blurb: "Fades, beard lineups, old-school chairs.", phone: "(312) 555-0175", neighborhood: "Little Italy", lat: 41.86440, lng: -87.62860 },
    { name: "Ukrainian Village Electric Co.", category: "Electrician", blurb: "Rewires, EV chargers, code corrections.", phone: "(773) 555-0144", neighborhood: "Ukrainian Village", lat: 41.87540, lng: -87.69170 },
    { name: "Violet & Vine Florist", category: "Florist", blurb: "Wedding work and weekly office arrangements.", phone: "(312) 555-0188", neighborhood: "West Loop", lat: 41.90560, lng: -87.62240 },
    { name: "Western Avenue Auto Clinic", category: "Auto repair", blurb: "Tires, alignments, state inspections.", phone: "(773) 555-0111", neighborhood: "Lincoln Square", lat: 41.96100, lng: -87.67280 },
    { name: "Albany Park Family Law", category: "Lawyer", blurb: "Divorce mediation and custody paperwork.", phone: "(773) 555-0169", neighborhood: "Albany Park", lat: 41.95750, lng: -87.72690 },
    { name: "Back of the Yards Plumbing", category: "Plumber", blurb: "Sewer cameras, sump pumps, re-pipes.", phone: "(773) 555-0128", neighborhood: "Back of the Yards", lat: 41.77610, lng: -87.66450 },
    { name: "Cicero Court Café", category: "Café", blurb: "Breakfast burritos and strong drip coffee.", phone: "(773) 555-0158", neighborhood: "Archer Heights", lat: 41.79810, lng: -87.73930 },
    { name: "Dunning Daycare Nest", category: "Daycare", blurb: "Infant through pre-K, bilingual staff.", phone: "(773) 555-0191", neighborhood: "Dunning", lat: 41.97590, lng: -87.83470 },
    { name: "Elsie's Evergreen Landscaping", category: "Landscaper", blurb: "Native plantings and patio beds.", phone: "(773) 555-0136", neighborhood: "Evergreen Park", lat: 41.70180, lng: -87.68840 },
    { name: "Foster Pet Supply", category: "Pet store", blurb: "Bulk food, aquariums, local rescue board.", phone: "(773) 555-0106", neighborhood: "North Center", lat: 41.93040, lng: -87.68120 },
    { name: "Grand Crossing Handyman", category: "Handyman", blurb: "Fences, painting, appliance hookups.", phone: "(773) 555-0179", neighborhood: "Greater Grand Crossing", lat: 41.79760, lng: -87.58980 },
    { name: "Heartland Internal Medicine", category: "Doctor", blurb: "Primary care, labs on-site, telehealth.", phone: "(312) 555-0147", neighborhood: "Streeterville", towerHandle: "heartland-md", towerClaimed: true, lat: 41.91960, lng: -87.64380 },
    { name: "Montrose Electric & Lighting", category: "Electrician", blurb: "Track lighting and kitchen remodels.", phone: "(773) 555-0123", neighborhood: "Ravenswood", lat: 41.99460, lng: -87.68220 },
    { name: "Norridge Neighborhood Cleaners", category: "House cleaner", blurb: "Housekeeping for busy families.", phone: "(708) 555-0182", neighborhood: "Norridge", lat: 41.94270, lng: -87.82910 },
    { name: "Old Town Italian Kitchen", category: "Restaurant", blurb: "Thin crust, family tables, cash welcome.", phone: "(312) 555-0150", neighborhood: "Old Town", lat: 41.92220, lng: -87.62960 },
    { name: "Portage Park Barbers", category: "Barber", blurb: "Kids' first cuts and senior discounts.", phone: "(773) 555-0163", neighborhood: "Portage Park", lat: 41.97030, lng: -87.74190 },
    { name: "Rogers Park Pipe Pros", category: "Plumber", blurb: "Frozen pipes, fixture swaps, fair rates.", phone: "(773) 555-0117", neighborhood: "Rogers Park", lat: 41.98550, lng: -87.70150 },
    { name: "South Shore Pet Spa", category: "Groomer", blurb: "Mobile van grooming by appointment.", phone: "(773) 555-0186", neighborhood: "South Shore", lat: 41.78030, lng: -87.57290 },
    { name: "Wicker Park Wellness MD", category: "Doctor", blurb: "Walk-in clinic for colds and physicals.", phone: "(773) 555-0140", neighborhood: "Wicker Park", lat: 41.90600, lng: -87.69920 }
  ];

  var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  var MILES_RADIUS = 15;
  var DEFAULT_ORIGIN = { lat: 41.8781, lng: -87.6298, label: "downtown Chicago (demo fallback)" };
  var pagesOrigin = null;
  var pagesGeoPromise = null;

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  /** Haversine distance in miles. */
  function milesBetween(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return Infinity;
    var R = 3958.7613;
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function setPagesGeoStatus(root, message, kind) {
    var el = root.querySelector("[data-pages-geo-status]");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.classList.remove("is-geo-ok", "is-geo-fallback", "is-geo-pending");
    if (kind) el.classList.add(kind);
  }

  function ensurePagesOrigin(root) {
    if (pagesOrigin) return Promise.resolve(pagesOrigin);
    if (pagesGeoPromise) return pagesGeoPromise;

    setPagesGeoStatus(
      root,
      "Requesting your location to show businesses within 15 miles…",
      "is-geo-pending"
    );

    pagesGeoPromise = new Promise(function (resolve) {
      function finish(origin) {
        pagesOrigin = origin;
        if (origin.source === "geo") {
          setPagesGeoStatus(
            root,
            "Showing local businesses within 15 miles of your location.",
            "is-geo-ok"
          );
        } else {
          setPagesGeoStatus(
            root,
            "Location unavailable or denied — showing demo businesses within 15 miles of " +
              origin.label +
              ". Enable location for your area.",
            "is-geo-fallback"
          );
        }
        resolve(origin);
      }

      if (!navigator.geolocation) {
        finish({
          lat: DEFAULT_ORIGIN.lat,
          lng: DEFAULT_ORIGIN.lng,
          label: DEFAULT_ORIGIN.label,
          source: "fallback",
        });
        return;
      }

      var settled = false;
      var timer = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        finish({
          lat: DEFAULT_ORIGIN.lat,
          lng: DEFAULT_ORIGIN.lng,
          label: DEFAULT_ORIGIN.label,
          source: "fallback",
        });
      }, 8000);

      try {
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            finish({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              label: "your location",
              source: "geo",
            });
          },
          function () {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            finish({
              lat: DEFAULT_ORIGIN.lat,
              lng: DEFAULT_ORIGIN.lng,
              label: DEFAULT_ORIGIN.label,
              source: "fallback",
            });
          },
          { enableHighAccuracy: false, maximumAge: 300000, timeout: 7000 }
        );
      } catch (err) {
        window.clearTimeout(timer);
        finish({
          lat: DEFAULT_ORIGIN.lat,
          lng: DEFAULT_ORIGIN.lng,
          label: DEFAULT_ORIGIN.label,
          source: "fallback",
        });
      }
    });

    return pagesGeoPromise;
  }

  /**
   * Demo path — filter local seed by category/query/distance.
   * Replace body with fetch('/api/pages?...') when a free backend exists.
   */
  function fetchPagesListings(category, query, origin) {
    return Promise.resolve(
      filterDemoListings(category, query, origin || pagesOrigin || DEFAULT_ORIGIN)
    );
  }

  function filterDemoListings(category, query, origin) {
    var cat = (category || "All categories").trim();
    var q = (query || "").trim().toLowerCase();
    var originPoint = origin || pagesOrigin || DEFAULT_ORIGIN;
    return DEMO_LISTINGS.filter(function (item) {
      if (cat && cat !== "All categories" && item.category !== cat) return false;
      var dist = milesBetween(originPoint, { lat: item.lat, lng: item.lng });
      if (!(dist <= MILES_RADIUS)) return false;
      item._distanceMiles = Math.round(dist * 10) / 10;
      if (!q) return true;
      var hay = (
        item.name +
        " " +
        item.category +
        " " +
        item.blurb +
        " " +
        item.neighborhood +
        " " +
        (item.phone || "") +
        " " +
        (item.towerHandle || "")
      ).toLowerCase();
      return hay.indexOf(q) !== -1;
    })
      .slice()
      .sort(function (a, b) {
        var da = typeof a._distanceMiles === "number" ? a._distanceMiles : 999;
        var db = typeof b._distanceMiles === "number" ? b._distanceMiles : 999;
        if (da !== db) return da - db;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }

  function letterOf(name) {
    var ch = (name || "").charAt(0).toUpperCase();
    return /[A-Z]/.test(ch) ? ch : "#";
  }

  function groupByLetter(listings) {
    var map = {};
    listings.forEach(function (item) {
      var L = letterOf(item.name);
      if (!map[L]) map[L] = [];
      map[L].push(item);
    });
    return map;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildCategoryOptions(select) {
    select.innerHTML = "";
    CATEGORIES.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
  }

  function buildAzBar(nav, presentLetters) {
    nav.innerHTML = "";
    LETTERS.forEach(function (L) {
      var a = document.createElement("a");
      a.href = "#pages-letter-" + L;
      a.className = "pages-az-link";
      a.textContent = L;
      a.setAttribute("data-pages-letter", L);
      if (!presentLetters[L]) {
        a.classList.add("is-disabled");
        a.setAttribute("aria-disabled", "true");
        a.tabIndex = -1;
      }
      a.addEventListener("click", function (e) {
        if (a.classList.contains("is-disabled")) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        var target = document.getElementById("pages-letter-" + L);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      nav.appendChild(a);
    });
  }

  /**
   * Claimed = explicit Cognation handle on the listing (provider claimed it).
   * Do not invent handles from category or business name.
   */
  function listingTowerHandle(item) {
    if (!item) return "";
    var h = (item.towerHandle || "").trim().toLowerCase();
    return h;
  }

  function isClaimedListing(item) {
    if (!item) return false;
    var handle = listingTowerHandle(item);
    if (!handle) return false;
    if (item.towerClaimed === false) return false;
    return true;
  }

  function switchMainTab(tabId) {
    var tab = document.getElementById(tabId);
    if (tab) tab.click();
  }

  function goToTowerProfile(handle) {
    if (!handle) return;
    var hash = "tower-profile-" + handle;
    switchMainTab("tab-tower");
    if (typeof window.CognationTowerApplySide === "function") {
      window.CognationTowerApplySide("public");
    }
    if (location.hash === "#" + hash) {
      window.setTimeout(function () {
        var el = document.getElementById(hash);
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } else {
      location.hash = hash;
    }
  }

  function showPagesCallHint(message) {
    var existing = document.querySelector("[data-pages-call-hint]");
    if (existing) existing.remove();
    var hint = document.createElement("p");
    hint.className = "pages-call-hint";
    hint.setAttribute("data-pages-call-hint", "");
    hint.setAttribute("role", "status");
    hint.textContent = message;
    var shell = document.querySelector("[data-pages-shell]");
    if (shell) {
      var intro = shell.querySelector(".pages-intro") || shell;
      intro.appendChild(hint);
    } else {
      document.body.appendChild(hint);
    }
    window.setTimeout(function () {
      if (hint.parentNode) hint.parentNode.removeChild(hint);
    }, 4500);
  }

  function startProviderIpCall(item) {
    /* WELL is hidden from public chrome; do not open a public entry point. */
    showPagesCallHint("WELL is not available on the public site.");
  }

  function appendListingActions(li, item) {
    /* Tower + Call only when the listing was claimed with a Cognation handle */
    if (!isClaimedListing(item)) return;
    var handle = listingTowerHandle(item);

    var actions = document.createElement("div");
    actions.className = "pages-listing-actions";

    var towerLink = document.createElement("a");
    towerLink.className = "pages-tower-link";
    towerLink.href = "#tower-profile-" + handle;
    towerLink.textContent = "Tower · @" + handle;
    towerLink.setAttribute("data-pages-tower", handle);
    towerLink.addEventListener("click", function (e) {
      e.preventDefault();
      goToTowerProfile(handle);
    });
    actions.appendChild(towerLink);

    var callBtn = document.createElement("button");
    callBtn.type = "button";
    callBtn.className = "pages-call-btn";
    callBtn.textContent = "Call via IP";
    callBtn.setAttribute("data-pages-call-ip", handle);
    callBtn.setAttribute("aria-label", "Call " + (item.name || "provider") + " via IP");
    callBtn.addEventListener("click", function () {
      startProviderIpCall(item);
    });
    actions.appendChild(callBtn);

    li.appendChild(actions);
  }


  function renderListings(container, emptyEl, listings) {
    container.innerHTML = "";
    if (!listings.length) {
      emptyEl.hidden = false;
      container.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    container.hidden = false;

    var groups = groupByLetter(listings);
    var present = {};
    LETTERS.forEach(function (L) {
      if (groups[L] && groups[L].length) present[L] = true;
    });
    if (groups["#"] && groups["#"].length) present["#"] = true;

    var shell = container.closest("[data-pages-shell]");
    if (shell) {
      var nav = shell.querySelector("[data-pages-az]");
      if (nav) buildAzBar(nav, present);
    }

    var order = LETTERS.slice();
    if (groups["#"]) order.push("#");

    order.forEach(function (L) {
      var items = groups[L];
      if (!items || !items.length) return;

      var section = document.createElement("section");
      section.className = "pages-letter-section";
      section.id = "pages-letter-" + L;
      section.setAttribute("aria-labelledby", "pages-letter-heading-" + L);

      var h = document.createElement("h4");
      h.className = "pages-letter-heading";
      h.id = "pages-letter-heading-" + L;
      h.textContent = L;
      section.appendChild(h);

      var ul = document.createElement("ul");
      ul.className = "pages-listing-list";
      ul.setAttribute("aria-label", "Businesses starting with " + L);

      items.forEach(function (item) {
        var li = document.createElement("li");
        li.className = "pages-listing";
        if (isClaimedListing(item)) li.classList.add("pages-listing--claimed");
        var miles =
          typeof item._distanceMiles === "number" ? " · " + item._distanceMiles + " mi" : "";
        li.innerHTML =
          '<div class="pages-listing-row">' +
          '<span class="pages-chip">' +
          escapeHtml(item.category) +
          "</span>" +
          '<strong class="pages-listing-name">' +
          escapeHtml(item.name) +
          "</strong>" +
          "</div>" +
          '<p class="pages-listing-blurb">' +
          escapeHtml(item.blurb) +
          "</p>" +
          '<p class="pages-listing-meta">' +
          '<a class="pages-phone" href="tel:' +
          escapeHtml(String(item.phone).replace(/[^\d+]/g, "")) +
          '">' +
          escapeHtml(item.phone) +
          "</a>" +
          '<span class="pages-neighborhood">' +
          escapeHtml(item.neighborhood) +
          miles +
          "</span>" +
          "</p>";
        appendListingActions(li, item);
        ul.appendChild(li);
      });

      section.appendChild(ul);
      container.appendChild(section);
    });
  }

  function renderPages(root) {
    var search = root.querySelector("[data-pages-search]");
    var category = root.querySelector("[data-pages-category]");
    var results = root.querySelector("[data-pages-results]");
    var empty = root.querySelector("[data-pages-empty]");
    var countEl = root.querySelector("[data-pages-count]");
    var az = root.querySelector("[data-pages-az]");

    if (!search || !category || !results || !empty) return;
    if (root.__cognationPagesBound) return;
    root.__cognationPagesBound = true;

    buildCategoryOptions(category);
    if (az) buildAzBar(az, {});

    function refresh() {
      ensurePagesOrigin(root).then(function (origin) {
        fetchPagesListings(category.value, search.value, origin).then(function (listings) {
          if (countEl) {
            countEl.textContent =
              listings.length === 1
                ? "1 listing within 15 mi"
                : listings.length + " listings within 15 mi";
          }
          renderListings(results, empty, listings);
        });
      });
    }

    search.addEventListener("input", refresh);
    category.addEventListener("change", refresh);

    var pagesTab = document.getElementById("tab-pages");
    if (pagesTab) {
      pagesTab.addEventListener("click", function () {
        window.setTimeout(refresh, 0);
      });
    }

    refresh();
  }

  function boot() {
    document.querySelectorAll("[data-pages-shell]").forEach(renderPages);
  }

  window.fetchPagesListings = fetchPagesListings;
  window.CognationPagesDemo = DEMO_LISTINGS;
  window.CognationPagesMilesRadius = MILES_RADIUS;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
