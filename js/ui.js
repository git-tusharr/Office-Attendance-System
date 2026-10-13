/* ==========================================================
   OfficeTrack — small UI helpers shared by all pages
   Exposes window.UI
   ========================================================== */
(function () {
  const loc = window.OT_CONFIG.OFFICE.LOCALE;
  const UI = (window.UI = {});

  UI.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  UI.fmtDate = d => new Date(d + "T00:00:00").toLocaleDateString(loc, { day: "2-digit", month: "short", year: "numeric" });
  UI.fmtTime = (iso, secs) => new Date(iso).toLocaleTimeString(loc, secs ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : { hour: "2-digit", minute: "2-digit" });
  UI.fmtLongDate = d => d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  UI.fmtMonth = mk => new Date(mk + "-01T00:00:00").toLocaleDateString(loc, { month: "long", year: "numeric" });
  UI.fmt12 = hhmm => { const [h, m] = hhmm.split(":").map(Number); return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

  UI.cls = s => ({ "PRESENT": "present", "APPROVED": "approved", "HALF DAY": "half", "REJECTED": "rejected", "PENDING": "pending", "ABSENT": "rejected", "INACTIVE": "inactive", "ACTIVE": "present" }[s] || "pending");
  UI.badge = s => `<span class="status ${UI.cls(s)}">${UI.esc(s)}</span>`;

  UI.fillSelect = (sel, options, selected) => {
    sel.innerHTML = options.map(o => `<option value="${UI.esc(o.value)}"${o.value === selected ? " selected" : ""}>${UI.esc(o.label)}</option>`).join("");
  };

  UI.toast = function (msg, type) {
    let box = document.getElementById("toastBox");
    if (!box) { box = document.createElement("div"); box.id = "toastBox"; box.className = "toast-box"; document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast " + (type || "success"); t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  };

  /* Modal: UI.modal({title, body, onClose}) -> element; UI.closeModal() */
  UI.modal = function (opts) {
    UI.closeModal();
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop"; wrap.id = "modalWrap";
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="panel-head"><h2>${UI.esc(opts.title)}</h2><button type="button" class="modal-x" data-close aria-label="Close">✕</button></div>${opts.body}</div>`;
    wrap.addEventListener("click", e => { if (e.target === wrap || e.target.closest("[data-close]")) UI.closeModal(); });
    document.body.appendChild(wrap);
    document.addEventListener("keydown", escKey);
    return wrap;
  };
  function escKey(e) { if (e.key === "Escape") UI.closeModal(); }
  UI.closeModal = function () { const w = document.getElementById("modalWrap"); if (w) w.remove(); document.removeEventListener("keydown", escKey); };

  UI.downloadCSV = function (filename, rows) {
    const csv = rows.map(r => r.map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
  };

  UI.msg = function (el, text, type) { el.textContent = text; el.className = "message " + (type || "success"); };
})();
