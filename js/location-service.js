/**
 * Live location for Cognation content.
 * Signup and sign-in ask for permission. A position is reverse-geocoded into a
 * state/region and saved here. Statewide news, local news, and PAGES read this
 * record. A denial resolves to null and never blocks auth. This release does
 * not read or store a signup State field.
 */
(function () {
  "use strict";

  var LIVE_STATE_KEY = "cognation.member.liveState.v1";
  var pending = null;

  function read() {
    try {
      var saved = JSON.parse(localStorage.getItem(LIVE_STATE_KEY) || "null");
      if (!saved || saved.source === "signup-state") return null;
      if (saved.source && saved.source !== "geolocation") return null;
      if (typeof saved.lat === "number" && typeof saved.lng === "number") return saved;
      if (saved.state || saved.region || saved.locality) return saved;
    } catch (e) {}
    return null;
  }

  function write(place) {
    try {
      localStorage.setItem(LIVE_STATE_KEY, JSON.stringify(place));
    } catch (e) {}
    try {
      document.dispatchEvent(new CustomEvent("cognation:live-location", { detail: place }));
    } catch (e2) {}
    return place;
  }

  function placeFromFix(lat, lng, data) {
    data = data || {};
    var state = String(data.principalSubdivision || "").trim();
    var locality = String(data.city || data.locality || "").trim();
    var country = String(data.countryName || "").trim();
    return {
      lat: lat,
      lng: lng,
      state: state.slice(0, 80),
      region: (state || locality).slice(0, 80),
      locality: locality.slice(0, 80),
      country: country.slice(0, 80),
      source: "geolocation",
      savedAt: Date.now(),
    };
  }

  function request() {
    if (pending) return pending;
    pending = new Promise(function (resolve) {
      function finish(place) {
        pending = null;
        resolve(place || null);
      }
      if (!navigator.geolocation) {
        finish(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          fetch(
            "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
              encodeURIComponent(lat) +
              "&longitude=" +
              encodeURIComponent(lng) +
              "&localityLanguage=en"
          )
            .then(function (res) {
              return res.json();
            })
            .then(function (data) {
              var place = placeFromFix(lat, lng, data);
              if (!place.region && !place.locality) {
                finish(write(place));
                return;
              }
              finish(write(place));
            })
            .catch(function () {
              finish(
                write({
                  lat: lat,
                  lng: lng,
                  state: "",
                  region: "",
                  locality: "",
                  country: "",
                  source: "geolocation",
                  savedAt: Date.now(),
                })
              );
            });
        },
        function () {
          finish(null);
        },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 7000 }
      );
    });
    return pending;
  }

  window.CognationLocation = {
    key: LIVE_STATE_KEY,
    get: read,
    request: request,
  };
})();
