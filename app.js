/* CIB Case Dashboard — ข้อมูลทั้งหมดถูกเข้ารหัส (AES-GCM) ถอดด้วยรหัสผ่านในเบราว์เซอร์เท่านั้น */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (x) => Number(x || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (x) => Number(x || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const M = (x) => (Number(x || 0) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ล.";
const MTH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const dTh = (iso) => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return y ? `${d} ${MTH[m]} ${String(y + 543).slice(2)}` : String(iso); };
const toast = (t) => { const e = $("#toast"); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (e.hidden = true), 3200); };

let KEY = null, DB = null, C = null, CH = {};
const ITER = 600000;

/* ---------- เข้ารหัส / ถอดรหัส ---------- */
async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
}
async function fetchEnc(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("โหลดข้อมูลไม่ได้ (" + r.status + ")");
  const b = new Uint8Array(await r.arrayBuffer());
  if (String.fromCharCode(...b.slice(0, 4)) !== "CIB1") throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");
  return { salt: b.slice(4, 20), iv: b.slice(20, 32), ct: b.slice(32) };
}
const decrypt = (key, f) => crypto.subtle.decrypt({ name: "AES-GCM", iv: f.iv }, key, f.ct);
async function gunzipJSON(buf) {
  const ds = new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip")));
  return JSON.parse(await ds.text());
}
async function unlock(pass, rawKey) {
  const f = await fetchEnc("data.enc");
  KEY = rawKey ? await crypto.subtle.importKey("raw", rawKey, "AES-GCM", true, ["decrypt"]) : await deriveKey(pass, f.salt);
  DB = await gunzipJSON(await decrypt(KEY, f));
  if (!rawKey) { try { sessionStorage.setItem("cib_k", btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("raw", KEY))))); } catch (e) { } }
}
$("#loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = $("#loginBtn"), msg = $("#loginMsg");
  btn.disabled = true; msg.textContent = "กำลังถอดรหัสข้อมูล…";
  try { await unlock($("#pw").value); msg.textContent = ""; start(); }
  catch (e) { KEY = null; msg.textContent = e.name === "OperationError" ? "รหัสผ่านไม่ถูกต้อง" : "ผิดพลาด: " + e.message; }
  btn.disabled = false; $("#pw").value = "";
});
(async () => {
  let k = null; try { k = sessionStorage.getItem("cib_k"); } catch (e) { }
  if (!k) return;
  try { await unlock(null, Uint8Array.from(atob(k), (c) => c.charCodeAt(0))); start(); } catch (e) { try { sessionStorage.removeItem("cib_k"); } catch (e2) { } }
})();
$("#outBtn").onclick = () => { try { sessionStorage.removeItem("cib_k"); } catch (e) { } location.reload(); };

/* ---------- เนื้อหาที่แก้ไขได้ (ฐานข้อมูล Google Sheet) ---------- */
const SEC = {
  story: { label: "เนื้อเรื่อง", f: [["title", "หัวข้อ"], ["detail", "รายละเอียด", "ta"]] },
  case: { label: "รายละเอียดคดี", f: [["title", "หัวข้อ"], ["detail", "รายละเอียด", "ta"]] },
  events: { label: "ลำดับเหตุการณ์", f: [["date", "วันที่", "date"], ["title", "เหตุการณ์"], ["detail", "รายละเอียด", "ta"]] },
  charges: { label: "ข้อหา", f: [["title", "บุคคล"], ["extra1", "บทบาท"], ["detail", "ข้อหา", "ta"], ["status", "สถานะ"]] },
  defences: { label: "ข้อต่อสู้ที่ต้องพิสูจน์", f: [["extra1", "ผู้อ้าง"], ["title", "ข้อต่อสู้"], ["detail", "สิ่งที่ต้องพิสูจน์", "ta"], ["extra2", "หลักฐานที่มี", "ta"], ["status", "สถานะ"]] },
  done: { label: "สิ่งที่ทำไปแล้ว", f: [["title", "งาน"], ["detail", "รายละเอียด", "ta"], ["date", "วันที่", "date"]] },
  todo: { label: "สิ่งที่ต้องทำต่อ", f: [["title", "งาน"], ["detail", "รายละเอียด", "ta"], ["extra1", "ผู้รับผิดชอบ"], ["date", "กำหนด", "date"], ["status", "สถานะ"]] },
};
const LS = { get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
const sheetCfg = () => { const o = LS.get("cib_sheet") || {}; return { url: o.url || DB.sheet_url || "", token: o.token || DB.sheet_token || "" }; };
async function sheetCall(body) {
  const { url, token } = sheetCfg();
  if (!url) return null;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ token, ...body }), redirect: "follow" });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Sheet ตอบกลับผิดพลาด");
  return j;
}
const rowsToContent = (rows) => { const o = {}; Object.keys(SEC).forEach((k) => (o[k] = [])); rows.filter((r) => SEC[r.section]).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach((r) => o[r.section].push(r)); return o; };
const contentToRows = (c) => Object.keys(SEC).flatMap((s) => (c[s] || []).map((it, i) => ({ section: s, id: it.id, order: i + 1, title: it.title || "", detail: it.detail || "", extra1: it.extra1 || "", extra2: it.extra2 || "", status: it.status || "", date: it.date || "" })));
async function loadContent() {
  C = LS.get("cib_content") || JSON.parse(JSON.stringify(DB.content));
  Object.keys(SEC).forEach((k) => (C[k] = C[k] || []));
  if (sheetCfg().url) {
    try { const j = await sheetCall({ action: "list" }); if (j && j.rows && j.rows.length) { C = rowsToContent(j.rows); LS.set("cib_content", C); toast("ดึงข้อมูลจาก Google Sheet แล้ว"); render(); } }
    catch (e) { toast("เชื่อม Google Sheet ไม่ได้ — ใช้ข้อมูลในเครื่อง"); }
  }
}
async function saveItem(sec, it, del) {
  const arr = C[sec]; const i = arr.findIndex((x) => x.id === it.id);
  if (del) { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i] = it; else arr.push(it);
  LS.set("cib_content", C); render();
  try { const r = await sheetCall(del ? { action: "delete", id: it.id } : { action: "upsert", row: contentToRows(C).find((x) => x.id === it.id) }); toast(r ? "บันทึกลง Google Sheet แล้ว" : "บันทึกในเครื่องนี้แล้ว (ยังไม่ได้ตั้งค่า Google Sheet)"); }
  catch (e) { toast("บันทึกในเครื่องแล้ว แต่ส่งขึ้น Sheet ไม่ได้: " + e.message); }
}
function openModal(html) { $("#modalBox").innerHTML = html; $("#modal").hidden = false; }
const closeModal = () => ($("#modal").hidden = true);
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
function editItem(sec, id) {
  const it = id ? { ...C[sec].find((x) => x.id === id) } : { id: sec[0] + Date.now().toString(36) };
  openModal(`<h3>${id ? "แก้ไข" : "เพิ่ม"} — ${SEC[sec].label}</h3>` + SEC[sec].f.map(([k, l, t]) =>
    `<label>${l}</label>` + (t === "ta" ? `<textarea data-k="${k}">${esc(it[k])}</textarea>` : `<input data-k="${k}" type="${t === "date" ? "date" : "text"}" value="${esc(it[k])}">`)).join("") +
    `<div class="modal-foot">${id ? '<button class="btn o" id="mDel">ลบ</button>' : ""}<button class="btn o" id="mCancel">ยกเลิก</button><button class="btn" id="mSave">บันทึก</button></div>`);
  $("#mCancel").onclick = closeModal;
  $("#mSave").onclick = () => { $$("[data-k]", $("#modalBox")).forEach((e) => (it[e.dataset.k] = e.value.trim())); closeModal(); saveItem(sec, it); };
  if (id) $("#mDel").onclick = () => { if (confirm("ลบรายการนี้?")) { closeModal(); saveItem(sec, it, true); } };
}
$("#editBtn").onclick = () => { document.body.classList.toggle("edit"); $("#editBtn").classList.toggle("on"); };
$("#setBtn").onclick = () => {
  const c = sheetCfg();
  openModal(`<h3>ตั้งค่าฐานข้อมูล Google Sheet</h3>
    <p class="muted" style="margin:0;font-size:.88rem">วาง URL ของ Apps Script Web App (ดูวิธีตั้งค่าใน README) — ถ้าเว้นว่าง การแก้ไขจะเก็บในเครื่องนี้เท่านั้น</p>
    <label>URL Web App</label><input id="sUrl" value="${esc(c.url)}" placeholder="https://script.google.com/macros/s/…/exec">
    <label>โทเคน</label><input id="sTok" value="${esc(c.token)}">
    <div class="modal-foot"><button class="btn o" id="sPull">ดึงจาก Sheet</button><button class="btn o" id="sPush">ส่งข้อมูลทั้งหมดขึ้น Sheet</button><button class="btn o" id="sExp">ส่งออก JSON</button><button class="btn o" id="sReset">คืนค่าตั้งต้น</button><button class="btn" id="sSave">บันทึก</button></div>`);
  const keep = () => LS.set("cib_sheet", { url: $("#sUrl").value.trim(), token: $("#sTok").value.trim() });
  $("#sSave").onclick = () => { keep(); closeModal(); toast("บันทึกการตั้งค่าแล้ว"); };
  $("#sPull").onclick = async () => { keep(); closeModal(); await loadContent(); render(); };
  $("#sPush").onclick = async () => { keep(); try { const r = await sheetCall({ action: "replaceAll", rows: contentToRows(C) }); toast(r ? `ส่งขึ้น Sheet แล้ว ${r.n || ""} แถว` : "ยังไม่ได้ใส่ URL"); } catch (e) { toast("ส่งไม่สำเร็จ: " + e.message); } };
  $("#sExp").onclick = () => download("content.json", JSON.stringify(C, null, 1), "application/json");
  $("#sReset").onclick = () => { if (confirm("คืนเนื้อหาเป็นค่าตั้งต้น (เฉพาะในเครื่องนี้)?")) { try { localStorage.removeItem("cib_content"); } catch (e) { } C = JSON.parse(JSON.stringify(DB.content)); closeModal(); render(); } };
};
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: type + ";charset=utf-8" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

