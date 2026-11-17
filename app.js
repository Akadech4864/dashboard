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
const TABS = [["over", "ภาพรวม", "chart"], ["case", "คดี", "book"], ["charges", "ข้อหา", "scale"], ["defences", "ข้อต่อสู้", "shield"], ["work", "งาน", "list"], ["prog", "ความคืบหน้า", "cal"], ["stm", "ขอ STM", "doc"], ["asset", "ทรัพย์สิน", "coin"], ["srch", "ตรวจค้น", "bag"], ["ppl", "บุคคล", "users"], ["ana", "วิเคราะห์", "flow"], ["acc", "บัญชี", "bank"], ["trace", "ไล่เส้นเงิน", "route"], ["img", "ภาพ", "img"]];
let TAB = "over";
function start() {
  $("#login").hidden = true; $("#app").hidden = false;
  $("#caseTitle").textContent = DB.case || "ข้อมูลคดี";
  $("#madeAt").textContent = "ข้อมูล ณ " + dTh(DB.made) + " " + DB.made.slice(11);
  $("#tabs").innerHTML = TABS.map(([k, l, ic]) => `<button data-t="${k}">${IC(ic, 20)}<span class="tx"><span>${l}</span><small></small></span></button>`).join("");
  $("#tabs").onclick = (e) => { const b = e.target.closest("button"); if (b) go(b.dataset.t); };
  prep();
  C = LS.get("cib_content") || JSON.parse(JSON.stringify(DB.content));
  Object.keys(SEC).forEach((k) => (C[k] = C[k] || []));
  go((location.hash || "#over").slice(1));
  loadContent();
  if (window.aiMount) window.aiMount();
}
function go(t) { PV = ""; AV = ""; TAB = TABS.some((x) => x[0] === t) ? t : "over"; history.replaceState(null, "", "#" + TAB); $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === TAB)); render(); window.scrollTo(0, 0); }
function killCharts() { Object.values(CH).forEach((c) => c.destroy()); CH = {}; }
function render() { killCharts(); ONRS = null; const m_ = $("#main"); m_.onclick = m_.onchange = m_.oninput = null; ({ over: pOver, case: pCase, charges: pCharges, defences: pDef, work: pWork, prog: pProg, asset: pAsset, ppl: pPpl, stm: pStm, srch: pSrch, ana: pAna, acc: pAcc, trace: pTrace, img: pImg })[TAB](); navStats(); }
const acts = (sec, id) => `<span class="acts"><button onclick="editItem('${sec}','${id}')">แก้ไข</button></span>`;
const addBtn = (sec) => `<button class="add" onclick="editItem('${sec}')">+ เพิ่ม</button>`;
const badge = (s) => { if (!s) return ""; const c = /ค้าง|ต้อง|รอ/.test(s) ? "r" : /เสร็จ|มีหลักฐาน|แล้ว/.test(s) ? "g" : /พัก|มติ/.test(s) ? "y" : ""; return `<span class="badge ${c}">${esc(s)}</span>`; };
window.editItem = editItem;
window.closeModal = closeModal;

