/* ==========================================================
   OfficeTrack — GPS location verification
   High-precision browser Geolocation API + multi-sample satellite lock
   + Haversine geodesic distance.
   Exposes window.OTLocation. No DOM code here.
   Rules come from OT_CONFIG.GEOFENCE (see js/config.js) and
   can be calibrated by admin (saved in localStorage).
   ========================================================== */
(function () {
  const G = (window.OT_CONFIG && window.OT_CONFIG.GEOFENCE) || { ENABLED: false, OFFICES: {} };
  const OTL = (window.OTLocation = {});
  const EARTH_RADIUS_M = 6371008.8; // mean Earth radius in metres
  const OVERRIDE_KEY = "ot_geofence_override";

  /* Haversine great-circle distance in metres */
  OTL.haversine = function (lat1, lon1, lat2, lon2) {
    const rad = d => (d * Math.PI) / 180;
    const dLat = rad(lat2 - lat1),
      dLon = rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  /* Reads any admin overrides from localStorage */
  OTL.getOverrides = function () {
    try {
      return JSON.parse(localStorage.getItem(OVERRIDE_KEY)) || {};
    } catch (e) {
      return {};
    }
  };

  /* The GPS rule for a center id, or null when that center is not restricted */
  OTL.getRule = function (centerId) {
    if (!G.ENABLED) return null;
    const overrides = OTL.getOverrides();
    const custom = overrides[centerId];
    const base = (G.OFFICES && G.OFFICES[centerId]) || null;
    if (!base && !custom) return null;

    const merged = Object.assign(
      {
        label: `${centerId} office`,
        radiusMeters: 25,
        maxAccuracyMeters: 25
      },
      base || {},
      custom || {}
    );
    // Ensure numbers
    merged.radiusMeters = Number(merged.radiusMeters) || 25;
    merged.maxAccuracyMeters = Number(merged.maxAccuracyMeters) || 25;
    merged.latitude = Number(merged.latitude);
    merged.longitude = Number(merged.longitude);
    return merged;
  };

  /* Save admin calibrated coordinates & radius for a center */
  OTL.saveRule = function (centerId, data) {
    const overrides = OTL.getOverrides();
    overrides[centerId] = Object.assign({}, overrides[centerId] || {}, data);
    try {
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  /* Reset a center's rule to the original config.js defaults */
  OTL.resetRule = function (centerId) {
    const overrides = OTL.getOverrides();
    delete overrides[centerId];
    try {
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  /* Format distance with 1-decimal precision for small office ranges (<100m) */
  OTL.fmtDistance = function (m) {
    if (m == null || !isFinite(m)) return "—";
    if (m >= 1000) return (m / 1000).toFixed(2) + " km";
    if (m < 100) return m.toFixed(1) + " m";
    return Math.round(m) + " m";
  };

  /* Ask the browser for the current high-accuracy position.
     Uses watchPosition for multi-sample GPS stabilization so satellite signals
     warm up and lock to high precision (<= 15m), rather than returning a crude
     first-shot Wi-Fi triangulation reading.
     options: { onProgress: fn({elapsed, accuracy, bestAccuracy, sampleCount}) }
     Always resolves (never rejects):
     { ok:true, reading:{latitude, longitude, accuracy, capturedAt} } or
     { ok:false, code, message } */
  OTL.getPosition = function (options) {
    options = options || {};
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};

    return new Promise(resolve => {
      if (!window.isSecureContext)
        return resolve({
          ok: false,
          code: "INSECURE",
          message:
            "Location only works on a secure page. Open this app over HTTPS or from http://localhost, then tap Retry."
        });
      if (!navigator.geolocation)
        return resolve({
          ok: false,
          code: "UNSUPPORTED",
          message:
            "This browser does not support location. Please use an up-to-date browser on your phone or computer."
        });

      let done = false;
      let watchId = null;
      let timerId = null;
      let stabilizationTimer = null;
      let bestReading = null;
      let sampleCount = 0;
      const startTime = Date.now();
      const maxWaitMs = G.TIMEOUT_MS || 20000;

      const finish = r => {
        if (!done) {
          done = true;
          if (watchId !== null) {
            try {
              navigator.geolocation.clearWatch(watchId);
            } catch (e) {}
          }
          if (timerId !== null) clearTimeout(timerId);
          if (stabilizationTimer !== null) clearTimeout(stabilizationTimer);
          resolve(r);
        }
      };

      const handleSuccess = pos => {
        if (done) return;
        const coords = pos.coords;
        sampleCount++;
        const reading = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          altitude: coords.altitude,
          capturedAt: Date.now()
        };

        // Keep the best (lowest accuracy radius = highest precision) reading
        if (!bestReading || reading.accuracy <= bestReading.accuracy) {
          bestReading = reading;
        }

        const elapsed = Date.now() - startTime;
        onProgress({
          elapsed,
          accuracy: reading.accuracy,
          bestAccuracy: bestReading.accuracy,
          sampleCount,
          latitude: reading.latitude,
          longitude: reading.longitude
        });

        // If satellite lock has reached high accuracy (<= 12m) and has had time to stabilize
        if (reading.accuracy <= 12 && elapsed >= 1200) {
          return finish({ ok: true, reading: bestReading });
        }

        // If accuracy <= 18m and elapsed >= 2.5s, lock in the accurate reading
        if (reading.accuracy <= 18 && elapsed >= 2500) {
          return finish({ ok: true, reading: bestReading });
        }
      };

      const handleError = err => {
        if (done) return;
        // If we already have a reasonably accurate reading, finish with it
        if (bestReading && bestReading.accuracy <= 25) {
          return finish({ ok: true, reading: bestReading });
        }
        const code = err && err.code;
        if (code === 1)
          finish({
            ok: false,
            code: "DENIED",
            message:
              "Location permission is blocked. OfficeTrack needs your location to confirm you are at the office. Allow location access in browser settings, then tap Retry."
          });
        else if (code === 3)
          finish({
            ok: false,
            code: "TIMEOUT",
            message:
              "Acquiring high-accuracy GPS took too long. Check that GPS is on, move near a window or open area, and tap Retry."
          });
        else
          finish({
            ok: false,
            code: "UNAVAILABLE",
            message:
              "Your location could not be determined. Turn on GPS / Location Services, move near a window, then tap Retry."
          });
      };

      try {
        const geoOptions = {
          enableHighAccuracy: true,
          timeout: maxWaitMs,
          maximumAge: 0
        };

        // If watchPosition is supported, use it for satellite stabilization
        if (navigator.geolocation.watchPosition) {
          watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);

          // After 3.5s of multi-sampling, if we have an acceptable fix (accuracy <= 25m), resolve immediately
          stabilizationTimer = setTimeout(() => {
            if (!done && bestReading && bestReading.accuracy <= 25) {
              finish({ ok: true, reading: bestReading });
            }
          }, 3500);

          // Hard timeout
          timerId = setTimeout(() => {
            if (!done) {
              if (bestReading) {
                finish({ ok: true, reading: bestReading });
              } else {
                finish({
                  ok: false,
                  code: "TIMEOUT",
                  message:
                    "Acquiring high-accuracy GPS took too long. Check that GPS is on, move near a window or open area, and tap Retry."
                });
              }
            }
          }, maxWaitMs);
        } else {
          // Fallback to single getCurrentPosition if watchPosition is not available
          navigator.geolocation.getCurrentPosition(
            pos =>
              finish({
                ok: true,
                reading: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  capturedAt: Date.now()
                }
              }),
            handleError,
            geoOptions
          );
        }
      } catch (e) {
        finish({
          ok: false,
          code: "UNAVAILABLE",
          message: "Your location could not be determined. Turn on GPS / Location Services and tap Retry."
        });
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

    const radius = num(rule.radiusMeters) ? rule.radiusMeters : 25;
    const maxAcc = num(rule.maxAccuracyMeters) ? rule.maxAccuracyMeters : 25;
    const out = { ok: false, rule, radius, label: rule.label || `${centerId} office` };

    if (
      !reading ||
      !num(reading.latitude) ||
      !num(reading.longitude) ||
      !num(reading.accuracy) ||
      reading.accuracy < 0 ||
      Math.abs(reading.latitude) > 90 ||
      Math.abs(reading.longitude) > 180
    ) {
      return Object.assign(out, {
        status: "INVALID",
        message: "We couldn't read a valid location fix. Please tap Retry."
      });
    }

    const distance = OTL.haversine(reading.latitude, reading.longitude, rule.latitude, rule.longitude);
    Object.assign(out, { distance, accuracy: reading.accuracy });

    // GPS accuracy filter
    if (reading.accuracy > maxAcc) {
      return Object.assign(out, {
        status: "POOR_ACCURACY",
        message: `GPS signal is too weak (accuracy ±${Math.round(
          reading.accuracy
        )} m; ±${maxAcc} m or better is required). Move near a window or outdoors, wait 3–5 seconds for satellite lock, then tap Retry.`
      });
    }

    // Geofence perimeter check (25m limit, allowing 0.05m floating point tolerance)
    if (distance <= radius + 0.05) {
      return Object.assign(out, {
        ok: true,
        status: "VERIFIED",
        message: `Location verified: ${OTL.fmtDistance(distance)} from ${rule.label} (within ${radius} m limit). GPS accuracy: ±${Math.round(reading.accuracy)} m.`
      });
    }

    const overage = distance - radius;
    return Object.assign(out, {
      status: "OUTSIDE",
      message: `You are ${OTL.fmtDistance(distance)} from ${rule.label} (${OTL.fmtDistance(
        overage
      )} outside the ${radius} m limit). Attendance can only be marked within ${radius} m of the office. Move closer and tap Retry.`
    });
  };

  /* Used by the data layer right before saving: requires a fresh reading AND re-checks it. */
  OTL.verify = function (reading, centerId) {
    if (!OTL.getRule(centerId)) return { ok: true, status: "NOT_REQUIRED" };
    if (!reading)
      return {
        ok: false,
        status: "MISSING",
        message: "Location verification is required to mark attendance. Please allow location access and try again."
      };
    const age = Date.now() - reading.capturedAt;
    if (!num(reading.capturedAt) || age > (G.MAX_READING_AGE_MS || 60000) || age < -5000)
      return {
        ok: false,
        status: "STALE",
        message: "Your location check has expired. Please tap Retry to check your location again."
      };
    return OTL.evaluate(reading, centerId);
  };

  /* Create a test simulated location at an exact distance (in meters) from a center */
  OTL.simulate = function (centerId, targetDistanceMeters, accuracy = 5) {
    const rule = OTL.getRule(centerId);
    if (!rule) return null;
    // Exactly matches Earth great circle radius
    const deltaLat = targetDistanceMeters * (180 / (Math.PI * EARTH_RADIUS_M));
    return {
      latitude: rule.latitude + deltaLat,
      longitude: rule.longitude,
      accuracy: accuracy,
      capturedAt: Date.now(),
      simulated: true
    };
  };
})();
