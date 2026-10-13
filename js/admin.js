/* ==========================================================
   OfficeTrack — admin dashboard (Super Admin + Center Admin)
   Super Admin: all 6 centers + center filter.
   Center Admin: locked to their own center (enforced in store.js too).
   ========================================================== */
OT.init();
const user = OT.requireRole(["SUPER_ADMIN", "CENTER_ADMIN"], "admin-login.html");
const $ = id => document.getElementById(id);
const CFG = window.OT_CONFIG;
const VIEWS = ["overview", "approvals", "attendance", "employees", "reports"];
const state = { center: "ALL" };
const SUPER = user && OT.isSuper(user);
const MAX_ROWS = 300;

/* ---------- helpers ---------- */
const scope = () => (SUPER ? state.center : user.centerId);                // active center filter
const empMap = () => Object.fromEntries(OT.getEmployees().map(e => [e.id, e]));
const matches = (e, q) => !q || (e && (e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || (e.email || "").toLowerCase().includes(q)));
const centerTag = id => `<span class="center-tag${OT.location(id) && OT.location(id).isHeadOffice ? " head" : ""}">${UI.esc(OT.centerName(id))}</span>`;
const who = e => e ? `<b>${UI.esc(e.id)}</b><br>${UI.esc(e.name)}` : "<b>—</b>";

function actionCell(a) {
  if (a.approvalStatus === "PENDING")
    return `<div class="action-group"><button class="small-btn approve-btn" data-action="approve" data-id="${UI.esc(a.id)}">✓ Approve</button><button class="small-btn reject-btn" data-action="reject" data-id="${UI.esc(a.id)}">✕ Reject</button></div>`;
  return `<div class="action-group"><button class="small-btn neutral-btn" data-action="reopen" data-id="${UI.esc(a.id)}">↺ Reopen</button></div>`;
}

/* ---------- header / shell ---------- */
function setupShell() {
  $("sideName").textContent = user.name;
  $("sideMeta").textContent = `${CFG.ROLE_LABELS[user.role]} · ${SUPER ? "All centers" : OT.centerName(user.centerId)}`;
  $("adminDate").textContent = UI.fmtLongDate(new Date());
  if (SUPER) {
    $("roleEyebrow").textContent = "SUPER ADMIN · HEAD OFFICE BHOPAL";
    UI.fillSelect($("centerFilter"), [{ value: "ALL", label: "All Centers" }].concat(OT.locations.map(l => ({ value: l.id, label: OT.centerLabel(l.id) }))), "ALL");
  } else {
    $("roleEyebrow").textContent = `CENTER ADMIN · ${OT.centerName(user.centerId).toUpperCase()}`;
    $("centerFilterWrap").hidden = true;
    $("centerPill").hidden = false;
    $("centerPill").textContent = "📍 " + OT.centerLabel(user.centerId);
    $("centerPanel").hidden = true;
    $("centerReportWrap").hidden = true;
    $("resetDemoBtn").hidden = true;
  }
  UI.fillSelect($("emDept"), [{ value: "ALL", label: "All departments" }].concat(CFG.DEPARTMENTS.map(d => ({ value: d, label: d }))), "ALL");

  const t = OT.date.today();
  $("atFrom").value = t.slice(0, 7) + "-01";
  $("atTo").value = t;
  $("repMonth").value = t.slice(0, 7);
}

function setView(name) {
  if (!VIEWS.includes(name)) name = "overview";
  VIEWS.forEach(v => $("view-" + v).classList.toggle("active", v === name));
  document.querySelectorAll("#sideNav a").forEach(a => a.classList.toggle("active", a.dataset.view === name));
  window.scrollTo(0, 0);
}

function renderHeader() {
  const c = scope();
  const name = c === "ALL" ? "All Centers" : OT.centerLabel(c);
  $("pageTitle").textContent = SUPER ? (c === "ALL" ? "Consolidated Overview" : `${OT.centerName(c)} Center`) : `${OT.centerName(user.centerId)} Center`;
  $("pageSub").textContent = SUPER ? `Showing attendance for: ${name}` : "Review, approve and manage your center's employees and attendance.";
}

