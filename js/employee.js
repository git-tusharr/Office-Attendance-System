/* ==========================================================
   OfficeTrack — employee dashboard
   ========================================================== */
OT.init();
const me0 = OT.requireRole(["EMPLOYEE"], "login.html");
const $ = id => document.getElementById(id);
const CFG = window.OT_CONFIG, OFFICE = CFG.OFFICE;
let checking = false; // true while a location check is in progress

function updateTelemetry(ev) {
  const box = $("geoTelemetry");
  if (!box) return;
  if (!ev || ev.distance == null) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const radius = ev.radius || 25;
  $("geoDistanceVal").textContent = OTLocation.fmtDistance(ev.distance);
  $("geoLimitVal").textContent = `${radius}.0 m`;
  $("geoAccuracyVal").textContent = `±${ev.accuracy != null ? Number(ev.accuracy).toFixed(1) : "—"} m`;

  // Scale 0 to (radius * 2) meters
  const pct = Math.min(100, Math.max(0, Math.round((ev.distance / (radius * 2)) * 100)));
  const fill = $("geoMeterFill");
  fill.style.width = pct + "%";
  fill.className = "geo-meter-fill " + (ev.ok ? "in-range" : ev.distance <= radius * 1.5 ? "warning" : "out-range");

  const badge = $("geoStatusBadge");
  if (ev.ok) {
    badge.textContent = `✓ In Range (≤ ${radius} m)`;
    badge.className = "status present";
  } else if (ev.status === "POOR_ACCURACY") {
    badge.textContent = "⚠️ Weak GPS";
    badge.className = "status half";
  } else if (ev.status === "OUTSIDE") {
    badge.textContent = `✕ Outside ${radius}m Boundary`;
    badge.className = "status rejected";
  } else {
    badge.textContent = ev.status || "Checking";
    badge.className = "status pending";
  }
}

function render() {
  const me = OT.currentUser();
  if (!me || me.role !== "EMPLOYEE") return location.replace("login.html");
  const t = OT.date.today(), mk = t.slice(0, 7);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  $("welcomeName").textContent = `${greet}, ${me.name.split(" ")[0]} 👋`;
  $("todayDate").textContent = UI.fmtLongDate(new Date());
  $("monthLabel").textContent = UI.fmtMonth(mk);
  $("centerPill").textContent = "📍 " + OT.centerLabel(me.centerId);
  $("sideName").textContent = me.name;
  $("sideMeta").textContent = `${me.id} · ${OT.centerName(me.centerId)}`;
  $("officeRuleText").textContent = `Office start ${UI.fmt12(OFFICE.START)} · Present up to ${UI.fmt12(OFFICE.PRESENT_CUTOFF)}`;
  const geoRule = OTLocation.getRule(me.centerId);
  const limitMeters = geoRule ? (geoRule.radiusMeters || 25) : 25;
  $("policyList").innerHTML = `
    <li>One attendance record per employee per day.</li>
    <li>Office start time is <b>${UI.fmt12(OFFICE.START)}</b>.</li>
    <li>Check-in up to and including <b>${UI.fmt12(OFFICE.PRESENT_CUTOFF)}</b> is Present.</li>
    <li>Check-in after ${UI.fmt12(OFFICE.PRESENT_CUTOFF)} is Half Day.</li>
    <li>Employee cannot edit or delete attendance.</li>${geoRule ? `
    <li>Check-in needs high-accuracy location access: you must be within <b>${limitMeters} m</b> of the ${UI.esc(geoRule.label)} (the 25-meter perimeter includes the staircase and entrance).</li>` : ""}
    <li>Your <b>${UI.esc(OT.centerName(me.centerId))}</b> center admin approves or rejects each record.</li>`;
  $("myDetails").innerHTML = [["Employee ID", me.id], ["Center", OT.centerLabel(me.centerId)], ["Department", me.department], ["Designation", me.designation], ["Email", me.email]]
    .map(([k, v]) => `<dt>${k}</dt><dd>${UI.esc(v)}</dd>`).join("");

  const mine = OT.attendanceOf(me.id);
  const td = mine.find(a => a.date === t);
  const btn = $("markBtn"), st = $("todayStatus"), info = $("checkInInfo");
  if (td) {
    st.textContent = td.attendanceStatus; st.className = "status " + UI.cls(td.attendanceStatus);
    info.innerHTML = `Check-in: <b>${UI.fmtTime(td.checkIn, true)}</b> · Approval: ${UI.badge(td.approvalStatus)}`
      + (td.location ? `<br>Location verified: ${td.location.distanceMeters} m from office (within 25m boundary; GPS ±${td.location.accuracyMeters} m)` : "");
    $("retryLocBtn").hidden = true;
    if ($("resetTodayBtn")) $("resetTodayBtn").hidden = false;
    btn.disabled = true; btn.textContent = "✓ Attendance Already Marked"; btn.style.opacity = ".55";
  } else {
    st.textContent = "Not Marked"; st.className = "status pending";
    info.textContent = "No attendance marked today.";
    if ($("resetTodayBtn")) $("resetTodayBtn").hidden = true;
    btn.disabled = checking; btn.textContent = checking ? "Acquiring satellites…" : "Mark Attendance"; btn.style.opacity = checking ? ".55" : "1";
  }

  // This month's summary
  const monthRecs = mine.filter(a => a.date.startsWith(mk));
  const s = OT.monthSummary(me, mk, monthRecs);
  $("workingDays").textContent = s.workingDays;
  $("presentCount").textContent = s.present;
  $("halfCount").textContent = s.half;
  $("absentCount").textContent = s.absent;
  $("approvedCount").textContent = monthRecs.filter(a => a.approvalStatus === "APPROVED").length;
  $("pendingCount").textContent = monthRecs.filter(a => a.approvalStatus === "PENDING").length;
  $("rejectedCount").textContent = s.rejected;
  $("percentCount").textContent = s.percent + "%";

  // History with filters
  const monthSel = $("histMonth"), keep = monthSel.value || "ALL";
  const months = [...new Set(mine.map(a => a.date.slice(0, 7)).concat(mk))].sort().reverse();
  UI.fillSelect(monthSel, [{ value: "ALL", label: "All months" }].concat(months.map(m => ({ value: m, label: UI.fmtMonth(m) }))), keep);
  const mf = monthSel.value, af = $("histApproval").value;
  const rows = mine.filter(a => (mf === "ALL" || a.date.startsWith(mf)) && (af === "ALL" || a.approvalStatus === af))
    .sort((a, b) => b.date.localeCompare(a.date));
  $("historyBody").innerHTML = rows.map(a => `<tr><td>${UI.fmtDate(a.date)}</td><td>${UI.fmtTime(a.checkIn, true)}</td><td>${UI.badge(a.attendanceStatus)}</td><td>${UI.badge(a.approvalStatus)}</td><td>${a.approvedBy ? UI.esc(a.approvedBy) : "—"}</td></tr>`).join("")
    || `<tr><td colspan="5" class="empty">No attendance records match.</td></tr>`;
}

