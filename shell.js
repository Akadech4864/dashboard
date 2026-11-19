"use strict";
/* โครงแอพรุ่นใหม่ (ผู้สั่งงาน 19 พ.ย. 69 "แบบแอพระดับโลก คอม-มือถือคนละหน้าตา ธีมเดียวกัน")
   คอม: เมนูเต็มด้านซ้าย + แถบย่อย (บทของสรุปทางการ / รายชื่อผู้ต้องหา / หน้าในกลุ่มเดียวกัน) + ปุ่มย้อนกลับ
   มือถือ: แถบล่าง 5 ไอคอน + เมนู 3 ขีด + ค้นหา + ตั้งค่า
   หน้าใหม่: home (เรื่องราวคดี) / brief (สรุปทางการแบบโต้ตอบ) / recs (ข้อเสนอแนะ แก้ไขได้) + โหมดนำเสนอ + ค้นหาอัจฉริยะ + ตั้งค่าการแสดงผล
   ห้ามมีชื่อบุคคล/คดีในไฟล์นี้ (deploy_site.sh ตรวจ) — ชื่อทั้งหมดมาจาก DB ที่ถอดรหัสแล้ว */
Object.assign(ICP, {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  star: '<polygon points="12 2 15.1 8.6 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 8.9 8.6 12 2"/>',
  print: '<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
  pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  fx: '<path d="M3 4h18l-7 9v6l-4 2v-8z"/><path d="M16 16l5 5M21 16l-5 5"/>',
  xls: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  csv: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 13.5l4 4M13.5 13.5l-4 4"/>',
  shrink: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  more: '<path d="M6 9l6 6 6-6"/>',
  less: '<path d="M6 15l6-6 6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  swap: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
});

/* ---------- ตั้งค่าการแสดงผล ---------- */
function savePref() { try { localStorage.setItem("cib_prefs", JSON.stringify(PREF)); } catch (e) { } }
function applyPrefs() {
  const sysDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const th = PREF.theme === "dark" || (PREF.theme === "auto" && sysDark) ? "dark" : "light";
  document.documentElement.dataset.theme = th;
  document.documentElement.dataset.fs = PREF.fs || "m";
  if (window.Chart) { Chart.defaults.color = th === "dark" ? "#C9D4E3" : "#3A4A5E"; Chart.defaults.borderColor = th === "dark" ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.08)"; Chart.defaults.font.family = '"Sarabun","Leelawadee UI",sans-serif'; }
}
applyPrefs();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (PREF.theme === "auto") { applyPrefs(); if (DB) render(); } });
const PDEF = { money: "m", theme: "light", chartLab: "name", fs: "m" };
const seg = (k, opts) => `<div class="seg" data-pk="${k}">${opts.map(([v, l]) => `<button data-pv="${v}" class="${(PREF[k] ?? PDEF[k] ?? opts[0][0]) === v ? "on" : ""}">${l}</button>`).join("")}</div>`;
function openPrefs() {
  const s = $("#prefs");
  s.querySelector(".sheet-body").innerHTML = `
    <div class="ps"><b>${IC("coin", 18)} ตัวเลขเงิน</b>${seg("money", [["m", "ล้าน (1.25 ล.)"], ["auto", "ย่ออัตโนมัติ (แสน / ล้าน)"], ["full", "เต็ม (1,250,000.00)"]])}
      <label class="tg"><input type="checkbox" data-pc="tblShort" ${PREF.tblShort ? "checked" : ""}> ใช้ตัวเลขย่อในตารางด้วย</label></div>
    <div class="ps"><b>${IC("img", 18)} ธีม</b>${seg("theme", [["light", "สว่าง"], ["dark", "มืด"], ["auto", "ตามเครื่อง"]])}</div>
    <div class="ps"><b>${IC("flow", 18)} ป้ายในชาร์ตเส้นเงิน</b>${seg("chartLab", [["name", "ชื่อบัญชี"], ["acc", "เลขบัญชี"], ["both", "ชื่อ + เลขบัญชี"]])}
      <label class="tg"><input type="checkbox" data-pc="flAuto" ${PREF.flAuto !== false ? "checked" : ""}> คลี่ทอดถัดไปอัตโนมัติให้ครบจำนวนคอลัมน์ที่เลือก</label></div>
    <div class="ps"><b>${IC("doc", 18)} ขนาดตัวอักษร</b>${seg("fs", [["s", "เล็ก"], ["m", "ปกติ"], ["l", "ใหญ่"]])}</div>
    <div class="ps"><b>${IC("db", 18)} ข้อมูล</b><div class="pbtns">
      <button class="btn o${document.body.classList.contains("edit") ? " on" : ""}" id="editBtn">${IC("edit", 16)} โหมดแก้ไขเนื้อหา</button>
      <button class="btn o" id="setBtn">${IC("db", 16)} ฐานข้อมูล Google Sheet</button>
      <button class="btn o" id="outBtn">${IC("out", 16)} ออกจากระบบ</button></div>
      <small class="muted">ข้อมูล ณ ${dTh(DB.made)} ${DB.made.slice(11)}</small></div>`;
  s.hidden = false; requestAnimationFrame(() => s.classList.add("open"));
  s.onclick = (e) => {
    if (e.target === s || e.target.closest("[data-close]")) return closePrefs();
    const b = e.target.closest("[data-pv]");
    if (b) { const k = b.parentNode.dataset.pk; PREF[k] = b.dataset.pv; savePref(); applyPrefs(); $$("button", b.parentNode).forEach((x) => x.classList.toggle("on", x === b)); ACCNO = ACCNO; render(); return; }
    if (e.target.id === "editBtn") { document.body.classList.toggle("edit"); e.target.classList.toggle("on"); toast(document.body.classList.contains("edit") ? "เปิดโหมดแก้ไข — กดปุ่ม แก้ไข / + เพิ่ม ในแต่ละหน้า" : "ปิดโหมดแก้ไข"); return; }
    if (e.target.id === "setBtn") { closePrefs(); return SETDB(); }
    if (e.target.id === "outBtn") { try { sessionStorage.removeItem("cib_k"); } catch (e2) { } location.reload(); }
  };
  s.onchange = (e) => { const c = e.target.closest("[data-pc]"); if (c) { PREF[c.dataset.pc] = c.checked; savePref(); render(); } };
}
function closePrefs() { const s = $("#prefs"); s.classList.remove("open"); setTimeout(() => (s.hidden = true), 200); }

/* ---------- เมนู ---------- */
const GROUPS = [["", ["home", "brief", "case"]], ["สืบสวนเส้นเงิน", ["ana", "acct", "cc", "over"]], ["ดำเนินคดี", ["recs", "asset", "work", "defences", "srch"]], ["เอกสาร", ["img"]]];
const BNAV = ["home", "brief", "ana", "acct", "asset"];
const BNAV_L = { home: "หน้าแรก", brief: "สรุป", ana: "เส้นเงิน", acct: "บัญชี", asset: "ทรัพย์สิน" };
const tabOf = (k) => TABS.find((t) => t[0] === k) || [k, k, "doc"];
function shellInit() {
  $("#menuBtn").innerHTML = IC("menu", 22); $("#backBtn").innerHTML = IC("back", 22); $("#prefBtn").innerHTML = IC("gear", 21);
  $("#srchBtn").innerHTML = `${IC("search", 18)}<span class="sb-t">ค้นหา ชื่อ · เลขบัญชี · ยอดเงิน · หน้า</span><kbd>Ctrl K</kbd>`;
  $("#tabs").innerHTML = `<div class="side-hd"><img src="logo.jpg" alt=""><b>${esc(DB.case || "")}</b><button class="ib" id="drawerX" aria-label="ปิดเมนู">${IC("x", 20)}</button></div>` +
    GROUPS.map(([g, ks]) => `${g ? `<div class="side-g">${g}</div>` : ""}` + ks.map((k) => { const [, l, ic] = tabOf(k); return `<button data-t="${k}">${IC(ic, 20)}<span class="tx"><span>${l}</span><small></small></span>${SUBS[k] ? `<span class="car" data-car="${k}" role="button" aria-label="แสดงหน้าย่อย"></span>` : ""}</button>` + (SUBS[k] ? `<div class="side-sub" data-sub="${k}"></div>` : ""); }).join("")).join("") +
    `<div class="side-g">ตั้งค่า</div><button data-x="pref">${IC("gear", 20)}<span class="tx"><span>ตั้งค่าการแสดงผล</span><small>ตัวเลข · ธีม · ชาร์ต</small></span></button>`;
  $("#bnav").innerHTML = BNAV.map((k) => `<button data-t="${k}">${IC(tabOf(k)[2], 22)}<span>${BNAV_L[k]}</span></button>`).join("");
  const nav = (e) => {
    const car = e.target.closest("[data-car]");
    if (car) { e.stopPropagation(); const k = car.dataset.car; SEXP.has(k) ? SEXP.delete(k) : SEXP.add(k); sideSubs(); return; }
    const b = e.target.closest("button"); if (!b) return; if (b.id === "drawerX") return drawer(false);
    if (b.dataset.sgo) { const [t, v, s] = b.dataset.sgo.split("|"); if (t === "brief") { BRV = v || BRV; if (s) BRS = s; } else if (t === "acct") { ACS = s || ACS; } else if (t === "cc") { CCV = s || CCV; } drawer(false); go(t); window.scrollTo(0, 0); return; } if (b.dataset.x === "pref") { drawer(false); return openPrefs(); } if (b.dataset.t) { drawer(false); go(b.dataset.t); } };
  $("#tabs").onclick = nav; $("#bnav").onclick = nav;
  $("#menuBtn").onclick = () => drawer(true); $("#drawerMask").onclick = () => drawer(false);
  $("#prefBtn").onclick = openPrefs; $("#srchBtn").onclick = openSearch;
  $("#backBtn").onclick = () => history.back();
  $("#sub").onclick = (e) => { const b = e.target.closest("[data-sgo]"); if (!b) return; const [t, v, s] = b.dataset.sgo.split("|"); if (t === "brief") { BRV = v || BRV; if (s) BRS = s; } go(t); };
  addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
    else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
    else if (e.key === "Escape") { if (!$("#search").hidden) closeSearch(); else if (!$("#prefs").hidden) closePrefs(); else if (document.body.classList.contains("present")) presentOff(); }
    else if (document.body.classList.contains("present") && (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ")) { e.preventDefault(); presentStep(1); }
    else if (document.body.classList.contains("present") && (e.key === "ArrowLeft" || e.key === "PageUp")) { e.preventDefault(); presentStep(-1); }
  });
  addEventListener("popstate", (e) => { const t = (e.state && e.state.t) || (location.hash || "#home").slice(1); if (e.state && e.state.v) BRV = e.state.v; NAVD = Math.max(0, NAVD - 1); go(t, true); });
}
function drawer(on) { document.body.classList.toggle("drawer", on); $("#drawerMask").hidden = !on; }
let NAVD = 0;                                                            // จำนวนหน้าที่ย้อนกลับได้
function shellSync() {
  $$("#tabs button[data-t], #bnav button").forEach((b) => b.classList.toggle("on", b.dataset.t === TAB));
  $("#backBtn").hidden = NAVD <= 0;
  const [, l] = tabOf(TAB); $("#pageTitle").textContent = TAB === "home" ? (DB.case || "") : l;
  document.body.dataset.tab = TAB;
  subPanel();
}
/* หน้าย่อยคลี่ออกจากเมนูซ้ายแบบหุบได้ มีสามเหลี่ยมเล็กบอกว่ามีหน้าย่อย (ผู้ใช้สั่ง 19 พ.ย. 69 แทนแถบย่อยแยกคอลัมน์) */
const SUBS = {
  brief: () => BRCH.map(([k, l, ic]) => ({ go: `brief|${k}`, l, ic, on: TAB === "brief" && BRV === k,
    kids: k === "sus" && TAB === "brief" && BRV === "sus" && DB.formal ? susKeys().map((s) => ({ go: `brief|sus|${s}`, l: shortName(DB.formal.suspects[s].name), no: DB.formal.suspects[s].no, on: BRS === s })) : null })),
  acct: () => ACS_T.map(([k, l, ic]) => ({ go: `acct||${k}`, l, ic, on: TAB === "acct" && ACS === k })),
  cc: () => CCV_T.map(([k, l, ic]) => ({ go: `cc||${k}`, l, ic, on: TAB === "cc" && CCV === k })),
};
const SEXP = new Set(); let SLAST = "";
function sideSubs() {
  if (TAB !== SLAST) { SEXP.clear(); if (SUBS[TAB]) SEXP.add(TAB); SLAST = TAB; }   // เปิดหน้าใดคลี่หน้าย่อยของหน้านั้น หุบของหน้าอื่น
  Object.keys(SUBS).forEach((k) => {
    const box = $(`#tabs [data-sub="${k}"]`), btn = $(`#tabs button[data-t="${k}"]`); if (!box) return;
    const op = SEXP.has(k); btn.classList.toggle("exp", op); box.classList.toggle("open", op);
    box.innerHTML = op ? SUBS[k]().map((x) => `<button data-sgo="${x.go}" class="${x.on ? "on" : ""}">${IC(x.ic, 16)}<span>${esc(x.l)}</span></button>` +
      (x.kids ? `<div class="side-sub3">${x.kids.map((c) => `<button data-sgo="${c.go}" class="${c.on ? "on" : ""}"><span class="no">${c.no}</span><span>${esc(c.l)}</span></button>`).join("")}</div>` : "")).join("") : "";
  });
}
function subPanel() {
  const el = $("#sub"); el.innerHTML = ""; el.hidden = true;           // ไม่ใช้แถบย่อยแยกคอลัมน์แล้ว
  document.body.classList.remove("has-sub");
  sideSubs();
}