/* ---------- โครงหน้า ---------- */
const TABS = [["over", "ภาพรวม", "chart"], ["case", "คดี", "book"], ["charges", "ข้อหา", "scale"], ["defences", "ข้อต่อสู้", "shield"], ["work", "งาน", "list"], ["prog", "ความคืบหน้า", "cal"], ["asset", "ทรัพย์สิน", "coin"], ["ana", "วิเคราะห์", "flow"], ["acc", "บัญชี", "bank"], ["trace", "ไล่เส้นเงิน", "route"], ["img", "ภาพชาร์ต", "img"]];
let TAB = "over";
function start() {
  $("#login").hidden = true; $("#app").hidden = false;
  $("#caseTitle").textContent = DB.case || "ข้อมูลคดี";
  $("#madeAt").textContent = "ข้อมูล ณ " + dTh(DB.made) + " " + DB.made.slice(11);
  $("#tabs").innerHTML = TABS.map(([k, l, ic]) => `<button data-t="${k}">${IC(ic, 20)}<span>${l}</span></button>`).join("");
  $("#tabs").onclick = (e) => { const b = e.target.closest("button"); if (b) go(b.dataset.t); };
  prep();
  C = LS.get("cib_content") || JSON.parse(JSON.stringify(DB.content));
  Object.keys(SEC).forEach((k) => (C[k] = C[k] || []));
  go((location.hash || "#over").slice(1));
  loadContent();
}
function go(t) { PV = ""; AV = ""; TAB = TABS.some((x) => x[0] === t) ? t : "over"; history.replaceState(null, "", "#" + TAB); $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === TAB)); render(); window.scrollTo(0, 0); }
function killCharts() { Object.values(CH).forEach((c) => c.destroy()); CH = {}; }
function render() { killCharts(); const m_ = $("#main"); m_.onclick = m_.onchange = m_.oninput = null; ({ over: pOver, case: pCase, charges: pCharges, defences: pDef, work: pWork, prog: pProg, asset: pAsset, ana: pAna, acc: pAcc, trace: pTrace, img: pImg })[TAB](); }
const acts = (sec, id) => `<span class="acts"><button onclick="editItem('${sec}','${id}')">แก้ไข</button></span>`;
const addBtn = (sec) => `<button class="add" onclick="editItem('${sec}')">+ เพิ่ม</button>`;
const badge = (s) => { if (!s) return ""; const c = /ค้าง|ต้อง|รอ/.test(s) ? "r" : /เสร็จ|มีหลักฐาน|แล้ว/.test(s) ? "g" : /พัก|มติ/.test(s) ? "y" : ""; return `<span class="badge ${c}">${esc(s)}</span>`; };
window.editItem = editItem;