function showLocInfo(r) {
  const box = $("locInfo");
  if (!r || r.distance == null) { box.hidden = true; return; }
  box.hidden = false;
  box.textContent = `Distance to ${r.label}: ${OTLocation.fmtDistance(r.distance)} · GPS precision: ±${Number(r.accuracy).toFixed(1)} m · Limit: within ${r.radius} m`;
}

function finishCheckIn(me, at, geo) {
  const m = $("markMessage");
  const res = OT.markAttendance(me.id, at, geo);
  if (!res.ok) {
    UI.msg(m, res.error, "error");
    if (res.location) $("retryLocBtn").hidden = false;
    render(); return;
  }
  $("retryLocBtn").hidden = true;
  UI.msg(m, `Attendance marked at ${UI.fmtTime(res.record.checkIn, true)} as ${res.record.attendanceStatus}. Location verified (${res.record.location ? res.record.location.distanceMeters + ' m from office' : 'Not required'}).`, "success");
  render();
}

/* Helper to acquire location: uses simulation if selected, otherwise real multi-sample satellite lock */
async function acquireLocation(centerId, onProgress) {
  const sim = $("demoLocation") ? $("demoLocation").value : "REAL";
  if (sim === "INSIDE") {
    const reading = OTLocation.simulate(centerId, 12.5, 4.0);
    return { ok: true, reading };
  } else if (sim === "EDGE") {
    const reading = OTLocation.simulate(centerId, 24.5, 4.5);
    return { ok: true, reading };
  } else if (sim === "OUTSIDE") {
    const reading = OTLocation.simulate(centerId, 42.0, 5.0);
    return { ok: true, reading };
  }
  // Real high-accuracy GPS with multi-sample satellite lock
  return await OTLocation.getPosition({ onProgress });
}