/* ---------- ค้นหาอัจฉริยะ ---------- */
const nrm = (s) => nk(s).toLowerCase().replace(/[\s.\-_]/g, "");
let SIX = null;
function searchIndex() {
  if (SIX) return SIX;
  const I = [];
  TABS.forEach(([k, l, ic]) => I.push({ g: "หน้า", ic, t: l, s: "", key: nrm(l), go: () => go(k) }));
  BRCH.forEach(([k, l, ic]) => I.push({ g: "หน้า", ic, t: "สรุปทางการ · " + l, s: "", key: nrm(l), go: () => { BRV = k; go("brief"); } }));
  const X = DB.formal;
  if (X) susKeys().forEach((k) => { const s = X.suspects[k]; I.push({ g: "ผู้ต้องหา", ic: "scale", t: s.name, s: `ผู้ต้องหาที่ ${s.no} · ${s.role.split(" ; ")[0]}`, key: nrm(s.name), go: () => { BRV = "sus"; BRS = k; go("brief"); } }); });
  try { people().forEach((p) => I.push({ g: "บุคคล", ic: "user", t: p.name, s: p.cat || "", key: nrm(p.name), go: () => { PPQ = p.name; ACS = "ppl"; go("acct"); } })); } catch (e) { }
  try { accRows().rows.forEach((r) => I.push({ g: "บัญชี", ic: "bank", t: `${r.name || ""}`, s: `${r.bank || ""} ${fa(r.acc)}${r.stm ? " · มี statement" : ""}`, key: nrm(r.name || "") + " " + dg(r.acc), acc: dg(r.acc), go: () => { ACS = "tbl"; go("acct"); setTimeout(() => accDetail(r.k), 60); } })); } catch (e) { }
  try { tsLand().forEach((r) => I.push({ g: "ทรัพย์สิน", ic: "home", t: `${r.loc || r.no || ""}`, s: `${r.own || ""} ${r.deed ? "โฉนด " + r.deed : ""}`, key: nrm(`${r.loc} ${r.own} ${r.deed} ${r.from}`), go: () => { ASF.q = r.deed || r.loc || ""; go("asset"); } })); } catch (e) { }
  (C.recs || []).forEach((r) => I.push({ g: "ข้อเสนอแนะ", ic: "bulb", t: r.title, s: r.extra2 || "", key: nrm(r.title + " " + r.detail), go: () => go("recs") }));
  (C.events || []).forEach((r) => I.push({ g: "เหตุการณ์", ic: "cal", t: r.title, s: dTh(r.date), key: nrm(r.title + " " + r.detail), go: () => go("case") }));
  try { workRows().forEach((r) => I.push({ g: "งาน", ic: "list", t: r.title || r.t || "", s: r.type || "", key: nrm(`${r.title || r.t || ""} ${r.type || ""}`), go: () => { WF.q = r.title || r.t || ""; go("work"); } })); } catch (e) { }
  return (SIX = I);
}
function amountOf(q) {                                                   // "1,060,312" / "1.5 ล้าน" / "3แสน" -> ตัวเลข
  const m = String(q).replace(/,/g, "").match(/^\s*(\d+(?:\.\d+)?)\s*(ล้าน|ล\.?|แสน|หมื่น|พัน)?\s*(บาท)?\s*$/);
  if (!m) return null; const v = parseFloat(m[1]) * ({ "ล้าน": 1e6, "ล": 1e6, "ล.": 1e6, "แสน": 1e5, "หมื่น": 1e4, "พัน": 1e3 }[m[2]] || 1);
  return m[2] || /[.,]/.test(q) || v >= 1000 ? v : null;
}
function runSearch(q) {
  const out = $("#sres"); q = q.trim();
  if (!q) { out.innerHTML = `<div class="s-tip">${IC("search", 16)} พิมพ์ชื่อบุคคล / เลขบัญชี (อย่างน้อย 4 หลัก) / ยอดเงิน เช่น 1,060,312 หรือ 2.5 ล้าน / ชื่อหน้า</div>`; return; }
  const I = searchIndex(), n = nrm(q), d = q.replace(/\D/g, ""), res = [];
  const isAcc = /^[\d\s-]{4,}$/.test(q) && d.length >= 4;
  const NS = [n, ...Object.entries((DB.formal || {}).alias || {}).filter(([k]) => n.length >= 2 && (nrm(k).includes(n) || n.includes(nrm(k)))).map(([, v]) => nrm(v))];   // ชื่อเล่น -> ชื่อจริง (จากข้อมูลเข้ารหัส)
  const hitN = (s) => NS.some((x) => x && s.includes(x));
  for (const it of I) {
    if (isAcc ? it.acc && it.acc.includes(d.replace(/^0+/, "")) : n && hitN(it.key)) res.push(it);
    if (res.length > 60) break;
  }
  if (!isAcc && n.length >= 2) {                                          // คู่โอนใน statement
    let k = 0;
    for (let ci = 0; ci < DB.cps.length && k < 12; ci++) { const c = DB.cps[ci]; if (hitN(nrm(c[1])) || (d.length >= 4 && dg(c[0]).includes(d))) { k++; res.push({ g: "คู่โอนใน statement", ic: "route", t: c[1] || c[0], s: `${c[2] || ""} ${fa(c[0])} · ${(DB.groups[c[3]] || [0, ""])[1].split(" (")[0]}`, go: () => { if (!F) resetF(); F.q = c[1] || c[0]; go("ana"); } }); } }
  } else if (isAcc) {
    let k = 0;
    for (let ci = 0; ci < DB.cps.length && k < 12; ci++) { const c = DB.cps[ci]; if (dg(c[0]).includes(d.replace(/^0+/, ""))) { k++; res.push({ g: "คู่โอนใน statement", ic: "route", t: c[1] || c[0], s: `${c[2] || ""} ${fa(c[0])}`, go: () => { if (!F) resetF(); F.q = c[0]; go("ana"); } }); } }
  }
  const amt = amountOf(q);
  if (amt) {                                                              // รายการที่ยอดเท่ากัน (± 1 บาท)
    const hit = [];
    for (let i = 0; i < DB.tx.length && hit.length < 15; i++) if (Math.abs(DB.tx[i][3] - amt) <= 1) hit.push(i);
    hit.forEach((i) => { const r = DB.tx[i], a = DB.accounts[r[0]], c = DB.cps[cpOf(i)], day = min2iso(r[1]).slice(0, 10);
      res.unshift({ g: `รายการยอด ${fmt0(amt)} บาท`, ic: "coin", t: `${dTh(day)} · ${DB.kinds[r[2]] || ""} ${fmtFull(r[3])}`, s: `${a.name || a.acc} → ${c[1] || c[0]}`, go: () => { if (!F) resetF(); F.from = F.to = day; F.q = ""; F.accs = new Set([r[0]]); go("ana"); } }); });
  }
  if (!res.length) { out.innerHTML = `<div class="s-tip">ไม่พบ "${esc(q)}"</div>`; return; }
  const gs = [...new Set(res.map((r) => r.g))];
  out.innerHTML = gs.map((g) => `<div class="s-g">${esc(g)}</div>` + res.filter((r) => r.g === g).slice(0, 12).map((r) => `<button class="s-r" data-si="${res.indexOf(r)}">${IC(r.ic, 18)}<span><b>${esc(r.t)}</b><small>${esc(r.s)}</small></span></button>`).join("")).join("");
  out._res = res; SSEL = 0; hiSel();
}
let SSEL = 0;
const hiSel = () => $$("#sres .s-r").forEach((b, i) => b.classList.toggle("on", i === SSEL));
function openSearch() {
  const s = $("#search"); s.hidden = false; const q = $("#sq"); q.value = ""; runSearch(""); setTimeout(() => q.focus(), 30);
  q.oninput = () => runSearch(q.value);
  q.onkeydown = (e) => { const bs = $$("#sres .s-r"); if (e.key === "ArrowDown") { SSEL = Math.min(bs.length - 1, SSEL + 1); hiSel(); e.preventDefault(); } else if (e.key === "ArrowUp") { SSEL = Math.max(0, SSEL - 1); hiSel(); e.preventDefault(); } else if (e.key === "Enter" && bs[SSEL]) bs[SSEL].click(); };
  s.onclick = (e) => { if (e.target === s || e.target.closest("[data-close]")) return closeSearch(); const b = e.target.closest("[data-si]"); if (b) { const r = $("#sres")._res[+b.dataset.si]; closeSearch(); drawer(false); r.go(); } };
}
function closeSearch() { $("#search").hidden = true; }

