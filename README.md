# OfficeTrack — Multi-Center Employee Attendance System

A **frontend-only working model** built with plain **HTML, CSS and Vanilla JavaScript**.
No framework, no build step, no backend, no database.

It supports **6 office locations**: **Bhopal (Head Office)**, Jabalpur, Gwalior, Ratlam, Ujjain and Nagpur.

## Run it
1. Extract the ZIP.
2. Serve the folder on **localhost** (needed for GPS check-in, see below), for example:
   ```
   cd office-track-attendance-system
   python3 -m http.server 8000
   ```
   then open <http://localhost:8000> (VS Code + Live Server also works).

No installation or build step is needed. Everything except Bhopal check-in also works if you simply double-click `index.html`, but browsers may block or not remember location permission on `file://` pages, so use localhost or HTTPS for Bhopal check-in.

## Demo logins

### Super Admin (Bhopal Head Office — sees all 6 centers)
| ID | Password |
|---|---|
| `admin` | `admin123` |

### Center Admins (each sees ONLY their own center)
| Center | ID | Password |
|---|---|---|
| Bhopal | `bhopal.admin` | `center123` |
| Jabalpur | `jabalpur.admin` | `center123` |
| Gwalior | `gwalior.admin` | `center123` |
| Ratlam | `ratlam.admin` | `center123` |
| Ujjain | `ujjain.admin` | `center123` |
| Nagpur | `nagpur.admin` | `center123` |

Admin login: `admin-login.html`. The login page lists these credentials; click a row to fill the form.

### Employees (password for all demo employees: `123456`)
| Center | Sample ID | Name |
|---|---|---|
| Bhopal | `EMP001` | Rahul Kumar (original demo user) |
| Jabalpur | `EMP013` | Ashish Pandey |
| Gwalior | `EMP021` | Abhishek Tomar |
| Ratlam | `EMP028` | Mohit Jain |
| Ujjain | `EMP034` | Vikas Parmar |
| Nagpur | `EMP041` | Rahul Deshmukh |

All 48 demo employees (EMP001–EMP048) can log in with `123456`. You can also sign in with the employee's email. The employee login page has one-click chips for each center.

## What each role can do
**Super Admin**
- Consolidated dashboard with today's statistics for all 6 centers (employees, present, half day, not marked, pending, check-in rate).
- **Center filter** (top right) re-scopes every view. Click a row in the center table to filter by that center.
- Approve / reject / reopen attendance for any center. "Approve All Shown" for bulk approval.
- Employees: add, edit, activate/deactivate, and **transfer between centers**.
- Reports: center-wise monthly summary + per-employee monthly summary, with CSV export.
- Reset Demo Data.

**Center Admin**
- Sees and manages only their own center's employees, attendance, approvals and reports.
- New employees are always created in their own center. They cannot transfer employees away or touch other centers' records (also enforced in the data layer, not just hidden in the UI).

**Employee**
- Check in once per day (Bhopal employees must pass the GPS check above), see monthly stats, attendance history (filter by month / approval status) and approval status (Pending / Approved / Rejected, plus who reviewed it).
- Self-registration at `register.html` (choose your center).

## GPS check-in verification (Bhopal office only)
Employees of the **Bhopal** center must be physically at the office to check in. Other centers (Jabalpur, Gwalior, Ratlam, Ujjain, Nagpur) are **not restricted yet** and behave exactly as before; no coordinates have been invented for them.

**Configured location** (`GEOFENCE.OFFICES.BPL` in `js/config.js`):

| Setting | Value |
|---|---|
| Latitude | `23.231264` |
| Longitude | `77.435580` |
| Allowed radius | `20` metres (`radiusMeters`) |
| Max GPS error accepted | `±25` metres (`maxAccuracyMeters`) |

**How it works**
1. When a Bhopal employee clicks **Mark Attendance**, the browser asks for location permission (`navigator.geolocation.getCurrentPosition`, high accuracy, 20 s timeout, no cached position).
2. The distance to the office is calculated with the **Haversine formula** (`js/location.js`).
3. If the GPS accuracy is worse than ±25 m the employee is asked to **retry** (they are not treated as "outside"), and attendance is not saved.
4. If the distance is more than 20 m, check-in is blocked with the distance shown. If it is 20 m or less (and accuracy is acceptable), attendance is saved with the distance and accuracy.
5. Permission denied, GPS unavailable, timeout, insecure page and unsupported-browser cases each show a clear message and a **Retry location check** button. Attendance is never saved unless the location is verified.
6. The check is also enforced in the data layer (`OT.markAttendance` in `js/store.js`), which re-verifies a fresh reading before saving. Records store `location: { verified, distanceMeters, accuracyMeters, verifiedAt }` (raw coordinates are not stored).

**Staircase / floor:** the office is on the 3rd floor. GPS measures **horizontal** distance only, so the staircase area below the office works as long as it is within the radius. GPS cannot tell which floor someone is on.

### Changing the location or radius
Edit `js/config.js`:
```js
GEOFENCE: {
  ENABLED: true,                // false = switch the GPS restriction off everywhere
  OFFICES: {
    BPL: { label: "Bhopal office", latitude: 23.231264, longitude: 77.435580,
           radiusMeters: 20, maxAccuracyMeters: 25 }
  },
  TIMEOUT_MS: 20000,
  MAX_READING_AGE_MS: 60000
}
```
- Change `radiusMeters` to widen/narrow the allowed area. Because GPS indoors is often ±10–30 m, a 20 m radius can reject people who really are inside; if that happens, raise the radius or test on-site.
- To restrict another center later, add an entry keyed by its id from `LOCATIONS` (e.g. `JBP`) with that office's **real** coordinates.

