# OfficeTrack — Multi-Center Employee Attendance System

A **frontend-only working model** built with plain **HTML, CSS and Vanilla JavaScript**.
No framework, no build step, no backend, no database.

It supports **6 office locations**: **Bhopal (Head Office)**, Jabalpur, Gwalior, Ratlam, Ujjain and Nagpur.

## Run it
1. Extract the ZIP.
2. Double-click `index.html` (or open it with VS Code + Live Server).

No installation needed. Works offline in any modern browser.

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
- Check in once per day, see monthly stats, attendance history (filter by month / approval status) and approval status (Pending / Approved / Rejected, plus who reviewed it).
- Self-registration at `register.html` (choose your center).

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
js/config.js           – CENTRAL CONFIG: 6 locations, office rules, departments, demo admins
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

## ⚠️ Important: localStorage is for demonstration only
This is a frontend working model. All data (employees, attendance, approvals) lives in your browser's **localStorage**:
- It is **not shared** between browsers, computers or offices. Each browser sees its own separate copy, so a Jabalpur admin on another machine will **not** see check-ins made in Bhopal.
- It can be edited by anyone using browser developer tools; passwords are stored in plain text and logins are not secure.
- Clearing site data erases it (use Reset Demo Data to restore the samples).
- Browser time is used for check-ins.

For real use across the 6 offices you need a backend and a database with real authentication, server-side time and a unique constraint on (employee, date), plus audit logs.