/* ---------- ภาพรวม ---------- */
function pOver() {
  const o = DB.over, ntx = DB.tx.length;
  const yl = o.yearly || [];
  $("#main").innerHTML = `
  ${overExtra(o, ntx)}
  <h2>${IC("book")} เนื้อเรื่อง <small>${C.story.length} ตอน</small> ${addBtn("story")}</h2>
  <div class="accs">${C.story.map((s, i) => accd(`<span class="num">${i + 1}</span> ${esc(s.title)}`, "", `<div class="pgd">${esc(s.detail)}</div>${acts2("story", s.id)}`, isWide())).join("")}</div>
  <div class="grid g2w"><div><h2>${IC("route")} เงินออกจากบัญชีรับบริจาค ไปกลุ่มใด <small>แถว 1 → แถว 2 (ทุกช่วงเวลา)</small></h2>
  <div class="card"><div class="chartbox tall"><canvas id="cHop"></canvas></div></div></div>
  <div><h2>${IC("chart")} เงินบริจาคเข้า – ออก รายปี <small>รวม 3 บัญชี (ล้านบาท)</small></h2>
  <div class="card"><div class="chartbox tall"><canvas id="cYear"></canvas></div></div></div></div>`;
  const h = (o.hop1 || []).slice(0, 14);
  CH.hop = new Chart($("#cHop"), { type: "bar", data: { labels: h.map((r) => r[0].split(" (")[0]), datasets: [{ data: h.map((r) => r[1] / 1e6), backgroundColor: h.map((r) => r[3]) }] },
    options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${fmt(c.raw * 1e6)} บาท (${fmt0(h[c.dataIndex][2])} ครั้ง)` } } }, scales: { x: { title: { display: true, text: "ล้านบาท" } } } } });
  CH.year = new Chart($("#cYear"), { type: "bar", data: { labels: yl.map((r) => r[0] + (r[1] ? (r[1].includes("ก่อน") ? " ก่อนตั้ง" : " หลังตั้ง") : "")), datasets: [{ label: "เงินเข้า", data: yl.map((r) => r[2] / 1e6), backgroundColor: "#FFD403" }, { label: "เงินออก", data: yl.map((r) => r[4] / 1e6), backgroundColor: "#00264D" }] },
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} ${fmt(c.raw * 1e6)} บาท` } } } } });
  $("#main").onclick = (e) => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); };
}
/* ---------- คดี / ข้อหา / ข้อต่อสู้ / งาน (กล่องไอคอน กดดูรายละเอียด) ---------- */
const acts2 = (sec, id) => `<div class="acts in"><button onclick="editItem('${sec}','${id}')">แก้ไข</button></div>`;
const icFor = (t) => (/มูลนิธิ|บริษัท|นิติบุคคล/.test(t) ? "build" : /บัญชี|ธนาคาร/.test(t) ? "bank" : /วัน|ช่วง|เวลา|ลำดับ/.test(t) ? "cal" : /ผู้ต้องหา|บุคคล|กรรมการ|ผู้เสียหาย|ผู้บริจาค/.test(t) ? "users" : /ข้อหา|กฎหมาย|มาตรา|ศาล|หมาย/.test(t) ? "scale" : /เงิน|ยอด|บริจาค|ทรัพย์/.test(t) ? "coin" : /หน่วย|สอบสวน|ตำรวจ/.test(t) ? "shield" : "doc");
const stDot = (s) => `<span class="dot" style="background:${/ค้าง|ต้อง|รอ|ยัง/.test(s || "") ? "var(--red)" : /เสร็จ|มีหลักฐาน|แล้ว/.test(s || "") ? "var(--green)" : s ? "#E0A800" : "#B8C2CF"}"></span>`;
const sico = (ic, cls) => `<span class="ico s ${cls || ""}">${IC(ic, 18)}</span>`;
let EVY = "", CHV = -1, DFF = "", WKF = "todo", CHF = [];
function pCase() {
  const ev = [...C.events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const yrs = [...new Set(ev.map((e) => String(e.date).slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))];
  const show = ev.filter((e) => !EVY || String(e.date).startsWith(EVY)), wide = isWide();
  $("#main").innerHTML = `<h2>${IC("book")} รายละเอียดคดี <small>${C.case.length} หัวข้อ</small> ${addBtn("case")}</h2>
  <div class="accs">${C.case.map((s) => accd(`${sico(icFor(s.title))} ${esc(s.title)}`, "", `<div class="pgd">${esc(s.detail)}</div>${acts2("case", s.id)}`, wide)).join("")}</div>
  <h2>${IC("cal")} ลำดับเหตุการณ์ <small>${show.length} / ${ev.length} เหตุการณ์</small> ${addBtn("events")}</h2>
  <div class="frow"><button class="chip ${!EVY ? "on" : ""}" data-ey="">ทั้งหมด</button>${yrs.map((y) => `<button class="chip ${EVY === y ? "on" : ""}" data-ey="${y}">${IC("cal", 14)} ${+y + 543} · ${ev.filter((e) => String(e.date).startsWith(y)).length}</button>`).join("")}</div>
  <div class="accs">${show.map((e) => accd(`<span class="dt">${dTh(e.date)}</span> ${esc(e.title)}`, "", `<div class="pgd">${esc(e.detail)}</div>${acts2("events", e.id)}`, false, "tlr")).join("")}</div>${newsBlock()}`;
  $("#main").onclick = (e) => { const b = e.target.closest("[data-ey]"); if (b) { EVY = b.dataset.ey; render(); } };
}
function pCharges() {
  // ผู้ต้องหาและข้อหา: หมวดข้อหา (กดกรอง) + ตารางใครถูกแจ้งข้อหาใด + การ์ดรายบุคคล (ผู้สั่งงาน 17 พ.ย. 69)
  const CATS = [["fraud", "ฉ้อโกงประชาชน", /ฉ้อโกง/, "scale", "#B3261E"], ["com", "พ.ร.บ.คอมพิวเตอร์", /คอมพิวเตอร์|ข้อมูล(อัน)?เป็นเท็จ/, "doc", "#1565C0"], ["aml", "ฟอกเงิน", /ฟอกเงิน/, "coin", "#6A1B9A"]];
  const ph = {}; imgBy((i) => i.cat === "บุคคล").forEach((i) => (ph[nk(i.key)] = i));
  const pic = (s) => { const k = nk(String(s.title).split("(")[0]); if (ph[k]) return ph[k]; const f = Object.keys(ph).find((n) => n.length >= 6 && k.length >= 6 && (k.includes(n) || n.includes(k))); return f ? ph[f] : null; };
  const SUS = tsSus();
  const sheet = (s) => { const k = nk(String(s.title).split("(")[0]).slice(0, 6); return SUS.find((r) => nk(r.name).replace(/^สาว/, "").slice(0, 6) === k || nk(r.name).includes(k)); };
  const P = C.charges.map((s, i) => {
    const parts = String(s.detail || "").split(" / ").map((x) => x.trim()).filter(Boolean);
    const cats = new Set(), other = [];
    parts.forEach((x) => { const head = x.split(" — ")[0]; let hit = false; CATS.forEach(([k, , rx]) => { if (rx.test(head)) { cats.add(k); hit = true; } }); if (!hit) other.push(head); });
    return { s, i, parts, cats, other, img: pic(s), sh: sheet(s) };
  });
  const sel = CHF.filter((k) => CATS.some((c) => c[0] === k));
  const show = P.filter((p) => !sel.length || sel.every((k) => p.cats.has(k)));
  const tile = (k, l, ic, col) => { const n = P.filter((p) => p.cats.has(k)).length; return `<button class="tile ${sel.includes(k) ? "on" : ""}" data-cf="${k}"><span class="ico" style="background:${col};color:#fff">${IC(ic)}</span><span class="v">${n}<small> ราย</small></span><span class="l">${esc(l)}</span></button>`; };
  const tick = (on, col) => (on ? `<span class="ck" style="background:${col}">${IC("check", 15)}</span>` : `<span class="ck no">–</span>`);
  const stat = (p) => { const st = p.s.status || ""; const sh = p.sh; return `${st ? badge(st) : ""}${sh ? ` <span class="badge y">${IC("cal", 12)} ${esc(sh.issue.replace(/\s+/g, " ").replace(/^แจ้งข้อกล่าวหา\s*/, "นัดแจ้งข้อกล่าวหา "))} ${esc(sh.date)}${sh.time ? " " + esc(sh.time) : ""}${sh.st ? " · " + esc(sh.st) : ""}</span>` : ""}`; };
  const m = $("#main");
  m.innerHTML = `<h2>${IC("scale")} ผู้ต้องหาและข้อหา <small>${P.length} ราย · กดหมวดข้อหาเพื่อกรอง (เลือกหลายหมวด = ต้องมีครบทุกข้อหาที่เลือก)</small> ${addBtn("charges")}</h2>
  <div class="tiles">${CATS.map(([k, l, , ic, col]) => tile(k, l, ic, col)).join("")}<button class="tile ${!sel.length ? "on" : ""}" data-cf=""><span class="ico">${IC("users")}</span><span class="v">${P.length}<small> ราย</small></span><span class="l">ทั้งหมด</span></button></div>
  <h2>${IC("list")} ใครถูกแจ้ง / ถูกเสนอข้อหาใด <small>${show.length} ราย</small></h2>
  <div class="tblwrap"><table class="cmx"><tr><th>ผู้ต้องหา</th><th>บทบาท</th>${CATS.map(([, l]) => `<th class="c">${esc(l)}</th>`).join("")}<th>สถานะ</th></tr>
    ${show.map((p) => `<tr class="click" data-c="${p.i}"><td><b>${esc(p.s.title)}</b></td><td>${esc(p.s.extra1)}</td>${CATS.map(([k, , , , col]) => `<td class="c">${tick(p.cats.has(k), col)}</td>`).join("")}<td>${stat(p)}</td></tr>`).join("")}
  </table></div>
  ${CATS.map(([k, l, , ic, col]) => { const v = show.filter((p) => p.cats.has(k)); return v.length ? `<h3 class="pch"><span class="dot" style="background:${col}"></span>${IC(ic, 16)} ${esc(l)} <small>${v.length}</small></h3>
    <div class="pgrid">${v.map((p) => `<button class="pcard" data-c="${p.i}" style="--c:${col}">${p.img ? thumbEl(p.img) : `<span class="ph">${IC("user", 30)}</span>`}<b>${esc(p.s.title)}</b><small>${esc(p.s.extra1)}</small></button>`).join("")}</div>` : ""; }).join("")}
  <p class="muted" style="font-size:.82rem">ข้อหาตามเนื้อหาที่บันทึกในเว็บ (ตามข่าว / มติ) ; วันนัดแจ้งข้อกล่าวหาจากแท็บ "คุมหมายเรียกผู้ต้องหา" ของชีตชุดทำคดี — กดชื่อเพื่อดูข้อหารายข้อ</p>`;
  m.onclick = (e) => {
    const b = e.target.closest("[data-cf],[data-c],.back"); if (!b) return;
    if (b.dataset.cf != null) { const k = b.dataset.cf; CHF = !k ? [] : CHF.includes(k) ? CHF.filter((x) => x !== k) : [...CHF, k]; render(); return; }
    if (b.dataset.c != null) {
      const p = P[+b.dataset.c];
      openModal(`<div class="prof">${p.img ? `<span class="pf">${thumbEl(p.img)}</span>` : `<span class="pf ph">${IC("user", 44)}</span>`}<div><h3>${esc(p.s.title)}</h3><div class="muted">${esc(p.s.extra1)}</div><div style="margin-top:6px">${stat(p)}</div></div></div>
        <h3 style="margin-top:14px">${IC("scale", 18)} ข้อหา ${p.parts.length} ข้อ</h3>${p.parts.map((c, k) => `<div class="item" style="margin-top:8px"><span class="num">${k + 1}</span><div><p style="color:var(--ink)">${esc(c)}</p></div></div>`).join("")}
        <div class="modal-foot">${document.body.classList.contains("edit") ? `<button class="btn o" onclick="closeModal();editItem('charges','${p.s.id}')">แก้ไข</button>` : ""}<button class="btn" onclick="closeModal()">ปิด</button></div>`);
    }
  };
}
function pDef() {
  const who = [...new Set(C.defences.map((s) => s.extra1).filter(Boolean))], show = C.defences.filter((s) => !DFF || s.extra1 === DFF);
  const ft = (k, ic, n, l) => `<button class="tile ${DFF === k ? "on" : ""}" data-df="${esc(k)}"><span class="ico">${IC(ic)}</span><span class="v">${n}</span><span class="l">${esc(l)}</span></button>`;
  $("#main").innerHTML = `<h2>${IC("shield")} ข้อต่อสู้ที่ต้องพิสูจน์ทราบ <small>${show.length} / ${C.defences.length} ประเด็น</small> ${addBtn("defences")}</h2>
  <div class="tiles">${ft("", "shield", C.defences.length, "ทั้งหมด")}${who.map((w) => ft(w, "user", C.defences.filter((s) => s.extra1 === w).length, w)).join("")}</div>
  <div class="accs" style="margin-top:6px">${show.map((s) => accd(`${sico("shield")} ${esc(s.title)}`, stDot(s.status),
    `<div class="pgm"><span class="badge">${IC("user", 13)} ${esc(s.extra1)}</span>${badge(s.status)}</div><div class="lab">${IC("search", 14)} ต้องพิสูจน์</div><div class="pgd">${esc(s.detail)}</div><div class="lab">${IC("doc", 14)} หลักฐานที่มี</div><div class="pgd">${esc(s.extra2)}</div>${acts2("defences", s.id)}`)).join("")}</div>`;
  $("#main").onclick = (e) => { const b = e.target.closest("[data-df]"); if (b) { DFF = b.dataset.df; render(); } };
}
function pWork() {
  const open = C.todo.filter((t) => !/เสร็จ/.test(t.status || "")).length, wide = isWide();
  const item = (sec, s) => accd(`${sico(sec === "done" ? "check" : "clock", sec === "done" ? "g" : "r")} ${esc(s.title)}`, s.date ? dTh(s.date) : "",
    `${s.detail ? `<div class="pgd">${esc(s.detail)}</div>` : ""}<div class="pgm">${s.extra1 ? `<span class="badge">${IC("user", 13)} ${esc(s.extra1)}</span>` : ""}${badge(s.status)}</div>${acts2(sec, s.id)}`);
  const col = (sec, t, ic) => `<div><h2>${IC(ic)} ${t} <small>${C[sec].length} รายการ</small> ${addBtn(sec)}</h2>${C[sec].map((s) => item(sec, s)).join("") || '<p class="muted">ยังไม่มีรายการ</p>'}</div>`;
  const m = $("#main");
  m.innerHTML = `<div class="tiles">${tile("todo", "clock", C.todo.length, "ต้องทำต่อ", `ยังค้าง ${open}`)}${tile("done", "check", C.done.length, "ทำไปแล้ว", "")}</div>
  ${wide ? `<div class="grid g2w" style="align-items:start">${col("todo", "สิ่งที่ต้องทำต่อ", "clock")}${col("done", "สิ่งที่ทำไปแล้ว", "check")}</div>` : (WKF === "done" ? col("done", "สิ่งที่ทำไปแล้ว", "check") : col("todo", "สิ่งที่ต้องทำต่อ", "clock"))}`;
  if (!wide) $$(".tile", m).forEach((b) => b.classList.toggle("on", b.dataset.v === WKF));
  m.onclick = (e) => { const b = e.target.closest("button.tile"); if (b) { WKF = b.dataset.v; render(); } };
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
const accd = (t, a, body, open, cls) => `<details class="acc ${cls || ""}"${open ? " open" : ""}><summary><span class="t">${t}</span><span class="a">${a || ""}</span></summary><div class="body">${body}</div></details>`;
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
const linksOf = (s) => [...new Set((String(s || "").match(/https?:\/\/[^\s,;"'<>]+/g) || []).map((u) => u.replace(/[)\].,]+$/, "")))];
function linkLab(u) {
  try {
    const x = new URL(u), h = x.hostname.replace(/^(www|m|web|mobile)\./, "");
    const site = /facebook|fb\.(com|me|watch)/.test(h) ? "Facebook" : /tiktok/.test(h) ? "TikTok" : /instagram/.test(h) ? "Instagram" : /youtube|youtu\.be/.test(h) ? "YouTube" : /line\.me/.test(h) ? "LINE" : /maps|goo\.gl/.test(h + x.pathname) ? "แผนที่" : h;
    const id = x.searchParams.get("id"), seg = decodeURIComponent(x.pathname.replace(/\/+$/, "")).split("/").filter(Boolean).pop() || "";
    const tail = seg && !/\.php$/.test(seg) ? seg : id || "";
    return site + (tail ? " · " + tail.slice(0, 30) : "");
  } catch (e) { return String(u).slice(0, 40); }
}
const linkBtn = (u) => (/^https?:\/\//i.test(u) ? `<a class="chip lnk" href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${esc(u)}">${IC("link", 14)} ${esc(linkLab(u))}</a>` : "");
const tsPpl = () => tsR("ppl").filter((r) => isNo(r[0]) && r[1]).map((r) => ({ name: r[1], note: noteClean(r[2]), links: linksOf(r[2]) }));

/* ---------- ความคืบหน้าการทำคดี ---------- */
const PST = { done: ["เสร็จ", "#1B7A4A"], wait: ["รอผล", "#E0A800"], doing: ["ดำเนินการ", "#1565C0"], none: ["ยังไม่ระบุ", "#9E9E9E"] };
const KIND = { task: ["check", "งาน"], sus: ["scale", "ผู้ต้องหา"], wit: ["users", "พยาน"], anu: ["doc", "หมายเรียกเอกสาร / รถ"] };
let PV = "", PF = { st: new Set(), own: new Set() }, AF = "";
function pProg() {
  const T = progTasks(), S = tsSus(), W = tsWit(), A = tsAnu(), AC = tsAcc(), CO = tsCo(), PP = tsPpl();
  const wAll = W.flatMap((s) => s.rows), came = (rs) => rs.filter((r) => /มาพบ/.test(r.st)).length;
  const cnt = (k) => T.filter((t) => t.st === k).length, got = AC.filter((r) => /ได้แล้ว/.test(r.data)).length;
  const head = (ic, t, s) => `${backBtn()}<h2>${IC(ic)} ${t} <small>${s || ""}</small></h2>`;
  const det = (PV) => { let h = "";
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
  }
  return h; };
  const mainH = () => { let h = "";
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
  return h; };
  const wide = isWide(), v = wide ? (PV || "task") : PV;
  const m = $("#main"); m.innerHTML = wide ? `<div class="md"><div class="md-l">${mainH()}</div><div class="md-r">${det(v)}</div></div>` : (v ? det(v) : mainH());
  $$(".tile", m).forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  if (v === "task") {
    const allDays = [...new Set(T.map((t) => t.date || ""))].sort(), owners = [...new Set(T.map((t) => t.owner))];
    const ds = (f) => Object.entries(PST).map(([k, v]) => ({ label: v[0], data: f(k), backgroundColor: v[1], stack: "s" }));
    const op = (hz) => ({ indexAxis: hz ? "y" : "x", maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } } }, scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true, ticks: { precision: 0 } } } });
    CH.pgDay = new Chart($("#cPgDay"), { type: "bar", data: { labels: allDays.map((d) => (d ? dTh(d) : "ไม่ระบุ")), datasets: ds((k) => allDays.map((d) => T.filter((t) => (t.date || "") === d && t.st === k).length)) }, options: op(false) });
    CH.pgOwn = new Chart($("#cPgOwn"), { type: "bar", data: { labels: owners.map((o) => o || "ไม่ระบุ"), datasets: ds((k) => owners.map((o) => T.filter((t) => t.owner === o && t.st === k).length)) }, options: op(true) });
  }
  m.onclick = (e) => {
    const b = e.target.closest("button"); if (!b || tsClick(b)) return;
    const tg = (s, v) => (s.has(v) ? s.delete(v) : s.add(v));
    if (b.dataset.v === "acc") go("stm"); else if (b.dataset.v === "ppl") go("ppl");
    else if (b.dataset.v != null) { PV = b.dataset.v; render(); if (!wide) window.scrollTo(0, 0); }
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
  const det = (AV) => { let h = "";
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
  }
  return h; };
  const mainH = () => { let h;
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
  return h; };
  const wide = isWide(), v = wide ? (AV || "s0") : AV;
  const m = $("#main"); m.innerHTML = wide ? `<div class="md"><div class="md-l">${mainH()}</div><div class="md-r">${det(v)}</div></div>` : (v ? det(v) : mainH());
  $$(".tile", m).forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  if ((wide || !v) && S.length) CH.as = new Chart($("#cAs"), { type: "bar", data: { labels: S.map((s) => secNm(s.name)), datasets: [0, 1].map((o) => ({ label: own[o], data: S.map((s) => s.tot[o] / 1e6), backgroundColor: OC[o], stack: "s" })) },
    options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} ${fmt0(c.raw * 1e6)} บาท` } } }, scales: { x: { stacked: true }, y: { stacked: true } } } });
  m.onclick = (e) => { const b = e.target.closest("button"); if (!b || tsClick(b)) return; if (b.dataset.v != null) { AV = b.dataset.v; render(); if (!wide) window.scrollTo(0, 0); } };
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
function resetF() { F = { from: DB.lo, to: DB.hi, accs: new Set(), kinds: new Set(), cpg: new Set(), min: 0, q: "", gran: "auto", cps: "t", flm: "g", fln: innerWidth > 1100 ? 14 : 8 }; SHOWN = 200; }
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
    <div class="frow"><label>รายบัญชี</label><div class="accgroups">${Object.keys(gAcc).map((g) => `<div class="accg" style="--c:${DB.groups[g][2]}"><button class="ghead" data-g="${g}" title="กดเพื่อเลือก / ยกเลิกทั้งกลุ่ม"><span class="dot" style="background:${DB.groups[g][2]}"></span><b>${esc(DB.groups[g][1].split(" (")[0])}</b><span class="n" data-gn="${g}"></span></button>
        ${gAcc[g].map((i) => { const a = DB.accounts[i]; return `<label title="${esc(a.name)}"><input type="checkbox" data-a="${i}"><span>${a.bank} ${a.acc}</span><small>${esc(a.name)}</small></label>`; }).join("")}</div>`).join("")}</div></div>
    <div class="frow"><label>ประเภทรายการ</label>${DB.kinds.map((k, i) => `<button class="chip" data-k="${i}"><span class="dot" style="background:${KCOL[i]}"></span>${k}</button>`).join("")}</div>
    <div class="frow"><label>กลุ่มคู่โอน</label>${usedCpg.map((g) => `<button class="chip" data-c="${g}"><span class="dot" style="background:${DB.groups[g][2]}"></span>${esc(DB.groups[g][1].split(" (")[0])}</button>`).join("")}</div>
    <div class="frow"><label>ยอดขั้นต่ำ</label><input type="number" id="fMin" min="0" step="1000" value="${F.min || ""}" placeholder="บาท" style="width:130px">
      <input type="search" id="fQ" value="${esc(F.q)}" placeholder="ค้นหาชื่อ / เลขบัญชีคู่โอน">
      <button class="btn o" id="fClear">ล้างตัวกรอง</button><button class="btn o" id="fCsv">ส่งออก CSV</button></div>
   </div></details>
  <div class="grid g4 kp8" style="margin-top:12px" id="aKpi"></div>
  <p class="muted" style="font-size:.82rem;margin:.6em 0 0">ยอดตาม statement ของบัญชีที่เลือก — การโอนระหว่างบัญชีที่มี statement ทั้งสองฝั่งจะปรากฏทั้งฝั่งออกและฝั่งเข้า ; เงินบริจาคเข้าบัญชีมูลนิธิแสดงเป็นยอดรวมรายเดือน</p>
  <h2>${IC("flow")} เส้นเงินตามตัวกรอง <small>เงินเข้า → บัญชี → เงินออก · เปลี่ยนทันทีเมื่อกรอง · กดกล่องเพื่อกรองต่อ</small>
    <button class="chip" data-fm="g">กลุ่ม</button><button class="chip" data-fm="d">รายบัญชี</button><span class="muted" style="font-size:.8rem;font-weight:400">จำนวนกล่อง</span><button class="chip" data-fn="8">8</button><button class="chip" data-fn="14">14</button><button class="chip" data-fn="24">24</button></h2>
  <div class="card flowcard"><div id="flow" class="flow"></div><div id="flTip" class="fltip" hidden></div></div>
  <h2>ตามเวลา <small id="granLab"></small> <button class="chip" id="gBtn">สลับ รายเดือน / รายปี</button></h2>
  <div class="card"><div class="chartbox"><canvas id="cTime"></canvas></div></div>
  <div class="grid g2" style="margin-top:12px">
    <div><h2>ตามกลุ่มคู่โอน <small>กดแท่งเพื่อกรอง</small></h2><div class="card"><div class="chartbox tall"><canvas id="cCpg"></canvas></div></div></div>
    <div><h2>ตามบัญชี <small>กดแท่งเพื่อกรอง</small></h2><div class="card"><div class="chartbox tall"><canvas id="cAcc"></canvas></div></div></div>
  </div>
  <div class="grid tb2"><div><h2>${IC("users")} คู่โอนรายใหญ่ <small>50 อันดับ — กดแถวเพื่อค้นหา</small> <span class="muted" style="font-size:.8rem;font-weight:400">เรียงตาม</span>${[["t", "ยอดรวม"], ["i", "เงินเข้า"], ["o", "เงินออก"], ["n", "จำนวนครั้ง"]].map(([k, l]) => `<button class="chip" data-cs="${k}">${l}</button>`).join("")}</h2><div class="tblwrap" id="tCp"></div></div>
  <div><h2>รายการ <small id="txLab"></small></h2><div class="tblwrap" id="tTx"></div></div></div>
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
    else if (b.dataset.cs) F.cps = b.dataset.cs;
    else if (b.dataset.fm) F.flm = b.dataset.fm;
    else if (b.dataset.fn) F.fln = +b.dataset.fn;
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
    const K = DB.kinds.map(() => [0, 0]), byG = {}, byA = {}, byC = new Map(), byT = new Map(), pair = new Map();
    const span = (+F.to.slice(0, 4) * 12 + +F.to.slice(5, 7)) - (+F.from.slice(0, 4) * 12 + +F.from.slice(5, 7));
    const gy = F.gran === "y" || (F.gran === "auto" && span > 47); F._g = gy ? "y" : "m";
    for (const i of IDX) {
      const r = DB.tx[i], k = r[2], amt = r[3], n = r[5] || 1, c = DB.cps[r[4]], inn = IN_K.includes(k) ? 0 : 1;
      K[k][0] += amt; K[k][1] += n;
      const pk = r[4] * 64 + r[0]; let pv = pair.get(pk); if (!pv) pair.set(pk, (pv = [0, 0, 0, 0])); pv[inn] += amt; pv[2 + inn] += n;
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
    $$("[data-gn]", m).forEach((e) => { const ids = gAcc[e.dataset.gn]; e.textContent = `${ids.filter((i) => F.accs.has(i)).length}/${ids.length}`; });
    $$("button[data-cs]", m).forEach((b) => b.classList.toggle("on", F.cps === b.dataset.cs));
    $$("[data-fm]", m).forEach((b) => b.classList.toggle("on", F.flm === b.dataset.fm));
    $$("[data-fn]", m).forEach((b) => b.classList.toggle("on", F.fln === +b.dataset.fn));
    drawFlow($("#flow"), pair); ONRS = () => TAB === "ana" && drawFlow($("#flow"), pair);
    // ตาราง
    const ck = { t: (v) => v[0] + v[1], i: (v) => v[0], o: (v) => v[1], n: (v) => v[2] }[F.cps] || ((v) => v[0] + v[1]);
    const top = [...byC.entries()].filter((x) => ck(x[1]) > 0).sort((x, y) => ck(y[1]) - ck(x[1])).slice(0, 50);
    $("#tCp").innerHTML = `<table><tr><th>#</th><th>คู่โอน</th><th>บัญชี</th><th>กลุ่ม</th><th class="n srt ${F.cps === "i" ? "on" : ""}" data-cs="i">เงินเข้า (บาท)</th><th class="n srt ${F.cps === "o" ? "on" : ""}" data-cs="o">เงินออก (บาท)</th><th class="n srt ${F.cps === "n" ? "on" : ""}" data-cs="n">ครั้ง</th></tr>` +
      top.map(([ci, v], i) => { const c = DB.cps[ci]; return `<tr class="click" data-q="${esc(c[0] || c[1])}"><td>${i + 1}</td><td>${esc(c[1]) || "<span class=muted>ไม่ระบุชื่อ</span>"}</td><td>${c[2]} ${c[0]}</td><td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${DB.groups[c[3]][2]}"></span> ${esc(DB.groups[c[3]][1].split(" (")[0])}</td><td class="n">${v[0] ? fmt(v[0]) : ""}</td><td class="n">${v[1] ? fmt(v[1]) : ""}</td><td class="n">${fmt0(v[2])}</td></tr>`; }).join("") + "</table>";
    $("#tCp").onclick = (e) => { const th = e.target.closest("th[data-cs]"); if (th) { F.cps = F.cps === th.dataset.cs ? "t" : th.dataset.cs; upd(true); return; } const tr = e.target.closest("tr[data-q]"); if (tr) { F.q = tr.dataset.q; $("#fQ").value = F.q; upd(); } };
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
  const fb = $("#flow"), tip = $("#flTip");
  fb.onmousemove = (e) => { const t = e.target.closest("[data-tip]"); if (!t) { tip.hidden = true; return; } tip.textContent = t.dataset.tip; tip.hidden = false; tip.style.left = Math.max(4, Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 14)) + "px"; tip.style.top = (e.clientY + 16) + "px"; };
  fb.onmouseleave = () => (tip.hidden = true);
  fb.onclick = (e) => {
    const g = e.target.closest("[data-n]"); if (!g) { const t = e.target.closest("[data-tip]"); if (t) toast(t.dataset.tip); return; }
    const id = g.dataset.n.slice(1), k = +id.slice(1);
    if (id[0] === "g") tog(F.cpg, k);
    else if (id[0] === "c") { const cp = DB.cps[k]; F.q = cp[0] || cp[1]; $("#fQ").value = F.q; }
    else if (id[0] === "G") { const ids = gAcc[k] || [], all = ids.every((i) => F.accs.has(i)); ids.forEach((i) => (all ? F.accs.delete(i) : F.accs.add(i))); }
    else if (id[0] === "a") tog(F.accs, k);
    else return;
    tip.hidden = true; upd();
  };
  upd();
}

/* ---------- บัญชี (กล่องรายกลุ่ม กดดูรายบัญชี) ---------- */
let ACV = "", TRV = "";
function pAcc() {
  const S = DB.accounts.map(() => [0, 0, 0, 0]);
  for (const r of DB.tx) { const s = S[r[0]]; if (IN_K.includes(r[2])) s[0] += r[3]; else s[1] += r[3]; if (r[2] === 3) s[2] += r[3]; s[3] += r[5] || 1; }
  const by = {}; DB.accounts.forEach((a, i) => (by[a.g] = by[a.g] || []).push(i));
  const gs = Object.keys(by), sum = (g, k) => by[g].reduce((t, i) => t + S[i][k], 0), nm = (g) => DB.groups[g][1].split(" (")[0];
  const mainH = () => `<h2>${IC("bank")} บัญชีที่มี statement <small>${DB.accounts.length} บัญชี · ${gs.length} กลุ่ม</small></h2>
    <div class="tiles">${gs.map((g) => `<button class="tile" data-v="${g}"><span class="ico" style="background:${DB.groups[g][2]};color:#fff">${IC("bank")}</span><span class="v">${by[g].length}<small> บัญชี</small></span><span class="l">${esc(nm(g))}</span><span class="s">เข้า ${M(sum(g, 0))} · ออก ${M(sum(g, 1))}</span><span class="go">${IC("next", 16)}</span></button>`).join("")}</div>`;
  const det = (g) => (!by[g] ? "" : `${backBtn()}<h2><span class="dot" style="width:14px;height:14px;border-radius:4px;background:${DB.groups[g][2]}"></span> ${esc(DB.groups[g][1])} <small>${by[g].length} บัญชี</small></h2>
    <div class="grid g4" style="margin-bottom:10px">${[["เงินเข้า", 0, ""], ["เงินออก", 1, "r"], ["ถอนเงินสด", 2, "x"]].map(([l, k, c]) => `<div class="card kpi ${c}"><div class="l">${l}</div><div class="v">${M(sum(g, k))}</div><div class="s">${fmt(sum(g, k))} บาท</div></div>`).join("")}</div>
    <div class="grid g3">${by[g].map((i) => { const a = DB.accounts[i], s = S[i]; return `<button class="thumb" data-i="${i}"><b>${a.bank} ${a.acc}</b>${esc(a.name)}
      <div class="row"><span>เงินเข้า</span><span>${fmt(s[0])}</span></div><div class="row"><span>เงินออก</span><span>${fmt(s[1])}</span></div><div class="row"><span>ถอนเงินสด</span><span>${fmt(s[2])}</span></div>
      <div class="muted" style="font-size:.8rem;margin-top:6px">${IC("cal", 13)} ${dTh(a.first)} – ${dTh(a.last)} · ${fmt0(s[3])} รายการ</div></button>`; }).join("")}</div>
    <p class="muted" style="font-size:.84rem">${IC("flow", 14)} กดบัญชีเพื่อเปิดเส้นเงินของบัญชีนั้น</p>`);
  const wide = isWide(), v = wide ? (ACV || gs[0]) : ACV, m = $("#main");
  m.innerHTML = wide ? `<div class="md"><div class="md-l">${mainH()}</div><div class="md-r">${det(v)}</div></div>` : (v ? det(v) : mainH());
  $$(".tile", m).forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  m.onclick = (e) => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.i != null) { resetF(); F.accs.add(+b.dataset.i); F.flm = "d"; go("ana"); }
    else if (b.dataset.v != null) { ACV = b.dataset.v; render(); if (!wide) scrollTo(0, 0); } };
}
/* ---------- ไล่เส้นเงิน (กล่องรายชุด กดดูรายละเอียด) ---------- */
function pTrace() {
  const bars = (rows, tot) => rows.map(([l, v]) => `<div class="row"><span>${esc(l)}</span><span>${M(v)}${tot ? ` · ${(v / tot * 100).toFixed(1)}%` : ""}</span></div><div class="bar"><i style="width:${tot ? Math.min(100, v / tot * 100) : 0}%;background:${/มูลนิธิ|บริจาค/.test(l) ? "#1565C0" : /สด/.test(l) ? "#9E9E9E" : /ส่วนตัว|กองทุน|ประกัน/.test(l) ? "#212121" : "#6A1B9A"}"></i></div>`).join("");
  const gl = (c) => { const g = DB.groups.find((x) => x[0] === c); return g ? g[1].split(" (")[0] : c; };
  const GN = { t1: gl("t1"), pan: gl("pan"), ath: gl("ath") }, IT = [];
  Object.values(DB.chang || {}).forEach((g, i) => { const inn = g.agg.filter((r) => r[1] === "t2c"), out = g.agg.filter((r) => r[1] === "c2t"), ti = inn.reduce((s, r) => s + r[2], 0), to = out.reduce((s, r) => s + r[2], 0);
    IT.push({ k: "c" + i, ic: "users", v: M(ti), l: g.title.split(" (")[0], s: `โอนกลับ ${M(to)}`, h: `<div class="grid g2" style="margin-bottom:10px"><div class="card kpi r"><div class="l">รับเงิน</div><div class="v">${M(ti)}</div><div class="s">${fmt(ti)} บาท</div></div><div class="card kpi"><div class="l">โอนกลับเข้า</div><div class="v">${M(to)}</div><div class="s">${fmt(to)} บาท</div></div></div>
      <div class="card"><h3 style="margin:0;color:var(--navy)">${esc(g.title)}</h3><div class="lab">รับจาก</div>${bars(inn.map((r) => [`${GN[r[0]] || r[0]} (${fmt0(r[3])} ครั้ง)`, r[2]]), ti)}
      <div class="lab">โอนกลับเข้า</div>${bars(out.map((r) => [`${GN[r[0]] || r[0]} (${fmt0(r[3])} ครั้ง)`, r[2]]), to)}
      ${g.cash.length ? `<div class="lab">ถอนสดจากบัญชีรับบริจาคนำฝากเข้า</div><div>${M(g.cash.reduce((s, r) => s + r[2], 0))} (${g.cash.length} ครั้ง · ${dTh(g.cash[0][0])})</div>` : ""}</div>` }); });
  IT.push({ k: "cash", ic: "coin", v: DB.cash.pairs + DB.cash.upairs, l: "ถอนเงินสด → ฝากเงินสด", s: "คู่ที่จับได้", h: `<div class="grid g3">
    <div class="card kpi x"><div class="l">คู่ยอดเท่ากัน</div><div class="v">${DB.cash.pairs}</div><div class="s">ยอด ≥ ${fmt0(DB.cash.min_amt)} บาท</div></div>
    <div class="card kpi x"><div class="l">คู่ยอดไม่เท่ากัน ≤ 24 ชม.</div><div class="v">${DB.cash.upairs}</div></div>
    <div class="card kpi r"><div class="l">เงินสดเข้า${esc(GN.ath)} ไม่พบต้นทาง</div><div class="v">${DB.cash.ath_un_n}</div><div class="s">รายการ</div></div></div>
    ${(() => { const v = imgBy((i) => i.cat === "เงินสด"); return v.length ? `<div class="shots big" style="margin-top:10px">${v.map((i) => shot(i)).join("")}</div>` : ""; })()}` });
  DB.sets.forEach((s, i) => IT.push({ k: "s" + i, ic: "route", v: s.total ? M(s.total) : "–", l: s.name.replace(/^(\d+)_/, "$1. "), s: s.n ? `${fmt0(s.n)} ครั้ง` : "", h: `<div class="card"><h3 style="margin:0;color:var(--navy)">${esc(s.name.replace(/^(\d+)_/, "$1. "))}</h3><div class="muted" style="font-size:.86rem">${esc(s.kind)}</div>
    <div class="kpi" style="border:0;padding:6px 0 0"><span class="v">${s.total ? fmt(s.total) : "-"}</span> <span class="s">บาท${s.n ? ` · ${fmt0(s.n)} ครั้ง` : ""}</span></div>
    <div class="muted" style="font-size:.84rem">${esc(s.note)}</div>${bars(s.rows, s.total)}</div>` }));
  const mainH = () => `<h2>${IC("route")} ไล่เส้นเงิน <small>${IT.length} ชุด</small></h2><div class="tiles">${IT.map((x) => tile(x.k, x.ic, x.v, esc(x.l), x.s)).join("")}</div>`;
  const det = (k) => { const x = IT.find((y) => y.k === k); return x ? `${backBtn()}<h2>${IC(x.ic)} ${esc(x.l)}</h2>${x.h}` : ""; };
  const wide = isWide(), v = wide ? (TRV || IT[0].k) : TRV, m = $("#main");
  m.innerHTML = wide ? `<div class="md"><div class="md-l">${mainH()}</div><div class="md-r">${det(v)}</div></div>` : (v ? det(v) : mainH());
  $$(".tile", m).forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  m.onclick = (e) => { const b = e.target.closest("button"); if (b && b.dataset.v != null) { TRV = b.dataset.v; render(); if (!wide) scrollTo(0, 0); } };
}
/* ---------- จอกว้าง / เมนู ---------- */
Object.assign(ICP, {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  zoom: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5M8.5 11h5M11 8.5v5"/>',
});
const WIDE = matchMedia("(min-width:1100px)");
const isWide = () => WIDE.matches;
let ONRS = null, RST = 0;
WIDE.addEventListener("change", () => DB && TAB && render());
addEventListener("resize", () => { clearTimeout(RST); RST = setTimeout(() => ONRS && ONRS(), 180); });
function navStats() {
  try {
    const S = tsSum(), fz = tsFrz().secs.flatMap((s) => s.rows), T = progTasks(), W = tsWit().flatMap((s) => s.rows), A = tsAcc(), SR = DB.search || { rows: [] };
    const st = {
      over: M(DB.over.donor_in) + " เงินเข้า 3 บัญชี", case: `${(C.events || []).length} เหตุการณ์`, charges: `${C.charges.length} ราย`, defences: `${C.defences.length} ประเด็น`,
      work: `ค้าง ${C.todo.filter((t) => !/เสร็จ/.test(t.status || "")).length} · เสร็จ ${C.done.length}`,
      prog: `งาน ${T.filter((t) => t.st === "done").length}/${T.length} · พยาน ${W.filter((r) => /มาพบ/.test(r.st)).length}/${W.length}`,
      asset: `${M(S.reduce((t, s) => t + s.tot[0] + s.tot[1], 0))} · อายัด ${M(fz.reduce((t, r) => t + r.amt, 0))}`,
      ppl: `${people().length} ราย · ${imgBy((i) => i.cat === "บุคคล").length} ภาพ`,
      stm: `ได้แล้ว ${A.filter((r) => /ได้แล้ว/.test(r.data)).length}/${A.length} บัญชี`,
      srch: `${SR.rows.reduce((t, r) => t + (r.n || 0), 0)} รายการ · ${imgBy((i) => i.cat === "ตรวจค้น").length} ภาพ`,
      ana: `${fmt0(DB.tx.length)} รายการ`, acc: `${DB.accounts.length} บัญชีมี statement`, trace: `${DB.sets.length} ชุด`, img: `${imgBy((i) => i.cat !== "บุคคล" && i.cat !== "นิติบุคคล").length} ภาพ`,
    };
    $$("#tabs button").forEach((b) => { const s = $("small", b); if (s) s.textContent = st[b.dataset.t] || ""; });
  } catch (e) { }
}