/* ---------- ภาพรวม ---------- */
function pOver() {
  const o = DB.over, ntx = DB.tx.length;
  const yl = o.yearly || [];
  $("#main").innerHTML = `
  <div class="grid g4">
    <div class="card kpi y"><div class="l">เงินบริจาคเข้า 3 บัญชี</div><div class="v">${M(o.donor_in)}</div><div class="s">${fmt0(o.donor_n)} ครั้ง</div></div>
    <div class="card kpi r"><div class="l">เงินออกจากบัญชีรับบริจาค</div><div class="v">${M(o.t1_out)}</div><div class="s">ตั้งแต่ 29 ม.ค. 2558</div></div>
    <div class="card kpi"><div class="l">บัญชีที่มี statement</div><div class="v">${DB.accounts.length}</div><div class="s">${fmt0(ntx)} รายการ</div></div>
    <div class="card kpi g"><div class="l">ผู้ต้องหา / ข้อต่อสู้</div><div class="v">${C.charges.length} / ${C.defences.length}</div><div class="s">งานค้าง ${C.todo.filter((t) => !/เสร็จ/.test(t.status || "")).length} รายการ</div></div>
  </div>
  <h2>เนื้อเรื่อง ${addBtn("story")}</h2>
  <div class="grid g3">${C.story.map((s, i) => `<div class="card item">${acts("story", s.id)}<span class="num">${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.detail)}</p></div></div>`).join("")}</div>
  <h2>เงินออกจากบัญชีรับบริจาค ไปกลุ่มใด <small>แถว 1 → แถว 2 (ทุกช่วงเวลา)</small></h2>
  <div class="card"><div class="chartbox tall"><canvas id="cHop"></canvas></div></div>
  <h2>เงินบริจาคเข้า – ออก รายปี <small>รวม 3 บัญชี (ล้านบาท)</small></h2>
  <div class="card"><div class="chartbox"><canvas id="cYear"></canvas></div></div>`;
  const h = (o.hop1 || []).slice(0, 14);
  CH.hop = new Chart($("#cHop"), { type: "bar", data: { labels: h.map((r) => r[0].split(" (")[0]), datasets: [{ data: h.map((r) => r[1] / 1e6), backgroundColor: h.map((r) => r[3]) }] },
    options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${fmt(c.raw * 1e6)} บาท (${fmt0(h[c.dataIndex][2])} ครั้ง)` } } }, scales: { x: { title: { display: true, text: "ล้านบาท" } } } } });
  CH.year = new Chart($("#cYear"), { type: "bar", data: { labels: yl.map((r) => r[0] + (r[1] ? (r[1].includes("ก่อน") ? " ก่อนตั้ง" : " หลังตั้ง") : "")), datasets: [{ label: "เงินเข้า", data: yl.map((r) => r[2] / 1e6), backgroundColor: "#FFD403" }, { label: "เงินออก", data: yl.map((r) => r[4] / 1e6), backgroundColor: "#00264D" }] },
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} ${fmt(c.raw * 1e6)} บาท` } } } } });
}
/* ---------- คดี / ข้อหา / ข้อต่อสู้ / งาน ---------- */
function pCase() {
  const ev = [...C.events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  $("#main").innerHTML = `<h2>รายละเอียดคดี ${addBtn("case")}</h2>
  <div class="grid g2">${C.case.map((s) => `<div class="card">${acts("case", s.id)}<div class="lab" style="margin-top:0">${esc(s.title)}</div><div>${esc(s.detail)}</div></div>`).join("")}</div>
  <h2>ลำดับเหตุการณ์ ${addBtn("events")}</h2>
  <div class="card"><div class="tl">${ev.map((e) => `<div class="ev" style="position:relative">${acts("events", e.id)}<div class="d">${dTh(e.date)}</div><b>${esc(e.title)}</b><div class="muted">${esc(e.detail)}</div></div>`).join("")}</div></div>`;
}
function pCharges() {
  $("#main").innerHTML = `<h2>ผู้ต้องหาและข้อหา ${addBtn("charges")}</h2>
  <div class="grid g3">${C.charges.map((s) => `<div class="card">${acts("charges", s.id)}<h3 style="margin:0">${esc(s.title)}</h3><div class="muted">${esc(s.extra1)}</div>
    <div class="lab">ข้อหา</div><div>${esc(s.detail).replace(/ \/ /g, "<br>")}</div><div style="margin-top:8px">${badge(s.status)}</div></div>`).join("")}</div>`;
}
function pDef() {
  $("#main").innerHTML = `<h2>ข้อต่อสู้ที่ต้องพิสูจน์ทราบ ${addBtn("defences")}</h2>
  <div class="grid g2">${C.defences.map((s) => `<div class="card">${acts("defences", s.id)}<span class="badge">${esc(s.extra1)}</span> ${badge(s.status)}
    <h3 style="margin:.4em 0 0">${esc(s.title)}</h3><div class="lab">ต้องพิสูจน์</div><div>${esc(s.detail)}</div><div class="lab">หลักฐานที่มี</div><div class="muted">${esc(s.extra2)}</div></div>`).join("")}</div>`;
}
function pWork() {
  const li = (sec, s) => `<div class="card item">${acts(sec, s.id)}<span class="num">${sec === "done" ? "✓" : "!"}</span><div><h3>${esc(s.title)} ${badge(s.status)}</h3><p>${esc(s.detail)}</p>
    ${s.extra1 || s.date ? `<p class="muted" style="font-size:.84rem">${esc(s.extra1 || "")} ${s.date ? "· " + dTh(s.date) : ""}</p>` : ""}</div></div>`;
  $("#main").innerHTML = `<div class="grid g2" style="align-items:start">
    <div><h2>สิ่งที่ต้องทำต่อ <small>${C.todo.length} รายการ</small> ${addBtn("todo")}</h2><div class="grid">${C.todo.map((s) => li("todo", s)).join("")}</div></div>
    <div><h2>สิ่งที่ทำไปแล้ว <small>${C.done.length} รายการ</small> ${addBtn("done")}</h2><div class="grid">${C.done.map((s) => li("done", s)).join("")}</div></div></div>`;
}

/* ---------- ข้อมูลชุดทำคดี (Google Sheet — อ่านอย่างเดียว) : ไอคอน + ตัวอ่านแท็บ ---------- */
const ICP = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  car: '<path d="M5 13l1.6-4.6A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.4L19 13"/><rect x="3" y="13" width="18" height="5" rx="1.5"/><circle cx="7.5" cy="18.5" r="1.4"/><circle cx="16.5" cy="18.5" r="1.4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  scale: '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.6.2 4.5 2 4.5 4.9"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
  build: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M15 9.3c-.6-.9-1.6-1.3-3-1.3-1.7 0-3 .8-3 2s1.2 1.8 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.4"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  flow: '<circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="12" r="2.2"/><circle cx="5" cy="18" r="2.2"/><path d="M7.2 6.6l9.6 4.6M7.2 17.4l9.6-4.6"/>',
  img: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 18l5.5-5 4 3.5 2.5-2 4 3.5"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
};
const IC = (n, s = 22) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICP[n] || ""}</svg>`;
const TEAM = () => DB.team || { tabs: {} };
const tsR = (k) => { const t = TEAM().tabs[k] || {}, n = (t.cols || []).length; return (t.rows || []).map((r) => Array.from({ length: Math.max(n, r.length) }, (_, i) => (r[i] == null ? "" : String(r[i]).trim()))); };
const num = (s) => { const v = parseFloat(String(s || "").replace(/[^\d.\-]/g, "")); return isFinite(v) ? v : 0; };
const isNo = (s) => /^\d+$/.test(s || "");
const MO2 = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"];
function pDate(s) { // "12 พ.ย.69" / "20 พ.ย. 69" / "12/11/2569" / "31/10/69" -> ค.ศ. yyyy-mm-dd
  s = String(s || "").trim(); let d, mo, y, m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else { m = s.match(/(\d{1,2})\s*([฀-๿.]+)\s*(\d{2,4})\s*$/); if (!m) return ""; d = +m[1]; mo = MO2.indexOf(m[2].replace(/\./g, "")) + 1; y = +m[3]; }
  if (!mo || mo > 12 || !d || d > 31) return "";
  if (y < 100) y += 2500; if (y > 2400) y -= 543;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const isoNow = () => { const d = new Date(), p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
function parseCSV(t) {
  const out = []; let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
    else if (ch !== "\r") cur += ch;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out;
}
async function teamLive() { // ดึงสดจากชีต (อ่านอย่างเดียว) ทุกแท็บที่ใช้ — เก็บเฉพาะคอลัมน์ที่กำหนด
  const T = TEAM(); if (!T.id) throw new Error("ยังไม่ได้ตั้งค่าชีต");
  const ks = Object.keys(T.tabs);
  const res = await Promise.all(ks.map(async (k) => {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${T.id}/export?format=csv&gid=${T.tabs[k].gid}`, { credentials: "omit", cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return parseCSV(await r.text());
  }));
  ks.forEach((k, i) => { const c = T.tabs[k].cols; T.tabs[k].rows = res[i].map((r) => c.map((j) => (r[j] || "").trim())).filter((r) => r.some(Boolean)); });
  T.fetched = isoNow(); T.live = true;
}
const tsStamp = () => { const T = TEAM(); return T.fetched ? `${dTh(T.fetched)} ${T.fetched.slice(11)}${T.live ? " · สด" : ""}` : "ยังไม่มีข้อมูล"; };
const syncBtn = () => `<button class="chip" id="tsSync" title="ดึงข้อมูลล่าสุดจากชีต">${IC("sync", 15)} อัปเดต</button>`;
function tsClick(b) { if (b.id !== "tsSync") return false; toast("กำลังดึงข้อมูล…"); teamLive().then(() => { toast("อัปเดตแล้ว"); render(); }).catch((e) => toast("ดึงไม่ได้: " + e.message)); return true; }
const tile = (k, ic, v, l, s) => `<button class="tile" data-v="${k}"><span class="ico">${IC(ic)}</span><span class="v">${v}</span><span class="l">${l}</span>${s ? `<span class="s">${s}</span>` : ""}<span class="go">${IC("next", 16)}</span></button>`;
const backBtn = () => `<button class="back" data-v="">${IC("back", 18)} กลับ</button>`;
const stBadge = (s) => (!s ? "" : `<span class="badge ${/มาพบแล้ว|ได้แล้ว|เรียบร้อย/.test(s) ? "g" : /ยังไม่/.test(s) ? "r" : /ออกแล้ว|ขอแล้ว|รอ|อยู่ระหว่าง/.test(s) ? "y" : ""}">${esc(s)}</span>`);
const li = (t, sub, a) => `<div class="li"><div class="t"><b>${t}</b>${sub ? `<small>${sub}</small>` : ""}</div>${a ? `<div class="a">${a}</div>` : ""}</div>`;
const accd = (t, a, body, open) => `<details class="acc"${open ? " open" : ""}><summary><span class="t">${t}</span><span class="a">${a || ""}</span></summary><div class="body">${body}</div></details>`;
const dShow = (s) => { const d = pDate(s); return d ? dTh(d) : esc(s); };
const dRange = (ds) => { const v = ds.filter(Boolean).sort(); return !v.length ? "" : v[0] === v[v.length - 1] ? dTh(v[0]) : `${dTh(v[0])} – ${dTh(v[v.length - 1])}`; };