/* ---------- Overview ---------- */
function renderOverview() {
  const t = OT.date.today(), c = scope();
  const emps = OT.employeesFor(user, c).filter(e => e.status === "ACTIVE");
  const ids = new Set(emps.map(e => e.id));
  const all = OT.attendanceFor(user, c);
  const td = all.filter(a => a.date === t);
  const marked = td.filter(a => ids.has(a.employeeId)).length;
  const working = OT.date.isWorkingDay(t);

  $("totalEmployees").textContent = emps.length;
  $("adminPresent").textContent = td.filter(a => a.attendanceStatus === "PRESENT" && a.approvalStatus !== "REJECTED").length;
  $("adminHalf").textContent = td.filter(a => a.attendanceStatus === "HALF DAY" && a.approvalStatus !== "REJECTED").length;
  $("adminPending").textContent = all.filter(a => a.approvalStatus === "PENDING").length;   // all dates
  $("adminNotMarked").textContent = working ? emps.length - marked : 0;
  $("adminApproved").textContent = td.filter(a => a.approvalStatus === "APPROVED").length;
  $("adminRejected").textContent = td.filter(a => a.approvalStatus === "REJECTED").length;
  $("adminRate").textContent = (emps.length ? Math.round((marked / emps.length) * 100) : 0) + "%";
  $("navPending").textContent = all.filter(a => a.approvalStatus === "PENDING").length;

  // center-wise table (Super Admin)
  if (SUPER) {
    const rows = OT.centerDayRows(t);
    const tot = rows.reduce((s, r) => { ["employees", "present", "half", "notMarked", "pending"].forEach(k => (s[k] += r[k])); return s; }, { employees: 0, present: 0, half: 0, notMarked: 0, pending: 0 });
    const totRate = tot.employees ? Math.round(((tot.employees - tot.notMarked) / tot.employees) * 100) : 0;
    const bar = p => `<div class="rate"><div class="bar"><i style="width:${p}%"></i></div><span>${p}%</span></div>`;
    $("centerTodayBody").innerHTML = rows.map(r => `<tr data-center="${r.center.id}" class="${state.center === r.center.id ? "selected" : ""}"><td><b>${UI.esc(r.center.name)}</b>${r.center.isHeadOffice ? ' <span class="status pending">HO</span>' : ""}</td><td>${r.employees}</td><td>${r.present}</td><td>${r.half}</td><td>${r.notMarked}</td><td>${r.pending}</td><td>${bar(r.rate)}</td></tr>`).join("")
      + `<tr class="totals" data-center="ALL"><td>All Centers</td><td>${tot.employees}</td><td>${tot.present}</td><td>${tot.half}</td><td>${tot.notMarked}</td><td>${tot.pending}</td><td>${bar(totRate)}</td></tr>`;
  }

  // today's table
  const map = empMap(), q = $("searchToday").value.trim().toLowerCase(), f = $("statusToday").value;
  const rows = td.filter(a => matches(map[a.employeeId], q) && (f === "ALL" || a.approvalStatus === f))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  $("todayBody").innerHTML = rows.map(a => { const e = map[a.employeeId];
    return `<tr><td>${who(e)}</td><td>${centerTag(a.centerId)}</td><td>${UI.esc(e ? e.department : "-")}</td><td>${UI.fmtTime(a.checkIn)}</td><td>${UI.badge(a.attendanceStatus)}</td><td>${UI.badge(a.approvalStatus)}</td><td>${actionCell(a)}</td></tr>`; }).join("")
    || `<tr><td colspan="7" class="empty">${working ? "No attendance records for today match the filter." : "Today is not a working day."}</td></tr>`;
}

/* ---------- Approvals ---------- */
function pendingRows() {
  const map = empMap(), q = $("apSearch").value.trim().toLowerCase(), type = $("apType").value;
  return OT.attendanceFor(user, scope())
    .filter(a => a.approvalStatus === "PENDING" && matches(map[a.employeeId], q) && (type === "ALL" || a.attendanceStatus === type))
    .sort((a, b) => b.date.localeCompare(a.date) || a.checkIn.localeCompare(b.checkIn));
}
function renderApprovals() {
  const map = empMap(), rows = pendingRows();
  $("approvalsSub").textContent = `${rows.length} record${rows.length === 1 ? "" : "s"} waiting for a decision${scope() === "ALL" ? " across all centers" : " in " + OT.centerName(scope())}.`;
  $("approveAllBtn").disabled = !rows.length;
  $("approvalsBody").innerHTML = rows.slice(0, MAX_ROWS).map(a => `<tr><td>${who(map[a.employeeId])}</td><td>${centerTag(a.centerId)}</td><td>${UI.fmtDate(a.date)}</td><td>${UI.fmtTime(a.checkIn)}</td><td>${UI.badge(a.attendanceStatus)}</td><td>${actionCell(a)}</td></tr>`).join("")
    || `<tr><td colspan="6" class="empty">🎉 No pending approvals.</td></tr>`;
}