async function testLocationOnly() {
  if (checking) return;
  const me = OT.currentUser();
  if (!me) return location.replace("login.html");
  const rule = OTLocation.getRule(me.centerId);
  const m = $("markMessage");
  if (!rule) {
    UI.msg(m, `Center ${OT.centerName(me.centerId)} does not have GPS restriction enabled.`, "info");
    return;
  }

  checking = true;
  $("retryLocBtn").hidden = true;
  $("locInfo").hidden = true;
  render();
  UI.msg(m, "Locking onto GPS satellites for highest accuracy… please keep device still.", "info");

  let pos;
  try {
    pos = await acquireLocation(me.centerId, p => {
      UI.msg(m, `Locking satellites… precision ±${Number(p.bestAccuracy).toFixed(1)} m (sample #${p.sampleCount})`, "info");
    });
  } finally {
    checking = false;
    render();
  }

  if (!pos.ok) {
    UI.msg(m, pos.message, pos.code === "TIMEOUT" || pos.code === "UNAVAILABLE" ? "warning" : "error");
    $("retryLocBtn").hidden = false;
    return;
  }

  const ev = OTLocation.evaluate(pos.reading, me.centerId);
  showLocInfo(ev);
  updateTelemetry(ev);
  if (ev.ok) {
    UI.msg(m, `✓ High-precision GPS lock confirmed: ${OTLocation.fmtDistance(ev.distance)} from office (within ${ev.radius}m limit; accuracy ±${Number(ev.accuracy).toFixed(1)}m).`, "success");
  } else {
    UI.msg(m, ev.message, ev.status === "OUTSIDE" ? "error" : "warning");
    $("retryLocBtn").hidden = false;
  }
}

async function attemptCheckIn() {
  if (checking) return;
  const me = OT.currentUser(); if (!me) return location.replace("login.html");
  let at = null;
  const dt = $("demoTime").value;
  if (dt) { const [h, m] = dt.split(":").map(Number); at = new Date(); at.setHours(h, m, 0, 0); }
  const m = $("markMessage");

  // Centers without a GPS rule keep the original behaviour
  if (!OTLocation.getRule(me.centerId)) return finishCheckIn(me, at, null);

  checking = true; $("retryLocBtn").hidden = true; $("locInfo").hidden = true; render();
  UI.msg(m, "Locking onto GPS satellites for high accuracy… if your browser asks, choose Allow.", "info");
  
  let pos;
  try {
    pos = await acquireLocation(me.centerId, p => {
      UI.msg(m, `Acquiring satellite lock… precision ±${Number(p.bestAccuracy).toFixed(1)} m (refining fix)`, "info");
    });
  }
  finally { checking = false; }
  
  if (!pos.ok) {
    UI.msg(m, pos.message, pos.code === "TIMEOUT" || pos.code === "UNAVAILABLE" ? "warning" : "error");
    $("retryLocBtn").hidden = false; render(); return;
  }
  const ev = OTLocation.evaluate(pos.reading, me.centerId);
  showLocInfo(ev);
  updateTelemetry(ev);
  if (!ev.ok) {
    UI.msg(m, ev.message, ev.status === "OUTSIDE" ? "error" : "warning");
    $("retryLocBtn").hidden = false; render(); return;
  }
  finishCheckIn(me, at, pos.reading);
}

$("markBtn").addEventListener("click", attemptCheckIn);
$("retryLocBtn").addEventListener("click", attemptCheckIn);
$("testLocBtn").addEventListener("click", testLocationOnly);
if ($("demoLocation")) {
  $("demoLocation").addEventListener("change", () => {
    // Re-test location when simulation option changes
    testLocationOnly();
  });
}
$("demoTimeClear").addEventListener("click", () => { $("demoTime").value = ""; });
$("histMonth").addEventListener("change", render);
$("histApproval").addEventListener("change", render);
$("logoutBtn").onclick = () => OT.logout("login.html");

function handleResetAttendance() {
  const me = OT.currentUser();
  if (!me) return;
  const res = OT.removeAttendance(me.id);
  const m = $("markMessage");
  if (res.ok) {
    UI.msg(m, "Today's attendance record removed. You can now test marking attendance again.", "info");
    if ($("locInfo")) $("locInfo").hidden = true;
    if ($("geoTelemetry")) $("geoTelemetry").hidden = true;
    render();
  }
}

if ($("resetTodayBtn")) $("resetTodayBtn").addEventListener("click", handleResetAttendance);
if ($("demoResetBtn")) $("demoResetBtn").addEventListener("click", handleResetAttendance);
document.querySelectorAll("[data-nav]").forEach(a => a.addEventListener("click", e => {
  e.preventDefault();
  document.querySelectorAll("[data-nav]").forEach(x => x.classList.toggle("active", x === a));
  (a.getAttribute("href") === "#history" ? $("history") : $("top")).scrollIntoView({ behavior: "smooth" });
}));
window.addEventListener("storage", render); // keeps a second tab in sync
setInterval(() => { $("liveClock").textContent = new Date().toLocaleTimeString(OFFICE.LOCALE); }, 1000);
$("liveClock").textContent = new Date().toLocaleTimeString(OFFICE.LOCALE);
render();