/* ตัวอ่านแต่ละแท็บ */
function progTasks() {
  const out = [];
  for (const r of tsR("prog")) {
    const [no, date, title, detail, owner, due, prob, note] = r;
    if (no === "ลำดับ") continue;
    if (!no && !date && out.length) { const t = out[out.length - 1]; if (title) t.title += " / " + title; if (detail) t.detail += (t.detail ? "\n" : "") + detail; if (owner && !t.owner) t.owner = owner; if (due && !t.due) t.due = due; if (prob) t.prob += (t.prob ? " ; " : "") + prob; if (note) t.note += (t.note ? " ; " : "") + note; continue; }
    if (!title && !detail) continue;
    out.push({ no, date: pDate(date), title, detail, owner: owner.replace(/\s+/g, " ").replace(/^ชป\.?\s*(\d)/, "ชป.$1"), due, prob, note });
  }
  out.forEach((t) => { t.st = /เรียบร้อย|เสร็จ/.test(t.due) ? "done" : /รอ/.test(t.due) ? "wait" : t.due ? "doing" : "none"; });
  return out;
}
function tsSum() { // แท็บรวมทรัพย์สิน -> [{name, own:[a,b], items:[[ชื่อ, ยอด, เจ้าของ]], tot:[a,b]}]
  const R = tsR("sum"), out = []; let cur = null;
  for (let i = 0; i < R.length; i++) {
    const [a, b, c, d] = R[i], nx = R[i + 1] || [];
    if (a && !b && !c && !d && nx[0] && !nx[1] && nx[2] && !nx[3]) { cur = { name: a, own: [nx[0], nx[2]], items: [], st: [null, null], tot: [0, 0] }; out.push(cur); i++; continue; }
    if (!cur) continue;
    if (!a && !c) { if (b) cur.st[0] = num(b); if (d) cur.st[1] = num(d); continue; }
    if (a) cur.items.push([a, num(b), 0]);
    if (c) cur.items.push([c, num(d), 1]);
  }
  out.forEach((s) => [0, 1].forEach((o) => { s.tot[o] = s.st[o] != null ? s.st[o] : s.items.filter((x) => x[2] === o).reduce((t, x) => t + x[1], 0); }));
  return out;
}
function tsFrz() { // แท็บอายัดทั้งหมด -> หมวด + รายบัญชี
  const out = []; let cur = null, stated = null;
  for (const r of tsR("frz")) {
    const gi = r.findIndex((x) => /ยอดอายัดทั้งสิ้น/.test(x));
    if (gi >= 0) { stated = num(r.slice(gi + 1).find(Boolean)); continue; }
    if (isNo(r[0]) && r[2]) { if (!cur) { cur = { title: "", rows: [] }; out.push(cur); } cur.rows.push({ bank: r[1], acc: r[2], name: r[3], ref: r[4], date: r[5], amt: num(r[6]), note: r[7] || "" }); continue; }
    if (r.filter(Boolean).length === 1 && r[0]) { cur = { title: r[0], rows: [] }; out.push(cur); }
  }
  return { secs: out.filter((s) => s.rows.length), stated };
}
const tsLand = () => tsR("land").filter((r) => r[1] && r[0] !== "ข้อ" && !/^รวม/.test(r[0])).map((r) => ({ no: r[0], own: r[1], deed: r[2], area: r[3], loc: r[4], bld: r[5], date: r[6], from: r[7], price: num(r[8]), mort: r[9], act: r[10] }));
const tsIns = () => tsR("ins").filter((r) => isNo(r[0]) && r[1]).map((r) => ({ pol: r[1], co: r[2], who: r[3], from: r[4], to: r[5], prem: num(r[6]), st: r[7] }));
const tsAcc = () => tsR("acc").filter((r) => isNo(r[0]) && r[1]).map((r) => ({ acc: r[1], name: r[2], bank: r[3], ref: r[4], data: r[5], wd: r[6], note: r[9] }));
const tsSus = () => tsR("sus").filter((r) => isNo(r[0]) && r[1]).map((r) => ({ name: r[1], issue: r[2], date: r[3], time: r[4], st: r[5], off: r[6], note: r[7] }));
function tsWit() {
  const out = []; let cur = null, land = false;
  for (const r of tsR("wit")) {
    if (r[0] === "ลำดับ") { land = /โฉนด/.test(r[1]); continue; }
    if (r.filter(Boolean).length === 1 && r[0] && !isNo(r[0])) { cur = { title: r[0], rows: [] }; out.push(cur); continue; }
    if (isNo(r[0])) { if (!cur) { cur = { title: "", rows: [] }; out.push(cur); } cur.rows.push({ name: land ? r[2] : r[1], sub: land ? "โฉนด " + r[1] : r[2], date: r[3], time: r[4], st: r[5], off: r[6], note: r[7] }); }
  }
  return out.filter((s) => s.rows.length);
}
const tsAnu = () => tsR("anu").filter((r) => r[0] && r[0] !== "หมายมายัง").map((r) => ({ name: r[0], prov: r[1], issued: r[2], meet: r[3] }));
const tsCo = () => tsR("co").filter((r) => r[0] && !/ชื่อนิติบุคคล/.test(r[0])).map((r) => ({ name: r[0], type: r[1] }));
const tsPpl = () => tsR("ppl").filter((r) => isNo(r[0]) && r[1]).map((r) => ({ name: r[1], note: r[2].replace(/https?:\/\/\S+/g, "").replace(/[\s\/]+$/, "").trim() }));

/* ---------- ความคืบหน้าการทำคดี ---------- */
const PST = { done: ["เสร็จ", "#1B7A4A"], wait: ["รอผล", "#E0A800"], doing: ["ดำเนินการ", "#1565C0"], none: ["ยังไม่ระบุ", "#9E9E9E"] };
const KIND = { task: ["check", "งาน"], sus: ["scale", "ผู้ต้องหา"], wit: ["users", "พยาน"], anu: ["doc", "หมายเรียกเอกสาร / รถ"] };
let PV = "", PF = { st: new Set(), own: new Set() }, AF = "";
function pProg() {
  const T = progTasks(), S = tsSus(), W = tsWit(), A = tsAnu(), AC = tsAcc(), CO = tsCo(), PP = tsPpl();
  const wAll = W.flatMap((s) => s.rows), came = (rs) => rs.filter((r) => /มาพบ/.test(r.st)).length;
  const cnt = (k) => T.filter((t) => t.st === k).length, got = AC.filter((r) => /ได้แล้ว/.test(r.data)).length;
  const head = (ic, t, s) => `${backBtn()}<h2>${IC(ic)} ${t} <small>${s || ""}</small></h2>`;
  let h = "";
  if (PV === "task") {
    const owners = [...new Set(T.map((t) => t.owner).filter(Boolean))];
    const show = T.filter((t) => (!PF.st.size || PF.st.has(t.st)) && (!PF.own.size || PF.own.has(t.owner)));
    h = head("check", "งานที่ดำเนินการ", `${show.length} / ${T.length} งาน`) + `
    <div class="grid g2"><div class="card"><div class="chartbox sm"><canvas id="cPgDay"></canvas></div></div><div class="card"><div class="chartbox sm"><canvas id="cPgOwn"></canvas></div></div></div>
    <div class="frow" style="margin-top:12px">${Object.entries(PST).map(([k, v]) => `<button class="chip ${PF.st.has(k) ? "on" : ""}" data-ps="${k}"><span class="dot" style="background:${v[1]}"></span>${v[0]} ${cnt(k)}</button>`).join("")}</div>
    <div class="frow" style="margin-top:6px">${owners.map((o) => `<button class="chip ${PF.own.has(o) ? "on" : ""}" data-po="${esc(o)}">${IC("user", 14)} ${esc(o)}</button>`).join("")}</div>
    ${show.map((t) => accd(`<span class="dot" style="background:${PST[t.st][1]}"></span> ${esc(t.no ? t.no + ". " : "")}${esc(t.title)}`, t.date ? dTh(t.date) : "",
      `${t.detail ? `<div class="pgd">${esc(t.detail).replace(/\n/g, "<br>")}</div>` : ""}<div class="pgm">${t.owner ? `<span class="badge">${IC("user", 13)} ${esc(t.owner)}</span>` : ""}${t.due ? stBadge(t.due) : ""}</div>${t.prob ? `<div class="pgw">${IC("warn", 15)} ${esc(t.prob)}</div>` : ""}${t.note ? `<div class="muted pgn">${esc(t.note)}</div>` : ""}`)).join("") || '<p class="muted">ไม่มีรายการตามตัวกรอง</p>'}`;
  } else if (PV === "sus") {
    h = head("scale", "หมายเรียกผู้ต้องหา", `${S.length} ราย`) + `<div class="card">${S.map((r) => li(esc(r.name), `${esc(r.issue)}${r.off ? " · " + esc(r.off) : ""}${r.note ? " · " + esc(r.note) : ""}`, `${dShow(r.date)}${r.time ? " · " + esc(r.time) : ""}<br>${stBadge(r.st)}`)).join("")}</div>`;
  } else if (PV === "wit") {
    h = head("users", "หมายเรียกพยาน", `มาพบแล้ว ${came(wAll)} / ${wAll.length}`) + W.map((s, i) => accd(esc(s.title || "พยาน"), `${came(s.rows)} / ${s.rows.length}`,
      s.rows.map((r) => li(esc(r.name), [r.sub, r.date ? dShow(r.date) + (r.time ? " " + esc(r.time) : "") : "", r.off, r.note].filter(Boolean).map((x, j) => (j === 1 ? x : esc(x))).join(" · "), stBadge(r.st))).join(""), i === 0)).join("");
  } else if (PV === "anu") {
    h = head("doc", "หมายเรียกเอกสาร / ครอบครองรถ", `${A.length} ราย`) + `<div class="card">${A.map((r) => li(esc(r.name), esc(r.prov), r.meet ? `${IC("cal", 14)} ${dShow(r.meet)}` : "")).join("")}</div>`;
  } else if (PV === "acc") {
    const ks = [...new Set(AC.map((r) => r.data).filter(Boolean))], show = AC.filter((r) => !AF || r.data === AF);
    h = head("bank", "ขอข้อมูลบัญชี", `ได้แล้ว ${got} / ${AC.length}`) + `<div class="frow">${ks.map((k) => `<button class="chip ${AF === k ? "on" : ""}" data-af="${esc(k)}">${esc(k)} ${AC.filter((r) => r.data === k).length}</button>`).join("")}</div>
    <div class="card" style="margin-top:8px">${show.map((r) => li(`${esc(r.bank)} ${esc(r.acc)}`, `${esc(r.name)}${r.wd ? " · ถอนเงิน: " + esc(r.wd) : ""}`, stBadge(r.data))).join("")}</div>`;
  } else if (PV === "co") {
    h = head("build", "นิติบุคคลที่ออกหมายเรียก", `${CO.length} ราย`) + `<div class="card">${CO.map((r) => li(esc(r.name), esc(r.type))).join("")}</div>`;
  } else if (PV === "ppl") {
    h = head("user", "บุคคล / นิติบุคคลที่เกี่ยวข้อง", `${PP.length} ราย`) + `<div class="card">${PP.map((r) => li(esc(r.name), esc(r.note))).join("")}</div>`;
  } else {
    const ev = [...T.map((t) => ({ d: t.date, k: "task", n: t.title })), ...S.map((r) => ({ d: pDate(r.date), k: "sus", n: r.name })), ...wAll.map((r) => ({ d: pDate(r.date), k: "wit", n: r.name })), ...A.map((r) => ({ d: pDate(r.meet), k: "anu", n: r.name }))].filter((e) => e.d);
    const days = [...new Set(ev.map((e) => e.d))].sort(), today = isoNow().slice(0, 10);
    const pct = T.length ? Math.round((cnt("done") / T.length) * 100) : 0;
    h = `<h2>${IC("cal")} ความคืบหน้า <small>${tsStamp()}</small> ${syncBtn()}</h2>
    <div class="tiles">
      ${tile("task", "check", `${cnt("done")}<small>/${T.length}</small>`, "งานเสร็จ", `<span class="bar"><i style="width:${pct}%;background:var(--green)"></i></span>`)}
      ${tile("sus", "scale", S.length, "หมายเรียกผู้ต้องหา", dRange(S.map((r) => pDate(r.date))))}
      ${tile("wit", "users", `${came(wAll)}<small>/${wAll.length}</small>`, "พยานมาพบแล้ว", dRange(wAll.map((r) => pDate(r.date))))}
      ${tile("anu", "doc", A.length, "หมายเรียกเอกสาร / รถ", dRange(A.map((r) => pDate(r.meet))))}
      ${tile("acc", "bank", `${got}<small>/${AC.length}</small>`, "ข้อมูลบัญชีได้แล้ว", "")}
      ${tile("co", "build", CO.length, "นิติบุคคล", "")}
      ${tile("ppl", "user", PP.length, "ผู้เกี่ยวข้อง", "")}
    </div>
    <h2>${IC("flow")} เส้นเวลา <small>${Object.values(KIND).map((v) => `<span class="cnt">${IC(v[0], 14)}${v[1]}</span>`).join("")}</small></h2>
    ${days.map((d) => { const es = ev.filter((e) => e.d === d);
      return `<details class="acc tlr ${d < today ? "past" : d === today ? "now" : ""}"><summary><span class="t">${dTh(d)}${d === today ? ' <span class="badge y">วันนี้</span>' : ""}</span><span class="a">${Object.keys(KIND).map((k) => { const n = es.filter((e) => e.k === k).length; return n ? `<span class="cnt">${IC(KIND[k][0], 15)}${n}</span>` : ""; }).join("")}</span></summary>
      <div class="body">${Object.keys(KIND).map((k) => { const v = es.filter((e) => e.k === k); return v.length ? `<div class="lab">${IC(KIND[k][0], 14)} ${KIND[k][1]} ${v.length}</div><div class="pgd">${v.slice(0, 12).map((e) => esc(e.n)).join(" · ")}${v.length > 12 ? ` … อีก ${v.length - 12}` : ""}</div>` : ""; }).join("")}</div></details>`; }).join("") || '<p class="muted">ยังไม่มีข้อมูล</p>'}`;
  }
  const m = $("#main"); m.innerHTML = h;
  if (PV === "task") {
    const allDays = [...new Set(T.map((t) => t.date || ""))].sort(), owners = [...new Set(T.map((t) => t.owner))];
    const ds = (f) => Object.entries(PST).map(([k, v]) => ({ label: v[0], data: f(k), backgroundColor: v[1], stack: "s" }));
    const op = (hz) => ({ indexAxis: hz ? "y" : "x", maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } } }, scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true, ticks: { precision: 0 } } } });
    CH.pgDay = new Chart($("#cPgDay"), { type: "bar", data: { labels: allDays.map((d) => (d ? dTh(d) : "ไม่ระบุ")), datasets: ds((k) => allDays.map((d) => T.filter((t) => (t.date || "") === d && t.st === k).length)) }, options: op(false) });
    CH.pgOwn = new Chart($("#cPgOwn"), { type: "bar", data: { labels: owners.map((o) => o || "ไม่ระบุ"), datasets: ds((k) => owners.map((o) => T.filter((t) => t.owner === o && t.st === k).length)) }, options: op(true) });
  }
  m.onclick = (e) => {
    const b = e.target.closest("button"); if (!b || tsClick(b)) return;
    const tg = (s, v) => (s.has(v) ? s.delete(v) : s.add(v));
    if (b.dataset.v != null) { PV = b.dataset.v; render(); window.scrollTo(0, 0); }
    else if (b.dataset.ps) { tg(PF.st, b.dataset.ps); render(); }
    else if (b.dataset.po) { tg(PF.own, b.dataset.po); render(); }
    else if (b.dataset.af != null) { AF = AF === b.dataset.af ? "" : b.dataset.af; render(); }
  };
}