/* ---------- Attendance ---------- */
function renderAttendance() {
  const map = empMap(), q = $("atSearch").value.trim().toLowerCase();
  const from = $("atFrom").value || "0000-00-00", to = $("atTo").value || "9999-99-99";
  const att = $("atAtt").value, app = $("atApp").value;
  const rows = OT.attendanceFor(user, scope())
    .filter(a => a.date >= from && a.date <= to && matches(map[a.employeeId], q) && (att === "ALL" || a.attendanceStatus === att) && (app === "ALL" || a.approvalStatus === app))
    .sort((a, b) => b.date.localeCompare(a.date) || a.employeeId.localeCompare(b.employeeId));
  $("attendanceBody").innerHTML = rows.slice(0, MAX_ROWS).map(a => `<tr><td>${who(map[a.employeeId])}</td><td>${centerTag(a.centerId)}</td><td>${UI.fmtDate(a.date)}</td><td>${UI.fmtTime(a.checkIn)}</td><td>${UI.badge(a.attendanceStatus)}</td><td>${UI.badge(a.approvalStatus)}</td><td>${a.approvedBy ? UI.esc(a.approvedBy) : "—"}</td><td>${actionCell(a)}</td></tr>`).join("")
    || `<tr><td colspan="8" class="empty">No attendance records match the filters.</td></tr>`;
  $("attendanceNote").textContent = `${rows.length} record${rows.length === 1 ? "" : "s"} found${rows.length > MAX_ROWS ? ` — showing the latest ${MAX_ROWS}. Narrow the date range to see more.` : "."}`;
}

/* ---------- Employees ---------- */
function renderEmployees() {
  const q = $("emSearch").value.trim().toLowerCase(), dept = $("emDept").value, st = $("emStatus").value;
  const rows = OT.employeesFor(user, scope()).filter(e => matches(e, q) && (dept === "ALL" || e.department === dept) && (st === "ALL" || e.status === st))
    .sort((a, b) => a.id.localeCompare(b.id));
  $("employeesSub").textContent = `${rows.length} employee${rows.length === 1 ? "" : "s"}${scope() === "ALL" ? " across all centers" : " · " + OT.centerName(scope())}`;
  $("employeesBody").innerHTML = rows.map(e => `<tr><td><b>${UI.esc(e.id)}</b></td><td>${UI.esc(e.name)}</td><td>${UI.esc(e.email)}</td><td>${centerTag(e.centerId)}</td><td>${UI.esc(e.department)}</td><td>${UI.esc(e.designation)}</td><td>${UI.badge(e.status)}</td>
    <td><div class="action-group"><button class="small-btn neutral-btn" data-action="edit-emp" data-id="${UI.esc(e.id)}">✎ Edit</button><button class="small-btn ${e.status === "ACTIVE" ? "reject-btn" : "approve-btn"}" data-action="toggle-emp" data-id="${UI.esc(e.id)}">${e.status === "ACTIVE" ? "Deactivate" : "Activate"}</button></div></td></tr>`).join("")
    || `<tr><td colspan="8" class="empty">No employees match the filters.</td></tr>`;
}