/* ---------- ตัวช่วย ---------- */
const fa = (a) => { a = String(a || ""); return /^\d{10}$/.test(a) ? `${a.slice(0, 3)}-${a[3]}-${a.slice(4, 9)}-${a[9]}` : a; };
const fmtFull = (x) => Number(x || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pc = (a, b) => (b ? (a / b * 100).toFixed(1) + "%" : "–");
const shortName = (n) => String(n || "").replace(/^(นางสาว|นาย|นาง)/, (m) => ({ "นางสาว": "น.ส.", "นาย": "นาย", "นาง": "นาง" }[m]));
const susKeys = () => Object.keys(DB.formal ? DB.formal.suspects : {}).sort((a, b) => DB.formal.suspects[a].no - DB.formal.suspects[b].no);
const CHC = { F: ["ฉ้อโกงประชาชน", "#B3261E"], C: ["พ.ร.บ.คอมพิวเตอร์", "#1565C0"], M: ["ฟอกเงิน", "#6A1B9A"] };
const chChips = (ch) => ["F", "C", "M"].filter((k) => ch.includes(k)).map((k) => `<span class="cc" style="--c:${CHC[k][1]}">${CHC[k][0]}</span>`).join("");
const SCOL = { pan: "#1B5E20", ath: "#7CB342", tre: "#6A1B9A", prp: "#5D4037", srk: "#795548", prc: "#8D6E63", con: "#8E1B1B", bld: "#D84315" };
const ENTC = { t1: "#1565C0", pco: "#2E7D32", lnd: "#00897B", ctr: "#AD1457", nom: "#00796B", kpk: "#01579B", sst: "#795548", rel_pan: "#558B2F", rel_ath: "#9CCC65", rel: "#827717", cash: "#616161", per: "#263238", inv: "#37474F", pub: "#F9A825", oth: "#90A4AE", noacc: "#B0BEC5", cashdep: "#9E9E9E", ...SCOL };
const entLab = (e) => { const X = DB.formal; return X.suspects[e] ? `ผู้ต้องหาที่ ${X.suspects[e].no} ${shortName(X.suspects[e].name)}` : (X.ent[e] || e); };
function photoOf(name) {
  const ph = {}; imgBy((i) => i.cat === "บุคคล").forEach((i) => (ph[nk(i.key)] = i));
  const k = nk(String(name).split("(")[0]); if (ph[k]) return ph[k];
  const f = Object.keys(ph).find((n) => n.length >= 6 && k.length >= 6 && (k.includes(n) || n.includes(k) || n.slice(0, 6) === k.slice(0, 6)));
  return f ? ph[f] : null;
}
const chgOf = (name) => (C.charges || []).find((c) => nk(String(c.title).split("(")[0]).slice(0, 6) === nk(name).replace(/^สาว/, "").slice(0, 6) || nk(c.title).includes(nk(name).slice(0, 6)));
const kpiC = (v, l, s, col, go_) => `<button class="kc"${go_ ? ` data-go="${go_}"` : ""} style="--c:${col || "var(--navy)"}"><span class="v">${v}</span><span class="l">${l}</span>${s ? `<span class="s">${s}</span>` : ""}</button>`;
const secH = (ic, t, sub, extra) => `<h2 class="sh">${IC(ic, 20)} ${t}${sub ? ` <small>${sub}</small>` : ""}${extra || ""}</h2>`;
const tbl = (head, rows, num) => `<div class="tblwrap"><table><thead><tr>${head.map((h, i) => `<th${num && num.includes(i) ? ' class="n"' : ""}>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${num && num.includes(i) ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const labAcc = (lab) => { const m = String(lab || "").match(/^(\S+) (\S+) (.+)$/); return m && /\d/.test(m[2]) ? `${esc(m[3])} <small class="muted">${esc(m[1])} ${esc(fa(m[2]))}</small>` : esc(lab); };
const dtt = (s) => (String(s).length > 10 ? `${dTh(String(s).slice(0, 10))} ${String(s).slice(11, 16)}` : dTh(s));
const ctaRow = (L) => `<div class="cta">${L.map(([go_, ic, l, pri]) => `<button class="btn${pri ? "" : " o"}" ${go_.startsWith("!") ? `data-act="${go_.slice(1)}"` : `data-go="${go_}"`}>${IC(ic, 16)} ${l}</button>`).join("")}</div>`;
function wireGo() {
  $("#main").onclick = (e) => {
    const a = e.target.closest("[data-act]"); if (a) { if (a.dataset.act === "present") presentOn(); else if (a.dataset.act === "print") window.print(); else if (a.dataset.act === "copyrecs") copyRecs(); return; }
    const s = e.target.closest("[data-sus]"); if (s) { BRV = "sus"; BRS = s.dataset.sus; return go("brief"); }
    const c = e.target.closest("[data-ch]"); if (c) { BRV = c.dataset.ch; if (TAB === "brief") { render(); scrollTo(0, 0); history.replaceState({ t: "brief", v: BRV }, "", "#brief"); } else go("brief"); return; }
    const b = e.target.closest("[data-go]"); if (b) { const [t, v] = b.dataset.go.split("|"); if (v) BRV = v; go(t); }
  };
}

/* ---------- ตัวเลขกลาง (สูตรเดียวกับรายงาน / สไลด์ฉบับทางการ) ---------- */
function NUMS() {
  const X = DB.formal, K = X.kpi, S = X.suspects, G = X.groups || {};
  const sum = (o) => Object.values(o || {}).reduce((a, v) => a + (+v || 0), 0);
  const gt = (g, ks) => ks.reduce((a, k) => a + (((G[g] || {}).tot || {})[k] || 0), 0);
  const cashOf = (k) => Object.values((S[k] || {}).cashy || {}).reduce((a, v) => a + v[0], 0);
  const perOf = (k) => Object.values((S[k] || {}).yr || {}).reduce((a, v) => a + (v.out_per || 0), 0);
  const pt = (k) => (S[k] || {}).pt || { amt: 0, f24: 0 };
  const g = (k) => ((X.t1_out[k] || [0])[0]);
  const conToAth = (S.con.to_sus || {}).ath || 0;
  return { X, K, S, G, sum, gt, cashOf, perOf, pt, g, conToAth, susCash: susKeys().reduce((a, k) => a + cashOf(k), 0) };
}

/* ---------- หน้าแรก: เรื่องราวคดี ---------- */
function pHome() {
  if (!DB.formal) return pOver();
  const N_ = NUMS(), { X, K, S } = N_;
  const ph = (n) => { const i = photoOf(n); return i ? thumbEl(i, "av") : `<span class="av ph">${IC("user", 30)}</span>`; };
  const ev = (C.events || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let assets = 0, frz = 0; try { assets = tsSum().reduce((t, s) => t + s.tot[0] + s.tot[1], 0); frz = tsFrz().secs.flatMap((s) => s.rows).reduce((t, r) => t + r.amt, 0); } catch (e) { }
  const pubP = pc(X.kpi.pub, K.t1_out), susP = pc(K.sus_all, K.t1_out);
  $("#main").innerHTML = `
  <section class="hero">
    <div class="hero-t"><span class="eyebrow">สรุปคดี · ข้อมูล ณ ${dTh(DB.made)}</span>
      <h1>${esc(DB.case || "")}</h1>
      <p class="lead">ประชาชนบริจาคเงินเข้าบัญชีรับบริจาค 3 บัญชี <b>${M(K.donor_in)}</b> แต่ใช้เพื่อสาธารณประโยชน์ที่ระบุได้เพียง <b class="y">${pubP}</b> ขณะที่ <b class="y">${susP}</b> ของเงินที่ออก เข้าบัญชีผู้ต้องหาโดยตรง</p>
      ${ctaRow([["brief", "book", "อ่านสรุปทางการ", 1], ["ana", "flow", "ดูเส้นทางเงิน"], ["recs", "bulb", "ข้อเสนอแนะ"], ["!present", "play", "นำเสนอ"]])}</div>
    <div class="hero-k">
      ${kpiC(M(K.donor_in), "เงินบริจาคเข้า 3 บัญชี", `${fmt0(K.donor_n)} ครั้ง`, "#E0A800", "brief|t1")}
      ${kpiC(fmt0((X.donors || {}).unique || 0), "ผู้บริจาคที่ระบุตัวได้ (ราย)", "ผู้เสียหายจำนวนมาก", "#00897B", "brief|don")}
      ${kpiC(M(K.sus_all), "เข้าบัญชีผู้ต้องหาโดยตรง", susP + " ของเงินออก", "#B3261E", "brief|sus")}
      ${kpiC(M(K.cash), "ถอนเป็นเงินสด", "จากบัญชีรับบริจาค", "#616161", "brief|ptn")}
      ${kpiC(M(K.per_inv + K.cc_t1), "ใช้ส่วนตัว / ประกัน / บัตรเครดิต", `รวมชำระบัตร ${M(K.cc_t1)}`, "#E65100", "brief|ptn")}
      ${kpiC(M(K.pub), "สาธารณประโยชน์ที่ระบุได้", pubP + " ของเงินออก", "#1B7A4A", "brief|sum")}
    </div>
  </section>

  ${secH("book", "เกิดอะไรขึ้น", `${C.story.length} ตอน`, addBtn("story"))}
  <div class="story">${C.story.map((s, i) => `<article class="st"><span class="st-n">${i + 1}</span><div><b>${esc(s.title)}</b><p>${esc(s.detail)}</p>${acts2("story", s.id)}</div></article>`).join("")}</div>

  ${secH("scale", "ใครถูกดำเนินคดี", `${susKeys().length} ราย`)}
  <div class="people">${susKeys().map((k) => { const s = S[k], c = chgOf(s.name) || {};
    return `<button class="pc" data-sus="${k}" style="--c:${SCOL[k] || "var(--navy)"}">${ph(s.name)}<span class="pc-no">${s.no}</span>
      <b>${esc(shortName(s.name))}</b><small>${esc(s.role.split(" ; ")[0])}</small><span class="chips">${chChips(s.charges)}</span>
      <span class="pc-v">${s.in_t1 ? `รับเงินบริจาค <b>${M(s.in_t1)}</b>` : `<span class="muted">พบเงินเข้าบัญชีเล็กน้อย</span>`}</span>${c.status ? `<span class="pc-st">${esc(c.status)}</span>` : ""}</button>`; }).join("")}</div>

  <div class="grid2">
    <div>${secH("pie", "เงินบริจาคไปไหน", "ไม่นับการโอนระหว่าง 3 บัญชี")}<div class="card"><div class="chartbox"><canvas id="hDon"></canvas></div><div id="hDonL" class="lg"></div></div></div>
    <div>${secH("route", "เส้นทางเงินหลัก", "บัญชีรับบริจาค → ผู้รับ")}<div class="card flowcard"><div id="hFlow" class="flowbox"></div></div></div>
  </div>

  ${secH("cal", "ลำดับเหตุการณ์", `${ev.length} เหตุการณ์`, addBtn("events"))}
  <div class="tl">${ev.map((e) => `<div class="tl-i"><span class="tl-d">${dTh(e.date)}</span><b>${esc(e.title)}</b><p>${esc(e.detail || "")}</p>${acts2("events", e.id)}</div>`).join("")}</div>

  ${secH("shield", "ทรัพย์สินและการอายัด")}
  <div class="hero-k sm">
    ${kpiC(M(assets), "ทรัพย์สินที่ตรวจพบ", "ตามข้อมูลชุดทำคดี", "#00264D", "asset")}
    ${kpiC(M(frz), "ยอดเงินในบัญชีที่อายัดแล้ว", "", "#1565C0", "asset")}
    ${K.cc_over ? kpiC(M(K.cc_over), "เงินชำระเกินค้างในบัตรเครดิต", "เสนออายัด", "#B3261E", "cc") : ""}
    ${kpiC(fmt0(K.cash_pairs_n), "คู่ถอนสด-ฝากที่จับคู่ได้", M(K.cash_pairs_amt), "#6A1B9A", "brief|ptn")}
  </div>`;
  // เงินบริจาคไปไหน
  const GR = [["ผู้ต้องหา", ["pan", "ath", "tre", "prp", "srk", "prc", "con", "bld"], "#B3261E"], ["ถอนเงินสด", ["cash"], "#616161"], ["ใช้ส่วนตัว / ประกัน / กองทุน", ["per", "inv"], "#263238"],
    ["ญาติ / บริษัท / คนใกล้ชิด", ["rel_pan", "rel_ath", "rel", "pco", "nom", "kpk"], "#558B2F"], ["ผู้รับเหมา / ผู้ขายที่ดิน", ["ctr", "lnd"], "#00897B"], ["บุคคลที่ชุดสืบระบุตัว", ["sst"], "#795548"],
    ["ไม่ระบุผู้รับ / อื่น ๆ", ["noacc", "oth"], "#B0BEC5"], ["สาธารณประโยชน์", ["pub"], "#F9A825"]];
  const v = GR.map(([l, ks, c]) => [l, ks.reduce((a, k) => a + N_.g(k), 0), c]).filter((x) => x[1] > 0);
  const tot = v.reduce((a, x) => a + x[1], 0);
  CH.hDon = new Chart($("#hDon"), { type: "doughnut", data: { labels: v.map((x) => x[0]), datasets: [{ data: v.map((x) => x[1] / 1e6), backgroundColor: v.map((x) => x[2]), borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: "62%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${M(c.raw * 1e6)} (${pc(c.raw * 1e6, tot)})` } } } } });
  $("#hDonL").innerHTML = v.map((x) => `<span><i style="background:${x[2]}"></i>${x[0]} <b>${pc(x[1], tot)}</b></span>`).join("");
  // เส้นทางเงินหลัก
  const R = [...["pan", "ath", "con", "tre", "bld"].map((k) => ({ id: k, lab: entLab(k), sub: "", v: N_.g(k), col: SCOL[k] })),
    { id: "cash", lab: "ถอนเงินสด", sub: "", v: N_.g("cash"), col: "#616161" }, { id: "per", lab: "ใช้ส่วนตัว / ประกัน / กองทุน", sub: "", v: N_.g("per") + N_.g("inv"), col: "#263238" },
    { id: "pub", lab: "สาธารณประโยชน์", sub: "", v: N_.g("pub"), col: "#F9A825" }];
  const oth = K.t1_out - R.reduce((a, x) => a + x.v, 0); R.push({ id: "oth", lab: "บุคคล / ผู้รับอื่น ๆ", sub: "", v: Math.max(0, oth), col: "#B0BEC5" });
  R.forEach((x) => (x.sub = pc(x.v, K.t1_out)));
  const fl = () => miniFlow($("#hFlow"), [{ id: "t1", lab: "บัญชีรับบริจาค 3 บัญชี", sub: `${fmt0(K.donor_n)} ครั้ง`, v: K.t1_out, col: "#1565C0" }], R, R.map((x) => ({ a: "t1", b: x.id, v: x.v, n: 0 })), ["เงินบริจาค", "ไปที่"]);
  fl(); ONRS = fl;
  wireGo();
}

/* ---------- สรุปทางการ (แบบโต้ตอบ) ---------- */
const BRCH = [["sum", "บทสรุป", "star"], ["chg", "ผู้ต้องหาและข้อหา", "scale"], ["t1", "บัญชีรับบริจาค", "bank"], ["don", "ผู้บริจาค (ผู้เสียหาย)", "users"], ["sus", "พฤติการณ์รายผู้ต้องหา", "user"],
  ["ev", "พฤติการณ์ตามเวลา", "clock"], ["ptn", "รูปแบบการฟอกเงิน", "route"], ["grp", "บุคคลที่เกี่ยวข้อง", "users"], ["pend", "บัญชีที่ควรขอ statement", "doc"]];
let BRV = "sum", BRS = "pan";
const WHY = {
  pan: { F: "เจ้าของบัญชีรับบริจาค 2 บัญชีที่ชื่อบัญชีระบุวัตถุประสงค์เพื่อองค์กรและการสร้างมูลนิธิ แต่เงินส่วนใหญ่ไม่ได้ใช้ตามที่ประกาศ", C: "ใช้เพจเผยแพร่เลขบัญชีและข้อความขอรับบริจาค ซึ่งไม่ตรงกับการใช้เงินจริง", M: "รับเงินบริจาคเข้าบัญชีส่วนตัว ชำระบัตรเครดิต ซื้อประกัน / กองทุน และโอนต่อให้ผู้ต้องหาที่ 2" },
  ath: { M: "รับเงินจากบัญชีรับบริจาค ผู้ต้องหาที่ 1 และเครือข่ายผู้รับเหมา แล้วโอนต่อ ถอนเงินสด ซื้อหน่วยลงทุน และจ่ายผู้ขายที่ดินที่มีเงินโอนกลับ" },
  tre: { F: "กรรมการและเหรัญญิก ผู้ดูแลการเงินของมูลนิธิ รับเงินบริจาคเข้าบัญชีส่วนตัว", C: "ต้องพิสูจน์บทบาทในการเผยแพร่ข้อความรับบริจาค", M: "กระจายเงินบริจาคไปยังบุคคลอื่นจำนวนมาก ใช้จ่ายส่วนตัว และถอนเงินสด" },
  con: { M: "รับเงินบริจาค (รวมเงินสดที่ถอนแล้วนำฝาก) แล้วโอนเข้าบัญชีผู้ต้องหาที่ 2 ภายในคืนเดียวกัน แบ่งหลายรายการผ่านบัญชีบริษัทหลายบัญชี" },
  bld: { M: "รับเงินค่าก่อสร้างจากบัญชีรับบริจาค และโอนเข้าบัญชีผู้ต้องหาที่ 2 (ข่าวอ้างว่าคืนเงินราว 12 ล้านบาท ยังรอ statement บัญชีหลัก)" },
  com: { F: "ดำรงตำแหน่งกรรมการ — ต้องพิสูจน์การรับรองบัญชี การอนุมัติจ่าย และการมีส่วนร่วมประกาศรับบริจาค", C: "ต้องพิสูจน์บทบาทในการเผยแพร่ข้อความ", M: "พบเงินเข้าบัญชีเพียงเล็กน้อย — ต้องพิสูจน์การรู้เห็นหรือสั่งการโอนเงิน" },
};
function pBrief() {
  if (!DB.formal) return pOver();
  const N_ = NUMS(), { X, K, S } = N_, i = BRCH.findIndex((c) => c[0] === BRV), ch = BRCH[Math.max(0, i)];
  const nav = `<div class="br-nav only-m">${BRCH.map(([k, l]) => `<button data-ch="${k}" class="${k === BRV ? "on" : ""}">${l}</button>`).join("")}</div>`;
  const pn = `<div class="br-pn">${i > 0 ? `<button class="btn o" data-ch="${BRCH[i - 1][0]}">${IC("back", 16)} ${BRCH[i - 1][1]}</button>` : "<span></span>"}${i < BRCH.length - 1 ? `<button class="btn" data-ch="${BRCH[i + 1][0]}">${BRCH[i + 1][1]} ${IC("next", 16)}</button>` : ""}</div>`;
  const head = `<div class="br-hd"><div><span class="eyebrow">สรุปพฤติการณ์และพยานหลักฐานทางการเงิน · บทที่ ${i + 1}/${BRCH.length}</span><h1>${IC(ch[2], 24)} ${ch[1]}</h1></div>
    <div class="br-act">${ibx("play", "นำเสนอ (เต็มจอ)", 'data-act="present"')}${ibx("print", "พิมพ์", 'data-act="print"')}</div></div>`;
  $("#main").innerHTML = nav + head + `<div class="br-body">${(BRF[ch[0]] || (() => ""))(N_)}</div>` + pn;
  { const n = $(".br-nav"), o = n && n.querySelector(".on"); if (o) n.scrollLeft = o.offsetLeft - (n.clientWidth - o.offsetWidth) / 2; }   // บทที่เลือก (เหลือง) เลื่อนมาอยู่กลางแถบบนมือถือ
  (BRP[ch[0]] || (() => { }))(N_);
  wireGo();
  const m = $("#main"), prev = m.onclick;
  m.onclick = (e) => { const p = e.target.closest("[data-sp]"); if (p) { BRS = p.dataset.sp; render(); subPanel(); return; } prev(e); };
  const cur = $(".br-nav .on"); if (cur) cur.scrollIntoView({ inline: "center", block: "nearest" });
}
const BRF = {
  sum: ({ X, K, S, g, conToAth, pt }) => {
    const L = [
      ["warn", "เงินบริจาคส่วนใหญ่ไม่ได้ใช้ตามวัตถุประสงค์", `เงินออก ${M(K.t1_out)} จ่ายสาธารณประโยชน์ที่ระบุได้ ${M(K.pub)} (${pc(K.pub, K.t1_out)})`, "#B3261E"],
      ["users", "ผู้เสียหายเป็นประชาชนจำนวนมาก", `ระบุบัญชีผู้บริจาคได้ ${fmt0((X.donors || {}).unique || 0)} ราย ส่วนใหญ่บริจาคไม่ถึง 1,000 บาท`, "#00897B"],
      ["user", "เข้าบัญชีผู้ต้องหาที่ 1 โดยตรง", `${M(S.pan.in_t1)} แล้วชำระบัตรเครดิต ซื้อประกัน / กองทุน และโอนต่อผู้ต้องหาที่ 2`, SCOL.pan],
      ["route", "ผู้ต้องหาที่ 2 เป็นจุดรวมเงิน", `รับจากบัญชีรับบริจาค ${M(S.ath.in_t1)} · จากผู้ต้องหาที่ 1 ${M((S.ath.from_sus || {}).pan || 0)} · โอนต่อภายใน 24 ชม. ${pc(pt("ath").f24, pt("ath").amt)}`, SCOL.ath],
      ["build", "ผ่านบริษัทผู้รับเหมาแล้วกลับเข้าบัญชีผู้ต้องหาที่ 2", `เครือข่ายผู้ต้องหาที่ 7 โอนเข้าบัญชีผู้ต้องหาที่ 2 ${M(conToAth)} หลายครั้งภายในคืนเดียวกัน`, SCOL.con],
      ["card", "ชำระบัตรเครดิตส่วนตัวด้วยเงินบริจาค", `${M(K.cc_t1)} · เงินชำระเกินโอนคืนเข้าบัญชีส่วนตัว ${M(K.cc_refund)}`, "#E65100"],
      ["coin", "ถอนเป็นเงินสดจำนวนมาก", `จากบัญชีรับบริจาค ${M(K.cash)} · จากบัญชีผู้ต้องหา ${M(NUMS().susCash)}`, "#616161"],
      ["clock", "รูปแบบมีมาตั้งแต่ก่อนตั้งมูลนิธิ", `ก่อน 25 มิ.ย. 2565 เข้าบัญชีผู้ต้องหาที่ 1–2 แล้ว ${M(((X.t1_out.pan || [0, 0, 0])[2]) + ((X.t1_out.ath || [0, 0, 0])[2]))}`, "#00264D"],
    ];
    return `<div class="facts">${L.map(([ic, t, s, c]) => `<div class="fact" style="--c:${c}">${IC(ic, 22)}<div><b>${t}</b><p>${s}</p></div></div>`).join("")}</div>
      ${secH("pie", "เงินออกจากบัญชีรับบริจาค แยกผู้รับ")}<div class="card"><div class="chartbox tall"><canvas id="bOut"></canvas></div></div>`;
  },
  chg: ({ X, S }) => `<div id="chgBox"></div>${secH("coin", "ข้อหา กับเงินที่รับจากบัญชีรับบริจาคโดยตรง")}<p class="muted">✓ = ข้อหาที่แจ้ง / มีมติ ; สถานะตามข้อมูลชุดสืบสวน (บางรายการตามข่าว ต้องตรวจทานกับสำนวน)</p>` + tbl(["ที่", "ผู้ต้องหา", "ฉ้อโกงประชาชน", "พ.ร.บ.คอมพิวเตอร์", "ฟอกเงิน", "รับเงินบริจาคโดยตรง", "สถานะ"],
    susKeys().map((k) => { const s = S[k], c = chgOf(s.name) || {}; return [s.no, `<a href="#" data-sus="${k}"><b>${esc(s.name)}</b></a><br><small class="muted">${esc(s.role.split(" ; ")[0])}</small>`, ...["F", "C", "M"].map((q) => (s.charges.includes(q) ? `<b style="color:${CHC[q][1]}">✓</b>` : "–")), M(s.in_t1), esc(c.status || "")]; }), [5]) +
    `<div class="note">ฉ้อโกงประชาชน ป.อ. ม.341 ประกอบ ม.343 · นำเข้าข้อมูลเท็จ พ.ร.บ.คอมพิวเตอร์ ม.14 (1) · ฟอกเงิน พ.ร.บ.ป้องกันและปราบปรามการฟอกเงิน ม.5 ประกอบ ม.60 — เลขมาตราต้องตรวจทานกับตัวบทฉบับปัจจุบัน</div>`,
  t1: ({ X }) => {
    const MO = X.monthly || {}, top = Object.entries(MO).sort((a, b) => (b[1].don || 0) - (a[1].don || 0)).slice(0, 6).sort((a, b) => a[0].localeCompare(b[0]));
    const susM = (v) => ["pan", "ath", "tre", "con", "bld", "oth_sus"].reduce((a, k) => a + (v[k] || 0), 0);
    const nx = (k) => { let y = +k.slice(0, 4), m = +k.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return `${y}-${String(m).padStart(2, "0")}`; };
    const ym = (k) => `${MTH[+k.slice(5, 7)]} ${+k.slice(0, 4) + 543}`;
    return `${secH("chart", "เงินบริจาครายเดือน กับเงินที่ออกไปยังผู้ต้องหา / เงินสด", "ล้านบาท")}<div class="card"><div class="chartbox tall"><canvas id="bMon"></canvas></div></div>
      ${secH("star", "6 เดือนที่เงินบริจาคเข้าสูงสุด", "เงินออกนับเดือนนั้น + เดือนถัดไป")}` +
      tbl(["เดือน", "เงินบริจาคเข้า", "เข้าบัญชีผู้ต้องหา", "ถอนเงินสด", "สาธารณประโยชน์"], top.map(([k, v]) => { const n = MO[nx(k)] || {}; return [ym(k), `<b>${M(v.don)}</b>`, `<b style="color:var(--red)">${M(susM(v) + susM(n))}</b>`, M((v.cash || 0) + (n.cash || 0)), M((v.pub || 0) + (n.pub || 0))]; }), [1, 2, 3, 4]) +
      `${secH("chart", "เงินเข้า – ออก รายปี", "รวม 3 บัญชี")}<div class="card"><div class="chartbox"><canvas id="bYear"></canvas></div></div>`;
  },
  don: ({ X }) => {
    const D = X.donors; if (!D) return "<p class='muted'>ไม่มีข้อมูล</p>";
    const labs = ["ต่ำกว่า 1,000", "1,000 – 9,999", "10,000 – 99,999", "100,000 – 999,999", "1 ล้านขึ้นไป"];
    return `<div class="hero-k sm">${kpiC(fmt0(D.unique), "ผู้บริจาคที่ระบุบัญชีได้ (ราย)", `${fmt0(D.tx)} ครั้ง`, "#00897B")}${kpiC(pc(D.bands[0][2], D.unique), "บริจาคสะสมไม่ถึง 1,000 บาท", `${fmt0(D.bands[0][2])} ราย`, "#E0A800")}${kpiC(M(D.amt_real), "ยอดของผู้บริจาคกลุ่มนี้", "", "#1565C0")}</div>
      <div class="grid2"><div class="card"><div class="chartbox"><canvas id="bBand"></canvas></div></div><div class="card"><div class="chartbox"><canvas id="bDy"></canvas></div></div></div>` +
      tbl(["ยอดสะสมต่อราย (บาท)", "ผู้บริจาค (ราย)", "%", "ยอดรวม"], D.bands.filter((b) => b[2] > 0).map((b) => [labs[D.bands.indexOf(b)], fmt0(b[2]), pc(b[2], D.unique), M(b[3])]), [1, 2, 3]) +
      `<div class="note">ข้อมูลรายผู้โอนครอบคลุมเงินเข้า ${M(D.amt_all)} ; ส่วนที่เหลือเข้ามาทางช่องทางที่ statement ไม่แสดงผู้โอนรายคน จำนวนผู้บริจาคจริงจึงมากกว่านี้ — ใช้เลือกผู้บริจาคกลุ่มตัวอย่างสอบปากคำเป็นผู้เสียหาย</div>`;
  },
  sus: (N_) => {
    const { X, S, cashOf, perOf, pt } = N_, k = S[BRS] ? BRS : "pan", s = S[k], q = pt(k);
    const picks = `<div class="sp">${susKeys().map((x) => `<button data-sp="${x}" class="${x === k ? "on" : ""}" style="--c:${SCOL[x]}"><span>${S[x].no}</span>${esc(shortName(S[x].name).split(" ")[0])}</button>`).join("")}</div>`;
    const ph = photoOf(s.name), com = ["prp", "srk", "prc"].includes(k), why = WHY[com ? "com" : k] || {};
    const fromSus = Object.values(s.from_sus || {}).reduce((a, v) => a + v, 0), toSus = Object.values(s.to_sus || {}).reduce((a, v) => a + v, 0);
    const yrs = Object.keys(s.yr || {}).filter((y) => Object.values(s.yr[y]).some((v) => v >= 1000));
    return picks + `<div class="prof" style="--c:${SCOL[k]}">${ph ? thumbEl(ph, "av lg") : `<span class="av lg ph">${IC("user", 40)}</span>`}<div><span class="eyebrow">ผู้ต้องหาที่ ${s.no}</span><h2>${esc(s.name)}</h2><p>${esc(s.role)}</p><div class="chips">${chChips(s.charges)}</div></div></div>
      <div class="hero-k sm">${kpiC(M(s.in_t1 + (k === "con" ? 0 : 0)), "รับจากบัญชีรับบริจาค", `${fmt0(s.in_t1_n)} ครั้ง`, "#1565C0")}${kpiC(M(fromSus), "รับจากผู้ต้องหาอื่น", "", SCOL.ath)}${kpiC(M(toSus), "โอนให้ผู้ต้องหาอื่น", "", "#B3261E")}
        ${kpiC(M(cashOf(k)), "ถอนเงินสด", "บัญชีที่มี statement", "#616161")}${kpiC(M(perOf(k)), "ใช้ส่วนตัว / ทรัพย์สิน", "", "#263238")}${q.amt >= 1e6 ? kpiC(pc(q.f24, q.amt), "โอนต่อภายใน 24 ชม.", `ของ ${M(q.amt)}`, "#E65100") : ""}</div>
      ${secH("scale", "ทำไมจึงแจ้งข้อหา")}<div class="why">${["F", "C", "M"].filter((x) => s.charges.includes(x)).map((x) => `<div class="w" style="--c:${CHC[x][1]}"><b>${CHC[x][0]}</b><p>${why[x] || "—"}</p></div>`).join("")}</div>
      ${yrs.length ? `${secH("chart", "ความเคลื่อนไหวรายปี", "ล้านบาท")}<div class="card"><div class="chartbox"><canvas id="bSy"></canvas></div></div>` : ""}
      ${Object.keys(s.cats || {}).length ? `${secH("route", "เงินออกจากบัญชีไปที่ใด", "เฉพาะบัญชีที่มี statement")}<div class="card"><div class="chartbox"><canvas id="bSc"></canvas></div></div>` : ""}
      ${secH("bank", "บัญชีของผู้ต้องหา")}` + tbl(["บัญชี", "statement", "เงินเข้าจากคู่โอนที่ทราบ"], s.accounts.map((a) => [`${esc(a.name || "")}<br><small class="muted">${esc(a.bank)} ${esc(fa(a.acc))}</small>`, a.stm ? "มี" : `<span style="color:var(--red)">ยังไม่มี</span>`, M(a.in)]), [2]) +
      (s.from_t1.length ? secH("coin", "เงินจากบัญชีรับบริจาค") + tbl(["จาก", "เข้าบัญชี", "ยอด", "ครั้ง", "ช่วงวันที่"], s.from_t1.map((x) => [esc(fa(x.src)), esc(fa(x.dst)), `<b>${M(x.amt)}</b>`, fmt0(x.n), `${dTh(x.first)} – ${dTh(x.last)}`]), [2, 3]) : "") +
      ((s.spend_top || []).filter((x) => x.amt >= 50000).length ? secH("card", "ผู้รับเงินประเภทใช้จ่ายส่วนตัว / ทรัพย์สิน") + tbl(["ผู้รับ", "ประเภท", "ยอด", "ครั้ง"], s.spend_top.filter((x) => x.amt >= 50000).map((x) => [labAcc(x.acc), esc(x.type), `<b>${M(x.amt)}</b>`, fmt0(x.n)]), [2, 3]) : "") +
      ((s.cash_top || []).length ? secH("coin", "ถอนเงินสดรายใหญ่") + tbl(["วันเวลา", "บัญชี", "ยอด"], s.cash_top.map((x) => [dtt(x.t), labAcc(x.acc), `<b>${M(x.amt)}</b>`]), [2]) : "") +
      ((q.ex || []).length ? secH("clock", "รับเงินแล้วโอนต่อในเวลาใกล้กัน", "ตัวอย่างก้อนใหญ่") + tbl(["เงินเข้า", "จาก", "ยอด", "รายการออกแรก (ห่าง)", "ปลายทางหลัก"], q.ex.map((x) => [dtt(x.t), labAcc(x.src), `<b>${M(x.amt)}</b>`, `${dtt(x.t_out)}<br><small class="muted">${x.min < 60 ? x.min + " นาที" : (x.min / 60).toFixed(1) + " ชม."}</small>`, labAcc(x.to)]), [2]) : "") +
      ((s.multi || []).length ? secH("list", "โอนหลายครั้งในวันเดียวให้ผู้รับรายเดียวกัน") + tbl(["วันที่", "จาก", "ไปยัง", "รวม", "ครั้ง"], s.multi.map((x) => [dTh(x.day), labAcc(x.src), labAcc(x.dst), `<b>${M(x.amt)}</b>`, x.n]), [3, 4]) : "");
  },
  ev: ({ X }) => (X.events || []).filter((e) => e.rows.length).map((e) => { const [t, d] = e.title.split(": ");
    const toAth = e.rows.filter((r) => r.dst_ent === "ath").reduce((a, r) => a + r.amt, 0), fromT1 = e.rows.filter((r) => r.src_ent === "t1").reduce((a, r) => a + r.amt, 0);
    return `<div class="evc">${secH("clock", t, d)}<div class="hero-k sm">${kpiC(M(fromT1), "ออกจากบัญชีรับบริจาค", "", "#1565C0")}${kpiC(M(toAth), "เข้าบัญชีผู้ต้องหาที่ 2", "", SCOL.ath)}${kpiC(e.rows.length, "รายการ ≥ 500,000", "", "#00264D")}</div>` +
      tbl(["วันเวลา", "จาก", "ไปยัง", "ยอด"], e.rows.map((r) => [dtt(r.t), labAcc(r.src), labAcc(r.dst), `<b style="${r.dst_ent === "ath" ? "color:var(--red)" : ""}">${M(r.amt)}</b>`]), [3]) + `</div>`; }).join("") +
    (X.lnd_back.length ? secH("home", "ผู้ขายที่ดินโอนเงินกลับเข้าบัญชีผู้ต้องหา") + tbl(["จาก", "เข้า", "ยอด", "ครั้ง", "ช่วงวันที่"], X.lnd_back.map((x) => [labAcc(x.src), labAcc(x.dst), `<b>${M(x.amt)}</b>`, x.n, `${dTh(x.first)} – ${dTh(x.last)}`]), [2, 3]) : ""),
  ptn: (N_) => { const { X, K, S, gt, pt, g, conToAth, susCash } = N_;
    const perOut = ["pan", "ath", "tre"].reduce((a, k) => a + N_.perOf(k), 0);
    const R = [
      ["user", "โอนเงินบริจาคเข้าบัญชีส่วนตัวผู้ต้องหาโดยตรง", M(K.sus_all), "1, 2, 3, 7, 8"],
      ["build", "ผ่านบัญชีบริษัทผู้รับเหมาแล้วโอนกลับเข้าบัญชีผู้ต้องหาที่ 2 ภายในวันเดียวกัน", `${M(conToAth)} + ${M((S.bld.to_sus || {}).ath || 0)}`, "2, 7, 8"],
      ["users", "ผู้รับเหมา / ช่าง / กลุ่ม เค พาร์ค โอนกลับเข้าบัญชีผู้ต้องหาที่ 1–2 / บัญชีรับบริจาค", M((gt("ctr", ["back"]) + gt("kpk", ["back"]))), "2"],
      ["coin", "ถอนเงินสดแล้วนำฝากเข้าบัญชีอื่นในเวลาใกล้กัน", `${fmt0(K.cash_pairs_n)} คู่ · ${M(K.cash_pairs_amt)}`, "1, 2, 7"],
      ["home", "จ่ายค่าที่ดินแล้วมีเงินโอนกลับ", `จ่าย ${M(gt("lnd", ["t1", "pan", "ath"]))} · กลับ ${M(gt("lnd", ["back"]))}`, "1, 2"],
      ["shield", "เปลี่ยนสภาพเป็นทรัพย์สิน (ประกัน กองทุน สลาก ทอง รถ ค่าบ้าน)", M(K.per_inv + perOut), "1, 2, 3"],
      ["card", "ชำระบัตรเครดิตส่วนตัวด้วยเงินบริจาค", `${M(K.cc_t1)} · คืน ${M(K.cc_refund)}`, "1"],
      ["users", "ส่งผ่านบัญชีญาติ / บุคคลใกล้ชิด / แม่ครัวมูลนิธิ", `รับ ${M(["rel_pan", "rel_ath", "nom"].reduce((a, x) => a + gt(x, ["t1", "pan", "ath"]), 0))} · กลับ ${M(["rel_pan", "rel_ath", "nom"].reduce((a, x) => a + gt(x, ["back"]), 0))}`, "1, 2"],
      ["clock", "รับเงินแล้วโอนต่อภายใน 24 ชั่วโมง (บัญชีพักเงินผ่าน)", `${pc(pt("ath").f24, pt("ath").amt)} (ผู้ต้องหาที่ 2) · ${pc(pt("con").f24, pt("con").amt)} (ผู้ต้องหาที่ 7)`, "2, 7"],
      ["coin", "ถอนเป็นเงินสดจำนวนมาก", `${M(K.cash)} + ${M(susCash)}`, "1, 2, 3, 7"]];
    return `<div class="ptn">${R.map(([ic, t, v, w], i) => `<div class="pt"><span class="pt-n">${i + 1}</span>${IC(ic, 22)}<div><b>${t}</b><span class="pt-v">${v}</span><small>ผู้ต้องหาที่ ${w}</small></div></div>`).join("")}</div>
      <div class="note">ยอดแต่ละรูปแบบซ้อนกันได้ (เงินก้อนเดียวผ่านหลายรูปแบบ) ไม่ควรนำมารวมกัน ; รูปแบบที่ 4 และ 9 วิเคราะห์จากยอดและเวลา ต้องยืนยันด้วยเอกสารธนาคาร</div>`; },
  grp: ({ X }) => { const T = { pco: "บริษัทของผู้ต้องหาที่ 1", rel_pan: "ญาติของผู้ต้องหาที่ 1", rel_ath: "ญาติของผู้ต้องหาที่ 2", lnd: "ผู้ขายที่ดิน", ctr: "ผู้รับเหมา / ช่างอื่น", nom: "แม่ครัวมูลนิธิ", kpk: "ผู้ทำบัญชีมูลนิธิ / เค พาร์ค", sst: "บุคคลที่ชุดสืบระบุตัวแล้ว" };
    const G = X.groups || {}, ks = Object.keys(T).filter((k) => G[k] && G[k].n_acc);
    return `<p class="muted">ข้อเท็จจริงทางการเงินเพื่อประกอบการสอบปากคำพยาน / ขยายผล — ไม่ใช่การสรุปความรับผิด</p>` +
      tbl(["กลุ่ม", "บัญชี (มี STM)", "จากบัญชีรับบริจาค", "จากผู้ต้องหาที่ 1", "จากผู้ต้องหาที่ 2", "โอนกลับเข้าผู้ต้องหา / บัญชีรับบริจาค"], ks.map((k) => { const t = G[k].tot; return [`<b>${T[k]}</b>`, `${G[k].n_acc} (${G[k].n_stm})`, M(t.t1), M(t.pan), M(t.ath), `<b style="color:${t.back > 0 ? "var(--red)" : "inherit"}">${M(t.back)}</b>`]; }), [2, 3, 4, 5]) +
      ks.map((k) => accd(`${T[k]}`, `${G[k].top.length} บัญชี`, tbl(["บัญชี", "STM", "จากบัญชีรับบริจาค", "จากผู้ต้องหาที่ 1", "จากผู้ต้องหาที่ 2", "โอนกลับ"], G[k].top.map((x) => [labAcc(x.acc), x.stm ? "มี" : "–", M(x.t1), M(x.pan), M(x.ath), M(x.back)]), [2, 3, 4, 5]), false)).join(""); },
  pend: ({ X }) => `<p class="muted">บัญชีที่ยังไม่มี statement ซึ่งรับเงินจากบัญชีรับบริจาคหรือบัญชีผู้ต้องหาตั้งแต่ 500,000 บาท</p>` +
    tbl(["ที่", "บัญชี", "กลุ่ม", "จากบัญชีรับบริจาค", "จากบัญชีผู้ต้องหา", "รวม", "ล่าสุด"], X.pending.map((x, i) => [i + 1, labAcc(x.acc), esc(X.suspects[x.ent] ? `ผู้ต้องหาที่ ${X.suspects[x.ent].no}` : (X.ent[x.ent] || x.ent)), M(x.t1), M(x.sus), `<b>${M(x.t1 + x.sus)}</b>`, dTh(x.last)]), [3, 4, 5]),
};
const BRP = {
  chg: () => { const el = $("#chgBox"); if (el) pCharges(el); },
  sum: ({ X, K }) => { const L = Object.entries(X.t1_out).filter(([, v]) => v[0] > 0).sort((a, b) => b[1][0] - a[1][0]).slice(0, 16);
    CH.bOut = new Chart($("#bOut"), { type: "bar", data: { labels: L.map(([k]) => entLab(k)), datasets: [{ data: L.map(([, v]) => v[0] / 1e6), backgroundColor: L.map(([k]) => ENTC[k] || "#90A4AE") }] },
      options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${M(c.raw * 1e6)} (${pc(c.raw * 1e6, K.t1_out)})` } } } } }); },
  t1: ({ X }) => { const MO = X.monthly || {}, ks = Object.keys(MO).filter((k) => k >= "2019-01").sort();
    const P = [["don", "เงินบริจาคเข้า", "#E0A800", "line"], ["pan", "ผู้ต้องหาที่ 1", SCOL.pan], ["ath", "ผู้ต้องหาที่ 2", SCOL.ath], ["con", "ผู้ต้องหาที่ 7", SCOL.con], ["tre", "ผู้ต้องหาที่ 3", SCOL.tre], ["bld", "ผู้ต้องหาที่ 8", SCOL.bld], ["cash", "ถอนเงินสด", "#616161"], ["pub", "สาธารณประโยชน์", "#F9A825"]];
    CH.bMon = new Chart($("#bMon"), { data: { labels: ks.map((k) => `${MTH[+k.slice(5, 7)]} ${(+k.slice(0, 4) + 543) % 100}`), datasets: P.map(([k, l, c, t]) => ({ type: t || "bar", label: l, data: ks.map((m) => (MO[m][k] || 0) / 1e6), backgroundColor: c, borderColor: c, stack: t ? undefined : "o", pointRadius: 0, borderWidth: t ? 2 : 0, order: t ? 0 : 1 })) },
      options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, scales: { x: { stacked: true, ticks: { maxTicksLimit: 14 } }, y: { stacked: true, title: { display: true, text: "ล้านบาท" } } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${M(c.raw * 1e6)}` } } } } });
    const yl = (DB.over.yearly || []);
    CH.bYear = new Chart($("#bYear"), { type: "bar", data: { labels: yl.map((r) => r[0] + (r[1] ? (r[1].includes("ก่อน") ? " ก่อน" : " หลัง") : "")), datasets: [{ label: "เงินเข้า", data: yl.map((r) => r[2] / 1e6), backgroundColor: "#FFD403" }, { label: "เงินออก", data: yl.map((r) => r[4] / 1e6), backgroundColor: "#00264D" }] }, options: { maintainAspectRatio: false } }); },
  don: ({ X }) => { const D = X.donors; if (!D) return; const B = D.bands.filter((b) => b[2] > 0), labs = ["< 1,000", "1,000–9,999", "10,000–99,999", "100,000–999,999", "≥ 1 ล้าน"];
    CH.bBand = new Chart($("#bBand"), { type: "bar", data: { labels: B.map((b) => labs[D.bands.indexOf(b)]), datasets: [{ label: "ผู้บริจาค (ราย)", data: B.map((b) => b[2]), backgroundColor: "#E0A800" }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: "จำนวนผู้บริจาค แยกตามยอดสะสมต่อราย" } } } });
    const Y = Object.entries(D.yr).filter(([, v]) => v[0] > 0);
    CH.bDy = new Chart($("#bDy"), { type: "bar", data: { labels: Y.map(([y]) => +y + 543), datasets: [{ label: "ผู้บริจาค (ราย)", data: Y.map(([, v]) => v[0]), backgroundColor: "#00897B" }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: "จำนวนผู้บริจาครายปี" } } } }); },
  sus: ({ S }) => { const k = S[BRS] ? BRS : "pan", s = S[k];
    const yrs = Object.keys(s.yr || {}).filter((y) => Object.values(s.yr[y]).some((v) => v >= 1000));
    if ($("#bSy")) { const P = [["in_t1", "รับจากบัญชีรับบริจาค", "#1565C0"], ["in_sus", "รับจากผู้ต้องหาอื่น", "#7CB342"], ["out_sus", "โอนให้ผู้ต้องหาอื่น", "#B3261E"], ["out_cash", "ถอนเงินสด", "#616161"], ["out_per", "ใช้ส่วนตัว / ทรัพย์สิน", "#263238"]];
      CH.bSy = new Chart($("#bSy"), { type: "bar", data: { labels: yrs.map((y) => +y + 543), datasets: P.map(([f, l, c]) => ({ label: l, data: yrs.map((y) => (s.yr[y][f] || 0) / 1e6), backgroundColor: c })) }, options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${M(c.raw * 1e6)}` } } } } }); }
    if ($("#bSc")) { const L = Object.entries(s.cats).filter(([e, v]) => v[0] >= 1000 && e !== k).slice(0, 12);
      CH.bSc = new Chart($("#bSc"), { type: "bar", data: { labels: L.map(([e]) => entLab(e)), datasets: [{ data: L.map(([, v]) => v[0] / 1e6), backgroundColor: L.map(([e]) => ENTC[e] || "#90A4AE") }] }, options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${M(c.raw * 1e6)}` } } } } }); } },
};