/* ---------- ทรัพย์สิน (ตามชีตชุดทำคดี) ---------- */
const OC = ["#FFD403", "#6FB1F2"];
let AV = "";
const secIc = (n) => (/ที่ดิน/.test(n) ? "home" : /รถ/.test(n) ? "car" : "shield");
const secNm = (n) => n.split("(")[0].trim();
const amtS = (v) => (v ? M(v) : "–");
function pAsset() {
  const S = tsSum(), FZ = tsFrz(), own = S[0] ? S[0].own : ["", ""];
  const tot = [0, 1].map((o) => S.reduce((t, s) => t + s.tot[o], 0)), all = tot[0] + tot[1];
  const fz = FZ.secs.flatMap((s) => s.rows), fzSum = fz.reduce((t, r) => t + r.amt, 0);
  let h = "";
  const si = AV.startsWith("s") ? +AV.slice(1) : -1, sec = S[si];
  if (sec) {
    const st = sec.tot[0] + sec.tot[1], mx = Math.max(1, ...sec.items.map((x) => x[1]));
    h = `${backBtn()}<h2>${IC(secIc(sec.name))} ${esc(secNm(sec.name))} <small>${M(st)}</small></h2>
    <div class="grid g2">${[0, 1].map((o) => `<div class="card"><div class="own"><span class="dot" style="background:${OC[o]}"></span><b>${esc(sec.own[o])}</b><span>${M(sec.tot[o])}</span></div>
      ${sec.items.filter((x) => x[2] === o).map((x) => `<div class="row"><span>${esc(x[0])}</span><span>${amtS(x[1])}</span></div><div class="bar"><i style="width:${(x[1] / mx) * 100}%;background:${OC[o]}"></i></div>`).join("")}</div>`).join("")}</div>`;
    if (/ที่ดิน/.test(sec.name)) {
      const L = tsLand(), os = [...new Set(L.map((r) => r.own))];
      if (L.length) h += `<h2>${IC("list")} รายแปลง <small>${L.length} รายการ</small></h2>` + os.map((o) => { const v = L.filter((r) => r.own === o);
        return accd(`${esc(o)} · ${v.length} รายการ`, M(v.reduce((t, r) => t + r.price, 0)), v.map((r) => li(esc(r.loc), `${esc(r.area)}${r.bld && !/ไม่พบ/.test(r.bld) ? " · " + esc(r.bld) : ""}${r.date ? " · " + esc(r.date) : ""}${/จำนอง/.test(r.mort) ? ` · ${IC("lock", 12)} จำนอง` : ""}`, amtS(r.price))).join("")); }).join("");
    }
    if (/ประกัน/.test(sec.name)) {
      const I = tsIns(), SL = tsR("slak").filter((r) => isNo(r[0]));
      if (I.length) h += `<h2>${IC("list")} รายละเอียด</h2>` + accd(`${IC("shield", 16)} กรมธรรม์ประกันชีวิต`, `${I.length} ฉบับ`, I.map((r) => li(esc(r.co), `${esc(r.pol)} · ${esc(r.from)} – ${esc(r.to)}${r.st ? " · " + esc(r.st) : ""}`, r.prem > 1e8 ? `<span class="badge r">${IC("warn", 12)} ตรวจทาน</span>` : r.prem ? fmt0(r.prem) : "–")).join(""));
      if (SL.length) h += accd(`${IC("coin", 16)} สลาก`, `${SL.length} รายการ`, SL.map((r) => li(esc(r[1]), "", fmt0(num(r[3])))).join(""));
    }
  } else if (AV === "frz") {
    h = `${backBtn()}<h2>${IC("lock")} เงินในบัญชีที่อายัด <small>${fz.length} บัญชี</small></h2>
    <div class="hero"><div class="l">ยอดรวม</div><div class="v">${M(fzSum)}</div><div class="l">${fmt(fzSum)} บาท${FZ.stated != null && Math.abs(FZ.stated - fzSum) > 0.01 ? ` · ชีตระบุ ${fmt(FZ.stated)}` : ""}</div></div>
    ${FZ.secs.map((s, i) => accd(esc(s.title || "บัญชี"), `${s.rows.length} บัญชี · ${M(s.rows.reduce((t, r) => t + r.amt, 0))}`, s.rows.map((r) => li(`${esc(r.bank)} ${esc(r.acc)}`, `${esc(r.name)}${r.note ? " · " + esc(r.note) : ""}`, fmt(r.amt))).join(""), i === 0)).join("")}`;
  } else {
    h = `<div class="hero"><div class="l">ทรัพย์สินที่ตรวจพบ · ${S.length} หมวด</div><div class="v">${M(all)}</div>
      <div class="split">${[0, 1].map((o) => `<i style="width:${all ? (tot[o] / all) * 100 : 0}%;background:${OC[o]}"></i>`).join("")}</div>
      <div class="leg">${[0, 1].map((o) => `<span style="--c:${OC[o]}">${esc(own[o])} ${M(tot[o])}</span>`).join("")}</div>
      <div class="l" style="margin-top:8px">${IC("lock", 15)} เงินในบัญชีที่อายัด <b style="color:#fff">${M(fzSum)}</b> · ${fz.length} บัญชี</div></div>
    <div class="tiles" style="margin-top:12px">
      ${S.map((s, i) => tile("s" + i, secIc(s.name), M(s.tot[0] + s.tot[1]), esc(secNm(s.name)), `${s.items.length} รายการ`)).join("")}
      ${tile("frz", "lock", M(fzSum), "บัญชีที่อายัด", `${fz.length} บัญชี`)}
    </div>
    <h2>${IC("chart")} แยกหมวด <small>ล้านบาท</small></h2>
    <div class="card"><div class="chartbox sm"><canvas id="cAs"></canvas></div></div>
    <p class="muted" style="font-size:.82rem">${IC("sync", 13)} ${tsStamp()} ${syncBtn()}</p>`;
  }
  const m = $("#main"); m.innerHTML = h;
  if (!AV && S.length) CH.as = new Chart($("#cAs"), { type: "bar", data: { labels: S.map((s) => secNm(s.name)), datasets: [0, 1].map((o) => ({ label: own[o], data: S.map((s) => s.tot[o] / 1e6), backgroundColor: OC[o], stack: "s" })) },
    options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} ${fmt0(c.raw * 1e6)} บาท` } } }, scales: { x: { stacked: true }, y: { stacked: true } } } });
  m.onclick = (e) => { const b = e.target.closest("button"); if (!b || tsClick(b)) return; if (b.dataset.v != null) { AV = b.dataset.v; render(); window.scrollTo(0, 0); } };
}

/* ---------- วิเคราะห์เส้นเงิน ---------- */
const T0 = Date.UTC(2015, 0, 1) / 60000;
const KCOL = ["#1565C0", "#00897B", "#B3261E", "#9E9E9E", "#FFD403"];
const IN_K = [0, 1, 4];
let F = null, TXM = null, SHOWN = 200;
const day2min = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 60000 - T0;
const min2iso = (m) => new Date((m + T0) * 60000).toISOString();
function prep() {
  const n = DB.tx.length; TXM = new Int32Array(n);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const t = DB.tx[i][1]; const d = new Date((t + T0) * 60000); TXM[i] = d.getUTCFullYear() * 12 + d.getUTCMonth(); if (t < lo) lo = t; if (t > hi) hi = t; }
  DB.lo = min2iso(lo).slice(0, 10); DB.hi = min2iso(hi).slice(0, 10);
  resetF();
}
function resetF() { F = { from: DB.lo, to: DB.hi, accs: new Set(), kinds: new Set(), cpg: new Set(), min: 0, q: "", gran: "auto" }; SHOWN = 200; }
function filterTx() {
  const a = day2min(F.from), b = day2min(F.to) + 1440, q = F.q.trim().toLowerCase();
  const out = [];
  for (let i = 0; i < DB.tx.length; i++) {
    const r = DB.tx[i];
    if (r[1] < a || r[1] >= b) continue;
    if (F.accs.size && !F.accs.has(r[0])) continue;
    if (F.kinds.size && !F.kinds.has(r[2])) continue;
    if (r[3] < F.min) continue;
    const cp = DB.cps[r[4]];
    if (F.cpg.size && !F.cpg.has(cp[3])) continue;
    if (q && !(cp[1].toLowerCase().includes(q) || cp[0].includes(q))) continue;
    out.push(i);
  }
  return out;
}
function pAna() {
  const gAcc = {}; DB.accounts.forEach((a, i) => (gAcc[a.g] = gAcc[a.g] || []).push(i));
  const usedCpg = [...new Set(DB.cps.map((c) => c[3]))].sort((x, y) => x - y);
  const yrs = []; for (let y = +DB.lo.slice(0, 4); y <= +DB.hi.slice(0, 4); y++) yrs.push(y);
  $("#main").innerHTML = `
  <details class="fbox" ${innerWidth > 760 ? "open" : ""}><summary>ตัวกรอง <span id="fSum" class="muted" style="font-weight:400"></span></summary>
   <div class="filters" style="margin-top:10px">
    <div class="frow"><label>ช่วงเวลา</label><input type="date" id="fFrom" value="${F.from}"> – <input type="date" id="fTo" value="${F.to}">
      <button class="chip" data-p="all">ทั้งหมด</button><button class="chip" data-p="before">ก่อนตั้งมูลนิธิ</button><button class="chip" data-p="after">หลังตั้งมูลนิธิ</button>
      ${yrs.slice(-4).map((y) => `<button class="chip" data-p="${y}">ปี ${y + 543}</button>`).join("")}</div>
    <div class="frow"><label>กลุ่มบัญชี</label>${Object.keys(gAcc).map((g) => `<button class="chip" data-g="${g}"><span class="dot" style="background:${DB.groups[g][2]}"></span>${esc(DB.groups[g][1].split(" (")[0])} (${gAcc[g].length})</button>`).join("")}</div>
    <div class="frow"><label>รายบัญชี</label><div class="acclist">${DB.accounts.map((a, i) => `<label title="${esc(a.name)}"><input type="checkbox" data-a="${i}"> ${a.bank} ${a.acc} ${esc(a.name)}</label>`).join("")}</div></div>
    <div class="frow"><label>ประเภทรายการ</label>${DB.kinds.map((k, i) => `<button class="chip" data-k="${i}"><span class="dot" style="background:${KCOL[i]}"></span>${k}</button>`).join("")}</div>
    <div class="frow"><label>กลุ่มคู่โอน</label>${usedCpg.map((g) => `<button class="chip" data-c="${g}"><span class="dot" style="background:${DB.groups[g][2]}"></span>${esc(DB.groups[g][1].split(" (")[0])}</button>`).join("")}</div>
    <div class="frow"><label>ยอดขั้นต่ำ</label><input type="number" id="fMin" min="0" step="1000" value="${F.min || ""}" placeholder="บาท" style="width:130px">
      <input type="search" id="fQ" value="${esc(F.q)}" placeholder="ค้นหาชื่อ / เลขบัญชีคู่โอน">
      <button class="btn o" id="fClear">ล้างตัวกรอง</button><button class="btn o" id="fCsv">ส่งออก CSV</button></div>
   </div></details>
  <div class="grid g4" style="margin-top:12px" id="aKpi"></div>
  <p class="muted" style="font-size:.82rem;margin:.6em 0 0">ยอดตาม statement ของบัญชีที่เลือก — การโอนระหว่างบัญชีที่มี statement ทั้งสองฝั่งจะปรากฏทั้งฝั่งออกและฝั่งเข้า ; เงินบริจาคเข้าบัญชีมูลนิธิแสดงเป็นยอดรวมรายเดือน</p>
  <h2>ตามเวลา <small id="granLab"></small> <button class="chip" id="gBtn">สลับ รายเดือน / รายปี</button></h2>
  <div class="card"><div class="chartbox"><canvas id="cTime"></canvas></div></div>
  <div class="grid g2" style="margin-top:12px">
    <div><h2>ตามกลุ่มคู่โอน <small>กดแท่งเพื่อกรอง</small></h2><div class="card"><div class="chartbox tall"><canvas id="cCpg"></canvas></div></div></div>
    <div><h2>ตามบัญชี <small>กดแท่งเพื่อกรอง</small></h2><div class="card"><div class="chartbox tall"><canvas id="cAcc"></canvas></div></div></div>
  </div>
  <h2>คู่โอนรายใหญ่ <small>50 อันดับ — กดแถวเพื่อค้นหา</small></h2><div class="tblwrap" id="tCp"></div>
  <h2>รายการ <small id="txLab"></small></h2><div class="tblwrap" id="tTx"></div>
  <p style="text-align:center"><button class="btn o" id="more">แสดงเพิ่ม</button></p>`;
  const m = $("#main");
  m.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.p) { const p = b.dataset.p; F.from = p === "after" ? DB.cut : /^\d+$/.test(p) ? p + "-01-01" : DB.lo; F.to = p === "before" ? "2022-06-24" : /^\d+$/.test(p) ? p + "-12-31" : DB.hi; $("#fFrom").value = F.from; $("#fTo").value = F.to; }
    else if (b.dataset.g) { const ids = gAcc[b.dataset.g]; const all = ids.every((i) => F.accs.has(i)); ids.forEach((i) => (all ? F.accs.delete(i) : F.accs.add(i))); }
    else if (b.dataset.k) tog(F.kinds, +b.dataset.k);
    else if (b.dataset.c) tog(F.cpg, +b.dataset.c);
    else if (b.id === "fClear") { resetF(); return pAna(); }
    else if (b.id === "fCsv") return csv();
    else if (b.id === "gBtn") F.gran = (F._g === "y") ? "m" : "y";
    else if (b.id === "more") { SHOWN += 300; return upd(true); }
    else return;
    SHOWN = 200; upd();
  };
  m.onchange = (e) => { const t = e.target;
    if (t.id === "fFrom") F.from = t.value || DB.lo; else if (t.id === "fTo") F.to = t.value || DB.hi; else if (t.dataset.a) tog(F.accs, +t.dataset.a, t.checked); else return; upd(); };
  let tmr; m.oninput = (e) => { const t = e.target; if (t.id !== "fMin" && t.id !== "fQ") return; clearTimeout(tmr); tmr = setTimeout(() => { F.min = +$("#fMin").value || 0; F.q = $("#fQ").value; upd(); }, 280); };
  const tog = (s, v, on) => ((on ?? !s.has(v)) ? s.add(v) : s.delete(v));
  let IDX = [];
  function csv() {
    const L = ["วันเวลา,ธนาคาร,บัญชี,ชื่อบัญชี,ประเภทรายการ,ยอด,ครั้ง,บัญชีคู่โอน,ธนาคารคู่โอน,ชื่อคู่โอน,กลุ่มคู่โอน"];
    const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    IDX.forEach((i) => { const r = DB.tx[i], a = DB.accounts[r[0]], c = DB.cps[r[4]]; L.push([min2iso(r[1]).slice(0, 16).replace("T", " "), a.bank, q("'" + a.acc), q(a.name), DB.kinds[r[2]], r[3], r[5] || 1, q(c[0] ? "'" + c[0] : ""), c[2], q(c[1]), q(DB.groups[c[3]][1])].join(",")); });
    download("รายการที่กรอง.csv", L.join("\r\n"), "text/csv");
  }
  function upd(tableOnly) {
    IDX = filterTx();
    const K = DB.kinds.map(() => [0, 0]), byG = {}, byA = {}, byC = new Map(), byT = new Map();
    const span = (+F.to.slice(0, 4) * 12 + +F.to.slice(5, 7)) - (+F.from.slice(0, 4) * 12 + +F.from.slice(5, 7));
    const gy = F.gran === "y" || (F.gran === "auto" && span > 47); F._g = gy ? "y" : "m";
    for (const i of IDX) {
      const r = DB.tx[i], k = r[2], amt = r[3], n = r[5] || 1, c = DB.cps[r[4]], inn = IN_K.includes(k) ? 0 : 1;
      K[k][0] += amt; K[k][1] += n;
      (byG[c[3]] = byG[c[3]] || [0, 0])[inn] += amt;
      (byA[r[0]] = byA[r[0]] || [0, 0])[inn] += amt;
      let o = byC.get(r[4]); if (!o) byC.set(r[4], (o = [0, 0, 0])); o[inn] += amt; o[2] += n;
      const tk = gy ? Math.floor(TXM[i] / 12) : TXM[i]; let t = byT.get(tk); if (!t) byT.set(tk, (t = [0, 0, 0, 0, 0])); t[k] += amt;
    }
    const tin = K[0][0] + K[1][0] + K[4][0], tout = K[2][0] + K[3][0];
    $("#aKpi").innerHTML = [["เงินเข้ารวม", tin, K[0][1] + K[1][1] + K[4][1], ""], ["เงินออกรวม", tout, K[2][1] + K[3][1], "r"], ["ถอนเงินสด", K[3][0], K[3][1], "x"], ["ฝากเงินสด", K[1][0], K[1][1], "g"], ["โอนออก / จ่าย", K[2][0], K[2][1], "r"], ["โอนเข้า / รับเงิน", K[0][0], K[0][1], ""], ["รับบริจาค", K[4][0], K[4][1], "y"], ["สุทธิ (เข้า − ออก)", tin - tout, IDX.length, ""]]
      .map(([l, v, n, c]) => `<div class="card kpi ${c}"><div class="l">${l}</div><div class="v">${M(v)}</div><div class="s">${fmt(v)} บาท</div><div class="s">${fmt0(n)} ${l.startsWith("สุทธิ") ? "แถวข้อมูล" : "ครั้ง"}</div></div>`).join("");
    $("#fSum").textContent = `— ${dTh(F.from)} ถึง ${dTh(F.to)} · ${F.accs.size || "ทุก"} บัญชี · ${fmt0(IDX.length)} แถว`;
    $$("[data-k]", m).forEach((b) => b.classList.toggle("on", F.kinds.has(+b.dataset.k)));
    $$("[data-c]", m).forEach((b) => b.classList.toggle("on", F.cpg.has(+b.dataset.c)));
    $$("[data-g]", m).forEach((b) => b.classList.toggle("on", gAcc[b.dataset.g].every((i) => F.accs.has(i))));
    $$("[data-a]", m).forEach((b) => (b.checked = F.accs.has(+b.dataset.a)));
    // ตาราง
    const top = [...byC.entries()].sort((x, y) => (y[1][0] + y[1][1]) - (x[1][0] + x[1][1])).slice(0, 50);
    $("#tCp").innerHTML = `<table><tr><th>#</th><th>คู่โอน</th><th>บัญชี</th><th>กลุ่ม</th><th class="n">เงินเข้า (บาท)</th><th class="n">เงินออก (บาท)</th><th class="n">ครั้ง</th></tr>` +
      top.map(([ci, v], i) => { const c = DB.cps[ci]; return `<tr class="click" data-q="${esc(c[0] || c[1])}"><td>${i + 1}</td><td>${esc(c[1]) || "<span class=muted>ไม่ระบุชื่อ</span>"}</td><td>${c[2]} ${c[0]}</td><td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${DB.groups[c[3]][2]}"></span> ${esc(DB.groups[c[3]][1].split(" (")[0])}</td><td class="n">${v[0] ? fmt(v[0]) : ""}</td><td class="n">${v[1] ? fmt(v[1]) : ""}</td><td class="n">${fmt0(v[2])}</td></tr>`; }).join("") + "</table>";
    $("#tCp").onclick = (e) => { const tr = e.target.closest("tr[data-q]"); if (tr) { F.q = tr.dataset.q; $("#fQ").value = F.q; upd(); } };
    const big = [...IDX].sort((x, y) => DB.tx[y][3] - DB.tx[x][3]).slice(0, SHOWN);
    $("#txLab").textContent = `เรียงตามยอด — แสดง ${fmt0(big.length)} จาก ${fmt0(IDX.length)} แถว`;
    $("#more").hidden = big.length >= IDX.length;
    $("#tTx").innerHTML = `<table><tr><th>วันเวลา</th><th>บัญชี</th><th>ประเภท</th><th class="n">ยอด (บาท)</th><th>คู่โอน</th><th>กลุ่มคู่โอน</th></tr>` +
      big.map((i) => { const r = DB.tx[i], a = DB.accounts[r[0]], c = DB.cps[r[4]], iso = min2iso(r[1]); return `<tr><td>${dTh(iso)} ${r[2] === 4 ? "(ทั้งเดือน)" : iso.slice(11, 16)}</td><td title="${esc(a.name)}">${a.bank} ${a.acc}</td><td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${KCOL[r[2]]}"></span> ${DB.kinds[r[2]].split(" (")[0]}</td><td class="n">${fmt(r[3])}</td><td>${esc(c[1])} ${c[2]} ${c[0]}</td><td>${esc(DB.groups[c[3]][1].split(" (")[0])}</td></tr>`; }).join("") + "</table>";
    if (tableOnly) return;
    // ชาร์ต
    ["time", "cpg", "acc"].forEach((k) => CH[k] && (CH[k].destroy(), delete CH[k]));
    const tks = [...byT.keys()].sort((x, y) => x - y);
    $("#granLab").textContent = gy ? "รายปี" : "รายเดือน";
    CH.time = new Chart($("#cTime"), { type: "bar", data: { labels: tks.map((t) => gy ? String(t + 543) : `${MTH[t % 12 + 1]} ${String(Math.floor(t / 12) + 543).slice(2)}`),
        datasets: DB.kinds.map((l, k) => ({ label: l.split(" (")[0], data: tks.map((t) => (IN_K.includes(k) ? 1 : -1) * byT.get(t)[k] / 1e6), backgroundColor: KCOL[k], stack: "s" })).filter((d) => d.data.some((v) => v)) },
      options: { maintainAspectRatio: false, scales: { x: { stacked: true, ticks: { maxRotation: 90, autoSkip: true } }, y: { stacked: true, title: { display: true, text: "ล้านบาท (เข้า + / ออก −)" } } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} ${fmt(Math.abs(c.raw) * 1e6)}` } } } } });
    const hb = (id, keys, lab, col, onPick) => new Chart($(id), { type: "bar", data: { labels: keys.map(lab), datasets: [{ label: "เงินเข้า", data: keys.map((k) => k[1][0] / 1e6), backgroundColor: "#1565C0" }, { label: "เงินออก", data: keys.map((k) => k[1][1] / 1e6), backgroundColor: "#B3261E" }] },
      options: { indexAxis: "y", maintainAspectRatio: false, onClick: (e, el) => { if (el.length) onPick(keys[el[0].index][0]); }, scales: { x: { title: { display: true, text: "ล้านบาท" } }, y: { ticks: { font: { size: 11 } } } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} ${fmt(c.raw * 1e6)}` } } } } });
    const gs = Object.entries(byG).sort((x, y) => (y[1][0] + y[1][1]) - (x[1][0] + x[1][1])).slice(0, 14);
    CH.cpg = hb("#cCpg", gs, (k) => DB.groups[k[0]][1].split(" (")[0], null, (g) => { tog(F.cpg, +g); upd(); });
    const as = Object.entries(byA).sort((x, y) => (y[1][0] + y[1][1]) - (x[1][0] + x[1][1])).slice(0, 14);
    CH.acc = hb("#cAcc", as, (k) => { const a = DB.accounts[k[0]]; return `${a.bank} ${a.acc} ${a.name.slice(0, 22)}`; }, null, (a) => { tog(F.accs, +a); upd(); });
  }
  upd();
}