function employeeForm(emp) {
  const isEdit = !!emp;
  const centerOpts = OT.locations.map(l => `<option value="${l.id}"${(emp ? emp.centerId : (SUPER ? (scope() === "ALL" ? "" : scope()) : user.centerId)) === l.id ? " selected" : ""}>${UI.esc(OT.centerLabel(l.id))}</option>`).join("");
  const deptOpts = CFG.DEPARTMENTS.map(d => `<option${emp && emp.department === d ? " selected" : ""}>${d}</option>`).join("");
  const v = k => UI.esc(emp ? emp[k] : "");
  const modal = UI.modal({
    title: isEdit ? `Edit ${emp.name}` : "Add Employee",
    body: `<form id="empForm" class="form-grid">
      <label>Employee ID<input id="fId" value="${isEdit ? v("id") : ""}" placeholder="Auto: ${OT.nextEmployeeId()}" ${isEdit ? "readonly" : ""}></label>
      <label>Full Name<input id="fName" required value="${v("name")}"></label>
      <label>Email<input id="fEmail" type="email" required value="${v("email")}"></label>
      <label>Mobile<input id="fMobile" value="${v("mobile")}"></label>
      <label>Assigned Center<select id="fCenter" ${SUPER ? "" : "disabled"} required>${SUPER && !emp ? '<option value="">Select center</option>' : ""}${centerOpts}</select></label>
      <label>Department<select id="fDept" required>${deptOpts}</select></label>
      <label>Designation<input id="fDesig" required value="${v("designation")}"></label>
      <label>${isEdit ? "New Password (optional)" : "Password"}<input id="fPass" type="password" ${isEdit ? "" : "required"} minlength="6" placeholder="${isEdit ? "Leave blank to keep current" : "Minimum 6 characters"}"></label>
      ${isEdit && SUPER ? '<p class="muted full-col note">Changing the center transfers the employee. Past attendance stays with the old center; pending approvals move with the employee.</p>' : ""}
      <div class="full-col modal-actions"><button type="button" class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" type="submit">${isEdit ? "Save Changes" : "Add Employee"}</button></div>
      <div id="empFormMsg" class="message full-col"></div></form>`
  });
  modal.querySelector("#empForm").addEventListener("submit", e => {
    e.preventDefault();
    const data = {
      name: $("fName").value, email: $("fEmail").value, mobile: $("fMobile").value,
      centerId: $("fCenter").value, department: $("fDept").value, designation: $("fDesig").value, password: $("fPass").value
    };
    const res = isEdit ? OT.updateEmployee(user, emp.id, data) : OT.addEmployee(user, Object.assign({ id: $("fId").value }, data));
    if (!res.ok) return UI.msg($("empFormMsg"), res.error, "error");
    UI.closeModal(); UI.toast(isEdit ? "Employee updated." : `Employee ${res.employee.id} added to ${OT.centerName(res.employee.centerId)}.`); renderAll();
  });
}

/* ---------- Reports ---------- */
function renderReports() {
  const mk = $("repMonth").value || OT.date.today().slice(0, 7), c = scope();
  $("reportSub").textContent = `${UI.fmtMonth(mk)} · ${c === "ALL" ? "All centers" : OT.centerLabel(c)} · Present/Half Day include pending records; rejected check-ins are not credited.`;
  const pct = p => `<div class="rate"><div class="bar"><i style="width:${p}%"></i></div><span>${p}%</span></div>`;
  const cells = s => `<td>${s.workingDays}</td><td>${s.present}</td><td>${s.half}</td><td>${s.absent}</td><td>${s.rejected}</td><td>${s.pending}</td><td>${pct(s.percent)}</td>`;

  if (SUPER) {
    const rows = OT.centerMonthRows(mk);
    const tot = OT.sumSummaries(rows.map(r => r.s));
    $("centerReportBody").innerHTML = rows.map(r => `<tr data-center="${r.center.id}" class="${state.center === r.center.id ? "selected" : ""}"><td><b>${UI.esc(r.center.name)}</b></td><td>${r.employees}</td>${cells(r.s)}</tr>`).join("")
      + `<tr class="totals" data-center="ALL"><td>All Centers</td><td>${rows.reduce((n, r) => n + r.employees, 0)}</td>${cells(tot)}</tr>`;
  }
  const rows = OT.monthRows(user, c, mk).sort((a, b) => a.emp.id.localeCompare(b.emp.id));
  $("empReportTitle").textContent = `Employee summary — ${c === "ALL" ? "All centers" : OT.centerName(c)}`;
  $("empReportBody").innerHTML = rows.map(r => `<tr><td>${who(r.emp)}</td><td>${centerTag(r.emp.centerId)}</td>${cells(r.s)}</tr>`).join("")
    || `<tr><td colspan="9" class="empty">No employees in this selection.</td></tr>`;
}
function exportEmployeeCSV() {
  const mk = $("repMonth").value, c = scope();
  const rows = [["Employee ID", "Name", "Center", "Department", "Month", "Working Days", "Present", "Half Day", "Absent", "Rejected", "Pending", "Attendance %"]];
  OT.monthRows(user, c, mk).sort((a, b) => a.emp.id.localeCompare(b.emp.id)).forEach(r =>
    rows.push([r.emp.id, r.emp.name, OT.centerName(r.emp.centerId), r.emp.department, mk, r.s.workingDays, r.s.present, r.s.half, r.s.absent, r.s.rejected, r.s.pending, r.s.percent]));
  UI.downloadCSV(`employee-summary-${c === "ALL" ? "all-centers" : OT.centerName(c).toLowerCase()}-${mk}.csv`, rows);
}
function exportCenterCSV() {
  const mk = $("repMonth").value;
  const rows = [["Center", "Month", "Employees", "Working Days", "Present", "Half Day", "Absent", "Rejected", "Pending", "Attendance %"]];
  OT.centerMonthRows(mk).forEach(r => rows.push([r.center.name, mk, r.employees, r.s.workingDays, r.s.present, r.s.half, r.s.absent, r.s.rejected, r.s.pending, r.s.percent]));
  UI.downloadCSV(`center-summary-${mk}.csv`, rows);
}