/* ---------- ภาพ: ภาพย่อ + ตัวเปิดภาพ (ถอดรหัสทีละภาพ ; ภาพใหญ่แบ่งท่อน) ---------- */
const imgBy = (f) => (DB.images || []).filter(f);
const thumbEl = (i, cls) => `<img class="${cls || (i.cat === "นิติบุคคล" ? "th lg" : "th")}" loading="lazy" alt="" src="data:image/jpeg;base64,${i.th}">`;
const shot = (i, cap) => `<button class="shot" data-img="${i.id}">${thumbEl(i)}${cap === false ? "" : `<span>${esc(cap || i.title)}</span>`}</button>`;
let VIM = null, VS = 1;
function vZoom(d) {
  if (!VIM) return;
  const fit = Math.min(1, (innerWidth - 16) / VIM.w);
  VS = d === 0 ? fit : d === 9 ? 1 : Math.min(2, Math.max(fit * 0.6, VS * (d > 0 ? 1.4 : 1 / 1.4)));
  $("#viewerBox").style.width = Math.round(VIM.w * VS) + "px";
}
async function openImg(id) {
  const im = (DB.images || []).find((x) => x.id === id); if (!im) return;
  const box = $("#viewerBox"); box.innerHTML = ""; VIM = im; $("#viewerCap").textContent = im.title; $("#viewer").hidden = false; vZoom(0);
  toast("กำลังถอดรหัสภาพ…");
  try {
    const files = im.parts ? Array.from({ length: im.parts }, (_, k) => `img/${id}_${k}.enc`) : [`img/${id}.enc`];
    for (const f of files) {
      const e = await fetchEnc(f), el = new Image();
      el.src = URL.createObjectURL(new Blob([await decrypt(KEY, e)], { type: "image/jpeg" }));
      if (VIM !== im) break;
      box.appendChild(el);
    }
    $("#toast").hidden = true;
  } catch (e) { toast("เปิดภาพไม่ได้: " + e.message); }
}
$("#viewer").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "viewerClose") { $$("#viewerBox img").forEach((i) => URL.revokeObjectURL(i.src)); $("#viewerBox").innerHTML = ""; $("#viewer").hidden = true; VIM = null; }
  else if (b.dataset.z != null) vZoom(+b.dataset.z);
};
document.addEventListener("click", (e) => { const b = e.target.closest("[data-img]"); if (b && DB) openImg(b.dataset.img); });
function pImg() {
  const by = {}; imgBy((i) => i.cat !== "บุคคล" && i.cat !== "นิติบุคคล").forEach((i) => (by[i.cat] = by[i.cat] || []).push(i));
  $("#main").innerHTML = Object.keys(by).map((c) => `<h2>${IC("img")} ${esc(c)} <small>${by[c].length} ภาพ</small></h2><div class="shots">${by[c].map((i) => shot(i)).join("")}</div>`).join("") +
    `<p class="muted" style="font-size:.84rem">กดภาพเพื่อเปิดภาพเต็ม (ซูมได้) — ไฟล์ต้นฉบับ (.png / .anb) อยู่ในโฟลเดอร์คดี</p>`;
}