/* ---------- บัญชี ---------- */
function pAcc() {
  const S = DB.accounts.map(() => [0, 0, 0, 0]);
  for (const r of DB.tx) { const s = S[r[0]]; if (IN_K.includes(r[2])) s[0] += r[3]; else s[1] += r[3]; if (r[2] === 3) s[2] += r[3]; s[3] += r[5] || 1; }
  const by = {}; DB.accounts.forEach((a, i) => (by[a.g] = by[a.g] || []).push(i));
  $("#main").innerHTML = Object.keys(by).map((g) => `<h2><span class="dot" style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${DB.groups[g][2]}"></span>${esc(DB.groups[g][1])} <small>${by[g].length} บัญชี</small></h2>
    <div class="grid g3">${by[g].map((i) => { const a = DB.accounts[i], s = S[i]; return `<button class="thumb" data-i="${i}"><b>${a.bank} ${a.acc}</b>${esc(a.name)}
      <div class="row"><span>เงินเข้า</span><span>${fmt(s[0])}</span></div><div class="row"><span>เงินออก</span><span>${fmt(s[1])}</span></div><div class="row"><span>ถอนเงินสด</span><span>${fmt(s[2])}</span></div>
      <div class="muted" style="font-size:.8rem;margin-top:6px">${dTh(a.first)} – ${dTh(a.last)} · ${fmt0(s[3])} รายการ</div></button>`; }).join("")}</div>`).join("") +
    `<p class="muted" style="font-size:.84rem">กดบัญชีเพื่อเปิดหน้าวิเคราะห์เส้นเงินของบัญชีนั้น</p>`;
  $("#main").onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) { resetF(); F.accs.add(+b.dataset.i); go("ana"); } };
}
/* ---------- ไล่เส้นเงิน ---------- */
function pTrace() {
  const bars = (rows, tot) => rows.map(([l, v]) => `<div class="row"><span>${esc(l)}</span><span>${M(v)}${tot ? ` · ${(v / tot * 100).toFixed(1)}%` : ""}</span></div><div class="bar"><i style="width:${tot ? Math.min(100, v / tot * 100) : 0}%;background:${/มูลนิธิ|บริจาค/.test(l) ? "#1565C0" : /สด/.test(l) ? "#9E9E9E" : /ส่วนตัว|กองทุน|ประกัน/.test(l) ? "#212121" : "#6A1B9A"}"></i></div>`).join("");
  const gl = (c) => { const g = DB.groups.find((x) => x[0] === c); return g ? g[1].split(" (")[0] : c; };
  const GN = { t1: gl("t1"), pan: gl("pan"), ath: gl("ath") };
  const ch = Object.values(DB.chang || {}).map((g) => { const inn = g.agg.filter((r) => r[1] === "t2c"), out = g.agg.filter((r) => r[1] === "c2t");
    return `<div class="card"><h3 style="margin:0;color:var(--navy)">${esc(g.title)}</h3>
      <div class="lab">รับจาก</div>${bars(inn.map((r) => [`${GN[r[0]] || r[0]} (${fmt0(r[3])} ครั้ง)`, r[2]]), inn.reduce((s, r) => s + r[2], 0))}
      <div class="lab">โอนกลับเข้า</div>${bars(out.map((r) => [`${GN[r[0]] || r[0]} (${fmt0(r[3])} ครั้ง)`, r[2]]), out.reduce((s, r) => s + r[2], 0))}
      ${g.cash.length ? `<div class="lab">ถอนสดจากมูลนิธินำฝากเข้า</div><div>${M(g.cash.reduce((s, r) => s + r[2], 0))} (${g.cash.length} ครั้ง · ${dTh(g.cash[0][0])})</div>` : ""}</div>`; }).join("");
  $("#main").innerHTML = `<h2>กลุ่มช่าง <small>เส้นเงินกับ ${esc(GN.t1)} / ${esc(GN.pan)} / ${esc(GN.ath)}</small></h2><div class="grid g2">${ch}</div>
  <h2>ถอนเงินสด → ฝากเงินสด</h2><div class="grid g4">
    <div class="card kpi x"><div class="l">คู่ยอดเท่ากัน</div><div class="v">${DB.cash.pairs}</div><div class="s">ยอด ≥ ${fmt0(DB.cash.min_amt)} บาท</div></div>
    <div class="card kpi x"><div class="l">คู่ยอดไม่เท่ากัน ≤ 24 ชม.</div><div class="v">${DB.cash.upairs}</div></div>
    <div class="card kpi r"><div class="l">เงินสดเข้า${esc(GN.ath)} ไม่พบต้นทาง</div><div class="v">${DB.cash.ath_un_n}</div><div class="s">รายการ</div></div></div>
  <h2>ชุดไล่เส้นเงินเฉพาะก้อน <small>${DB.sets.length} ชุด</small></h2>
  <div class="grid g2">${DB.sets.map((s) => `<div class="card"><h3 style="margin:0;color:var(--navy)">${esc(s.name.replace(/^(\d+)_/, "$1. "))}</h3><div class="muted" style="font-size:.86rem">${esc(s.kind)}</div>
    <div class="kpi" style="border:0;padding:6px 0 0"><span class="v">${s.total ? fmt(s.total) : "-"}</span> <span class="s">บาท${s.n ? ` · ${fmt0(s.n)} ครั้ง` : ""}</span></div>
    <div class="muted" style="font-size:.84rem">${esc(s.note)}</div>${bars(s.rows, s.total)}</div>`).join("")}</div>`;
}
/* ---------- ภาพชาร์ต ---------- */
async function openImg(id) {
  toast("กำลังถอดรหัสภาพ…");
  try { const f = await fetchEnc(`img/${id}.enc`); const u = URL.createObjectURL(new Blob([await decrypt(KEY, f)], { type: "image/jpeg" }));
    $("#viewerImg").src = u; $("#viewer").hidden = false; $("#toast").hidden = true; }
  catch (e) { toast("เปิดภาพไม่ได้: " + e.message); }
}
$("#viewerClose").onclick = () => { $("#viewer").hidden = true; URL.revokeObjectURL($("#viewerImg").src); $("#viewerImg").src = ""; };
function pImg() {
  const by = {}; DB.images.forEach((i) => (by[i.cat] = by[i.cat] || []).push(i));
  $("#main").innerHTML = Object.keys(by).map((c) => `<h2>${esc(c)}</h2><div class="thumbs">${by[c].map((i) => `<button class="thumb" data-img="${i.id}"><b>${esc(i.title)}</b><span class="muted" style="font-size:.84rem">กดเพื่อเปิดภาพ (เลื่อน/ซูมได้)</span></button>`).join("")}</div>`).join("") +
    `<p class="muted" style="font-size:.84rem">ภาพย่อจากไฟล์ A3 — ไฟล์เต็ม (.png / .anb) อยู่ในโฟลเดอร์คดี</p>`;
  $("#main").onclick = (e) => { const b = e.target.closest("[data-img]"); if (b) openImg(b.dataset.img); };
}
