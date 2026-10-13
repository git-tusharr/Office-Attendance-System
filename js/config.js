/* ==========================================================
   OfficeTrack — central configuration
   Everything that describes the organisation lives here:
   locations, office timing rules, departments and demo admins.
   ========================================================== */
window.OT_CONFIG = {
  APP_NAME: "OfficeTrack",

  /* localStorage keys */
  STORAGE: {
    EMPLOYEES: "ot_employees",
    ATTENDANCE: "ot_attendance",
    SESSION: "ot_session",
    META: "ot_meta"
  },

  /* Bump this to force demo data to be rebuilt on next load */
  DATA_VERSION: 2,

  /* Attendance rules */
  OFFICE: {
    START: "09:00",          // office start time (24h)
    PRESENT_CUTOFF: "09:15", // check-in up to and including this minute = PRESENT, later = HALF DAY
    WORKING_DAYS: [1, 2, 3, 4, 5], // Mon–Fri (0 = Sunday)
    LOCALE: "en-IN"
  },

  /* How many weekdays of history the demo data generates */
  DEMO_HISTORY_DAYS: 45,
  DEMO_EMPLOYEE_PASSWORD: "123456",

  DEPARTMENTS: ["Development", "Sales", "Marketing", "HR", "Operations", "Accounts"],

  /* The 6 office locations. Bhopal is the Head Office. */
  LOCATIONS: [
    { id: "BPL", name: "Bhopal",   state: "Madhya Pradesh", isHeadOffice: true  },
    { id: "JBP", name: "Jabalpur", state: "Madhya Pradesh", isHeadOffice: false },
    { id: "GWL", name: "Gwalior",  state: "Madhya Pradesh", isHeadOffice: false },
    { id: "RTM", name: "Ratlam",   state: "Madhya Pradesh", isHeadOffice: false },
    { id: "UJN", name: "Ujjain",   state: "Madhya Pradesh", isHeadOffice: false },
    { id: "NGP", name: "Nagpur",   state: "Maharashtra",    isHeadOffice: false }
  ],

  /* Demo admin accounts (plain text — demo only!).
     SUPER_ADMIN sees every center. CENTER_ADMIN is locked to centerId. */
  ADMINS: [
    { id: "admin",           name: "Rajesh Verma",  role: "SUPER_ADMIN",  centerId: "BPL", password: "admin123"  },
    { id: "bhopal.admin",    name: "Anita Sharma",  role: "CENTER_ADMIN", centerId: "BPL", password: "center123" },
    { id: "jabalpur.admin",  name: "Sunil Pandey",  role: "CENTER_ADMIN", centerId: "JBP", password: "center123" },
    { id: "gwalior.admin",   name: "Meena Tomar",   role: "CENTER_ADMIN", centerId: "GWL", password: "center123" },
    { id: "ratlam.admin",    name: "Rakesh Jain",   role: "CENTER_ADMIN", centerId: "RTM", password: "center123" },
    { id: "ujjain.admin",    name: "Kiran Joshi",   role: "CENTER_ADMIN", centerId: "UJN", password: "center123" },
    { id: "nagpur.admin",    name: "Vinod Deshmukh",role: "CENTER_ADMIN", centerId: "NGP", password: "center123" }
  ],

  ROLE_LABELS: { SUPER_ADMIN: "Super Admin", CENTER_ADMIN: "Center Admin", EMPLOYEE: "Employee" }
};