### Setup for GPS to work
- Browsers only provide location on **HTTPS** pages or **http://localhost**. Opening the app over a plain `http://` network address will be blocked. For phones, host the folder on an HTTPS site (e.g. GitHub Pages or Netlify).
- Employees must tap **Allow** when the browser asks, and have GPS / Location Services turned on. If permission was blocked, re-allow it in the browser's site settings, then tap Retry.
- If the building gives weak GPS, standing near a window or on the staircase landing usually helps.

### Limitations of browser-based GPS verification
- **It can be spoofed.** The location comes from the user's own device and the code runs in their browser. Fake-GPS apps, browser developer tools (location override), or editing localStorage can defeat it. It is a deterrent against honest mistakes and casual misuse, **not** a secure control.
- Attendance data lives in localStorage and the check runs client-side; there is no server to validate readings or timestamps.
- GPS accuracy varies (often ±10–50 m indoors), so valid check-ins may need a retry and borderline ones may be refused.
- It cannot detect the floor (horizontal distance only) or whether the person is really the employee.
- Genuinely tamper-resistant verification needs a backend that records server-side time and validates the check-in (and, ideally, extra signals such as Wi-Fi/QR at the office or manager approval).

## Attendance rules (configurable in `js/config.js`)
- Office starts **09:00 AM**.
- Check-in up to and including **09:15** → **PRESENT**; the comparison is by minute, so 09:15:59 is still Present and 09:16 is **HALF DAY**.
- **One record per employee per date**: enforced by a unique record key (`EMPID_YYYY-MM-DD`) and checked on every check-in, including from a second tab.
- New records start **PENDING**; the center admin (or Super Admin) approves or rejects them.
- Absent = a working day (Mon–Fri) with no record. Today is never counted as absent.
- Monthly summaries: pending check-ins count provisionally; **rejected** check-ins are shown separately and are not credited. Attendance % = (Present + ½ × Half Day) ÷ working days.
- Dates use your computer's **local** time. The original version used UTC, which could assign the wrong date in India.

### Testing the 09:15 rule at any time of day
The employee dashboard has a **Demo tool** time box. Enter e.g. `09:16` and click *Mark Attendance*. Leave it blank to use the real time. This is for demonstration only.

## Sample data
On first load the app creates 48 employees across the 6 centers (Bhopal 12, Jabalpur 8, Gwalior 7, Ratlam 6, Ujjain 7, Nagpur 8) and about 45 days of attendance history: present, half-day, absent, approved, rejected and pending. Recent days contain pending items so approvals can be tested at every center. On later days, the history for the demo employees is topped up automatically. **Reset Demo Data** (Super Admin, dashboard) rebuilds everything. `EMP001` has no record for today so you can test check-in right away.

## Project structure
```
index.html, login.html, admin-login.html, register.html
employee-dashboard.html, admin-dashboard.html
css/style.css          – original design + small additions for new components
js/config.js           – CENTRAL CONFIG: 6 locations, office rules, GPS geofence (Bhopal), departments, demo admins
js/location.js         – GPS: Geolocation API wrapper, Haversine distance, verification rules
js/demo-data.js        – demo employee roster
js/store.js            – data layer & business rules (localStorage, auth, attendance, reports)
js/ui.js               – shared UI helpers (formatting, toast, modal, CSV)
js/auth.js             – login & registration pages
js/employee.js         – employee dashboard
js/admin.js            – Super Admin / Center Admin dashboard
```
To add or rename a center, edit `LOCATIONS` (and `ADMINS`) in `js/config.js`.

## Changes vs. the original ZIP
- Single-office → 6 centers; every employee has a center; attendance records store the center.
- One admin → Super Admin + 6 Center Admins (the original `admin` / `admin123` is now the Super Admin).
- New admin views: Dashboard, Approvals, Attendance, Employees, Reports.
- Fixes: UTC date bug, "Working Days"/"Absent" counts on the employee page (now this month's working days), unescaped HTML in tables, `admin`-only guard that did not check roles, and approving unrelated records.
- Existing `ot_*` localStorage data from the old version is migrated: extra employees are kept and assigned to Bhopal; old demo attendance is replaced.

## Changes: GPS verification update
- New `js/location.js`; new `GEOFENCE` object in `js/config.js`.
- `js/store.js`: `OT.markAttendance(empId, at, geo)` now refuses Bhopal check-in without a valid, fresh, in-range location reading.
- `js/employee.js` / `employee-dashboard.html`: location check on *Mark Attendance*, plus a distance/accuracy line and a *Retry location check* button (hidden unless needed).
- `css/style.css`: two small message styles (`.message.info`, `.message.warning`). Layout, colours and navigation are otherwise unchanged.
- The app has no separate check-out feature, so none was added.

## ⚠️ Important: localStorage is for demonstration only
This is a frontend working model. All data (employees, attendance, approvals) lives in your browser's **localStorage**:
- It is **not shared** between browsers, computers or offices. Each browser sees its own separate copy, so a Jabalpur admin on another machine will **not** see check-ins made in Bhopal.
- It can be edited by anyone using browser developer tools; passwords are stored in plain text and logins are not secure.
- Clearing site data erases it (use Reset Demo Data to restore the samples).
- Browser time is used for check-ins.

For real use across the 6 offices you need a backend and a database with real authentication, server-side time and a unique constraint on (employee, date), plus audit logs.