/* ---------- ข้อเสนอแนะ ---------- */
/* ข้อเสนอแนะ รุ่น 19 พ.ย. 69 (ผู้ใช้สั่ง "แสดงเป็นรายการมีตัวกรองเหมือนหน้าอื่น ๆ"): การ์ดสถานะ (กดกรอง) + ตารางรายการกลาง XT */
const RCST = { "เสนอ": "#E0A800", "กำลังดำเนินการ": "#1565C0", "เสร็จแล้ว": "#1B7A4A" };
function pRecs() {
  const L = (C.recs || []), sts = Object.keys(RCST), cnt = (s) => L.filter((r) => (r.status || "เสนอ") === s).length, m = $("#main");
  m.innerHTML = `<div class="br-hd"><div><span class="eyebrow">สำหรับเสนอคณะทำงาน / ผู้บังคับบัญชา</span><h1>${IC("bulb", 24)} ข้อเสนอแนะการดำเนินการ</h1></div>
    <div class="br-act">${addBtn("recs")}${ibx("copy", "คัดลอกเป็นข้อความ", 'data-act="copyrecs"')}${ibx("print", "พิมพ์", 'data-act="print"')}</div></div>
  <div class="acards"><button class="acard tot" data-rst=""><span class="aic">${IC("bulb", 24)}</span><span class="acv">${L.length}</span><span class="acl">ข้อเสนอทั้งหมด</span><span class="acs">${[...new Set(L.map((r) => r.extra2 || "อื่น ๆ"))].length} หมวด</span>
      <span class="abar dfbar">${sts.map((s) => `<i style="width:${L.length ? (cnt(s) / L.length * 100).toFixed(1) : 0}%;background:${RCST[s]}"></i>`).join("")}</span></button>
    ${sts.map((s) => `<button class="acard" data-rst="${s}" style="--c:${RCST[s]}"><span class="aic">${IC({ "เสนอ": "bulb", "กำลังดำเนินการ": "clock", "เสร็จแล้ว": "check" }[s], 24)}</span><span class="acv">${cnt(s)}</span><span class="acl">${s}</span><span class="acs">${L.length ? Math.round(cnt(s) / L.length * 100) : 0}% ของข้อเสนอ</span><span class="abar"><i style="width:${L.length ? (cnt(s) / L.length * 100).toFixed(1) : 0}%"></i></span></button>`).join("")}</div>
  <div id="rcX"></div>`;
  const XS = xtS("recs");
  const X = xtMount($("#rcX"), { id: "recs", title: "รายการข้อเสนอแนะ", ph: "ค้นหาข้อเสนอ / รายละเอียด / ผู้รับผิดชอบ", rows: L, xl: "ข้อเสนอแนะ (ตามตัวกรอง)",
    search: (r) => `${r.title} ${r.detail} ${r.extra1} ${r.extra2}`,
    cols: [["#", () => 0, "n"], ["หมวด", (r) => r.extra2 || "อื่น ๆ", "t"], ["ข้อเสนอ", (r) => `${r.title} ${r.detail || ""}`, "t", (r) => `<b>${esc(r.title)}</b>${r.detail ? `<br><small class="muted">${esc(r.detail)}</small>` : ""}`],
      ["ผู้รับผิดชอบ / หน่วย", (r) => r.extra1 || "", "t"], ["สถานะ", (r) => r.status || "เสนอ", "t", (r) => `<span class="badge" style="background:${RCST[r.status || "เสนอ"] || "#999"};color:#fff">${esc(r.status || "เสนอ")}</span>`],
      ["", () => "", "x", (r) => acts2("recs", r.id)]],
    facets: [["cat", "ทุกหมวด", (r) => r.extra2 || "อื่น ๆ"], ["st", "ทุกสถานะ", (r) => r.status || "เสนอ", sts.map((s) => [s, s, RCST[s]])], ["own", "ทุกผู้รับผิดชอบ", (r) => r.extra1 || "(ไม่ระบุ)"]],
    onUpdate: () => $$("[data-rst]", m).forEach((b) => b.classList.toggle("on", b.dataset.rst ? !!(XS.f.st && XS.f.st.has(b.dataset.rst)) : !(XS.f.st && XS.f.st.size))),
    note: "แก้ไข / เพิ่มข้อเสนอได้ในโหมดแก้ไข (ตั้งค่า → โหมดแก้ไขเนื้อหา) ; บันทึกในเครื่องนี้ หรือ Google Sheet ถ้าตั้งค่าไว้" });
  wireGo();
  const prev = m.onclick;
  m.onclick = (e) => { const s = e.target.closest("[data-rst]"); if (s) { xtSet("recs", "st", s.dataset.rst, true); return X.upd(); } if (prev) prev(e); };
}
function copyRecs() {
  const L = C.recs || [], cats = [...new Set(L.map((r) => r.extra2 || "อื่น ๆ"))];
  let n = 0; const t = "ข้อเสนอแนะการดำเนินการ\n" + cats.map((c) => `\n${c}\n` + L.filter((r) => (r.extra2 || "อื่น ๆ") === c).map((r) => `${++n}. ${r.title}${r.detail ? " — " + r.detail : ""} [${r.status || "เสนอ"}]`).join("\n")).join("\n");
  navigator.clipboard.writeText(t).then(() => toast("คัดลอกแล้ว"), () => toast("คัดลอกไม่สำเร็จ"));
}

