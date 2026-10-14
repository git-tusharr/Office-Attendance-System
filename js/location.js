/* ==========================================================
   OfficeTrack — GPS location verification
   Browser Geolocation API + Haversine distance.
   Exposes window.OTLocation. No DOM code here.
   Rules come from OT_CONFIG.GEOFENCE (see js/config.js).
   NOTE: this is a frontend-only check. It reduces casual
   mistakes but cannot stop deliberate GPS spoofing.
   ========================================================== */
(function () {
  const G = (window.OT_CONFIG && window.OT_CONFIG.GEOFENCE) || { ENABLED: false, OFFICES: {} };
  const OTL = (window.OTLocation = {});
  const EARTH_RADIUS_M = 6371008.8; // mean Earth radius in metres

  /* Haversine great-circle distance in metres */
  OTL.haversine = function (lat1, lon1, lat2, lon2) {
    const rad = d => d * Math.PI / 180;
    const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  /* The GPS rule for a center id, or null when that center is not restricted */
  OTL.getRule = centerId => (G.ENABLED && G.OFFICES && G.OFFICES[centerId]) || null;

  OTL.fmtDistance = m => m >= 1000 ? (m / 1000).toFixed(1) + " km" : Math.round(m) + " m";

  /* Ask the browser for the current position. Always resolves (never rejects):
     { ok:true, reading:{latitude, longitude, accuracy, capturedAt} }  or
     { ok:false, code, message } */
  OTL.getPosition = function () {
    return new Promise(resolve => {
      if (!window.isSecureContext)
        return resolve({ ok: false, code: "INSECURE", message: "Location only works on a secure page. Open this app over HTTPS or from http://localhost, then tap Retry." });
      if (!navigator.geolocation)
        return resolve({ ok: false, code: "UNSUPPORTED", message: "This browser does not support location. Please use an up-to-date browser on your phone or computer." });
      let done = false;
      const finish = r => { if (!done) { done = true; resolve(r); } };
      try {
        navigator.geolocation.getCurrentPosition(
          pos => finish({ ok: true, reading: {
            latitude: pos.coords.latitude, longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy, capturedAt: Date.now() } }),
          err => {
            const code = err && err.code;
            if (code === 1) finish({ ok: false, code: "DENIED", message: "Location permission is blocked. OfficeTrack needs your location to confirm you are at the office. Allow location access for this site in your browser settings, then tap Retry." });
            else if (code === 3) finish({ ok: false, code: "TIMEOUT", message: "Getting your location took too long. Check that GPS / Location Services is on, move near a window or the open staircase area, then tap Retry." });
            else finish({ ok: false, code: "UNAVAILABLE", message: "Your location could not be determined. Turn on GPS / Location Services, move near a window or the open staircase area, then tap Retry." });
          },
          { enableHighAccuracy: true, timeout: G.TIMEOUT_MS || 20000, maximumAge: 0 }
        );
        /* safety net in case a browser never calls back */
        setTimeout(() => finish({ ok: false, code: "TIMEOUT", message: "Getting your location took too long. Check that GPS / Location Services is on, move near a window or the open staircase area, then tap Retry." }), (G.TIMEOUT_MS || 20000) + 5000);
      } catch (e) {
        finish({ ok: false, code: "UNAVAILABLE", message: "Your location could not be determined. Turn on GPS / Location Services and tap Retry." });
      }
    });
  };

  const num = v => typeof v === "number" && isFinite(v);

  /* Decide what a reading means for a center.
     status: NOT_REQUIRED | VERIFIED | OUTSIDE | POOR_ACCURACY | INVALID
     ok is true only for NOT_REQUIRED and VERIFIED. */
  OTL.evaluate = function (reading, centerId) {
    const rule = OTL.getRule(centerId);
    if (!rule) return { ok: true, status: "NOT_REQUIRED" };
    const out = { ok: false, rule, radius: rule.radiusMeters, label: rule.label };
    if (!reading || !num(reading.latitude) || !num(reading.longitude) || !num(reading.accuracy) || reading.accuracy < 0 ||
        Math.abs(reading.latitude) > 90 || Math.abs(reading.longitude) > 180)
      return Object.assign(out, { status: "INVALID", message: "We couldn't read a valid location. Please tap Retry." });
    const distance = OTL.haversine(reading.latitude, reading.longitude, rule.latitude, rule.longitude);
    const maxAcc = num(rule.maxAccuracyMeters) ? rule.maxAccuracyMeters : 25;
    Object.assign(out, { distance, accuracy: reading.accuracy });
    if (reading.accuracy > maxAcc) {
      return Object.assign(out, { status: "POOR_ACCURACY",
        message: `GPS signal is too weak to verify your location (accuracy about ±${Math.round(reading.accuracy)} m; ±${maxAcc} m or better is needed). Move near a window or the staircase landing, wait a few seconds, then tap Retry. Attendance can't be marked until your location is verified.` });
    }
    if (distance <= rule.radiusMeters)
      return Object.assign(out, { ok: true, status: "VERIFIED", message: `Location verified: about ${OTL.fmtDistance(distance)} from the ${rule.label}.` });
    return Object.assign(out, { status: "OUTSIDE",
      message: `You are about ${OTL.fmtDistance(distance)} from the ${rule.label}. Attendance can only be marked within ${rule.radiusMeters} m of the office (the staircase area below the office counts). Move closer and tap Retry.` });
  };

  /* Used by the data layer right before saving: requires a fresh reading AND re-checks it. */
  OTL.verify = function (reading, centerId) {
    if (!OTL.getRule(centerId)) return { ok: true, status: "NOT_REQUIRED" };
    if (!reading) return { ok: false, status: "MISSING", message: "Location verification is required to mark attendance. Please allow location access and try again." };
    const age = Date.now() - reading.capturedAt;
    if (!num(reading.capturedAt) || age > (G.MAX_READING_AGE_MS || 60000) || age < -5000)
      return { ok: false, status: "STALE", message: "Your location check has expired. Please tap Retry to check your location again." };
    return OTL.evaluate(reading, centerId);
  };
})();
