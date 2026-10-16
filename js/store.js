/* ==========================================================
   OfficeTrack — data & business logic layer (localStorage)
   No DOM code here. Pages call these functions.
   Exposes window.OT
   ========================================================== */
(function () {
  const C = window.OT_CONFIG;
  const K = C.STORAGE;
  const OT = (window.OT = {});

  /* ---------- storage ---------- */
  const read = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  /* ---------- date helpers (always LOCAL time, never UTC) ---------- */
  const pad = n => String(n).padStart(2, "0");
  const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); };
  const today = () => dateStr(new Date());
  const isWorkingDay = s => C.OFFICE.WORKING_DAYS.includes(parseDate(s).getDay());
  const monthRange = mk => { const [y, m] = mk.split("-").map(Number); return { start: `${mk}-01`, end: dateStr(new Date(y, m, 0)) }; };
  const eachDate = (a, b) => { const r = []; for (let d = a; d <= b; d = addDays(d, 1)) r.push(d); return r; };
  const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
  const toMinutes = hhmm => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  OT.date = { pad, dateStr, parseDate, addDays, today, isWorkingDay, monthRange, eachDate, daysBetween, toMinutes };

  /* ---------- locations ---------- */
  OT.locations = C.LOCATIONS;
  OT.location = id => C.LOCATIONS.find(l => l.id === id) || null;
  OT.centerName = id => (OT.location(id) || { name: id || "—" }).name;
  OT.centerLabel = id => { const l = OT.location(id); return l ? l.name + (l.isHeadOffice ? " (Head Office)" : "") : (id || "—"); };

  /* ---------- the 9:15 rule ---------- */
  /* Compared at minute precision: 09:15:59 is still PRESENT, 09:16:00 is HALF DAY. */
  OT.classify = function (date) {
    const mins = date.getHours() * 60 + date.getMinutes();
    return mins <= toMinutes(C.OFFICE.PRESENT_CUTOFF) ? "PRESENT" : "HALF DAY";
  };

  /* ---------- raw access ---------- */
  OT.getEmployees = () => read(K.EMPLOYEES, []);
  OT.getAttendance = () => read(K.ATTENDANCE, []);
  const saveEmployees = list => write(K.EMPLOYEES, list);
  const saveAttendance = list => write(K.ATTENDANCE, list);
  OT.getEmployee = id => OT.getEmployees().find(e => e.id === id) || null;
  const recordId = (empId, date) => `${empId}_${date}`; // unique key => duplicate prevention

  /* ==========================================================
     DEMO DATA (deterministic, so every reset looks realistic)
     ========================================================== */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const slug = n => n.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".");

  function buildDemoEmployees() {
    const t = today();
    return window.OT_DEMO_ROSTER.map(([centerId, name, department, designation], i) => {
      const id = "EMP" + pad(i + 1).padStart(3, "0");
      const h = hash(id);
      return {
        id, name,
        email: id === "EMP001" ? "rahul@example.com" : slug(name) + "@example.com",
        mobile: "9" + String(100000000 + (h % 899999999)).slice(0, 9),
        centerId, department, designation,
        password: C.DEMO_EMPLOYEE_PASSWORD,
        status: "ACTIVE",
        joinDate: addDays(t, -(90 + (h % 300))),
        demo: true,
        createdAt: new Date().toISOString()
      };
    });
  }

  /* Build one believable attendance record (or null = absent / not arrived yet) */
  function generateRecord(emp, date, nowMinutes) {
    const r = rng(hash(emp.id + date));
    const t = today();
    const isToday = date === t;
    const absentP = 0.05, halfP = 0.09 + (hash(emp.id) % 7) / 100;
    const roll = r();
    if (roll < absentP) return null;
    if (isToday && emp.id === "EMP001") return null; // keep the original demo user free to test check-in

    let minute;
    if (roll < absentP + halfP) minute = toMinutes(C.OFFICE.PRESENT_CUTOFF) + 1 + Math.floor(r() * 90); // late
    else minute = toMinutes(C.OFFICE.START) - 15 + Math.floor(r() * 31);                                  // 08:45–09:15
    if (isToday && minute > nowMinutes) return null; // hasn't arrived yet

    const d = parseDate(date);
    d.setHours(Math.floor(minute / 60), minute % 60, Math.floor(r() * 60), 0);
    const attendanceStatus = OT.classify(d);

    const age = daysBetween(date, t);
    let approvalStatus;
    const a = r();
    if (age >= 3) approvalStatus = a < 0.93 ? "APPROVED" : "REJECTED";
    else if (age >= 1) approvalStatus = a < 0.5 ? "PENDING" : (a < 0.93 ? "APPROVED" : "REJECTED");
    else approvalStatus = a < 0.85 ? "PENDING" : "APPROVED";

    const centerAdmin = C.ADMINS.find(x => x.role === "CENTER_ADMIN" && x.centerId === emp.centerId);
    let approvedBy = null, approvedAt = null;
    if (approvalStatus !== "PENDING") {
      approvedBy = centerAdmin ? centerAdmin.id : "admin";
      const ap = new Date(d); ap.setHours(11 + Math.floor(r() * 6), Math.floor(r() * 60), 0, 0);
      approvedAt = ap.toISOString();
    }
    return {
      id: recordId(emp.id, date), employeeId: emp.id, centerId: emp.centerId, date,
      checkIn: d.toISOString(), attendanceStatus, approvalStatus, approvedBy, approvedAt,
      createdAt: d.toISOString(), demo: true
    };
  }

  /* Fill in demo attendance for dates in (fromExclusive, toInclusive] */
  function backfillDemo(fromExclusive, toInclusive) {
    const emps = OT.getEmployees().filter(e => e.demo && e.status === "ACTIVE");
    const att = OT.getAttendance();
    const have = new Set(att.map(a => a.id));
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    eachDate(addDays(fromExclusive, 1), toInclusive).forEach(date => {
      if (!isWorkingDay(date)) return;
      emps.forEach(emp => {
        if (date < emp.joinDate || have.has(recordId(emp.id, date))) return;
        const rec = generateRecord(emp, date, nowMin);
        if (rec) att.push(rec);
      });
    });
    saveAttendance(att);
  }

  /* Wipe & rebuild everything. Keeps employees that registered themselves (non-demo). */
  OT.resetDemoData = function (keepCustom) {
    const custom = keepCustom ? OT.getEmployees().filter(e => !e.demo && e.centerId) : [];
    const customIds = new Set(custom.map(e => e.id));
    const demo = buildDemoEmployees().filter(e => !customIds.has(e.id));
    saveEmployees(demo.concat(custom));
    saveAttendance([]);
    const t = today();
    const start = addDays(t, -C.DEMO_HISTORY_DAYS);
    backfillDemo(addDays(start, -1), t);
    write(K.META, { version: C.DATA_VERSION, seededThrough: t });
  };

  /* Run on every page load: seed first time, upgrade old v1 data, keep demo history current */
  OT.init = function () {
    const meta = read(K.META, null);
    const existing = OT.getEmployees();
    if (!meta || meta.version !== C.DATA_VERSION || !existing.length) {
      // v1 (single-office) data: carry over any extra employees to Bhopal
      const legacy = existing.filter(e => !e.centerId && e.id !== "EMP001")
        .map(e => Object.assign({}, e, { centerId: "BPL", status: "ACTIVE", joinDate: today(), createdAt: e.createdAt || new Date().toISOString() }));
      const prevCustom = existing.filter(e => e.centerId && !e.demo);
      saveEmployees(prevCustom.concat(legacy));
      OT.resetDemoData(true);
      return;
    }
    const t = today();
    if (meta.seededThrough < t) {
      backfillDemo(meta.seededThrough, t);
      write(K.META, Object.assign({}, meta, { seededThrough: t }));
    }
  };

  /* ==========================================================
     AUTH & PERMISSIONS
     ========================================================== */
  OT.login = function (kind, idInput, password) {
    const id = String(idInput).trim().toLowerCase();
    if (kind === "admin") {
      const a = C.ADMINS.find(x => x.id.toLowerCase() === id && x.password === password);
      if (!a) return { ok: false, error: "Invalid admin ID or password." };
      write(K.SESSION, { role: a.role, id: a.id });
      return { ok: true, role: a.role };
    }
    const e = OT.getEmployees().find(x => (x.id.toLowerCase() === id || x.email.toLowerCase() === id) && x.password === password);
    if (!e) return { ok: false, error: "Invalid employee ID/email or password." };
    if (e.status !== "ACTIVE") return { ok: false, error: "This account is inactive. Please contact your center admin." };
    write(K.SESSION, { role: "EMPLOYEE", id: e.id });
    return { ok: true, role: "EMPLOYEE" };
  };

  OT.currentUser = function () {
    const s = read(K.SESSION, null);
    if (!s) return null;
    if (s.role === "EMPLOYEE") {
      const e = OT.getEmployee(s.id);
      return e && e.status === "ACTIVE" ? Object.assign({ role: "EMPLOYEE" }, e) : null;
    }
    const a = C.ADMINS.find(x => x.id === s.id && x.role === s.role);
    return a ? { id: a.id, name: a.name, role: a.role, centerId: a.centerId } : null;
  };

  /* Redirect to loginPage unless the signed-in user has one of the roles */
  OT.requireRole = function (roles, loginPage) {
    const u = OT.currentUser();
    if (!u || !roles.includes(u.role)) { localStorage.removeItem(K.SESSION); location.replace(loginPage); return null; }
    return u;
  };
  OT.logout = function (loginPage) { localStorage.removeItem(K.SESSION); location.href = loginPage; };

  const isSuper = u => u && u.role === "SUPER_ADMIN";
  OT.isSuper = isSuper;
  OT.canAccessCenter = (u, centerId) => !!u && (isSuper(u) || u.centerId === centerId);
  /* center filter actually applied for a user: center admins are always locked to their own center */
  const effCenter = (u, filter) => (isSuper(u) ? (filter && filter !== "ALL" ? filter : null) : u.centerId);

  /* ==========================================================
     EMPLOYEES
     ========================================================== */
  OT.nextEmployeeId = function () {
    const max = OT.getEmployees().reduce((m, e) => { const n = /^EMP(\d+)$/.exec(e.id); return n ? Math.max(m, +n[1]) : m; }, 0);
    return "EMP" + String(max + 1).padStart(3, "0");
  };

  OT.employeesFor = (u, centerFilter) => {
    const c = effCenter(u, centerFilter);
    return OT.getEmployees().filter(e => !c || e.centerId === c);
  };

  function validateEmployee(data, list, selfId) {
    if (!data.name || !data.name.trim()) return "Name is required.";
    if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) return "A valid email is required.";
    if (!OT.location(data.centerId)) return "Please select a center.";
    if (!data.department) return "Please select a department.";
    if (!data.designation || !data.designation.trim()) return "Designation is required.";
    if (list.some(e => e.id !== selfId && e.email.toLowerCase() === data.email.trim().toLowerCase())) return "This email is already registered.";
    return null;
  }

  /* user = admin adding an employee, or null for public self-registration */
  OT.addEmployee = function (user, data) {
    const list = OT.getEmployees();
    const d = Object.assign({}, data);
    if (user && !isSuper(user)) d.centerId = user.centerId;
    d.id = (d.id || "").trim().toUpperCase() || OT.nextEmployeeId();
    if (list.some(e => e.id === d.id)) return { ok: false, error: "Employee ID already exists." };
    const err = validateEmployee(d, list, null);
    if (err) return { ok: false, error: err };
    if (!d.password || d.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    const emp = {
      id: d.id, name: d.name.trim(), email: d.email.trim().toLowerCase(), mobile: (d.mobile || "").trim(),
      centerId: d.centerId, department: d.department, designation: d.designation.trim(),
      password: d.password, status: "ACTIVE", joinDate: today(), createdAt: new Date().toISOString()
    };
    list.push(emp); saveEmployees(list);
    return { ok: true, employee: emp };
  };

  OT.updateEmployee = function (user, id, patch) {
    const list = OT.getEmployees(), i = list.findIndex(e => e.id === id);
    if (i < 0) return { ok: false, error: "Employee not found." };
    const cur = list[i];
    if (!OT.canAccessCenter(user, cur.centerId)) return { ok: false, error: "You can only manage employees of your own center." };
    const next = Object.assign({}, cur, patch);
    if (!isSuper(user)) next.centerId = cur.centerId; // only Super Admin can transfer between centers
    next.id = cur.id;
    const err = validateEmployee(next, list, cur.id);
    if (err) return { ok: false, error: err };
    if (patch.password === "" || patch.password == null) next.password = cur.password;
    else if (patch.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    next.name = next.name.trim(); next.email = next.email.trim().toLowerCase(); next.designation = next.designation.trim();
    list[i] = next; saveEmployees(list);
    // Center transfer: history stays with the old center; pending approvals follow the employee.
    if (next.centerId !== cur.centerId) {
      const att = OT.getAttendance();
      att.forEach(a => { if (a.employeeId === id && a.approvalStatus === "PENDING") a.centerId = next.centerId; });
      saveAttendance(att);
    }
    return { ok: true, employee: next };
  };

  OT.setEmployeeStatus = (user, id, status) => OT.updateEmployee(user, id, { status });

  /* ==========================================================
     ATTENDANCE
     ========================================================== */
  OT.attendanceFor = (u, centerFilter) => {
    const c = effCenter(u, centerFilter);
    return OT.getAttendance().filter(a => !c || a.centerId === c);
  };
  OT.attendanceOf = empId => OT.getAttendance().filter(a => a.employeeId === empId);

  /* Employee check-in. `at` (Date) is optional — only used by the demo time override.
     `geo` is a fresh location reading from OTLocation.getPosition(). It is REQUIRED for centers that have a
     GPS rule in OT_CONFIG.GEOFENCE (currently Bhopal) and is re-verified here; nothing is saved if it fails. */
  OT.markAttendance = function (empId, at, geo) {
    const emp = OT.getEmployee(empId);
    if (!emp || emp.status !== "ACTIVE") return { ok: false, error: "Employee account is not active." };
    const now = at || new Date();
    const date = at ? today() : dateStr(now);
    const att = OT.getAttendance();           // read fresh: protects against a second tab
    const id = recordId(empId, date);
    if (att.some(a => a.id === id || (a.employeeId === empId && a.date === date)))
      return { ok: false, error: "Attendance is already marked for today." };

    /* GPS rule (fails closed: if the rule exists but the location module is missing, check-in is refused) */
    let locationMeta = null;
    const ruleOn = window.OTLocation ? !!window.OTLocation.getRule(emp.centerId) : (C.GEOFENCE && C.GEOFENCE.ENABLED && C.GEOFENCE.OFFICES && C.GEOFENCE.OFFICES[emp.centerId]);
    if (ruleOn) {
      if (!window.OTLocation) return { ok: false, error: "Location verification is unavailable, so attendance can't be marked right now." };
      const v = window.OTLocation.verify(geo, emp.centerId);
      if (!v.ok) return { ok: false, error: v.message, location: v };
      locationMeta = { verified: true, distanceMeters: Number(v.distance.toFixed(1)), accuracyMeters: Number(v.accuracy.toFixed(1)), verifiedAt: new Date().toISOString() };
    }

    const rec = {
      id, employeeId: empId, centerId: emp.centerId, date, checkIn: now.toISOString(),
      attendanceStatus: OT.classify(now), approvalStatus: "PENDING", approvedBy: null, approvedAt: null,
      createdAt: new Date().toISOString()
    };
    if (locationMeta) rec.location = locationMeta;
    att.push(rec); saveAttendance(att);
    return { ok: true, record: rec };
  };

  /* Remove an employee's attendance record (default today) to allow re-marking and testing */
  OT.removeAttendance = function (empId, date) {
    const targetDate = date || today();
    const id = recordId(empId, targetDate);
    const att = OT.getAttendance();
    const initialLen = att.length;
    const filtered = att.filter(a => !(a.id === id || (a.employeeId === empId && a.date === targetDate)));
    saveAttendance(filtered);
    return { ok: true, removed: initialLen !== filtered.length };
  };

  /* Admin delete attendance record by ID */
  OT.deleteAttendanceRecord = function (user, recordId) {
    if (!user || user.role === "EMPLOYEE") return { ok: false, error: "Not allowed." };
    const att = OT.getAttendance();
    const idx = att.findIndex(a => a.id === recordId);
    if (idx < 0) return { ok: false, error: "Record not found." };
    const rec = att[idx];
    if (!OT.canAccessCenter(user, rec.centerId)) return { ok: false, error: "You can only manage your own center." };
    att.splice(idx, 1);
    saveAttendance(att);
    return { ok: true };
  };

  /* decision: APPROVED | REJECTED | PENDING (reopen). ids = array of record ids */
  OT.decide = function (user, ids, decision) {
    if (!user || user.role === "EMPLOYEE") return { ok: false, error: "Not allowed.", count: 0 };
    const set = new Set(ids);
    let count = 0;
    const att = OT.getAttendance();
    att.forEach(a => {
      if (!set.has(a.id) || !OT.canAccessCenter(user, a.centerId)) return;
      a.approvalStatus = decision;
      a.approvedBy = decision === "PENDING" ? null : user.id;
      a.approvedAt = decision === "PENDING" ? null : new Date().toISOString();
      count++;
    });
    saveAttendance(att);
    return { ok: count > 0, count };
  };

  /* ==========================================================
     SUMMARIES / REPORTS
     ========================================================== */
  /* Monthly summary for one employee.
     - Days counted: working days from max(month start, join date) up to yesterday (+ today once checked in)
       and any weekend day that has a record.
     - Rejected check-ins are not credited; Pending ones count provisionally. */
  OT.monthSummary = function (emp, mk, records) {
    const { start, end } = monthRange(mk);
    const t = today();
    const from = emp.joinDate && emp.joinDate > start ? emp.joinDate : start;
    const to = end < t ? end : t;
    const byDate = {};
    records.forEach(r => { if (r.employeeId === emp.id) byDate[r.date] = r; });
    const s = { workingDays: 0, present: 0, half: 0, absent: 0, rejected: 0, pending: 0, approved: 0 };
    if (from <= to) {
      eachDate(from, to).forEach(d => {
        const r = byDate[d];
        if (r) {
          s.workingDays++;
          if (r.approvalStatus === "REJECTED") s.rejected++;
          else if (r.attendanceStatus === "PRESENT") s.present++;
          else s.half++;
          if (r.approvalStatus === "PENDING") s.pending++;
          if (r.approvalStatus === "APPROVED") s.approved++;
        } else if (isWorkingDay(d) && d < t) { s.workingDays++; s.absent++; }
      });
    }
    s.percent = s.workingDays ? Math.round(((s.present + s.half * 0.5) / s.workingDays) * 100) : 0;
    return s;
  };

  OT.sumSummaries = function (list) {
    const t = { workingDays: 0, present: 0, half: 0, absent: 0, rejected: 0, pending: 0, approved: 0 };
    list.forEach(s => Object.keys(t).forEach(k => (t[k] += s[k])));
    t.percent = t.workingDays ? Math.round(((t.present + t.half * 0.5) / t.workingDays) * 100) : 0;
    return t;
  };

  /* Per-employee monthly rows for a user's scope */
  OT.monthRows = function (user, centerFilter, mk) {
    const att = OT.attendanceFor(user, null);
    const { start, end } = monthRange(mk);
    return OT.employeesFor(user, centerFilter).map(emp => {
      const recs = att.filter(a => a.employeeId === emp.id && a.date >= start && a.date <= end);
      return { emp, s: OT.monthSummary(emp, mk, recs) };
    }).filter(r => r.emp.status === "ACTIVE" || r.s.workingDays > 0 && r.s.present + r.s.half + r.s.rejected > 0);
  };

  /* Center-wise monthly roll-up (Super Admin report) */
  OT.centerMonthRows = function (mk) {
    return C.LOCATIONS.map(l => {
      const rows = OT.monthRows({ role: "SUPER_ADMIN" }, l.id, mk);
      return { center: l, employees: rows.length, s: OT.sumSummaries(rows.map(r => r.s)) };
    });
  };

  /* Center-wise snapshot for a single day */
  OT.centerDayRows = function (date) {
    const emps = OT.getEmployees(), att = OT.getAttendance().filter(a => a.date === date);
    const working = isWorkingDay(date);
    return C.LOCATIONS.map(l => {
      const active = emps.filter(e => e.centerId === l.id && e.status === "ACTIVE");
      const ids = new Set(active.map(e => e.id));
      const recs = att.filter(a => a.centerId === l.id);
      const marked = recs.filter(a => ids.has(a.employeeId));
      const row = {
        center: l, employees: active.length,
        present: recs.filter(a => a.attendanceStatus === "PRESENT" && a.approvalStatus !== "REJECTED").length,
        half: recs.filter(a => a.attendanceStatus === "HALF DAY" && a.approvalStatus !== "REJECTED").length,
        pending: recs.filter(a => a.approvalStatus === "PENDING").length,
        approved: recs.filter(a => a.approvalStatus === "APPROVED").length,
        rejected: recs.filter(a => a.approvalStatus === "REJECTED").length,
        notMarked: working ? active.length - marked.length : 0
      };
      row.rate = active.length ? Math.round((marked.length / active.length) * 100) : 0;
      return row;
    });
  };
})();