/* ---------- render + events ---------- */
function renderAll() {
  renderHeader(); renderOverview(); renderApprovals(); renderAttendance(); renderEmployees(); renderReports();
}

function setCenter(id) {
  if (!SUPER) return;
  state.center = id; $("centerFilter").value = id; renderAll();
}

function decide(ids, decision, label) {
  const res = OT.decide(user, ids, decision);
  if (!res.ok) return UI.toast("Nothing changed — you can only manage your own center's records.", "error");
  UI.toast(`${res.count} record${res.count === 1 ? "" : "s"} ${label}.`);
  renderAll();
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (b) {
    const id = b.dataset.id;
    if (b.dataset.action === "approve") decide([id], "APPROVED", "approved");
    else if (b.dataset.action === "reject") decide([id], "REJECTED", "rejected");
    else if (b.dataset.action === "reopen") decide([id], "PENDING", "moved back to pending");
    else if (b.dataset.action === "edit-emp") { const emp = OT.getEmployee(id); if (emp && OT.canAccessCenter(user, emp.centerId)) employeeForm(emp); }
    else if (b.dataset.action === "toggle-emp") {
      const emp = OT.getEmployee(id); if (!emp) return;
      const next = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      if (next === "INACTIVE" && !confirm(`Deactivate ${emp.name}? They will no longer be able to log in or check in.`)) return;
      const res = OT.setEmployeeStatus(user, id, next);
      if (!res.ok) return UI.toast(res.error, "error");
      UI.toast(`${emp.name} is now ${next.toLowerCase()}.`); renderAll();
    }
    return;
  }
  const tr = e.target.closest("tr[data-center]");           // click a center row => filter by that center
  if (tr && SUPER) setCenter(tr.dataset.center);
});

if (user) {
  setupShell();
  window.addEventListener("hashchange", () => setView(location.hash.slice(1)));
  $("centerFilter").addEventListener("change", e => setCenter(e.target.value));
  ["searchToday", "statusToday", "apSearch", "apType", "atFrom", "atTo", "atSearch", "atAtt", "atApp", "emSearch", "emDept", "emStatus", "repMonth"]
    .forEach(id => { $(id).addEventListener("input", renderAll); $(id).addEventListener("change", renderAll); });
  $("approveAllBtn").addEventListener("click", () => {
    const rows = pendingRows();
    if (rows.length && confirm(`Approve ${rows.length} pending record${rows.length === 1 ? "" : "s"} currently shown?`)) decide(rows.map(r => r.id), "APPROVED", "approved");
  });
  $("addEmployeeBtn").addEventListener("click", () => employeeForm(null));
  $("exportEmpBtn").addEventListener("click", exportEmployeeCSV);
  $("exportCenterBtn").addEventListener("click", exportCenterCSV);
  $("resetDemoBtn").addEventListener("click", () => {
    if (confirm("Reset ALL demo data? Every employee and attendance record will be rebuilt from the original sample data (employees you added will be removed).")) {
      OT.resetDemoData(false); state.center = "ALL"; $("centerFilter").value = "ALL"; renderAll(); UI.toast("Demo data has been reset.");
    }
  });
  $("adminLogoutBtn").onclick = () => OT.logout("admin-login.html");
  window.addEventListener("storage", renderAll);
  setView(location.hash.slice(1));
  renderAll();
}