/* ---------- โหมดนำเสนอ: สไลด์ = บทของสรุปทางการ (ปุ่มลูกศร / ปัดจอ / ปุ่มบนจอ) ---------- */
function presentOn() {
  document.body.classList.add("present");
  if (TAB !== "brief") { BRV = "sum"; go("brief"); }
  try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); } catch (e) { }
  let bar = $("#pbar"); if (!bar) { bar = document.createElement("div"); bar.id = "pbar"; document.body.appendChild(bar); }
  bar.innerHTML = `<button data-p="-1">${IC("back", 22)}</button><span id="pcnt"></span><button data-p="1">${IC("next", 22)}</button><button data-p="x">${IC("x", 20)}</button>`;
  bar.onclick = (e) => { const b = e.target.closest("[data-p]"); if (!b) return; if (b.dataset.p === "x") presentOff(); else presentStep(+b.dataset.p); };
  let x0 = null; document.body.ontouchstart = (e) => (x0 = e.touches[0].clientX); document.body.ontouchend = (e) => { if (x0 == null || !document.body.classList.contains("present")) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 70) presentStep(dx < 0 ? 1 : -1); x0 = null; };
  pcnt();
}
const pcnt = () => { const c = $("#pcnt"); if (c) c.textContent = `${BRCH.findIndex((x) => x[0] === BRV) + 1} / ${BRCH.length}`; };
function presentStep(d) { const i = BRCH.findIndex((x) => x[0] === BRV), j = Math.max(0, Math.min(BRCH.length - 1, i + d)); if (j === i) return; BRV = BRCH[j][0]; render(); subPanel(); scrollTo(0, 0); pcnt(); }
function presentOff() { document.body.classList.remove("present"); const b = $("#pbar"); if (b) b.remove(); try { document.fullscreenElement && document.exitFullscreen(); } catch (e) { } }
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && document.body.classList.contains("present")) presentOff(); });