/* ---------- ชาร์ตเส้นเงินตามตัวกรอง (เงินเข้า → บัญชี → เงินออก) ---------- */
function flowBuild(pair) {
  const det = F.flm === "d", N = F.fln, L = new Map(), R = new Map(), Mi = new Map();
  const lid = (ci) => (det ? "c" + ci : "g" + DB.cps[ci][3]), mid = (ai) => (det ? "a" + ai : "G" + DB.accounts[ai].g);
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const [key, v] of pair) { const ci = Math.floor(key / 64), ai = key % 64; if (v[0]) add(L, lid(ci), v[0]); if (v[1]) add(R, lid(ci), v[1]); add(Mi, mid(ai), v[0] + v[1]); }
  const top = (m) => new Set([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, N).map((x) => x[0]));
  const kL = top(L), kR = top(R), kM = top(Mi), nodes = { L: new Map(), M: new Map(), R: new Map() }, links = new Map();
  const nd = (c, id) => { let n = nodes[c].get(id); if (!n) nodes[c].set(id, (n = { id, c, in: 0, out: 0 })); return n; };
  const lk = (a, b, v, n) => { const k = a + ">" + b; let o = links.get(k); if (!o) links.set(k, (o = { a, b, v: 0, n: 0 })); o.v += v; o.n += n; };
  for (const [key, v] of pair) {
    const ci = Math.floor(key / 64), ai = key % 64, m0 = mid(ai), m = kM.has(m0) ? m0 : "O", l0 = lid(ci);
    if (v[0]) { const l = kL.has(l0) ? l0 : "o"; nd("L", l).out += v[0]; nd("M", m).in += v[0]; lk("L" + l, "M" + m, v[0], v[2]); }
    if (v[1]) { const r = kR.has(l0) ? l0 : "o"; nd("R", r).in += v[1]; nd("M", m).out += v[1]; lk("M" + m, "R" + r, v[1], v[3]); }
  }
  return { nodes, links: [...links.values()] };
}
function flowInfo(id) {
  const t = id[0], k = +id.slice(1);
  if (id === "o" || id === "O") return { lab: "อื่นๆ (รวม)", sub: "", col: "#B0B8C4" };
  if (t === "g" || t === "G") return { lab: DB.groups[k][1].split(" (")[0], sub: "", col: DB.groups[k][2] };
  if (t === "c") { const c = DB.cps[k]; return { lab: c[1] || (c[0] ? `${c[2]} ${c[0]}` : DB.groups[c[3]][1].split(" (")[0]), sub: `${c[2]} ${c[0]}`.trim(), col: DB.groups[c[3]][2] }; }
  const a = DB.accounts[k]; return { lab: `${a.bank} ${a.acc}`, sub: a.name, col: DB.groups[a.g][2] };
}
function drawFlow(box, pair) {
  if (!box) return;
  const { nodes, links } = flowBuild(pair);
  if (!links.length) { box.innerHTML = '<p class="muted" style="padding:20px">ไม่มีรายการตามตัวกรอง</p>'; return; }
  const cols = ["L", "M", "R"].map((c) => [...nodes[c].values()].map((n) => ({ ...n, v: c === "L" ? n.out : c === "R" ? n.in : Math.max(n.in, n.out) }))
    .sort((a, b) => (a.id.length === 1) - (b.id.length === 1) || b.v - a.v));
  const W = Math.max(720, box.clientWidth), wide = W > 1000, LW = wide ? 270 : 160, bw = 14, pad = 7, minH = 20, top = 26;
  const H0 = Math.max(wide ? 520 : 420, Math.max(...cols.map((c) => c.length)) * 34);
  const sc = Math.min(...cols.filter((c) => c.length).map((c) => (H0 - pad * (c.length - 1)) / c.reduce((t, n) => t + n.v, 0)));
  const X = { L: LW, M: (W - bw) / 2, R: W - LW - bw }, pos = {};
  let H = 0;
  cols.forEach((c, i) => { let y = top; c.forEach((n) => { n.h = Math.max(minH, n.v * sc); n.y = y; n.x = X["LMR"[i]]; n.oi = y; n.oo = y; n.inf = flowInfo(n.id); pos["LMR"[i] + n.id] = n; y += n.h + pad; }); H = Math.max(H, y - pad); });
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s), mc = wide ? 30 : 17;
  let svg = "";
  links.sort((a, b) => pos[a.a].y - pos[b.a].y || pos[a.b].y - pos[b.b].y);
  const paths = links.map((l) => {
    const s = pos[l.a], t = pos[l.b], th = Math.max(1, l.v * sc), y0 = s.oo + th / 2, y1 = t.oi + th / 2, x0 = s.x + bw, x1 = t.x, mx = (x0 + x1) / 2;
    s.oo += th; t.oi += th;
    return `<path class="fl" d="M${x0.toFixed(1)},${y0.toFixed(1)} C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}" stroke="${(l.a[0] === "L" ? s : t).inf.col}" stroke-width="${th.toFixed(1)}" data-tip="${esc(s.inf.lab)} → ${esc(t.inf.lab)} : ${fmt(l.v)} บาท (${fmt0(l.n)} ครั้ง)"/>`;
  });
  svg += paths.join("");
  cols.forEach((c, i) => c.forEach((n) => {
    const col = "LMR"[i], f = n.inf, amt = col === "M" ? `เข้า ${M(n.in)} · ออก ${M(n.out)}` : M(n.v);
    const tip = `${f.lab}${f.sub ? " " + f.sub : ""} : ` + (col === "M" ? `เงินเข้า ${fmt(n.in)} / เงินออก ${fmt(n.out)} บาท` : `${fmt(n.v)} บาท`);
    const tx = col === "L" ? n.x - 6 : n.x + bw + 6, an = col === "L" ? "end" : "start", cy = n.y + n.h / 2, two = n.h >= 32;
    svg += `<g class="fn" data-n="${col}${n.id}" data-tip="${esc(tip)}"><rect x="${n.x}" y="${n.y.toFixed(1)}" width="${bw}" height="${n.h.toFixed(1)}" rx="3" fill="${f.col}"/>` +
      (two ? `<text x="${tx}" y="${(cy - 3).toFixed(1)}" text-anchor="${an}" class="fl1">${esc(cut(f.lab, mc))}</text><text x="${tx}" y="${(cy + 12).toFixed(1)}" text-anchor="${an}" class="fl2">${amt}${wide && f.sub ? " · " + esc(cut(f.sub, 24)) : ""}</text>`
        : `<text x="${tx}" y="${(cy + 4).toFixed(1)}" text-anchor="${an}" class="fl1">${esc(cut(f.lab, mc - 6))} <tspan class="fl2">${col === "M" ? M(n.v) : amt}</tspan></text>`) + `</g>`;
  }));
  const hd = (x, t, an) => `<text x="${x}" y="14" text-anchor="${an}" class="flh">${t}</text>`;
  box.innerHTML = `<svg width="${W}" height="${Math.ceil(H + 8)}" viewBox="0 0 ${W} ${Math.ceil(H + 8)}">${hd(X.L + bw, "เงินเข้าจาก", "end")}${hd(X.M + bw / 2, "บัญชี (statement)", "middle")}${hd(X.R, "เงินออกไป", "start")}${svg}</svg>`;
}

