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
const TABS = [["over", "ภาพรวม"], ["case", "คดี"], ["charges", "ข้อหา"], ["defences", "ข้อต่อสู้"], ["work", "งาน"], ["ana", "วิเคราะห์เส้นเงิน"], ["acc", "บัญชี"], ["trace", "ไล่เส้นเงิน"], ["img", "ภาพชาร์ต"]];
let TAB = "over";
function start() {
  $("#login").hidden = true; $("#app").hidden = false;
  $("#caseTitle").textContent = DB.case || "ข้อมูลคดี";
  $("#madeAt").textContent = "ข้อมูล ณ " + dTh(DB.made) + " " + DB.made.slice(11);
  $("#tabs").innerHTML = TABS.map(([k, l]) => `<button data-t="${k}">${l}</button>`).join("");
  $("#tabs").onclick = (e) => { const b = e.target.closest("button"); if (b) go(b.dataset.t); };
  prep();
  C = LS.get("cib_content") || JSON.parse(JSON.stringify(DB.content));
  Object.keys(SEC).forEach((k) => (C[k] = C[k] || []));
  go((location.hash || "#over").slice(1));
  loadContent();
}
function go(t) { TAB = TABS.some((x) => x[0] === t) ? t : "over"; history.replaceState(null, "", "#" + TAB); $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === TAB)); render(); window.scrollTo(0, 0); }
function killCharts() { Object.values(CH).forEach((c) => c.destroy()); CH = {}; }
function render() { killCharts(); const m_ = $("#main"); m_.onclick = m_.onchange = m_.oninput = null; ({ over: pOver, case: pCase, charges: pCharges, defences: pDef, work: pWork, ana: pAna, acc: pAcc, trace: pTrace, img: pImg })[TAB](); }
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