/* ---------- ตารางรายการกลาง XT (ผู้ใช้สั่ง 19 พ.ย. 69 "แสดงเป็นรายการมีตัวกรองเหมือนหน้าอื่น ๆ") ----------
   xtMount(host, cfg): ค้นหา + ปุ่มตัวกรองคลี่แผง (เลือกได้หลายค่า) + ตารางเรียงหลายชั้น (Shift) + ช่องกรองรายคอลัมน์ (cfMatch) + Excel ทุกแถวตามตัวกรอง
   cfg = { id, title, ph, rows, cols: [[หัว, get(r) -> ข้อความ/ตัวเลข, ชนิด t|a|d|n|x, html(r, i)?]], facets: [[key, ป้ายทั้งหมด, get(r), [[ค่า, ป้าย, สี]]?]],
           search(r) -> ข้อความ, sort0, rowAttr(r), onRow(r, e), onUpdate(rows), sum(rows), xl, note } ; สถานะอยู่ XTS[id] */
const XTS = {};
const xtS = (id) => (XTS[id] = XTS[id] || { q: "", f: {}, cf: {}, sort: null, lim: 300, open: new Set() });
function xtSet(id, key, v, only) {
  const S = xtS(id), F = (S.f[key] = S.f[key] || new Set());
  if (v === "" || v == null) F.clear(); else if (only) { const was = F.size === 1 && F.has(v); F.clear(); if (!was) F.add(v); } else (F.has(v) ? F.delete(v) : F.add(v));
}
function xtMount(host, cfg) {
  const S = xtS(cfg.id); if (!S.sort) S.sort = (cfg.sort0 || []).map((x) => x.slice());
  if (cfg.lims) { if (S.limSel == null) S.limSel = cfg.lims[0]; S.lim = S.limSel || Infinity; }
  const C_ = cfg.cols, FA = cfg.facets || [];
  const opts = FA.map(([k, , g, o]) => o || [...new Set(cfg.rows.map(g).filter((v) => v !== "" && v != null))].sort((a, b) => String(a).localeCompare(String(b), "th")).map((v) => [v, v]));
  const cnt = (i, v) => cfg.rows.filter((r) => FA[i][2](r) === v).length;
  host.innerHTML = `<div class="card fcard" data-xf="1">
    <div class="fline"><label class="sbox" style="flex:1 1 320px">${IC("search", 16)}<input type="search" data-xq="1" value="${esc(S.q)}" placeholder="${esc(cfg.ph || "ค้นหา")}"></label></div>
    <div class="fline">${FA.map(([k]) => `<button class="pill" data-xd="${k}"><span></span></button>`).join("")}<button class="ibx" data-xclr="1" hidden title="ล้างตัวกรอง" aria-label="ล้างตัวกรอง">${IC("fx", 16)}</button><span class="muted fsum" data-xsum="1"></span></div>
    ${FA.map(([k], i) => `<div class="ddp" data-xp="${k}" hidden><div class="frow">${opts[i].map(([v, l, c]) => `<button class="chip" data-xk="${k}" data-xv="${esc(v)}">${c ? `<span class="dot" style="background:${c}"></span>` : ""}${esc(l)} <small class="muted">${cnt(i, v)}</small></button>`).join("")}</div></div>`).join("")}</div>
  <h2>${IC("list")} ${esc(cfg.title || "รายการ")} <small data-xcnt="1"></small> ${infoI(cfg.note)}</h2>
  <div class="frow" style="margin:-4px 0 8px">${cfg.lims ? `<select class="pill fsel" data-xlim="1">${cfg.lims.map((n) => `<option value="${n}"${S.limSel === n ? " selected" : ""}>${n ? `แสดง ${n} อันดับ` : "แสดงทุกรายการ"}</option>`).join("")}</select>` : ""}${cfg.xl ? ibx("xls", "ส่งออก Excel (ทุกแถวตามตัวกรอง)", 'data-xx="xl"') : ""}${ibx("reset", "กลับลำดับเดิม", 'data-xx="sr"')}${ibx("fx", "ล้างช่องกรองคอลัมน์", 'data-xx="cf"')}</div>
  <div class="tblwrap tall" data-noxbar="1"><table class="xt"><thead><tr>${C_.map(([l, , t], c) => `<th ${t === "x" ? "" : `data-xs="${c}" class="srt${t === "a" || t === "n" ? " n" : ""}"`}>${l} <span class="si"></span></th>`).join("")}</tr>
    <tr class="cfr">${C_.map(([, , t], c) => (t === "x" || t === "n" ? "<th></th>" : `<th><input data-xcf="${c}" value="${esc(S.cf[c] || "")}" placeholder="${t === "a" ? "≥ / ช่วง" : t === "d" ? "2569 / 2026-11" : "กรอง…"}"></th>`)).join("")}</tr></thead><tbody></tbody></table></div>
  <div data-xmore="1" style="text-align:center;margin:8px 0"></div>`;
  cfrEnhance(host);
  const txt = (r, c) => { const v = C_[c][1](r); return C_[c][2] === "d" && v ? `${v} ${dTh(v)} ${+String(v).slice(0, 4) + 543}` : String(v ?? ""); };
  let R = [];
  const upd = () => {
    const q = S.q.trim().toLowerCase(), cf = Object.entries(S.cf).filter(([, v]) => v && v.trim());
    R = cfg.rows.filter((r) => FA.every(([k, , g]) => !(S.f[k] && S.f[k].size) || S.f[k].has(g(r))) && (!q || String(cfg.search ? cfg.search(r) : C_.map((c) => c[1](r)).join(" ")).toLowerCase().includes(q))
      && cf.every(([c, v]) => cfMatch(txt(r, +c), +C_[+c][1](r) || 0, v, C_[+c][2] === "a")));
    if (S.sort.length) R = R.slice().sort((a, b) => { for (const [c, d] of S.sort) { const t = C_[c][2], x = C_[c][1](a), y = C_[c][1](b);
      const v = t === "a" || t === "n" ? (+x || 0) - (+y || 0) : String(x ?? "").localeCompare(String(y ?? ""), "th"); if (v) return v * d; } return 0; });
    const tb = host.querySelector("tbody");
    if (!S.open) S.open = new Set();
    tb.innerHTML = R.slice(0, S.lim).map((r, i) => { const op = cfg.detail && S.open.has(cfg.key ? cfg.key(r) : i);
      return `<tr data-xi="${i}" ${cfg.rowAttr ? cfg.rowAttr(r) : ""}${op ? ' data-op="1"' : ""}>${C_.map(([, g, t, h], c) => `<td${t === "a" || t === "n" ? ' class="n"' : ""}>${c === 0 && cfg.detail ? `<span class="xcar">${op ? "▾" : "▸"}</span> ` : ""}${h ? h(r, i) : t === "n" ? i + 1 : t === "d" ? (g(r) ? dTh(g(r)) : "") : t === "a" ? (g(r) ? fmt0(g(r)) : "–") : esc(g(r) ?? "")}</td>`).join("")}</tr>`
        + (op ? `<tr class="xdet"><td colspan="${C_.length}">${cfg.detail(r)}</td></tr>` : ""); }).join("") || `<tr><td colspan="${C_.length}" class="muted" style="text-align:center">ไม่พบรายการตามตัวกรอง</td></tr>`;
    host.querySelector("[data-xmore]").innerHTML = R.length > S.lim ? `<button class="chip" data-xx="more" title="แสดงเพิ่ม">${IC("more", 14)} ${fmt0(Math.min(cfg.lims ? 100 : 500, R.length - S.lim))}</button> <button class="chip" data-xx="all" title="แสดงทั้งหมด">ทั้งหมด ${fmt0(R.length)}</button>` : "";
    const sm = cfg.sum ? cfg.sum(R) : "";
    host.querySelector("[data-xsum]").textContent = `${fmt0(R.length)} / ${fmt0(cfg.rows.length)} รายการ${sm ? " · " + sm : ""}`;
    host.querySelector("[data-xcnt]").textContent = `${fmt0(R.length)} รายการ${sm ? " · " + sm : ""}${R.length > S.lim ? ` · แสดง ${fmt0(S.lim)} แถวแรก` : ""}`;
    FA.forEach(([k, all], i) => { const b = host.querySelector(`[data-xd="${k}"]`), F = S.f[k], lab = (v) => (opts[i].find((o) => String(o[0]) === String(v)) || [v, v])[1];
      b.querySelector("span").textContent = F && F.size ? (F.size === 1 ? lab([...F][0]) : `${all.replace(/^ทุก/, "")} ${F.size} ค่า`) : all; b.classList.toggle("on", !!(F && F.size)); });
    host.querySelectorAll("[data-xk]").forEach((b) => b.classList.toggle("on", !!(S.f[b.dataset.xk] && [...S.f[b.dataset.xk]].some((v) => String(v) === b.dataset.xv))));
    host.querySelectorAll("[data-xs]").forEach((th) => { const i = S.sort.findIndex((x) => x[0] === +th.dataset.xs); th.querySelector(".si").textContent = i < 0 ? "" : (S.sort[i][1] > 0 ? "▲" : "▼") + (S.sort.length > 1 ? i + 1 : ""); });
    host.querySelector("[data-xclr]").hidden = !(S.q || Object.values(S.f).some((f) => f.size) || Object.values(S.cf).some((v) => v && v.trim()));
    if (cfg.onUpdate) cfg.onUpdate(R);
  };
  const reset = () => { S.lim = cfg.lims ? S.limSel || Infinity : 300; upd(); };
  let tm;
  host.onclick = (e) => {
    const th = e.target.closest("th[data-xs]");
    if (th) { const c = +th.dataset.xs, i = S.sort.findIndex((x) => x[0] === c), d0 = C_[c][2] === "t" ? 1 : -1;
      if (!e.shiftKey) S.sort = i < 0 ? [[c, d0]] : [[c, -S.sort[i][1]]]; else if (i < 0) S.sort.push([c, d0]); else if (S.sort[i][1] === d0) S.sort[i][1] *= -1; else S.sort.splice(i, 1); return upd(); }
    const b = e.target.closest("button");
    if (b && b.dataset.xd) { const p = host.querySelector(`[data-xp="${b.dataset.xd}"]`), was = p.hidden; host.querySelectorAll("[data-xp]").forEach((x) => (x.hidden = true)); host.querySelectorAll("[data-xd]").forEach((x) => x.classList.remove("open")); p.hidden = !was; b.classList.toggle("open", was); return; }
    if (b && b.dataset.xk) { const o = opts[FA.findIndex((f) => f[0] === b.dataset.xk)].find((x) => String(x[0]) === b.dataset.xv); xtSet(cfg.id, b.dataset.xk, o ? o[0] : b.dataset.xv); return reset(); }
    if (b && b.dataset.xclr) { S.q = ""; S.f = {}; S.cf = {}; host.querySelectorAll("[data-xq],[data-xcf]").forEach((x) => (x.value = "")); return reset(); }
    if (b && b.dataset.xx) { const k = b.dataset.xx;
      if (k === "sr") { S.sort = (cfg.sort0 || []).map((x) => x.slice()); return upd(); }
      if (k === "cf") { S.cf = {}; host.querySelectorAll("[data-xcf]").forEach((x) => (x.value = "")); return reset(); }
      if (k === "more") { S.lim += cfg.lims ? 100 : 500; return upd(); }
      if (k === "all") { S.lim = R.length; return upd(); }
      if (k === "xl") { const cs = C_.filter((c) => c[2] !== "x"), rows = [cs.map((c) => c[0])].concat(R.map((r, i) => cs.map((c) => (c[2] === "n" ? i + 1 : c[2] === "d" ? (c[1](r) ? dTh(c[1](r)) : "") : c[1](r) ?? ""))));
        return download2(cfg.xl + ".xlsx", xlsxBlob("รายการ", rows, cs.map((c) => (c[2] === "t" ? 30 : 14)))); } }
    if (!b && !e.target.closest("[data-xf]") && !e.target.closest("input")) { host.querySelectorAll("[data-xp]").forEach((x) => (x.hidden = true)); host.querySelectorAll("[data-xd]").forEach((x) => x.classList.remove("open")); }
    const tr = e.target.closest("tbody tr[data-xi]"); if (tr && !b && !e.target.closest(".xdet")) { const r = R[+tr.dataset.xi]; if (!r) return;
      if (cfg.detail) { const k = cfg.key ? cfg.key(r) : +tr.dataset.xi; S.open.has(k) ? S.open.delete(k) : S.open.add(k); return upd(); }
      if (cfg.onRow) cfg.onRow(r, e); }
  };
  host.onchange = (e) => { if (e.target.dataset.xlim) { S.limSel = +e.target.value; S.lim = S.limSel || Infinity; upd(); } };
  host.oninput = (e) => { const t = e.target; if (t.dataset.xq == null && t.dataset.xcf == null) return; clearTimeout(tm); tm = setTimeout(() => { if (t.dataset.xq != null) S.q = t.value; else S.cf[t.dataset.xcf] = t.value; reset(); }, 250); };
  upd();
  return { upd: reset };
}