/* ---------- บุคคล (ภาพ + บัญชี + เส้นเงิน) ---------- */
const nk = (s) => String(s || "").replace(/^\s*(นางสาว|นาย|นาง|น\.ส\.|ว่าที่\s*ร\.ต\.หญิง|ว่าที่ร้อยตรีหญิง|ด\.ญ\.|ด\.ช\.|mr\.?|mrs\.?|miss)\s*/i, "").replace(/\s+/g, "");
const noteClean = (s) => String(s || "").replace(/https?:\/\/\S+/g, "").replace(/0\d[\d-]{7,10}/g, "").replace(/[\s\/]+$/, "").replace(/\s{2,}/g, " ").trim();
const dg = (s) => String(s || "").replace(/\D/g, "").replace(/^0+/, "");
let PPL = null, PPV = -1, PPF = "", PPQ = "", PPG = true;
function people() {
  if (PPL && PPL.f === TEAM().fetched) return PPL.v;
  const ph = {}; imgBy((i) => i.cat === "บุคคล").forEach((i) => (ph[nk(i.key)] = i));
  const out = [], seen = {};
  DB.accounts.forEach((a) => { const c = DB.groups[a.g][0]; if (c === "t1" || c === "pco") out.push({ name: a.name, eng: "", note: `${a.bank} ${a.acc}`, org: true, acct: true, cat: c, accs: [{ acc: a.acc, bank: a.bank, name: a.name }], img: null }); });
  for (const r of tsR("chart")) {
    if (!isNo(r[0]) || !r[1]) continue;
    const b = r[3].split("\n"), a = r[4].split("\n"), n = r[5].split("\n");
    const p = { name: r[1], eng: r[2], note: noteClean(r[6]), links: linksOf(r[6]), org: /บริษัท|บจก|บมจ|หจก|limited|s\.a\./i.test(r[1]),
      accs: a.map((x, i) => ({ acc: x.trim(), bank: (b[i] || b[0] || "").trim(), name: (n[i] || "").replace(/^[\s\/]+/, "").trim() })).filter((x) => dg(x.acc)), img: ph[nk(r[1])] };
    seen[nk(r[1])] = p; out.push(p);
  }
  for (const q of tsPpl()) { const k = nk(q.name); if (seen[k]) { if (q.note && !seen[k].note) seen[k].note = q.note; seen[k].links = [...new Set([...(seen[k].links || []), ...q.links])]; continue; } seen[k] = { name: q.name, eng: "", note: q.note, links: q.links, org: /บริษัท|บจก|บมจ|หจก|limited|s\.a\./i.test(q.name), accs: [], img: ph[k] }; out.push(seen[k]); }
  for (const q of tsSus()) { const k = nk(q.name); if (!seen[k]) { seen[k] = { name: q.name, eng: "", note: noteClean(q.issue), org: false, accs: [], img: ph[k] }; out.push(seen[k]); } }
  const A = tsAcc();
  for (const p of out) {
    if (p.acct) continue;
    p.cat = (DB.pmap || {})[nk(p.name)] || "oth";
    const core = nk(p.name).replace(/จำกัด|\(มหาชน\)|บริษัท|บจก\.?|บมจ\.?/g, ""); if (core.length < 6) continue;
    const has = new Set(p.accs.map((a) => dg(a.acc))), hit = (nm) => String(nm || "").replace(/\s+/g, "").includes(core);
    for (const r of A) if (hit(r.name) && !has.has(dg(r.acc))) { has.add(dg(r.acc)); p.accs.push({ acc: r.acc, bank: r.bank, name: r.name }); }
    for (const a of DB.accounts) if (hit(a.name) && !has.has(dg(a.acc))) { has.add(dg(a.acc)); p.accs.push({ acc: a.acc, bank: a.bank, name: a.name }); }
  }
  const og = imgBy((i) => i.cat === "นิติบุคคล").map((i) => [nk(i.key).toUpperCase(), i]);
  out.forEach((p) => { p.links = p.links || []; if (!p.img && p.org) { const n = nk(p.name).toUpperCase(), h = og.find(([k]) => k.length >= 4 && n.includes(k)); if (h) p.img = h[1]; } });
  PPL = { f: TEAM().fetched, v: out }; return out;
}
function pplFlow(p) { // เงินจาก/เข้า บัญชีที่มี statement กับบัญชีของบุคคลนี้ (ตามเลขบัญชี)
  const set = new Set(p.accs.map((a) => dg(a.acc))), cis = new Set();
  if (!set.size) return null;
  DB.cps.forEach((c, i) => { if (c[0] && set.has(dg(c[0]))) cis.add(i); });
  let rin = 0, rout = 0, n1 = 0, n2 = 0;
  for (const r of DB.tx) if (cis.has(r[4])) { if (IN_K.includes(r[2])) { rout += r[3]; n2 += r[5] || 1; } else { rin += r[3]; n1 += r[5] || 1; } }
  return { rin, rout, n1, n2 };
}
function pPpl() {
  const P = people(), A = tsAcc(), have = new Set(DB.accounts.map((a) => dg(a.acc))), stOf = (acc) => (A.find((r) => dg(r.acc) === dg(acc)) || {}).data || "";
  const q = PPQ.trim().toLowerCase();
  const show = P.map((p, i) => [p, i]).filter(([p]) => (PPF === "img" ? p.img : PPF === "lnk" ? p.links.length : PPF === "org" ? p.org : PPF === "per" ? !p.org : true) && (!q || (p.name + p.eng + p.note).toLowerCase().includes(q)));
  const CAT = DB.pcats || [], cOf = (k) => CAT.find((c) => c[0] === k) || ["oth", "อื่นๆ", "#757575"];
  const ord = PPG ? CAT.flatMap((c) => show.filter(([p]) => p.cat === c[0])).concat(show.filter(([p]) => !CAT.some((c) => c[0] === p.cat))) : show;
  const card = ([p, i]) => `<button class="pcard ${i === PPV ? "on" : ""}" data-p="${i}" style="--c:${cOf(p.cat)[2]}">${p.img ? thumbEl(p.img) : `<span class="ph">${IC(p.acct ? "bank" : p.org ? "build" : "user", 30)}</span>`}<b>${esc(p.name)}</b>${p.note ? `<small>${esc(p.note)}</small>` : ""}${p.accs.length && !p.acct ? `<span class="cnt">${IC("bank", 13)}${p.accs.length}</span>` : ""}${p.links.length ? `<span class="cnt lk">${IC("link", 13)}${p.links.length}</span>` : ""}</button>`;
  const det = (i) => { const p = P[i]; if (!p) return ""; const f = pplFlow(p);
    return `${backBtn()}<div class="card prof">${p.img ? `<button class="pf" data-img="${p.img.id}">${thumbEl(p.img)}</button>` : `<span class="pf ph">${IC(p.org ? "build" : "user", 44)}</span>`}
      <div><h3>${esc(p.name)}</h3>${p.eng ? `<div class="muted">${esc(p.eng)}</div>` : ""}<div style="margin-top:6px"><span class="badge"><span class="dot" style="background:${cOf(p.cat)[2]};width:9px;height:9px;margin-right:5px"></span>${esc(cOf(p.cat)[1])}</span> ${p.note ? `<span class="badge y">${esc(p.note)}</span>` : ""}</div>${p.links.length ? `<div class="pgm">${p.links.map(linkBtn).join("")}</div>` : ""}</div></div>
    ${f ? `<div class="grid g2" style="margin-top:10px"><div class="card kpi r"><div class="l">รับเงินจากบัญชีที่มี statement</div><div class="v">${M(f.rin)}</div><div class="s">${fmt(f.rin)} บาท · ${fmt0(f.n1)} ครั้ง</div></div>
      <div class="card kpi"><div class="l">โอนเข้าบัญชีที่มี statement</div><div class="v">${M(f.rout)}</div><div class="s">${fmt(f.rout)} บาท · ${fmt0(f.n2)} ครั้ง</div></div></div>` : ""}
    <h2>${IC("bank")} บัญชี <small>${p.accs.length} บัญชี</small> ${p.accs.length ? `<button class="chip" data-flow="${i}">${IC("flow", 15)} ดูเส้นเงิน</button>` : ""}</h2>
    <div class="card">${p.accs.map((a) => li(`${esc(a.bank)} ${esc(a.acc)}`, esc(a.name), `${have.has(dg(a.acc)) ? `<span class="badge g">${IC("check", 12)} มี statement</span>` : stBadge(stOf(a.acc)) || '<span class="badge">ยังไม่ขอ</span>'}`)).join("") || '<span class="muted">ชีตยังไม่ระบุบัญชี</span>'}</div>`; };
  const list = `<h2>${IC("users")} บุคคล / นิติบุคคลที่เกี่ยวข้อง <small>${show.length} / ${P.length} ราย</small></h2>
    <div class="frow">${[["", "ทั้งหมด"], ["img", "มีภาพ"], ["lnk", "มีลิงก์"], ["per", "บุคคล"], ["org", "นิติบุคคล"]].map(([k, l]) => `<button class="chip ${PPF === k ? "on" : ""}" data-pf="${k}">${l}</button>`).join("")}<button class="chip ${PPG ? "on" : ""}" data-pg="1" title="สลับ แยกประเภท / รวมทั้งหมด">${IC("list", 14)} แยกประเภท</button><input type="search" id="ppQ" value="${esc(PPQ)}" placeholder="ค้นหาชื่อ"></div>
    ${PPG ? CAT.map((c) => { const v = show.filter(([p]) => p.cat === c[0]); return v.length ? `<h3 class="pch"><span class="dot" style="background:${c[2]}"></span>${esc(c[1])} <small>${v.length}</small></h3><div class="pgrid">${v.map(card).join("")}</div>` : ""; }).join("") : `<div class="pgrid">${show.map(card).join("")}</div>`}`;
  const wide = isWide(), v = wide ? (PPV >= 0 ? PPV : (ord[0] || [0, -1])[1]) : PPV, m = $("#main");
  m.innerHTML = wide ? `<div class="md"><div class="md-l wide">${list}</div><div class="md-r">${det(v)}</div></div>` : (v >= 0 ? det(v) : list);
  $$(".pcard", m).forEach((b) => b.classList.toggle("on", +b.dataset.p === v));
  m.onclick = (e) => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.p != null) { PPV = +b.dataset.p; render(); if (!wide) scrollTo(0, 0); }
    else if (b.dataset.v != null) { PPV = -1; render(); }
    else if (b.dataset.pf != null) { PPF = b.dataset.pf; render(); }
    else if (b.dataset.pg != null) { PPG = !PPG; render(); }
    else if (b.dataset.flow != null) { const p = P[+b.dataset.flow]; resetF(); F.q = dg(p.accs[0].acc); F.flm = "d"; go("ana"); } };
  let tm; m.oninput = (e) => { if (e.target.id !== "ppQ") return; clearTimeout(tm); tm = setTimeout(() => { PPQ = e.target.value; render(); const x = $("#ppQ"); if (x) { x.focus(); x.setSelectionRange(PPQ.length, PPQ.length); } }, 300); };
}

