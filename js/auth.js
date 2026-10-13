/* ==========================================================
   OfficeTrack — login / registration pages
   ========================================================== */
OT.init();
const CFG = window.OT_CONFIG;

/* If already signed in, skip the login screen */
(function redirectIfSignedIn() {
  const u = OT.currentUser();
  if (!u) return;
  const onAdminPage = !!document.getElementById("adminLoginForm");
  const onEmployeePage = !!document.getElementById("loginForm");
  if (onAdminPage && u.role !== "EMPLOYEE") location.replace("admin-dashboard.html");
  if (onEmployeePage && u.role === "EMPLOYEE") location.replace("employee-dashboard.html");
})();

/* ---------- Registration ---------- */
const reg = document.getElementById("registerForm");
if (reg) {
  const centerSel = document.getElementById("centerId");
  UI.fillSelect(centerSel, [{ value: "", label: "Select center" }].concat(OT.locations.map(l => ({ value: l.id, label: OT.centerLabel(l.id) }))), "");
  UI.fillSelect(document.getElementById("department"), [{ value: "", label: "Select" }].concat(CFG.DEPARTMENTS.map(d => ({ value: d, label: d }))), "");
  reg.addEventListener("submit", e => {
    e.preventDefault();
    const msg = document.getElementById("registerMessage");
    const res = OT.addEmployee(null, {
      id: document.getElementById("employeeId").value,
      name: document.getElementById("employeeName").value,
      email: document.getElementById("employeeEmail").value,
      mobile: document.getElementById("employeeMobile").value,
      centerId: centerSel.value,
      department: document.getElementById("department").value,
      designation: document.getElementById("designation").value,
      password: document.getElementById("registerPassword").value
    });
    if (!res.ok) return UI.msg(msg, res.error, "error");
    UI.msg(msg, `Registration successful (${res.employee.id} · ${OT.centerName(res.employee.centerId)}). You can now login.`, "success");
    reg.reset();
  });
}

/* ---------- Employee login ---------- */
const login = document.getElementById("loginForm");
if (login) {
  login.addEventListener("submit", e => {
    e.preventDefault();
    const res = OT.login("employee", document.getElementById("loginId").value, document.getElementById("loginPassword").value);
    if (!res.ok) return UI.msg(document.getElementById("loginMessage"), res.error, "error");
    location.href = "employee-dashboard.html";
  });
  // Demo quick-fill: one employee per center
  const box = document.getElementById("demoEmployees");
  if (box) {
    const emps = OT.getEmployees();
    box.innerHTML = `<strong>Demo employees</strong> · password <b>${UI.esc(CFG.DEMO_EMPLOYEE_PASSWORD)}</b> <span class="hint">(click to fill)</span><div class="chip-row">` +
      OT.locations.map(l => {
        const e = emps.find(x => x.centerId === l.id && x.demo);
        return e ? `<button type="button" class="chip" data-id="${UI.esc(e.id)}">${UI.esc(e.id)} · ${UI.esc(l.name)}</button>` : "";
      }).join("") + "</div>";
    box.addEventListener("click", ev => {
      const b = ev.target.closest(".chip"); if (!b) return;
      document.getElementById("loginId").value = b.dataset.id;
      document.getElementById("loginPassword").value = CFG.DEMO_EMPLOYEE_PASSWORD;
    });
  }
}

/* ---------- Admin login (Super Admin + Center Admin) ---------- */
const al = document.getElementById("adminLoginForm");
if (al) {
  al.addEventListener("submit", e => {
    e.preventDefault();
    const res = OT.login("admin", document.getElementById("adminId").value, document.getElementById("adminPassword").value);
    if (!res.ok) return UI.msg(document.getElementById("adminLoginMessage"), res.error, "error");
    location.href = "admin-dashboard.html";
  });
  const box = document.getElementById("demoAdmins");
  if (box) {
    box.innerHTML = `<strong>Demo credentials</strong> <span class="hint">(click a row to fill)</span>
      <table class="mini-table"><thead><tr><th>Role</th><th>Center</th><th>ID</th><th>Password</th></tr></thead><tbody>` +
      CFG.ADMINS.map(a => `<tr data-id="${UI.esc(a.id)}" data-pw="${UI.esc(a.password)}"><td>${UI.esc(CFG.ROLE_LABELS[a.role])}</td><td>${a.role === "SUPER_ADMIN" ? "All centers" : UI.esc(OT.centerName(a.centerId))}</td><td><b>${UI.esc(a.id)}</b></td><td>${UI.esc(a.password)}</td></tr>`).join("") +
      `</tbody></table>`;
    box.addEventListener("click", ev => {
      const tr = ev.target.closest("tr[data-id]"); if (!tr) return;
      document.getElementById("adminId").value = tr.dataset.id;
      document.getElementById("adminPassword").value = tr.dataset.pw;
    });
  }
}