/* ---------- ช่องกรองรายคอลัมน์แบบไอคอน (ผู้ใช้สั่ง 19 พ.ย. 69 "ไม่ควรมีช่องให้กรอก ควรเป็นสัญลักษณ์แล้วค่อยพิมพ์ — ทำกับทุกตาราง") ----------
   ซ่อนแถว .cfr ของทุกตาราง ; หัวคอลัมน์ที่กรองได้มีไอคอนกรวยเล็ก กดแล้วช่องพิมพ์โผล่ใต้หัวคอลัมน์ ; มีค่ากรอง = ไอคอนสีเหลือง
   ย้าย input เดิมไปไว้ใน popover จึงใช้ตัวจัดการ input เดิมของแต่ละตารางได้ (เหตุการณ์ input ยังวิ่งขึ้นไปถึง host) */
const CF_IC = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3 4h18l-7 9v6l-4 2v-8z"/></svg>';
function cfrEnhance(root) {
  (root || document).querySelectorAll("table").forEach((tbl) => {
    const fr = tbl.querySelector("tr.cfr"); if (!fr || fr.dataset.cfx) return; fr.dataset.cfx = "1";
    const hr = [...tbl.rows].find((r) => r !== fr && r.querySelector("th")); if (!hr) return;
    [...fr.cells].forEach((cell, c) => {
      const inp = cell.querySelector("input"), th = hr.cells[c]; if (!inp || !th) return;
      th.classList.add("hasf");
      const b = document.createElement("button"); b.className = "cfb"; b.type = "button"; b.title = "กรองคอลัมน์นี้"; b.innerHTML = CF_IC;
      const pop = document.createElement("div"); pop.className = "cfp"; pop.appendChild(inp);
      const hint = document.createElement("small"); hint.textContent = inp.placeholder && /≥|ช่วง/.test(inp.placeholder) ? ">100000 · 1000-5000" : ", หรือ · ! ไม่เอา"; pop.appendChild(hint);
      inp.placeholder = "กรอง…";
      th.appendChild(b); th.appendChild(pop);
      b.addEventListener("click", (e) => { e.stopPropagation(); const op = !th.classList.contains("cfo"); document.querySelectorAll("th.cfo").forEach((x) => x.classList.remove("cfo")); th.classList.toggle("cfo", op); if (op) setTimeout(() => inp.focus(), 0); });
      pop.addEventListener("click", (e) => e.stopPropagation());
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") th.classList.remove("cfo"); });
      inp.addEventListener("input", () => th.classList.toggle("fon", !!inp.value.trim()));
      th.classList.toggle("fon", !!inp.value.trim());
    });
    fr.style.display = "none";
  });
}
function cfrSync() { document.querySelectorAll("th.hasf").forEach((th) => { const i = th.querySelector(".cfp input"); if (i) th.classList.toggle("fon", !!i.value.trim()); }); }
document.addEventListener("click", (e) => { if (!e.target.closest("th.cfo")) document.querySelectorAll("th.cfo").forEach((x) => x.classList.remove("cfo")); setTimeout(cfrSync, 0); });