/* ---------- ตารางขอข้อมูล STM (ตามแท็บคุมบัญชี) ---------- */
let SF = { st: "", bank: "", q: "", sys: "" };
function pStm() {
  const A = tsR("acc").filter((r) => isNo(r[0]) && r[1]).map((r) => ({ no: r[0], acc: r[1], name: r[2], bank: r[3], ref: r[4], data: r[5], wd: r[6], br: r[8], note: r[9] }));
  const have = new Set(DB.accounts.map((a) => dg(a.acc))); A.forEach((r) => (r.sys = have.has(dg(r.acc))));
  const sts = [...new Set(A.map((r) => r.data).filter(Boolean))], banks = [...new Set(A.map((r) => r.bank).filter(Boolean))];
  const c = (f) => A.filter(f).length, q = SF.q.trim().toLowerCase();
  const show = A.filter((r) => (!SF.st || r.data === SF.st) && (!SF.bank || r.bank === SF.bank) && (!SF.sys || (SF.sys === "y" ? r.sys : !r.sys && /ได้แล้ว/.test(r.data))) && (!q || (r.acc + r.name + r.ref + r.note).toLowerCase().includes(q)));
  const k = (key, val, ic, v, l, cls) => `<button class="tile ${SF[key] === val && (val || key === "all") ? "on" : ""}" data-sk="${key}" data-sv="${esc(val)}"><span class="ico ${cls || ""}">${IC(ic)}</span><span class="v">${v}</span><span class="l">${l}</span></button>`;
  const m = $("#main");
  m.innerHTML = `<h2>${IC("doc")} การขอข้อมูล statement <small>${tsStamp()}</small> ${syncBtn()}</h2>
  <div class="tiles">${k("all", "", "list", A.length, "บัญชีทั้งหมด")}${sts.map((s) => k("st", s, /ได้แล้ว/.test(s) ? "check" : "clock", c((r) => r.data === s), esc(s), /ได้แล้ว/.test(s) ? "g" : "y")).join("")}
    ${k("sys", "y", "chart", c((r) => r.sys), "อยู่ในระบบวิเคราะห์แล้ว", "g")}${k("sys", "n", "warn", c((r) => !r.sys && /ได้แล้ว/.test(r.data)), "ได้แล้ว รอนำเข้าระบบ", "r")}</div>
  <div class="grid g2w" style="margin-top:12px"><div class="card"><div class="chartbox sm"><canvas id="cStB"></canvas></div></div>
    <div class="card"><div class="lab" style="margin-top:0">ความคืบหน้า</div>${sts.map((s) => { const n = c((r) => r.data === s); return `<div class="row"><span>${esc(s)}</span><span>${n} บัญชี · ${(n / A.length * 100).toFixed(0)}%</span></div><div class="bar"><i style="width:${n / A.length * 100}%;background:${/ได้แล้ว/.test(s) ? "var(--green)" : "#E0A800"}"></i></div>`; }).join("")}
      <div class="row"><span>อยู่ในระบบวิเคราะห์เส้นเงินแล้ว</span><span>${c((r) => r.sys)} บัญชี</span></div><div class="bar"><i style="width:${c((r) => r.sys) / A.length * 100}%;background:var(--navy)"></i></div></div></div>
  <div class="frow" style="margin-top:12px"><label>ธนาคาร</label>${banks.map((b) => `<button class="chip ${SF.bank === b ? "on" : ""}" data-sk="bank" data-sv="${esc(b)}">${esc(b)} ${c((r) => r.bank === b)}</button>`).join("")}
    <input type="search" id="stQ" value="${esc(SF.q)}" placeholder="ค้นหาเลขบัญชี / ชื่อ / เลขหนังสือ"></div>
  <h2>${IC("list")} รายบัญชี <small>${show.length} / ${A.length} บัญชี</small></h2>
  <div class="tblwrap tall"><table><tr><th>#</th><th>ธนาคาร</th><th>เลขบัญชี</th><th>ชื่อบัญชี</th><th>สถานะ</th><th>ในระบบ</th><th>เลขที่หนังสือ</th><th>รายการถอนเงิน</th><th>สาขา</th><th>หมายเหตุ</th></tr>
    ${show.map((r) => `<tr><td>${esc(r.no)}</td><td>${esc(r.bank)}</td><td>${esc(r.acc)}</td><td>${esc(r.name)}</td><td>${stBadge(r.data)}</td><td>${r.sys ? `<span class="badge g">${IC("check", 12)} มี</span>` : ""}</td><td>${esc(r.ref)}</td><td>${esc(r.wd)}</td><td>${esc(r.br)}</td><td>${esc(r.note)}</td></tr>`).join("")}</table></div>
  <p class="muted" style="font-size:.82rem">สถานะตามแท็บ "คุมบัญชี" ของชีตชุดทำคดี (อ่านอย่างเดียว) · "ในระบบ" = บัญชีที่มี statement อยู่ในระบบวิเคราะห์เส้นเงินนี้แล้ว</p>`;
  const col = (s) => (/ได้แล้ว/.test(s) ? "#1B7A4A" : /ขอแล้ว/.test(s) ? "#E0A800" : "#9E9E9E");
  CH.stB = new Chart($("#cStB"), { type: "bar", data: { labels: banks, datasets: sts.map((s) => ({ label: s, data: banks.map((b) => c((r) => r.bank === b && r.data === s)), backgroundColor: col(s), stack: "s" })) },
    options: { maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 }, title: { display: true, text: "บัญชี" } } } } });
  m.onclick = (e) => { const b = e.target.closest("button"); if (!b || tsClick(b)) return; const kk = b.dataset.sk; if (!kk) return;
    if (kk === "all") SF = { st: "", bank: "", q: "", sys: "" }; else SF[kk] = SF[kk] === b.dataset.sv ? "" : b.dataset.sv; render(); };
  let tm; m.oninput = (e) => { if (e.target.id !== "stQ") return; clearTimeout(tm); tm = setTimeout(() => { SF.q = e.target.value; render(); const x = $("#stQ"); if (x) { x.focus(); x.setSelectionRange(SF.q.length, SF.q.length); } }, 300); };
}

/* ---------- ผลการตรวจค้น / ของกลาง ---------- */
function pSrch() {
  const S = DB.search || { rows: [], sites: {}, report: "" }, ims = imgBy((i) => i.cat === "ตรวจค้น");
  const sites = [...new Set([...Object.keys(S.sites || {}), ...S.rows.map((r) => String(r.site))])].sort();
  const tot = S.rows.reduce((t, r) => t + (r.n || 0), 0), pr = S.rows.filter((r) => r.used_lo != null);
  const sm = (rs, k) => rs.reduce((t, r) => t + (r[k] || 0) * (r.n || 1), 0), rng = (rs) => (rs.length ? `${M(sm(rs, "used_lo"))} – ${M(sm(rs, "used_hi"))}` : "–");
  const kinds = [...new Set(S.rows.map((r) => r.item))];
  $("#main").innerHTML = `<div class="hero"><div class="l">${IC("search", 16)} ของกลางที่ตรวจยึด · ${esc(S.made)}</div><div class="v">${tot} รายการ</div>
    <div class="leg">${kinds.map((k) => `<span style="--c:#FFD403">${esc(k)} ${S.rows.filter((r) => r.item === k).reduce((t, r) => t + r.n, 0)}</span>`).join("")}</div>
    <div class="l" style="margin-top:8px">ประเมินราคามือสองเบื้องต้นจากภาพถ่าย <b style="color:#fff">${rng(pr)}</b> (เฉพาะ ${pr.reduce((t, r) => t + r.n, 0)} รายการที่ประเมินได้ — ไม่ใช่ราคาประเมินทางการ)</div></div>
  ${ims.length ? `<div class="shots big" style="margin-top:12px">${ims.filter((i) => /ภาพรวม/.test(i.title)).map((i) => shot(i)).join("")}</div>` : ""}
  <div class="grid g2w" style="margin-top:4px">${sites.map((s) => { const rs = S.rows.filter((r) => String(r.site) === s), ph = ims.filter((i) => i.key === "s" + s && !/ภาพรวม/.test(i.title));
    return `<div><h2>${IC("bag")} จุดที่ ${s} <small>${rs.reduce((t, r) => t + r.n, 0)} รายการ</small></h2><div class="muted" style="font-size:.86rem;margin:-4px 0 8px">${esc((S.sites || {})[s] || "")}</div>
    ${ph.length ? `<div class="shots">${ph.map((i) => shot(i, false)).join("")}</div>` : ""}
    <div class="card" style="margin-top:8px">${rs.map((r) => li(`${esc(r.item)}${r.n > 1 ? " × " + r.n : ""}`, `${esc(r.model || r.look || "")}${r.conf ? ` · ความมั่นใจ ${esc(r.conf)}` : ""}`, r.used_lo != null ? `${fmt0(r.used_lo)}–${fmt0(r.used_hi)}` : "–")).join("")}</div></div>`; }).join("")}</div>
  ${S.report ? accd(`${IC("doc", 16)} รายงานผลการตรวจค้น (ฉบับเต็ม)`, "", `<div class="pgd" style="white-space:pre-wrap">${esc(S.report)}</div>`) : ""}
  <p class="muted" style="font-size:.82rem">ราคาต่อชิ้น (บาท) เป็นช่วงราคามือสองโดยประมาณจากภาพถ่าย ต้องให้ผู้เชี่ยวชาญ / ตัวแทนเจ้าของเครื่องหมายการค้าตรวจยืนยัน</p>`;
}

function overExtra(o, ntx) {
  const S = tsSum(), fz = tsFrz().secs.flatMap((s) => s.rows), W = tsWit().flatMap((s) => s.rows), A = tsAcc(), SR = DB.search || { rows: [] }, big = imgBy((i) => i.key === "big")[0];
  const k = (t, ic, v, l, s, cls) => `<button class="tile" data-go="${t}"><span class="ico ${cls || ""}">${IC(ic)}</span><span class="v">${v}</span><span class="l">${l}</span>${s ? `<span class="s">${s}</span>` : ""}<span class="go">${IC("next", 16)}</span></button>`;
  return `<div class="tiles">
    ${k("ana", "coin", M(o.donor_in), "เงินเข้าจากภายนอก 3 บัญชี", o.back_in != null ? `บริจาค ${M(o.donor_in - o.back_in)} · ตัวละครโอนคืน ${M(o.back_in)}` : `${fmt0(o.donor_n)} ครั้ง`, "y")}
    ${k("ana", "route", M(o.t1_out), "เงินออกจากบัญชีรับบริจาค", "ตั้งแต่ 29 ม.ค. 2558", "r")}
    ${k("acc", "bank", DB.accounts.length, "บัญชีที่มี statement", `${fmt0(ntx)} รายการ`)}
    ${k("charges", "scale", C.charges.length, "ผู้ต้องหา", `ข้อต่อสู้ ${C.defences.length} ประเด็น`)}
    ${k("work", "clock", C.todo.filter((t) => !/เสร็จ/.test(t.status || "")).length, "งานค้าง", `ทำแล้ว ${C.done.length}`)}
    ${k("asset", "home", M(S.reduce((t, s) => t + s.tot[0] + s.tot[1], 0)), "ทรัพย์สินที่ตรวจพบ", `${S.length} หมวด`)}
    ${k("asset", "lock", M(fz.reduce((t, r) => t + r.amt, 0)), "เงินในบัญชีที่อายัด", `${fz.length} บัญชี`)}
    ${k("stm", "doc", `${A.filter((r) => /ได้แล้ว/.test(r.data)).length}<small>/${A.length}</small>`, "statement ได้แล้ว", "")}
    ${k("prog", "users", `${W.filter((r) => /มาพบ/.test(r.st)).length}<small>/${W.length}</small>`, "พยานมาพบแล้ว", "")}
    ${k("srch", "bag", SR.rows.reduce((t, r) => t + (r.n || 0), 0), "ของกลางที่ตรวจยึด", "รายการ")}
    ${k("ppl", "user", people().length, "บุคคลที่เกี่ยวข้อง", "")}
    ${k("trace", "flow", DB.sets.length, "ชุดไล่เส้นเงิน", "")}</div>
  ${big ? `<button class="banner" data-img="${big.id}">${thumbEl(big)}<span><b>${IC("zoom", 18)} ${esc(big.title)}</b><small>กดเพื่อเปิดภาพเต็ม — เลื่อนและซูมได้</small></span></button>` : ""}`;
}
const newsBlock = () => { const v = imgBy((i) => i.cat === "ภาพข่าว"); return v.length ? `<h2>${IC("img")} ภาพข่าว / ภาพประกอบ <small>${v.length} ภาพ</small></h2><div class="shots big">${v.map((i) => shot(i)).join("")}</div>` : ""; };
