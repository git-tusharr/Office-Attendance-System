/* ==========================================================
   OfficeTrack — employee dashboard
   ========================================================== */
OT.init();
const me0 = OT.requireRole(["EMPLOYEE"], "login.html");
const $ = id => document.getElementById(id);
const CFG = window.OT_CONFIG, OFFICE = CFG.OFFICE;

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
  $("policyList").innerHTML = `
    <li>One attendance record per employee per day.</li>
    <li>Office start time is <b>${UI.fmt12(OFFICE.START)}</b>.</li>
    <li>Check-in up to and including <b>${UI.fmt12(OFFICE.PRESENT_CUTOFF)}</b> is Present.</li>
    <li>Check-in after ${UI.fmt12(OFFICE.PRESENT_CUTOFF)} is Half Day.</li>
    <li>Employee cannot edit or delete attendance.</li>
    <li>Your <b>${UI.esc(OT.centerName(me.centerId))}</b> center admin approves or rejects each record.</li>`;
  $("myDetails").innerHTML = [["Employee ID", me.id], ["Center", OT.centerLabel(me.centerId)], ["Department", me.department], ["Designation", me.designation], ["Email", me.email]]
    .map(([k, v]) => `<dt>${k}</dt><dd>${UI.esc(v)}</dd>`).join("");

  const mine = OT.attendanceOf(me.id);
  const td = mine.find(a => a.date === t);
  const btn = $("markBtn"), st = $("todayStatus"), info = $("checkInInfo");
  if (td) {
    st.textContent = td.attendanceStatus; st.className = "status " + UI.cls(td.attendanceStatus);
    info.innerHTML = `Check-in: <b>${UI.fmtTime(td.checkIn, true)}</b> · Approval: ${UI.badge(td.approvalStatus)}`;
    btn.disabled = true; btn.textContent = "✓ Attendance Already Marked"; btn.style.opacity = ".55";
  } else {
    st.textContent = "Not Marked"; st.className = "status pending";
    info.textContent = "No attendance marked today.";
    btn.disabled = false; btn.textContent = "Mark Attendance"; btn.style.opacity = "1";
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

$("markBtn").addEventListener("click", () => {
  const me = OT.currentUser(); if (!me) return location.replace("login.html");
  let at = null;
  const dt = $("demoTime").value;
  if (dt) { const [h, m] = dt.split(":").map(Number); at = new Date(); at.setHours(h, m, 0, 0); }
  const res = OT.markAttendance(me.id, at);
  const m = $("markMessage");
  if (!res.ok) { UI.msg(m, res.error, "error"); render(); return; }
  UI.msg(m, `Attendance marked at ${UI.fmtTime(res.record.checkIn, true)} as ${res.record.attendanceStatus}. Waiting for approval from ${OT.centerName(me.centerId)} center admin.`, "success");
  render();
});
$("demoTimeClear").addEventListener("click", () => { $("demoTime").value = ""; });
$("histMonth").addEventListener("change", render);
$("histApproval").addEventListener("change", render);
$("logoutBtn").onclick = () => OT.logout("login.html");
document.querySelectorAll("[data-nav]").forEach(a => a.addEventListener("click", e => {
  e.preventDefault();
  document.querySelectorAll("[data-nav]").forEach(x => x.classList.toggle("active", x === a));
  (a.getAttribute("href") === "#history" ? $("history") : $("top")).scrollIntoView({ behavior: "smooth" });
}));
window.addEventListener("storage", render); // keeps a second tab in sync
setInterval(() => { $("liveClock").textContent = new Date().toLocaleTimeString(OFFICE.LOCALE); }, 1000);
$("liveClock").textContent = new Date().toLocaleTimeString(OFFICE.LOCALE);
render();