/* ---------- ปุ่มไอคอนล้วน + ⓘ คำอธิบาย (ผู้ใช้สั่ง 19 พ.ย. 69 "คลีน ตัวอักษรน้อยที่สุดทุกหน้า แต่ฟังก์ชันครบ") ----------
   ibx(icon, title, attrs) = ปุ่มไอคอน มีคำอธิบายเมื่อชี้ (title) ; infoI(text) = ปุ่ม ⓘ กดแล้วแสดงคำอธิบาย/หมายเหตุ (แทนย่อหน้าคำอธิบายในหน้า) */
const ibx = (ic, t, attrs) => `<button class="ibx" type="button" title="${esc(t)}" aria-label="${esc(t)}" ${attrs || ""}>${IC(ic, 16)}</button>`;
const infoI = (t) => (t ? `<button class="ibx sm info" type="button" data-info="${esc(t)}" title="คำอธิบาย" aria-label="คำอธิบาย">${IC("info", 15)}</button>` : "");
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-info]"), p = document.getElementById("ipop");
  if (!b) { if (p && !e.target.closest("#ipop")) p.remove(); return; }
  e.stopPropagation(); e.preventDefault();
  if (p) { const same = p._b === b; p.remove(); if (same) return; }
  const d = document.createElement("div"); d.id = "ipop"; d._b = b; d.textContent = b.dataset.info; document.body.appendChild(d);
  const r = b.getBoundingClientRect(), w = Math.min(360, innerWidth - 24); d.style.width = w + "px";
  d.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + "px"; d.style.top = (r.bottom + 8 + scrollY) + "px";
}, true);

/* ---------- หัวตารางลอยบนมือถือ (ผู้ใช้สั่ง 19 พ.ย. 69) ----------
   มือถือ: .tblwrap เลื่อนแนวนอนอย่างเดียว (shell.css) หัว sticky ในกรอบจึงไม่ทำงาน → เมื่อหัวจริงพ้นขอบบน แสดงสำเนาหัวตารางใต้แถบบน
   ความกว้างคอลัมน์ลอกจากหัวจริง + เลื่อนแนวนอนตามกรอบ ; กดหัวลอย = ส่งต่อไปหัวจริง (เรียงลำดับ) ; ไม่สำเนาไอคอนกรวย */
const THF_MQ = matchMedia("(hover:none) and (pointer:coarse), (max-width:640px)");
let THF = { tbl: null, sig: "", hs: null }, THF_RAF = 0;
function thfTopY() { let y = 0; document.querySelectorAll(".top, .br-nav").forEach((e) => { const r = e.getBoundingClientRect(); if (r.height && r.top <= y + 1) y = Math.max(y, r.bottom); }); return y; }
function thfHdr(tbl) { const rs = []; for (const r of tbl.rows) { if (r.classList.contains("cfr") || r.style.display === "none") continue; if (!r.querySelector("th") || r.querySelector("td")) break; rs.push(r); } return rs; }
function thfClick(e) { const c = e.target.closest("th"); if (!c || !THF.hs) return; const ri = [...c.parentNode.parentNode.rows].indexOf(c.parentNode), o = THF.hs[ri] && THF.hs[ri].cells[c.cellIndex]; if (o) o.click(); }
function thfUpd() {
  THF_RAF = 0; let box = document.getElementById("thf");
  if (!THF_MQ.matches) { if (box) box.hidden = true; return; }
  const top = thfTopY(); let hit = null;
  for (const w of document.querySelectorAll("#main .tblwrap")) {
    const r = w.getBoundingClientRect(); if (!r.height || r.top >= top || r.bottom <= top + 44) continue;
    const tbl = w.querySelector("table"); if (!tbl) continue;
    const hs = thfHdr(tbl); if (!hs.length || hs[hs.length - 1].getBoundingClientRect().bottom > top) continue;
    hit = { w, tbl, hs, r }; break;
  }
  if (!hit) { if (box) box.hidden = true; return; }
  if (!box) { box = document.createElement("div"); box.id = "thf"; box.hidden = true; box.addEventListener("click", thfClick); document.body.appendChild(box); }
  const sig = hit.tbl.offsetWidth + ":" + hit.hs.map((r) => [...r.cells].map((c) => c.offsetWidth + c.className + c.textContent).join("|")).join("/");
  if (THF.tbl !== hit.tbl || THF.sig !== sig) {
    const t = hit.tbl.cloneNode(false), hd = document.createElement("thead"); t.removeAttribute("id"); t.style.width = hit.tbl.offsetWidth + "px";
    hit.hs.forEach((r) => { const c = r.cloneNode(true); c.removeAttribute("id"); c.querySelectorAll(".cfp,.cfb").forEach((x) => x.remove()); c.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id")); [...c.cells].forEach((x, i) => (x.style.width = r.cells[i].getBoundingClientRect().width + "px")); hd.appendChild(c); });
    t.appendChild(hd); box.replaceChildren(t); THF = { tbl: hit.tbl, sig, hs: hit.hs };
  }
  box.style.top = top + "px"; box.style.left = hit.r.left + hit.w.clientLeft + "px"; box.style.width = hit.w.clientWidth + "px";
  box.firstChild.style.transform = `translateX(${-hit.w.scrollLeft}px)`; box.hidden = false;
}
const thfQ = () => { if (!THF_RAF) THF_RAF = requestAnimationFrame(thfUpd); };
addEventListener("scroll", thfQ, { passive: true, capture: true });
addEventListener("resize", thfQ);
if (THF_MQ.addEventListener) THF_MQ.addEventListener("change", thfQ);
new MutationObserver(thfQ).observe(document.getElementById("main") || document.body, { childList: true, subtree: true });
