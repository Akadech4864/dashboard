/* CIB Case Dashboard — ข้อมูลทั้งหมดถูกเข้ารหัส (AES-GCM) ถอดด้วยรหัสผ่านในเบราว์เซอร์เท่านั้น */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PREF = (() => { try { return JSON.parse(localStorage.getItem("cib_prefs")) || {}; } catch (e) { return {}; } })();   // ตั้งค่าการแสดงผล (shell.js)
const nf = (v, d) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const moneyS = (x) => { const v = Number(x || 0), a = Math.abs(v), m = PREF.money || "m";
  if (m === "full") return nf(v, 2);
  if (m === "auto") return a >= 1e6 ? nf(v / 1e6, 2) + " ล." : a >= 1e5 ? nf(v / 1e5, 2) + " แสน" : nf(v, 0);
  return nf(v / 1e6, 2) + " ล."; };
const fmt = (x) => (PREF.tblShort ? moneyS(x) : nf(Number(x || 0), 2));
const fmt0 = (x) => Number(x || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const M = (x) => moneyS(x);
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

/* ---------- เนื้อหาที่แก้ไขได้ (ฐานข้อมูล Google Sheet) ---------- */
const SEC = {
  story: { label: "เนื้อเรื่อง", f: [["title", "หัวข้อ"], ["detail", "รายละเอียด", "ta"]] },
  case: { label: "รายละเอียดคดี", f: [["title", "หัวข้อ"], ["detail", "รายละเอียด", "ta"]] },
  events: { label: "ลำดับเหตุการณ์", f: [["date", "วันที่", "date"], ["title", "เหตุการณ์"], ["detail", "รายละเอียด", "ta"]] },
  charges: { label: "ข้อหา", f: [["title", "บุคคล"], ["extra1", "บทบาท"], ["detail", "ข้อหา", "ta"], ["status", "สถานะ"]] },
  defences: { label: "ข้อต่อสู้ที่ต้องพิสูจน์", f: [["extra1", "ผู้อ้าง"], ["title", "ข้อต่อสู้"], ["detail", "สิ่งที่ต้องพิสูจน์", "ta"], ["extra2", "หลักฐานที่มี", "ta"], ["status", "สถานะ"]] },
  done: { label: "สิ่งที่ทำไปแล้ว", f: [["title", "งาน"], ["detail", "รายละเอียด", "ta"], ["date", "วันที่", "date"]] },
  recs: { label: "ข้อเสนอแนะ", f: [["title", "ข้อเสนอ"], ["detail", "รายละเอียด", "ta"], ["extra2", "หมวด (เลือกหรือพิมพ์เอง)", "list"], ["extra1", "ผู้รับผิดชอบ"], ["status", "สถานะ", "sel:เสนอ|กำลังดำเนินการ|เสร็จแล้ว"]] },
  todo: { label: "งาน", f: [["title", "งาน"], ["detail", "รายละเอียด", "ta"], ["extra2", "หมวดงาน (เลือกหรือพิมพ์เอง)", "list"], ["extra1", "ผู้รับผิดชอบ"], ["date", "กำหนด / วันที่", "date"],
    ["status", "สถานะ", "sel:ต้องทำ|กำลังดำเนินการ|รอผล|เสร็จแล้ว"]] },
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
  Object.keys(SEC).forEach((k) => (C[k] = C[k] || (DB.content[k] ? JSON.parse(JSON.stringify(DB.content[k])) : [])));   // หมวดใหม่ (เช่น ข้อเสนอแนะ) ใช้ค่าตั้งต้นจากข้อมูลคดี
  if (sheetCfg().url) {
    try { const j = await sheetCall({ action: "list" }); if (j && j.rows && j.rows.length) { C = rowsToContent(j.rows);
      Object.keys(SEC).forEach((k) => { if (!j.rows.some((r) => r.section === k) && (DB.content[k] || []).length) C[k] = JSON.parse(JSON.stringify(DB.content[k])); });   // หมวดที่ยังไม่มีในชีต
      LS.set("cib_content", C); toast("ดึงข้อมูลจาก Google Sheet แล้ว"); render(); } }
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
    `<label>${l}</label>` + (t === "ta" ? `<textarea data-k="${k}">${esc(it[k])}</textarea>`
      : t && t.startsWith("sel:") ? `<select data-k="${k}">${[...new Set([...t.slice(4).split("|"), it[k] || ""])].filter(Boolean).map((o) => `<option${(it[k] || t.slice(4).split("|")[0]) === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`
      : t === "list" ? `<input data-k="${k}" list="dl_${k}" value="${esc(it[k])}" placeholder="เช่น ขอข้อมูลธนาคาร / สอบปากคำ / รายงาน"><datalist id="dl_${k}">${[...new Set(sec === "recs" ? (C.recs || []).map((r) => r.extra2).filter(Boolean) : typeof workRows === "function" ? workRows().map((r) => r.type) : [])].map((o) => `<option value="${esc(o)}">`).join("")}</datalist>`
      : `<input data-k="${k}" type="${t === "date" ? "date" : "text"}" value="${esc(it[k])}">`)).join("") +
    `<div class="modal-foot">${id ? '<button class="btn o" id="mDel">ลบ</button>' : ""}<button class="btn o" id="mCancel">ยกเลิก</button><button class="btn" id="mSave">บันทึก</button></div>`);
  $("#mCancel").onclick = closeModal;
  $("#mSave").onclick = () => { $$("[data-k]", $("#modalBox")).forEach((e) => (it[e.dataset.k] = e.value.trim())); closeModal(); saveItem(sec, it); };
  if (id) $("#mDel").onclick = () => { if (confirm("ลบรายการนี้?")) { closeModal(); saveItem(sec, it, true); } };
}
function SETDB() {                                                     // ตั้งค่าฐานข้อมูล Google Sheet (เรียกจากแผงตั้งค่า)
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
}
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: type + ";charset=utf-8" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

function download2(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const CRCT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u) => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRCT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files) {                                              // [[ชื่อ, ข้อความ]] -> Blob zip (STORED)
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const [name, text] of files) {
    const nb = enc.encode(name), db = enc.encode(text), crc = crc32(db), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, db.length, true); h.setUint32(22, db.length, true); h.setUint16(26, nb.length, true);
    parts.push(h, nb, db);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, db.length, true); c.setUint32(24, db.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    cen.push(c, nb); off += 30 + nb.length + db.length;
  }
  const csz = cen.reduce((t, x) => t + x.byteLength, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, e], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
function xlsxBlob(sheet, rows, widths) {                                // ตาราง -> .xlsx (แถวแรก = หัวตาราง ตัวหนา ตรึงแถว ; ตัวเลข = ค่าตัวเลข)
  const x = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const col = (n) => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => { const ref = col(ci) + (ri + 1);
    if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${ri ? ' s="2"' : ""}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${ri ? "" : ' s="1"'}><is><t xml:space="preserve">${x(v ?? "")}</t></is></c>`; }).join("")}</row>`).join("");
  const cols = widths ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const ws = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData><autoFilter ref="A1:${col(rows[0].length - 1)}${rows.length}"/></worksheet>`;
  const st = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><name val="Tahoma"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  return zipStore([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${x(sheet)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${x(sheet)}'!$A$1:$${col(rows[0].length - 1)}$${rows.length}</definedName></definedNames></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", ws], ["xl/styles.xml", st]]);
}

const TMON = { "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6, "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12 };
function cellKey(t) {                                                   // ข้อความในเซลล์ -> ค่าที่ใช้เรียง (วันที่ไทย / ตัวเลข / ข้อความ)
  t = String(t || "").trim();
  const d = t.match(/^(\d{1,2}) (ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.) (\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (d) { let y = +d[3]; if (y < 100) y += 2500; return ((y * 100 + TMON[d[2]]) * 100 + +d[1]) * 1e6 + (+(d[4] || 0)) * 1e4 + (+(d[5] || 0)) * 100 + (+(d[6] || 0)); }
  const n = t.replace(/[,\s]|บาท|ล\.|ครั้ง|%/g, "");
  if (/^-?\d+(\.\d+)?$/.test(n)) return parseFloat(n);
  return t;
}
const isTotalRow = (tr) => /^(รวม|ผลรวม|ที่เหลือ)/.test((tr.cells[0] || {}).textContent || "") || /^(รวม|ผลรวม)/.test((tr.cells[1] || {}).textContent || "");
function tableRows(tbl) { return [...tbl.rows].map((tr) => [...tr.cells].map((c) => c.innerText.replace(/\s*\n\s*/g, " ").trim())); }
function exportTable(tbl, name) {
  const rows = tableRows(tbl).map((r, i) => (i ? r.map((v) => { const k = cellKey(v); return typeof k === "number" && !/\d{1,2} [ก-๙.]+ \d{2}/.test(v) ? k : v; }) : r));
  download2((name || "ตาราง") + ".xlsx", xlsxBlob("ตาราง", rows, rows[0].map((h, j) => Math.min(48, Math.max(8, ...rows.slice(0, 200).map((r) => String(r[j] ?? "").length + 2))))));
}
function sortTable(tbl) {
  const body = [...tbl.rows].filter((tr) => tr.parentNode && !tr.querySelector("th")), fixed = body.filter(isTotalRow), data = body.filter((tr) => !isTotalRow(tr));
  if (!tbl._orig) tbl._orig = data.slice();
  const keys = tbl._sort || [];
  const arr = keys.length ? data.slice().sort((a, b) => { for (const [c, d] of keys) { const x = cellKey((a.cells[c] || {}).textContent), y = cellKey((b.cells[c] || {}).textContent);
    if (x === y) continue; const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "th"); if (r) return r * d; } return tbl._orig.indexOf(a) - tbl._orig.indexOf(b); }) : tbl._orig.filter((tr) => data.includes(tr));
  const parent = (data[0] || fixed[0] || {}).parentNode; if (!parent) return;
  arr.concat(fixed).forEach((tr) => parent.appendChild(tr));
  const hr = [...tbl.rows].find((tr) => tr.querySelector("th"));
  if (hr) [...hr.cells].forEach((th, c) => { let s = th.querySelector(".sx"); const n = keys.findIndex((k) => k[0] === c);
    if (n < 0) { if (s) s.remove(); return; } if (!s) { s = document.createElement("small"); s.className = "sx"; th.appendChild(s); } s.textContent = ` ${keys[n][1] > 0 ? "▲" : "▼"}${keys.length > 1 ? n + 1 : ""}`; });
}
function svgPng(svg, name) {                                            // SVG ชาร์ตเส้นเงิน -> PNG (ฝังสไตล์ข้อความ/เส้น)
  let css = ""; for (const ss of document.styleSheets) { try { for (const r of ss.cssRules) if (/\.(fl|fn|flh)/.test(r.selectorText || "")) css += r.cssText; } catch (e) { } }
  const c = svg.cloneNode(true); c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  c.insertAdjacentHTML("afterbegin", `<style>text{font-family:Tahoma,'Leelawadee UI',sans-serif}${css}</style><rect width="100%" height="100%" fill="#fff"/>`);
  const w = +svg.getAttribute("width"), h = +svg.getAttribute("height"), im = new Image();
  im.onload = () => { const cv = document.createElement("canvas"); cv.width = w * 2; cv.height = h * 2; const g = cv.getContext("2d"); g.scale(2, 2); g.drawImage(im, 0, 0); cv.toBlob((b) => download2(name + ".png", b)); };
  im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(c));
}
function canvasPng(cv, name) { const o = document.createElement("canvas"); o.width = cv.width; o.height = cv.height; const g = o.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, o.width, o.height); g.drawImage(cv, 0, 0); o.toBlob((b) => download2(name + ".png", b)); }
const titleNear = (el) => { let e = el; for (let k = 0; k < 6 && e; k++) { let p = e.previousElementSibling; while (p) { if (/^H[23]$/.test(p.tagName) || p.classList.contains("lab")) return p.textContent.replace(/\s+/g, " ").trim().slice(0, 60); p = p.previousElementSibling; } e = e.parentElement; } return TABS.find((t) => t[0] === TAB)?.[1] || "ข้อมูล"; };
function enhance(root) {
  if (window.cfrEnhance) cfrEnhance(root);
  for (const tbl of root.querySelectorAll("table")) {
    if (tbl.dataset.enh) continue; tbl.dataset.enh = "1";
    const hr = [...tbl.rows].find((tr) => tr.querySelector("th"));
    const custom = hr && hr.querySelector("[data-ts],[data-cs],[data-xs]");
    if (hr && !custom) [...hr.cells].forEach((th, c) => { th.classList.add("srt"); th.title = "เรียง";
      th.addEventListener("click", (e) => { e.stopPropagation(); const k = tbl._sort = tbl._sort || [], n = k.findIndex((x) => x[0] === c);
        if (n < 0) k.push([c, 1]); else if (k[n][1] === 1) k[n][1] = -1; else k.splice(n, 1); sortTable(tbl); }); });
    if (tbl.closest("#tTx,[data-noxbar]")) continue;                                 // ตารางรายการมีปุ่มส่งออกทุกแถวของตัวเอง
    const host = tbl.closest(".tblwrap") || tbl;
    const bar = document.createElement("div"); bar.className = "xbar";
    bar.innerHTML = `${hr && !custom ? `<button class="ibx" data-xr="1" title="กลับลำดับเดิม" aria-label="กลับลำดับเดิม">${IC("reset", 15)}</button>` : ""}<button class="ibx" data-xl="1" title="ส่งออก Excel" aria-label="ส่งออก Excel">${IC("xls", 15)}</button>`;
    bar.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; e.stopPropagation();
      if (b.dataset.xl) exportTable(tbl, titleNear(host)); else { tbl._sort = []; sortTable(tbl); } };
    while (host.previousElementSibling && host.previousElementSibling.classList.contains("xbar")) host.previousElementSibling.remove();   // ตารางที่ถูกวาดใหม่ในกล่องเดิม: เอาแถบปุ่มเก่าออก (กันปุ่ม Excel ซ้อนเป็นแถวยาว ; ผู้ใช้แจ้ง 19 พ.ย. 69)
    host.parentNode.insertBefore(bar, host);
  }
  for (const cv of root.querySelectorAll(".chartbox canvas")) {
    const box = cv.closest(".chartbox"); if (box.dataset.enh) continue; box.dataset.enh = "1";
    const b = document.createElement("button"); b.className = "chip pngbtn"; b.textContent = "PNG"; b.title = "ส่งออกรูปชาร์ต";
    b.onclick = (e) => { e.stopPropagation(); canvasPng(cv, titleNear(box)); }; box.appendChild(b);
  }
  for (const card of root.querySelectorAll(".flowcard")) {
    if (card.dataset.enh) continue; card.dataset.enh = "1";
    const b = document.createElement("button"); b.className = "chip pngbtn"; b.textContent = "PNG"; b.title = "ส่งออกรูปชาร์ต";
    b.onclick = (e) => { e.stopPropagation(); const sv = card.querySelector("svg"); if (sv) svgPng(sv, titleNear(card)); }; card.style.position = "relative"; card.appendChild(b);
  }
}
let ENT = 0;
new MutationObserver(() => { clearTimeout(ENT); ENT = setTimeout(() => { const m = $("#main"); if (m) enhance(m); }, 120); }).observe(document.getElementById("main") || document.body, { childList: true, subtree: true });

/* ---------- โครงหน้า ---------- */
const TABS = [["home", "หน้าแรก", "home"], ["brief", "สรุปทางการ", "book"], ["charges", "ผู้ต้องหา / ข้อหา", "scale"], ["case", "ลำดับเหตุการณ์", "cal"], ["ana", "วิเคราะห์เส้นเงิน", "flow"], ["acct", "บัญชี / บุคคล", "bank"], ["cc", "บัตรเครดิต", "card"], ["over", "สถิติบัญชีรับบริจาค", "chart"],
  ["recs", "ข้อเสนอแนะ", "bulb"], ["asset", "ทรัพย์สิน", "coin"], ["work", "งาน / ความคืบหน้า", "list"], ["defences", "ข้อต่อสู้", "shield"], ["srch", "ตรวจค้น", "bag"], ["img", "ภาพ", "img"]];
let TAB = "home";
function start() {
  $("#login").hidden = true; $("#app").hidden = false;
  $("#caseTitle").textContent = DB.case || "ข้อมูลคดี";
  $("#madeAt").textContent = "ข้อมูล ณ " + dTh(DB.made) + " " + DB.made.slice(11);
  prep();
  C = LS.get("cib_content") || JSON.parse(JSON.stringify(DB.content));
  Object.keys(SEC).forEach((k) => (C[k] = C[k] || (DB.content[k] ? JSON.parse(JSON.stringify(DB.content[k])) : [])));
  shellInit();
  const h0 = (location.hash || "#home").slice(1);
  history.replaceState({ t: h0 }, "", "#" + h0);
  go(h0, true);
  loadContent();
  if (window.aiMount) window.aiMount();
}
function go(t, noHist) {                                                // noHist = มาจากปุ่มย้อนกลับ / เปิดครั้งแรก (ไม่เพิ่มประวัติ)
  PV = ""; AV = ""; if (t === "prog") t = "work"; if (t === "charges") { BRV = "chg"; t = "brief"; } if (t === "stm" || t === "acc") { ACS = "tbl"; t = "acct"; } else if (t === "ppl" || t === "trace") { ACS = t; t = "acct"; }
  const prev = TAB; TAB = TABS.some((x) => x[0] === t) ? t : "home";
  if (!noHist && prev !== TAB) { history.pushState({ t: TAB, v: TAB === "brief" ? BRV : undefined }, "", "#" + TAB); NAVD++; }
  else history.replaceState({ t: TAB, v: TAB === "brief" ? BRV : undefined }, "", "#" + TAB);
  render(); shellSync(); window.scrollTo(0, 0);
}
function killCharts() { Object.values(CH).forEach((c) => c.destroy()); CH = {}; }
function render() { killCharts(); ONRS = null; const m_ = $("#main"); m_.onclick = m_.onchange = m_.oninput = null; ({ home: pHome, brief: pBrief, recs: pRecs, over: pOver, case: pCase, charges: pCharges, defences: pDef, work: pWork, prog: pWork, acct: pAcct, asset: pAsset, cc: pCc, srch: pSrch, ana: pAna, img: pImg })[TAB](); navStats(); }
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
let EVY = "", CHV = -1, DFF = "", WKF = "todo", CHF = "";
/* ลำดับเหตุการณ์ รุ่น 19 พ.ย. 69 (ผู้ใช้สั่ง "ภาพรวมคร่าว ๆ ตั้งแต่เริ่มก่อตั้งจนดำเนินคดี ใคร ข้อหาอะไร"):
   แถบ 4 ช่วง (เริ่มรับบริจาค → จดทะเบียน/ดำเนินงาน → ตรวจสอบ → ดำเนินคดี) + เส้นเวลาแยกช่วง + ปลายทาง "ใครถูกดำเนินคดี ข้อหาอะไร" */
function susPic(title) {
  const ph = {}; imgBy((i) => i.cat === "บุคคล").forEach((i) => (ph[nk(i.key)] = i));
  const k = nk(String(title).split("(")[0]); if (ph[k]) return ph[k];
  const f = Object.keys(ph).find((n) => n.length >= 6 && k.length >= 6 && (k.includes(n) || n.includes(k))); return f ? ph[f] : null;
}
const CHG3 = [["F", "ฉ้อโกงประชาชน", /ฉ้อโกง/, "#B3261E"], ["C", "พ.ร.บ.คอมพิวเตอร์", /คอมพิวเตอร์|ข้อมูล(อัน)?เป็นเท็จ/, "#1565C0"], ["M", "ฟอกเงิน", /ฟอกเงิน/, "#6A1B9A"]];
function pCase() {
  const ev = [...C.events].sort((a, b) => String(a.date).localeCompare(String(b.date))), find = (rx, from) => (ev.find((e) => rx.test(e.title) && (!from || e.date >= from)) || {}).date;
  const d2 = find(/จดทะเบียนมูลนิธิ/) || DB.cut || "2022-06-25", d4 = find(/หมายจับ|จับกุม|แจ้งข้อ/, d2) || "9999", d3 = find(/ชี้แจง|รับเรื่อง|แถลง|ร้องเรียน|ข่าว/, d2) || d4;
  const PH = [["เริ่มรับบริจาค", "ก่อนจดทะเบียนมูลนิธิ — รับเงินผ่านบัญชีส่วนตัว", "#00264D", "coin", "", d2], ["จดทะเบียน / ดำเนินงานมูลนิธิ", "รับบริจาค ก่อสร้าง และเส้นเงินสำคัญ", "#1E6FD9", "home", d2, d3 < d4 ? d3 : d4],
    ["ตรวจสอบ", "ข่าว ชี้แจง และหน่วยงานรับเรื่อง", "#C98A00", "search", d3 < d4 ? d3 : d4, d4], ["ดำเนินคดี", "หมายจับ จับกุม อายัด และแจ้งข้อกล่าวหา", "#B3261E", "scale", d4, "9999"]]
    .map(([t, s, c, ic, a, b]) => ({ t, s, c, ic, ev: ev.filter((e) => (!a || e.date >= a) && e.date < b) })).filter((p) => p.ev.length);
  const SUS = tsSus(), sheet = (t) => { const k = nk(String(t).split("(")[0]).slice(0, 6); return SUS.find((r) => nk(r.name).replace(/^สาว/, "").slice(0, 6) === k || nk(r.name).includes(k)); };
  const heads = (s) => String(s.detail || "").split(" / ").map((x) => x.split(" — ")[0]).join(" | ");   // อ่านเฉพาะหัวข้อหา ไม่อ่านหมายเหตุหลัง " — "
  const P = C.charges.map((s) => ({ s, cs: CHG3.filter(([, , rx]) => rx.test(heads(s))), img: susPic(s.title), sh: sheet(s.title) }));
  const rng = (p) => { const a = p.ev[0].date, b = p.ev[p.ev.length - 1].date; return a === b ? dTh(a) : `${dTh(a)} – ${dTh(b)}`; };
  const wide = isWide();
  $("#main").innerHTML = `<div class="ahd"><h2>${IC("cal")} ลำดับเหตุการณ์ <small>${ev.length} เหตุการณ์ · ${P.length} ผู้ต้องหา</small></h2>${addBtn("events")}</div>
  <div class="tl4">${PH.map((p, i) => `<a class="tl4c" href="#ph${i}" style="--c:${p.c}"><span class="tl4n">${i + 1}</span><span class="aic">${IC(p.ic, 20)}</span><b>${p.t}</b><small>${rng(p)}</small><span class="tl4s">${p.ev.length} เหตุการณ์</span></a>`).join("")}
    <a class="tl4c fin" href="#phSus" style="--c:#6A1B9A"><span class="tl4n">${IC("users", 14)}</span><span class="aic">${IC("scale", 20)}</span><b>ใครถูกดำเนินคดี</b><small>${P.length} ราย</small><span class="tl4s">${CHG3.map(([k, l, , c]) => `<i style="background:${c}" title="${l}"></i>${P.filter((p) => p.cs.some((x) => x[0] === k)).length}`).join(" ")}</span></a></div>
  ${PH.map((p, i) => `<section class="tlp" id="ph${i}" style="--c:${p.c}"><header><span class="tl4n">${i + 1}</span><div><b>${p.t}</b><small>${p.s} · ${rng(p)}</small></div></header>
    <div class="tlv">${p.ev.map((e) => `<div class="tle"><span class="tld">${dTh(e.date)}</span><div class="tlb"><b>${esc(e.title)}</b>${e.detail ? `<p>${esc(e.detail)}</p>` : ""}${acts2("events", e.id)}</div></div>`).join("")}</div></section>`).join("")}
  <section class="tlp fin" id="phSus" style="--c:#6A1B9A"><header><span class="tl4n">${IC("scale", 15)}</span><div><b>ใครถูกดำเนินคดี ข้อหาอะไร</b><small>${CHG3.map(([k, l, , c]) => `<span class="cc3" style="--k:${c}">${l} ${P.filter((p) => p.cs.some((x) => x[0] === k)).length} ราย</span>`).join(" ")}</small></div></header>
    <div class="susg">${P.map((p, i) => `<button class="susc" data-gosus="${i}">${p.img ? `<span class="pf">${thumbEl(p.img)}</span>` : `<span class="pf ph">${IC("user", 28)}</span>`}<div class="susb"><small>ผู้ต้องหาที่ ${i + 1} · ${esc(p.s.extra1 || "")}</small><b>${esc(p.s.title)}</b>
      <span class="cc3s">${p.cs.map(([, l, , c]) => `<span class="cc3" style="--k:${c}">${l}</span>`).join("")}</span><small class="muted">${esc(p.s.status || "")}${p.sh ? ` · นัดแจ้งข้อหา ${esc(p.sh.date)}${p.sh.st ? " (" + esc(p.sh.st) + ")" : ""}` : ""}</small></div></button>`).join("")}</div>
    <p class="muted" style="font-size:.8rem;margin:6px 0 0">ข้อหาและสถานะตามข้อมูลในเว็บ (ตามข่าว / มติ) และแท็บคุมหมายเรียกผู้ต้องหา — รายละเอียดข้อหารายข้อ ดูที่ สรุปทางการ › ผู้ต้องหาและข้อหา</p></section>
  <h2>${IC("book")} ข้อมูลคดีโดยย่อ <small>${C.case.length} หัวข้อ</small> ${addBtn("case")}</h2>
  <div class="accs">${C.case.map((s) => accd(`${sico(icFor(s.title))} ${esc(s.title)}`, "", `<div class="pgd">${esc(s.detail)}</div>${acts2("case", s.id)}`, wide)).join("")}</div>${newsBlock()}`;
  const m = $("#main");
  m.onclick = (e) => { const a = e.target.closest("a.tl4c"); if (a) { e.preventDefault(); const t = $(a.getAttribute("href")); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const s = e.target.closest("[data-gosus]"); if (s) { BRV = "chg"; go("brief"); } };
}
const fSel = (attr, cur, allLab, opts) => `<select class="pill fsel ${cur !== "" && cur != null ? "on" : ""}" ${attr}><option value="">${esc(allLab)}</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const fSearch = (id, val, ph) => `<label class="sbox">${IC("search", 16)}<input type="search" id="${id}" value="${esc(val)}" placeholder="${ph}"></label>`;
const fClr = (attr, on) => (on ? `<button class="ibx" title="ล้างตัวกรอง" aria-label="ล้างตัวกรอง" ${attr}>${IC("fx", 16)}</button>` : "");
function pCharges(el) {
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
  // การ์ดสรุป = ชุดข้อหาของแต่ละคน (ครบทุกข้อหา / ฟอกเงินอย่างเดียว / …) — 1 คนอยู่การ์ดเดียว ผลรวมการ์ด = จำนวนผู้ต้องหา
  const cKey = (p) => CATS.filter((c) => p.cats.has(c[0])).map((c) => c[0]).join("+") || "none";
  const COMBO = []; P.forEach((p) => { const k = cKey(p); let c = COMBO.find((x) => x.k === k); if (!c) COMBO.push((c = { k, n: 0 })); c.n++; });
  COMBO.sort((a, b) => (a.k === "none") - (b.k === "none") || b.k.split("+").length - a.k.split("+").length || b.n - a.n);
  const cNames = (k) => (k === "none" ? [] : k.split("+").map((x) => CATS.find((c) => c[0] === x)[1]));
  const cLab = (k) => { const nm = cNames(k); return !nm.length ? "ข้อหาอื่น" : nm.length === CATS.length ? "ครบทุกข้อหา" : nm.length === 1 ? nm[0] + " อย่างเดียว" : nm.join(" + "); };
  const sel = COMBO.some((c) => c.k === CHF) ? CHF : "";
  const show = P.filter((p) => !sel || cKey(p) === sel);
  const tile = (c) => { const ks = c.k === "none" ? [] : c.k.split("+"), one = ks.length === 1 ? CATS.find((x) => x[0] === ks[0]) : null;
    return `<button class="tile ${sel === c.k ? "on" : ""}" data-cf="${c.k}"><span class="ico" style="background:${one ? one[4] : "var(--navy)"};color:#fff">${IC(one ? one[3] : "scale")}</span><span class="v">${c.n}<small> ราย</small></span><span class="l">${esc(cLab(c.k))}</span>${ks.length > 1 ? `<span class="s">${esc(cNames(c.k).join(" + "))}</span>` : ""}</button>`; };
  const tick = (on, col) => (on ? `<span class="ck" style="background:${col}">${IC("check", 15)}</span>` : `<span class="ck no">–</span>`);
  const stat = (p) => { const st = p.s.status || ""; const sh = p.sh; return `${st ? badge(st) : ""}${sh ? ` <span class="badge y">${IC("cal", 12)} ${esc(sh.issue.replace(/\s+/g, " ").replace(/^แจ้งข้อกล่าวหา\s*/, "นัดแจ้งข้อกล่าวหา "))} ${esc(sh.date)}${sh.time ? " " + esc(sh.time) : ""}${sh.st ? " · " + esc(sh.st) : ""}</span>` : ""}`; };
  const m = el || $("#main");
  m.innerHTML = `<h2>${IC("scale")} ผู้ต้องหาและข้อหา <small>${P.length} ราย</small> ${addBtn("charges")}</h2>
  <div class="tiles"><button class="tile ${!sel ? "on" : ""}" data-cf=""><span class="ico">${IC("users")}</span><span class="v">${P.length}<small> ราย</small></span><span class="l">ผู้ต้องหาทั้งหมด</span></button>${COMBO.map(tile).join("")}</div>
  <h2>${IC("list")} ใครถูกแจ้ง / ถูกเสนอข้อหาใด <small>${show.length} ราย${sel ? " · " + esc(cLab(sel)) : ""}</small></h2>
  <div class="tblwrap"><table class="cmx"><tr><th class="pt">รูป</th><th>ผู้ต้องหา</th><th>บทบาท</th>${CATS.map(([, l]) => `<th class="c">${esc(l)}</th>`).join("")}<th>สถานะ</th></tr>
    ${show.map((p) => `<tr class="click" data-c="${p.i}"><td class="pt">${p.img ? thumbEl(p.img, "tph") : `<span class="tph">${IC("user", 22)}</span>`}</td><td><b>${esc(p.s.title)}</b></td><td>${esc(p.s.extra1)}</td>${CATS.map(([k, , , , col]) => `<td class="c">${tick(p.cats.has(k), col)}</td>`).join("")}<td>${stat(p)}</td></tr>`).join("")}
  </table></div>
`;
  m.onclick = (e) => {
    const b = e.target.closest("[data-cf],[data-c],.back"); if (!b) return;
    if (b.dataset.cf != null) { CHF = b.dataset.cf === sel ? "" : b.dataset.cf; render(); return; }
    if (b.dataset.c != null) {
      const p = P[+b.dataset.c];
      openModal(`<div class="prof">${p.img ? `<span class="pf">${thumbEl(p.img)}</span>` : `<span class="pf ph">${IC("user", 44)}</span>`}<div><h3>${esc(p.s.title)}</h3><div class="muted">${esc(p.s.extra1)}</div><div style="margin-top:6px">${stat(p)}</div></div></div>
        <h3 style="margin-top:14px">${IC("scale", 18)} ข้อหา ${p.parts.length} ข้อ</h3>${p.parts.map((c, k) => `<div class="item" style="margin-top:8px"><span class="num">${k + 1}</span><div><p style="color:var(--ink)">${esc(c)}</p></div></div>`).join("")}
        <div class="modal-foot">${document.body.classList.contains("edit") ? `<button class="btn o" onclick="closeModal();editItem('charges','${p.s.id}')">แก้ไข</button>` : ""}<button class="btn" onclick="closeModal()">ปิด</button></div>`);
    }
  };
}
/* ข้อต่อสู้ รุ่น 19 พ.ย. 69 (ผู้ใช้สั่ง "ให้ดูดี ธีมเดียวกัน ดูง่ายกว่านี้"): การ์ดสถานะ 3 กลุ่ม (กดกรอง) + ค้นหา + เลือกผู้กล่าวอ้าง + การ์ดรายประเด็น ข้ออ้าง → ต้องพิสูจน์ → หลักฐานที่มี */
const DFB = { ok: ["มีหลักฐานแล้ว", "#1B7A4A", "check"], wait: ["รอข้อมูล / เอกสาร", "#C98A00", "clock"], todo: ["ต้องทำต่อ", "#B3261E", "warn"] };
const dfB = (s) => (/มีหลักฐาน|เสร็จ|ครบ|ยืนยัน/.test(s || "") ? "ok" : /ต้องทำ|ยังไม่|ค้าง/.test(s || "") ? "todo" : "wait");
let DFS = { b: "", w: "", q: "" };
function pDef() {
  const D = C.defences, who = [...new Set(D.map((s) => s.extra1).filter(Boolean))], q = DFS.q.trim().toLowerCase();
  const show = D.filter((s) => (!DFS.b || dfB(s.status) === DFS.b) && (!DFS.w || s.extra1 === DFS.w) && (!q || `${s.title} ${s.detail} ${s.extra1} ${s.extra2} ${s.status}`.toLowerCase().includes(q)));
  const n = (b) => D.filter((s) => dfB(s.status) === b).length;
  $("#main").innerHTML = `<div class="ahd"><h2>${IC("shield")} ข้อต่อสู้ที่ต้องพิสูจน์ทราบ <small>${show.length} / ${D.length} ประเด็น</small></h2>${addBtn("defences")}</div>
  <div class="acards df3"><button class="acard tot ${!DFS.b ? "on" : ""}" data-dfb=""><span class="aic">${IC("shield", 24)}</span><span class="acv">${D.length}</span><span class="acl">ประเด็นข้อต่อสู้ทั้งหมด</span><span class="acs">ผู้กล่าวอ้าง ${who.length} กลุ่ม</span>
      <span class="abar dfbar">${Object.keys(DFB).map((b) => `<i style="width:${(n(b) / (D.length || 1) * 100).toFixed(1)}%;background:${DFB[b][1]}"></i>`).join("")}</span></button>
    ${Object.entries(DFB).map(([b, [l, c, ic]]) => `<button class="acard ${DFS.b === b ? "on" : ""}" data-dfb="${b}" style="--c:${c}"><span class="aic">${IC(ic, 24)}</span><span class="acv">${n(b)}</span><span class="acl">${l}</span><span class="acs">${(n(b) / (D.length || 1) * 100).toFixed(0)}% ของประเด็นทั้งหมด</span><span class="abar"><i style="width:${(n(b) / (D.length || 1) * 100).toFixed(1)}%"></i></span></button>`).join("")}</div>
  <div class="card fcard"><div class="fline">${fSearch("dfQ", DFS.q, "ค้นหาข้อต่อสู้ / หลักฐาน")}${fSel('id="dfW"', DFS.w, "ผู้กล่าวอ้างทุกคน", who.map((w) => [w, `${w} · ${D.filter((s) => s.extra1 === w).length}`]))}${fClr('data-dfclr="1"', DFS.b || DFS.w || DFS.q)}</div></div>
  <div class="dfgrid">${show.map((s) => { const b = dfB(s.status), [bl, bc, bi] = DFB[b], no = D.indexOf(s) + 1;
    return `<article class="dfc" style="--c:${bc}"><header><span class="dfn">${no}</span><div class="dft"><small>ข้ออ้าง</small><b>“${esc(s.title)}”</b></div></header>
      <div class="dfm"><span class="dfw">${IC("user", 13)} ${esc(s.extra1 || "-")}</span><span class="dfs">${IC(bi, 13)} ${esc(s.status || bl)}</span></div>
      <div class="dfb"><div class="dfx prove"><div class="dfh">${IC("search", 15)} ต้องพิสูจน์</div><p>${esc(s.detail || "-")}</p></div>
        <div class="dfx evi"><div class="dfh">${IC("doc", 15)} หลักฐานที่มี</div><p>${esc(s.extra2 || "ยังไม่มี")}</p></div></div>${acts2("defences", s.id)}</article>`; }).join("") || `<p class="muted">ไม่พบประเด็นตามตัวกรอง</p>`}</div>`;
  const m = $("#main"); let tm;
  m.onclick = (e) => { const b = e.target.closest("[data-dfb]"); if (b) { DFS.b = DFS.b === b.dataset.dfb ? "" : b.dataset.dfb; return render(); } if (e.target.closest("[data-dfclr]")) { DFS = { b: "", w: "", q: "" }; render(); } };
  m.onchange = (e) => { if (e.target.id === "dfW") { DFS.w = e.target.value; render(); } };
  m.oninput = (e) => { if (e.target.id !== "dfQ") return; clearTimeout(tm); tm = setTimeout(() => { DFS.q = e.target.value; render(); const x = $("#dfQ"); if (x) { x.focus(); x.setSelectionRange(DFS.q.length, DFS.q.length); } }, 300); };
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
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>',
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

/* ---------- ทรัพย์สิน (ตามชีตชุดทำคดี) ---------- */
const OC = ["#FFD403", "#6FB1F2"];
let AV = "";
const secIc = (n) => (/ที่ดิน/.test(n) ? "home" : /รถ/.test(n) ? "car" : "shield");
const secNm = (n) => n.split("(")[0].trim();
const amtS = (v) => (v ? M(v) : "–");
/* หน้าทรัพย์สิน รุ่น 19 พ.ย. 69 (ผู้ใช้สั่ง "ตัวกรองแบบบัตรเครดิต + การ์ดไอคอนประเภท + แผนที่ 3 มิติ สลับกับการ์ดปกติ")
   หมวด ACAT: บ้าน / ที่ดินเปล่า / รถ / กระเป๋า / ผ้าพันคอ / แบรนด์เนมอื่น / เงินในบัญชี / เงินชำระเกินในบัตร / ประกัน / กองทุน-หุ้น-สลาก / อื่น ๆ */
const AST = { seized: ["ยึดแล้ว", "r", "#B3261E"], frozen: ["อายัดแล้ว", "r", "#B3261E"], prop: ["เสนออายัด (ยังไม่อายัด)", "y", "#E0A800"], doing: ["อยู่ระหว่างดำเนินการ", "y", "#E0A800"], none: ["ยังไม่มีข้อมูลยึด/อายัด", "", "#9AA5B4"] };
const ACAT = [["house", "บ้าน / ห้องชุด", "home", "#1E6FD9"], ["land", "ที่ดินเปล่า", "land", "#2E8B57"], ["car", "รถยนต์", "car", "#4A6274"], ["bag", "กระเป๋าแบรนด์เนม", "bag", "#C2185B"],
  ["scarf", "ผ้าพันคอแบรนด์เนม", "scarf", "#7B3FB8"], ["lux", "เครื่องประดับ / แบรนด์เนมอื่น", "gem", "#D4407A"], ["cash", "เงินในบัญชี (อายัด)", "lock", "#0E9384"], ["card", "เงินชำระเกินในบัตรเครดิต", "card", "#E8710A"],
  ["ins", "ประกันชีวิต", "umb", "#5E4FC4"], ["fund", "กองทุน / หุ้น / สลาก", "trend", "#D9A400"], ["oth", "ทรัพย์สินอื่น", "box", "#8D6E63"]];
const ACM = Object.fromEntries(ACAT.map((c) => [c[0], c]));
Object.assign(ICP, {
  land: '<path d="M2 20l6-9 4 5 3-3 7 7z"/><circle cx="17" cy="6" r="2"/>',
  scarf: '<path d="M7 3h10l-1.5 6L19 21h-4l-3-8-3 8H5l3.5-12z"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21L8 9l4-6 4 6z"/>',
  umb: '<path d="M22 12a10 10 0 0 0-20 0z"/><path d="M12 12v7a2 2 0 0 0 4 0"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  cube: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
});
function assetRows() {
  const S = tsSum(), FZ = tsFrz();
  const OWNS = (DB.own || []).map(([rx, lab]) => [new RegExp(rx), lab]);
  const OWN = (o) => { const h = OWNS.find(([rx]) => rx.test(o || "")); return h ? h[1] : o || "-"; };
  const R = [];
  tsLand().forEach((r) => { const h = r.bld && !/ไม่พบ/.test(r.bld);
    R.push({ cat: h ? "house" : "land", own: OWN(r.own), name: `${r.loc}${r.deed ? " (เลขที่ " + r.deed + ")" : ""}`, sub: [r.area, h ? r.bld : "", r.date ? "ได้มา " + r.date : "", /จำนอง/.test(r.mort) ? "ติดจำนอง" : ""].filter(Boolean).join(" · "), val: r.price, st: /ดำเนินการ/.test(r.act) && !/^การดำเนินการ$/.test(r.act) ? "doing" : "none", note: r.act || "", u: 1 }); });
  S.filter((s) => !/ที่ดิน/.test(s.name)).forEach((s) => s.items.forEach((x) => { const car = /รถ/.test(s.name);
    R.push({ cat: car ? "car" : /ประกัน/.test(x[0]) ? "ins" : /กองทุน|หุ้น|สลาก/.test(x[0]) ? "fund" : "oth", own: OWN(s.own[x[2]]), name: x[0], sub: "", val: x[1], st: "none", note: "", u: car ? Math.min(6, +((x[0].match(/(\d+)\s*คัน/) || [])[1] || 1)) : 1 }); }));
  (DB.search?.rows || []).forEach((r) => R.push({ cat: /กระเป๋า/.test(r.item) ? "bag" : /ผ้าพันคอ/.test(r.item) ? "scarf" : "lux", own: "ของกลาง จุดที่ " + r.site, name: `${r.item} ${r.model || ""}`.trim(), sub: r.look || "", val: ((r.used_lo || 0) + (r.used_hi || 0)) / 2 * (r.n || 1), st: "seized", note: `ประเมินมือสอง ${fmt0(r.used_lo)}–${fmt0(r.used_hi)} บาท${r.n > 1 ? " × " + r.n : ""}`, u: Math.min(4, r.n || 1) }));
  FZ.secs.forEach((s) => R.push({ cat: "cash", n: s.rows.length, own: /มูลนิธิ/.test(s.title) ? "บัญชีมูลนิธิ" : (OWNS.find(([rx]) => rx.test(s.title)) || [0, "อื่น ๆ"])[1], name: `${s.title || "บัญชีที่อายัด"} (${s.rows.length} บัญชี)`, sub: "รายบัญชีดูที่หน้า บัญชี / บุคคล", val: s.rows.reduce((t, r) => t + r.amt, 0), st: "frozen", note: "", go: "stm", u: 1 }));
  ((DB.cc && DB.cc.card_info) || []).filter((c) => c.bal < -0.005).forEach((c) => R.push({ cat: "card", own: OWN(DB.cc.holder), name: `บัตรเครดิต KBANK ${c.full}`,
    sub: `บัญชีบัตรใน statement ธนาคาร ${c.acc} · ยอดคงค้างติดลบ (ชำระเกิน) ณ รอบบิล ${dTh(c.bal_date)}`, val: -c.bal, st: "prop",
    note: `เงินชำระเข้าบัตรจากบัญชีรับบริจาค ${fmt(c.pay_t1)} บาท · ยังไม่อยู่ในรายการอายัด — เสนออายัดยอดเงินเกิน + ระงับการคืนเงิน/การใช้บัตร (ขอยอดปัจจุบันจากธนาคารก่อน)`, go: "cc", u: 1 }));
  R.forEach((r, i) => { r.i = i; r.mine = r.own !== "บัญชีมูลนิธิ"; r.lab = ACM[r.cat][1]; });
  return R;
}
/* ช่องกรองรายคอลัมน์ (ใช้ร่วมกันหลายหน้า): คั่นด้วย , = หรือ ; ! = ไม่เอา ; คอลัมน์ยอด: >x / <x / x-y / ตัวเลขเดียว = ตั้งแต่ */
function cfMatch(text, amt, v, isAmt) {
  const terms = String(v || "").split(",").map((s) => s.trim()).filter(Boolean); if (!terms.length) return true;
  const neg = terms.filter((t) => t[0] === "!").map((t) => t.slice(1).toLowerCase()).filter(Boolean), pos = terms.filter((t) => t[0] !== "!");
  if (isAmt) { const a = Math.abs(amt || 0), ok = (t) => { const s = t.replace(/[, ]/g, ""); let m;
      if ((m = s.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/))) return a >= +m[1] && a <= +m[2];
      if ((m = s.match(/^(>=|<=|>|<|=)(\d+(?:\.\d+)?)$/))) return { ">=": a >= +m[2], "<=": a <= +m[2], ">": a > +m[2], "<": a < +m[2], "=": Math.abs(a - +m[2]) < 0.005 }[m[1]];
      return /^\d+(\.\d+)?$/.test(s) ? a >= +s : true; };
    return (!pos.length || pos.some(ok)) && !neg.some((t) => ok(t)); }
  const x = String(text || "").toLowerCase();
  return (!pos.length || pos.some((t) => x.includes(t.toLowerCase()))) && !neg.some((t) => x.includes(t));
}
const ACOLS = [["#", "i", "n"], ["ประเภท", "lab", "t"], ["ทรัพย์สิน", "name", "t"], ["เจ้าของ / ที่พบ", "own", "t"], ["มูลค่า (บาท)", "val", "a"], ["สถานะ", "st", "t"], ["หมายเหตุ", "note", "t"]];
const aCell = (r, k) => (k === "st" ? AST[r.st][0] : k === "name" ? `${r.name} ${r.sub}` : String(r[k] ?? ""));
let ASF = { q: "", cats: new Set(), st: new Set(), own: new Set(), min: "", cf: {}, sort: [], rz: -32, rx: 56 };
let AR = [], ASH = [];
function asShow() {
  const F = ASF, q = F.q.trim().toLowerCase(), cf = Object.entries(F.cf).filter(([, v]) => v && v.trim());
  const S = AR.filter((r) => (!F.cats.size || F.cats.has(r.cat)) && (!F.st.size || F.st.has(r.st)) && (!F.own.size || F.own.has(r.own)) && (!F.min || (r.val || 0) >= +F.min)
    && (!q || `${r.name} ${r.sub} ${r.note} ${r.own} ${r.lab}`.toLowerCase().includes(q)) && cf.every(([c, v]) => cfMatch(aCell(r, ACOLS[c][1]), r.val, v, ACOLS[c][2] === "a")));
  if (F.sort.length) S.sort((a, b) => { for (const [c, d] of F.sort) { const k = ACOLS[c][1], t = ACOLS[c][2], x = t === "t" ? aCell(a, k) : a[k] || 0, y = t === "t" ? aCell(b, k) : b[k] || 0;
    const v = t === "t" ? String(x).localeCompare(String(y), "th") : x - y; if (v) return v * d; } return 0; });
  return S;
}
function pAsset() {
  const m = $("#main"); AR = assetRows();
  const view = PREF.assetView || "card", owners = [...new Set(AR.map((r) => r.own))], cnt = (f) => AR.filter(f).length;
  m.innerHTML = `<div class="ahd"><h2>${IC("coin")} ทรัพย์สินส่วนตัว <small>${tsStamp()}</small> ${syncBtn()}</h2>
    <div class="seg aview"><button data-av2="card" class="${view === "card" ? "on" : ""}">${IC("grid", 15)} การ์ด</button><button data-av2="3d" class="${view === "3d" ? "on" : ""}">${IC("cube", 15)} แผนที่ 3 มิติ</button></div></div>
  <div id="asTop"></div>
  <div class="card fcard" id="asF">
   <div class="fline"><label class="sbox" style="flex:1 1 320px">${IC("search", 16)}<input type="search" id="asQ" value="${esc(ASF.q)}" placeholder="ค้นหาทรัพย์สิน / ที่ตั้ง / ยี่ห้อ / หมายเหตุ"></label></div>
   <div class="fline">${["cat", "st", "own"].map((k) => `<button class="pill" data-asd="${k}"><span></span></button>`).join("")}
    <input type="number" id="asMin" class="pin" min="0" step="10000" value="${esc(ASF.min)}" placeholder="มูลค่าขั้นต่ำ (บาท)">
    <button class="ibx" id="asClr" hidden title="ล้างตัวกรอง" aria-label="ล้างตัวกรอง">${IC("fx", 16)}</button><span id="asSum" class="muted fsum"></span></div>
   <div class="ddp" data-asp="cat" hidden><div class="frow">${ACAT.filter((c) => AR.some((r) => r.cat === c[0])).map(([k, l, ic, col]) => `<button class="chip" data-asc="${k}"><span class="dot" style="background:${col}"></span>${IC(ic, 14)} ${l} <small class="muted">${cnt((r) => r.cat === k)}</small></button>`).join("")}</div></div>
   <div class="ddp" data-asp="st" hidden><div class="frow">${Object.entries(AST).filter(([k]) => AR.some((r) => r.st === k)).map(([k, v]) => `<button class="chip" data-ass="${k}"><span class="dot" style="background:${v[2]}"></span>${v[0]} <small class="muted">${cnt((r) => r.st === k)}</small></button>`).join("")}</div></div>
   <div class="ddp" data-asp="own" hidden><div class="frow">${owners.map((o) => `<button class="chip" data-aso="${esc(o)}">${esc(o)} <small class="muted">${cnt((r) => r.own === o)}</small></button>`).join("")}</div></div>
  </div>
  <h2>${IC("list")} รายการทรัพย์สิน <small id="asCnt"></small> ${infoI('สถานะ: "ยึดแล้ว" = ของกลางจากการตรวจค้น 11 พ.ย. 69 (มูลค่า = ค่ากลางราคาประเมินมือสอง) · "อายัดแล้ว" = เงินในบัญชีตามแท็บข้อมูลอายัด · "อยู่ระหว่างดำเนินการ" = คอลัมน์การดำเนินการของแท็บทรัพย์สินที่ดิน · ที่เหลือชีตยังไม่ระบุการยึด/อายัด ; เงินในบัญชีมูลนิธิแสดงในรายการแต่ไม่นับเป็นทรัพย์สินส่วนตัว ; ข้อมูลจากชีตชุดทำคดี (อ่านอย่างเดียว)')}</h2>
  <div class="frow" style="margin:-4px 0 8px"><button class="ibx" id="asXl" title="ส่งออก Excel (ตามตัวกรอง)" aria-label="ส่งออก Excel">${IC("xls", 16)}</button><button class="ibx" id="asSr" title="กลับลำดับเดิม" aria-label="กลับลำดับเดิม">${IC("reset", 16)}</button><button class="ibx" id="asCfx" title="ล้างช่องกรองคอลัมน์" aria-label="ล้างช่องกรองคอลัมน์">${IC("fx", 16)}</button></div>
  <div class="tblwrap tall" data-noxbar="1"><table id="asT" class="xt"><thead><tr>${ACOLS.map(([l, , t], c) => `<th data-cs="${c}" class="srt${t !== "t" ? " n" : ""}">${l} <span class="si"></span></th>`).join("")}</tr>
    <tr class="cfr">${ACOLS.map(([, , t], c) => (c === 0 ? "<th></th>" : `<th><input data-acf="${c}" value="${esc(ASF.cf[c] || "")}" placeholder="${t === "a" ? "≥ / ช่วง" : "กรอง…"}"></th>`)).join("")}</tr></thead><tbody></tbody></table></div>
  ${DB.cc ? `<p style="margin-top:10px"><button class="chip" data-gocc="1">${IC("card", 14)} ดูการใช้บัตรเครดิต (เมนูบัตรเครดิต) ${M(DB.cc.total)}</button></p>` : ""}`;
  if (view === "3d") a3dBuild();
  cfrEnhance(m); asSync(); asUpd();
  let tm;
  m.onclick = asClick;
  m.oninput = (e) => { const t = e.target; if (t.id === "asQ" || t.id === "asMin" || t.dataset.acf != null) { clearTimeout(tm); tm = setTimeout(() => {
    if (t.id === "asQ") ASF.q = t.value; else if (t.id === "asMin") ASF.min = t.value; else ASF.cf[t.dataset.acf] = t.value; asSync(); asUpd(); }, 250); } };
}
function asSync() {
  const m = $("#main"), F = ASF, setP = (k, txt, on) => { const b = $(`[data-asd="${k}"]`, m); if (!b) return; b.querySelector("span").textContent = txt; b.classList.toggle("on", on); };
  setP("cat", F.cats.size ? (F.cats.size === 1 ? ACM[[...F.cats][0]][1] : `${F.cats.size} ประเภท`) : "ทุกประเภททรัพย์สิน", F.cats.size > 0);
  setP("st", F.st.size ? [...F.st].map((k) => AST[k][0]).join(" + ") : "ทุกสถานะ", F.st.size > 0);
  setP("own", F.own.size ? (F.own.size === 1 ? [...F.own][0] : `${F.own.size} เจ้าของ`) : "ทุกเจ้าของ / ที่พบ", F.own.size > 0);
  $$("[data-asc]", m).forEach((b) => b.classList.toggle("on", F.cats.has(b.dataset.asc)));
  $$("[data-ass]", m).forEach((b) => b.classList.toggle("on", F.st.has(b.dataset.ass)));
  $$("[data-aso]", m).forEach((b) => b.classList.toggle("on", F.own.has(b.dataset.aso)));
  const any = F.q || F.cats.size || F.st.size || F.own.size || F.min || Object.values(F.cf).some((v) => v && v.trim());
  const c = $("#asClr"); if (c) c.hidden = !any;
  $$("#asT [data-cs]").forEach((th) => { const i = F.sort.findIndex((x) => x[0] === +th.dataset.cs); th.querySelector(".si").textContent = i < 0 ? "" : (F.sort[i][1] > 0 ? "▲" : "▼") + (F.sort.length > 1 ? i + 1 : ""); });
}
function asUpd() {
  const S = ASH = asShow(), tot = S.reduce((t, r) => t + (r.val || 0), 0), mineTot = S.filter((r) => r.mine).reduce((t, r) => t + (r.val || 0), 0);
  $("#asSum").textContent = `${fmt0(S.length)} / ${fmt0(AR.length)} รายการ · ${M(tot)}`;
  $("#asCnt").textContent = `${fmt0(S.length)} รายการ · ทรัพย์สินส่วนตัว ${M(mineTot)}${tot !== mineTot ? ` · รวมบัญชีมูลนิธิ ${M(tot)}` : ""}`;
  $("#asT tbody").innerHTML = S.map((r, i) => `<tr${r.go ? ` class="click" data-go="${r.go}"` : ""}><td>${i + 1}</td><td><span class="acat" style="--c:${ACM[r.cat][3]}">${IC(ACM[r.cat][2], 14)}</span> ${esc(r.lab)}</td><td><b>${esc(r.name)}</b>${r.sub ? `<br><small class="muted">${esc(r.sub)}</small>` : ""}</td><td>${esc(r.own)}</td><td class="n">${r.val ? fmt0(r.val) : "–"}</td><td><span class="badge ${AST[r.st][1]}">${AST[r.st][0]}</span></td><td><small>${esc(r.note)}</small></td></tr>`).join("") || `<tr><td colspan="7" class="muted" style="text-align:center">ไม่พบรายการตามตัวกรอง</td></tr>`;
  if ((PREF.assetView || "card") === "3d") a3dDim(); else asCards();
}
function asCards() {                                                    // การ์ดไอคอนตามประเภท (กดเพื่อกรอง ; ยอดตามตัวกรองอื่นที่ไม่ใช่ประเภท)
  const F = ASF, base = AR.filter((r) => r.mine), all = base.reduce((t, r) => t + (r.val || 0), 0) || 1;
  const fnd = AR.filter((r) => !r.mine).reduce((t, r) => t + (r.val || 0), 0);
  const cards = ACAT.filter((c) => base.some((r) => r.cat === c[0])).map(([k, l, ic, col]) => { const rs = base.filter((r) => r.cat === k), v = rs.reduce((t, r) => t + (r.val || 0), 0);
    const sts = Object.entries(AST).filter(([s]) => s !== "none").map(([s, d]) => { const n = rs.filter((r) => r.st === s).length; return n ? `<span class="ast" style="--c:${d[2]}">${d[0].split(" (")[0]} ${n}</span>` : ""; }).join("");
    const units = k === "cash" ? rs.reduce((t, r) => t + (r.n || 1), 0) + " บัญชี" : k === "car" ? rs.reduce((t, r) => t + ((r.name.match(/(\d+)\s*คัน/) || [])[1] * 1 || 1), 0) + " คัน" : rs.length + " รายการ";
    return `<button class="acard ${F.cats.has(k) ? "on" : ""}" data-asc="${k}" style="--c:${col}"><span class="aic">${IC(ic, 26)}</span><span class="acv">${M(v)}</span><span class="acl">${l}</span><span class="acs">${units} · ${(v / all * 100).toFixed(1)}%</span>
      <span class="abar"><i style="width:${Math.max(2, v / all * 100).toFixed(1)}%"></i></span>${sts ? `<span class="asts">${sts}</span>` : ""}</button>`; }).join("");
  $("#asTop").innerHTML = `<div class="acards"><button class="acard tot ${!F.cats.size ? "on" : ""}" data-asc="*"><span class="aic">${IC("coin", 26)}</span><span class="acv">${M(all)}</span><span class="acl">มูลค่าทรัพย์สินส่วนตัวทั้งหมด</span><span class="acs">${fmt0(base.length)} รายการ${fnd ? ` · ไม่รวมเงินบัญชีมูลนิธิ ${M(fnd)}` : ""}</span>
    <span class="abar"><i style="width:100%"></i></span></button>${cards}</div>`;
}
/* ---------- แผนที่ 3 มิติ (CSS 3D ไม่ใช้ไลบรารีภายนอก) : 1 โซน = 1 ประเภท ; 1 แท่ง = 1 รายการ ความสูงตามมูลค่า (สเกล log) ; ลากเพื่อหมุน ---------- */
function a3dBuild() {
  const narrow = ($("#main").clientWidth || 1000) < 700, cats = ACAT.filter((c) => AR.some((r) => r.cat === c[0])), COLS = narrow ? 2 : 4, PW = 300, PH = 230, GAP = 26;
  if (narrow && !ASF._mob) { ASF._mob = 1; ASF.rz = -18; ASF.rx = 50; }
  const rows = Math.ceil(cats.length / COLS), W = COLS * PW + (COLS + 1) * GAP, H = rows * PH + (rows + 1) * GAP;
  const vmax = Math.max(...AR.map((r) => r.val || 0), 1), LG = Math.log10(1 + vmax);
  /* รูปจำลองตามประเภท (ผู้ใช้สั่ง 19 พ.ย. 69 "จำลองรูปประเภทของนั้น ๆ ไม่ใช่กล่องสี่เหลี่ยม"): บ้าน = ตัวบ้าน + หลังคาจั่ว / รถ = ตัวรถ + ห้องโดยสาร + ล้อ /
     เงินในบัญชี = ปึกธนบัตรซ้อนชั้น / บัตรเครดิต = บัตรแบน / ที่ดิน = แปลงหญ้า + ต้นไม้ / อื่น ๆ = ภาพตั้งหันหาผู้ดู (กระเป๋า ผ้าพันคอ เพชร ประกัน กองทุน ลัง) ; ขนาดตามมูลค่า (สเกล log) */
  const f1 = (v) => 0.3 + 0.7 * Math.log10(1 + (v || 0)) / LG, X1 = (v) => v.toFixed(1);
  const cub = (x, y, z, w, d, h, col, cls) => `<div class="b3 ${cls || ""}" style="left:${X1(x)}px;top:${X1(y)}px;--w:${X1(w)}px;--d:${X1(d)}px;--h:${X1(h)}px;--c:${col};transform:translateZ(${X1(z)}px)"><i class="t"></i><i class="f"></i><i class="k"></i><i class="r"></i><i class="l"></i></div>`;
  const SVG = {
    bag: (c) => `<path d="M16 42h68l8 50H8z" fill="${c}"/><path d="M16 42h68l2 12H14z" fill="#0002"/><path d="M33 42V31a17 17 0 0 1 34 0v11" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><rect x="43" y="55" width="14" height="10" rx="2" fill="#FFD403"/>`,
    scarf: (c) => `<rect x="16" y="14" width="68" height="24" rx="10" fill="${c}"/><path d="M34 32l-12 56h18l8-50zM66 32l12 56H60l-8-50z" fill="${c}"/><path d="M22 88h18M60 88h18" stroke="#fff" stroke-width="3" stroke-dasharray="2 3"/><path d="M16 22h68M16 30h68" stroke="#fff" stroke-opacity=".45" stroke-width="3"/><circle cx="50" cy="36" r="10" fill="${c}" stroke="#0003" stroke-width="3"/>`,
    gem: (c) => `<path d="M18 36l15-20h34l15 20-32 54z" fill="${c}"/><path d="M18 36h64M33 16l17 74M67 16L50 90M33 16l17 20 17-20" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.5"/>`,
    umb: (c) => `<path d="M50 8l36 13v25c0 24-16 38-36 46C30 84 14 70 14 46V21z" fill="${c}"/><path d="M50 70S30 58 30 44a10 10 0 0 1 20-5 10 10 0 0 1 20 5c0 14-20 26-20 26z" fill="#fff"/>`,
    trend: (c) => `<rect x="12" y="58" width="20" height="34" rx="2" fill="${c}"/><rect x="40" y="42" width="20" height="50" rx="2" fill="${c}"/><rect x="68" y="24" width="20" height="68" rx="2" fill="${c}"/><path d="M10 46l28-20 18 10 32-26" fill="none" stroke="#1B7A4A" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="84" cy="14" r="7" fill="#FFD403" stroke="#B8860B" stroke-width="2"/>`,
    box: (c) => `<path d="M50 12l38 17v42L50 90 12 71V29z" fill="${c}"/><path d="M12 29l38 17 38-17" fill="none" stroke="#0003" stroke-width="3"/><path d="M50 46v44" stroke="#0004" stroke-width="3"/><path d="M50 46L12 29v42l38 19z" fill="#0002"/>`,
    tree: () => `<path d="M50 6l24 34H60l20 28H20l20-28H26z" fill="#2E8B57"/><path d="M50 6l24 34H60l20 28H50z" fill="#1F6B42"/><rect x="45" y="68" width="10" height="24" fill="#7B5B3A"/>`,
  };
  const spr = (x, y, sz, inner) => `<div class="sp3" style="left:${X1(x)}px;top:${X1(y)}px"><div class="spi" style="width:${X1(sz)}px;height:${X1(sz)}px"><svg viewBox="0 0 100 100" width="100%" height="100%">${inner}</svg></div></div>`;
  function model(k, r, col, s, u) {
    const f = f1((r.val || 0) / u);
    if (k === "house") { const w = s * 0.62, d = s * 0.5, h = 14 + 52 * f, rh = d * 0.55, L = Math.hypot(d / 2, rh), a = Math.atan2(rh, d / 2) * 180 / Math.PI;
      return [w, d, cub(0, 0, 0, w, d, h, "#F2EEE6", "win") + `<i class="rf" style="width:${X1(w)}px;height:${X1(L)}px;--rc:${col};transform:translateZ(${X1(h)}px) rotateX(${X1(a)}deg)"></i><i class="rf rf2" style="top:${X1(d)}px;width:${X1(w)}px;height:${X1(L)}px;--rc:${col};transform:translateZ(${X1(h)}px) rotateX(${X1(180 - a)}deg)"></i>`
        + `<i class="gb" style="left:0;width:${X1(rh)}px;height:${X1(d)}px;transform:translateZ(${X1(h)}px) rotateY(-90deg)"></i><i class="gb" style="left:${X1(w)}px;width:${X1(rh)}px;height:${X1(d)}px;transform:translateZ(${X1(h)}px) rotateY(-90deg)"></i>`]; }
    if (k === "car") { const q = 0.75 + 0.25 * f, L = s * 0.86 * q, D = s * 0.42 * q, h1 = 7 + 5 * q, h2 = 6 + 4 * q, wl = L * 0.17;
      return [L, D, [[L * 0.1, -1.5], [L * 0.7, -1.5], [L * 0.1, D - 1.5], [L * 0.7, D - 1.5]].map(([x, y]) => cub(x, y, 0, wl, 3, h1 * 0.7, "#1F2933")).join("")
        + cub(0, 0, h1 * 0.25, L, D, h1, col) + cub(L * 0.24, D * 0.07, h1 * 1.25, L * 0.48, D * 0.86, h2, col, "cab")]; }
    if (k === "cash") { const w = s * 0.62, d = s * 0.4, n = Math.max(2, Math.round(2 + 9 * f)); let o = "";
      for (let i = 0; i < n; i++) o += cub(0, 0, i * 5, w, d, 4.6, i % 2 ? "#2E9E6B" : "#3FB57F", i === n - 1 ? "bill" : "");
      return [w, d, o]; }
    if (k === "card") { const w = s * 0.7, d = s * 0.44; return [w, d, cub(0, 0, 0, w, d, 3, col, "ccd")]; }
    if (k === "land") { const w = s * 0.88, d = s * 0.88; return [w, d, cub(0, 0, 0, w, d, 2 + 4 * f, "#7CB342", "plot") + spr(w / 2, d / 2, s * (0.35 + 0.45 * f), SVG.tree())]; }
    const ic = { bag: "bag", scarf: "scarf", lux: "gem", ins: "umb", fund: "trend", oth: "box" }[k] || "box", sz = s * (0.45 + 0.5 * f);
    return [sz * 0.6, sz * 0.3, spr(sz * 0.3, sz * 0.15, sz, SVG[ic](col))];
  }
  let html = "", labels = "";
  cats.forEach(([k, l, ic, col], ci) => {
    const cx = GAP + (ci % COLS) * (PW + GAP), cy = GAP + Math.floor(ci / COLS) * (PH + GAP), rs = AR.filter((r) => r.cat === k);
    const units = rs.flatMap((r) => Array.from({ length: r.u || 1 }, (_, j) => [r, j, r.u || 1]));
    const n = units.length, cols = Math.max(1, Math.ceil(Math.sqrt(n * PW / PH))), rws = Math.ceil(n / cols), cw = (PW - 30) / cols, chh = (PH - 30) / rws;
    const tot = rs.filter((r) => r.mine).reduce((t, r) => t + (r.val || 0), 0);
    html += `<div class="p3" data-asc="${k}" style="left:${cx}px;top:${cy}px;width:${PW}px;height:${PH}px;--c:${col}"><span class="p3l">${IC(ic, 18)} ${l}</span></div>`;
    units.forEach(([r, j, u], ui) => {
      const gx = ui % cols, gy = Math.floor(ui / cols), s = Math.min(cw, chh), [w, d, body] = model(k, r, r.mine ? col : "#9FB3C8", s, u);
      const x = cx + 15 + gx * cw + (cw - w) / 2, y = cy + 15 + gy * chh + (chh - d) / 2;
      html += `<div class="it3 st-${r.st}" data-ai="${r.i}" style="left:${X1(x)}px;top:${X1(y)}px" title="${esc(`${r.lab} · ${r.name} · ${r.val ? fmt0(r.val) + " บาท" : "ไม่ระบุมูลค่า"} · ${AST[r.st][0]}`)}"><i class="sh3" style="left:${X1(-w * 0.12)}px;top:${X1(-d * 0.12)}px;width:${X1(w * 1.24)}px;height:${X1(d * 1.24)}px"></i>${body}</div>`;
    });
    labels += `<div class="l3" data-asc="${k}" style="left:${cx + PW / 2}px;top:${cy + 14}px;--c:${col}"><div class="l3i"><b>${IC(ic, 16)} ${l}</b><span>${M(tot)} · ${rs.length} รายการ</span></div></div>`;
  });
  $("#asTop").innerHTML = `<div class="a3d" id="a3d"><div class="a3d-tools"><button class="ib" data-a3="l" title="หมุนซ้าย">⟲</button><button class="ib" data-a3="r" title="หมุนขวา">⟳</button><button class="ib" data-a3="u" title="มุมสูงขึ้น">▲</button><button class="ib" data-a3="d" title="มุมต่ำลง">▼</button><button class="ib" data-a3="0" title="มุมเริ่มต้น">⌂</button></div>
    <div class="a3d-stage"><div class="a3d-world" id="a3w" style="width:${W}px;height:${H}px;margin-left:${-W / 2}px;margin-top:${-H / 2}px"><div class="g3" style="width:${W}px;height:${H}px"></div>${html}${labels}</div></div>
    <div class="a3d-leg">${Object.entries(AST).filter(([s]) => s !== "none" && AR.some((r) => r.st === s)).map(([s, d]) => `<span><i style="background:${d[2]}"></i>${d[0]}</span>`).join("")}<span><i style="background:#9FB3C8"></i>บัญชีมูลนิธิ (ไม่นับเป็นทรัพย์ส่วนตัว)</span>${infoI("ขนาดรูป = มูลค่า (สเกล log) · ลาก/ปัดเพื่อหมุน · กดโซนเพื่อกรอง · กดรูปเพื่อดูรายละเอียด")}</div>
    <div class="a3d-pop" id="a3p" hidden></div></div>`;
  const box = $("#a3d"), stage = box.querySelector(".a3d-stage"), world = $("#a3w");
  world._wh = [W, H];
  const fit = () => a3dApply();
  a3dApply(); window.removeEventListener("resize", window._a3fit || (() => { })); window._a3fit = fit; addEventListener("resize", fit);
  let drag = null;
  stage.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, rz: ASF.rz, rx: ASF.rx, moved: false }; };
  stage.onpointermove = (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; stage.setPointerCapture && stage.setPointerCapture(e.pointerId); }
    if (!drag.moved) return; ASF.rz = drag.rz + dx * 0.3; if (e.pointerType === "mouse") ASF.rx = Math.max(25, Math.min(75, drag.rx - dy * 0.2)); a3dApply(); };
  stage.onpointerup = stage.onpointercancel = () => { if (drag && drag.moved) box._noclick = Date.now(); drag = null; };
}
function a3dApply() {                                                  // มุมหมุน + ย่อให้พอดีกรอบตามภาพฉายของพื้นที่หมุนแล้ว
  const w = $("#a3w"); if (!w) return; w.style.setProperty("--rz", ASF.rz.toFixed(1) + "deg"); w.style.setProperty("--rx", ASF.rx.toFixed(1) + "deg");
  const st = w.parentNode, [W, H] = w._wh || [1000, 600], z = ASF.rz * Math.PI / 180, x = ASF.rx * Math.PI / 180;
  const pw = Math.abs(W * Math.cos(z)) + Math.abs(H * Math.sin(z)), ph = (Math.abs(W * Math.sin(z)) + Math.abs(H * Math.cos(z))) * Math.cos(x) + 200;
  const sc = Math.min(1.05, (st.clientWidth - 24) / pw); w.style.setProperty("--sc", sc.toFixed(3));
  if (!st._h || Math.abs(st._h - ph * sc) > 40) { st._h = ph * sc; st.style.height = Math.max(320, ph * sc + 70) + "px"; }
}
function a3dDim() {
  const ids = new Set(ASH.map((r) => r.i)), any = ASH.length !== AR.length;
  $$("#a3w .it3").forEach((b) => b.classList.toggle("dim", any && !ids.has(+b.dataset.ai)));
  $$("#a3w .p3, #a3w .l3").forEach((p) => p.classList.toggle("on", ASF.cats.has(p.dataset.asc)));
}
function a3dPop(r) {
  const p = $("#a3p"); if (!p) return;
  p.innerHTML = `<button class="ib" data-a3="x" style="float:right">✕</button><div class="lab" style="margin:0;color:${ACM[r.cat][3]}">${IC(ACM[r.cat][2], 15)} ${esc(r.lab)}</div><b>${esc(r.name)}</b>${r.sub ? `<div class="muted" style="font-size:.84rem">${esc(r.sub)}</div>` : ""}
    <div style="margin-top:6px"><span class="badge ${AST[r.st][1]}">${AST[r.st][0]}</span> <b>${r.val ? fmt(r.val) + " บาท" : "ไม่ระบุมูลค่า"}</b></div><div class="muted" style="font-size:.82rem">${esc(r.own)}${r.note ? " · " + esc(r.note) : ""}</div>${r.go ? `<button class="chip" data-go2="${r.go}" style="margin-top:6px">ดูรายละเอียด →</button>` : ""}`;
  p.hidden = false;
}
function asClick(e) {
  const m = $("#main"), F = ASF, b = e.target.closest("button"), upd = () => { asSync(); asUpd(); };
  const box = $("#a3d"); if (box && box._noclick && Date.now() - box._noclick < 300) return;
  const av = e.target.closest("[data-av2]"); if (av) { PREF.assetView = av.dataset.av2; savePref(); return render(); }
  if (b && b.dataset.gocc) return go("cc");
  if (b && b.dataset.go2) return go(b.dataset.go2);
  if (b && b.dataset.a3) { const k = b.dataset.a3; if (k === "x") { $("#a3p").hidden = true; return; } if (k === "l") ASF.rz -= 30; else if (k === "r") ASF.rz += 30; else if (k === "u") ASF.rx = Math.min(75, ASF.rx + 8); else if (k === "d") ASF.rx = Math.max(25, ASF.rx - 8); else { ASF.rz = -32; ASF.rx = 56; } return a3dApply(); }
  const bl = e.target.closest(".it3"); if (bl) { const r = AR[+bl.dataset.ai]; a3dPop(r); return; }
  const th = e.target.closest("#asT th[data-cs]");
  if (th) { const c = +th.dataset.cs, i = F.sort.findIndex((x) => x[0] === c), d0 = ACOLS[c][2] === "t" ? 1 : -1;
    if (!e.shiftKey) F.sort = i < 0 ? [[c, d0]] : [[c, -F.sort[i][1]]]; else if (i < 0) F.sort.push([c, d0]); else if (F.sort[i][1] === d0) F.sort[i][1] *= -1; else F.sort.splice(i, 1);
    return upd(); }
  const tr = e.target.closest("tr[data-go]"); if (tr && !b) return go(tr.dataset.go);
  const z = e.target.closest("[data-asc]");
  if (z) { const k = z.dataset.asc; if (k === "*") F.cats.clear(); else if (z.classList.contains("acard") || z.classList.contains("p3") || z.classList.contains("l3")) { if (F.cats.size === 1 && F.cats.has(k)) F.cats.clear(); else { F.cats.clear(); F.cats.add(k); } } else (F.cats.has(k) ? F.cats.delete(k) : F.cats.add(k)); return upd(); }
  if (!b) { if (!e.target.closest("#asF")) { $$("[data-asp]", m).forEach((p) => (p.hidden = true)); $$("[data-asd]", m).forEach((x) => x.classList.remove("open")); } return; }
  if (tsClick(b)) return;
  if (b.dataset.asd) { const p = $(`[data-asp="${b.dataset.asd}"]`, m), was = p.hidden; $$("[data-asp]", m).forEach((x) => (x.hidden = true)); $$("[data-asd]", m).forEach((x) => x.classList.remove("open")); p.hidden = !was; b.classList.toggle("open", was); return; }
  const tog = (S, v) => (S.has(v) ? S.delete(v) : S.add(v));
  if (b.dataset.ass) { tog(F.st, b.dataset.ass); return upd(); }
  if (b.dataset.aso) { tog(F.own, b.dataset.aso); return upd(); }
  if (b.id === "asClr") { Object.assign(F, { q: "", cats: new Set(), st: new Set(), own: new Set(), min: "", cf: {} }); $("#asQ").value = ""; $("#asMin").value = ""; $$("[data-acf]", m).forEach((x) => (x.value = "")); return upd(); }
  if (b.id === "asCfx") { F.cf = {}; $$("[data-acf]", m).forEach((x) => (x.value = "")); return upd(); }
  if (b.id === "asSr") { F.sort = []; return upd(); }
  if (b.id === "asXl") { const rows = [["#", "ประเภท", "ทรัพย์สิน", "รายละเอียด", "เจ้าของ / ที่พบ", "มูลค่า (บาท)", "สถานะ", "หมายเหตุ"]].concat(ASH.map((r, i) => [i + 1, r.lab, r.name, r.sub, r.own, r.val || 0, AST[r.st][0], r.note]));
    return download2("รายการทรัพย์สิน (ตามตัวกรอง).xlsx", xlsxBlob("ทรัพย์สิน", rows, [5, 24, 48, 36, 22, 16, 22, 40])); }
}
let CCS = "";                                                           // บัญชีต้นทางที่เลือกดูชาร์ตการชำระค่าบัตร ("" = ทุกบัญชี)
/* เมนูบัตรเครดิต (แยกจากหน้าทรัพย์สิน ; ผู้สั่งงาน 18 พ.ย. 69)
   รุ่น 19 พ.ย. 69 (ผู้ใช้สั่ง "ออกแบบให้คล้ายวิเคราะห์เส้นเงิน"): 3 หน้าย่อย — รายการใช้จ่าย (ตัวกรอง บัตร/ประเภท/ลักษณะ/ช่วงเวลา/ประเทศ + ค้นหาร้านค้า
   + ชาร์ตตามตัวกรอง กดแท่งเพื่อกรอง + ตารางเรียงหลายคอลัมน์ + ช่องกรองรายคอลัมน์อิสระ) / การชำระค่าบัตร / สรุปภาพรวม */
let CCV = "tx";
const CCV_T = [["tx", "รายการใช้จ่าย", "list"], ["pay", "การชำระค่าบัตร", "bank"], ["sum", "สรุปภาพรวม", "chart"]];   // สรุปภาพรวมตัดส่วนที่ซ้ำกับหน้ารายการใช้จ่ายออก (ผู้ใช้สั่ง 19 พ.ย. 69)
const CCF0 = () => ({ q: "", cards: new Set(), types: new Set(), nats: new Set(["per", "chr"]), ctry: new Set(), from: "", to: "", min: "", cf: {}, sort: [[0, -1]], lim: 300 });
let CCF = CCF0();
const NATL = { per: "ใช้ส่วนตัว", chr: "บริจาค / ทำบุญ", fin: "ชำระค่าบัตร / คืนเงิน" };
const CARDC = { "4615": "#1565C0", "4260": "#6A1B9A", "6834": "#00897B", "7787": "#F9A825" };
const CCOLS = [["วันที่", 0, "d"], ["บัตร", 1, "t"], ["ร้านค้า / รายการ", 2, "t"], ["เมือง / รายละเอียด", 3, "t"], ["ประเภท", 4, "t"], ["ลักษณะ", 5, "t"], ["ประเทศ", 6, "t"], ["ยอด (บาท)", 7, "a"]];
const ccCell = (r, c) => (c === 0 ? `${r[0]} ${dTh(r[0])} ${+r[0].slice(0, 4) + 543}` : c === 1 ? "x" + r[1] : c === 5 ? NATL[r[5]] || r[5] : String(r[c] ?? ""));
function ccColOk(r, c, v) {                                             // ช่องกรองรายคอลัมน์: คั่นด้วย , = หรือ ; ขึ้นต้น ! = ไม่เอา ; คอลัมน์ยอด: >1000 / <500 / 1000-5000 / ตัวเลขเดียว = ตั้งแต่
  const terms = v.split(",").map((s) => s.trim()).filter(Boolean); if (!terms.length) return true;
  const neg = terms.filter((t) => t[0] === "!").map((t) => t.slice(1).toLowerCase()).filter(Boolean), pos = terms.filter((t) => t[0] !== "!");
  if (CCOLS[c][2] === "a") {
    const a = Math.abs(r[7]), ok = (t) => { const s = t.replace(/[, ]/g, ""); let m;
      if ((m = s.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/))) return a >= +m[1] && a <= +m[2];
      if ((m = s.match(/^(>=|<=|>|<|=)(\d+(?:\.\d+)?)$/))) return { ">=": a >= +m[2], "<=": a <= +m[2], ">": a > +m[2], "<": a < +m[2], "=": Math.abs(a - +m[2]) < 0.005 }[m[1]];
      return /^\d+(\.\d+)?$/.test(s) ? a >= +s : true; };
    return (!pos.length || pos.some(ok)) && !neg.some((t) => ok(t));
  }
  const x = ccCell(r, c).toLowerCase();
  return (!pos.length || pos.some((t) => x.includes(t.toLowerCase()))) && !neg.some((t) => x.includes(t));
}
function ccRows() {
  const F = CCF, q = F.q.trim().toLowerCase(), cf = Object.entries(F.cf).filter(([, v]) => v && v.trim());
  const R = DB.cc.tx.filter((r) => (!F.cards.size || F.cards.has(r[1])) && (!F.types.size || F.types.has(r[4])) && (!F.nats.size || F.nats.has(r[5])) && (!F.ctry.size || F.ctry.has(r[6]))
    && (!F.from || r[0] >= F.from) && (!F.to || r[0] <= F.to) && (!F.min || Math.abs(r[7]) >= +F.min)
    && (!q || `${r[2]} ${r[3]} ${r[4]} ${r[6]}`.toLowerCase().includes(q)) && cf.every(([c, v]) => ccColOk(r, +c, v)));
  if (F.sort.length) R.sort((a, b) => { for (const [c, d] of F.sort) { const k = CCOLS[c][2], x = a[c], y = b[c];
    const v = k === "a" ? x - y : String(x).localeCompare(String(y), "th"); if (v) return v * d; } return 0; });
  return R;
}
function pCc() {
  const m = $("#main");
  if (!DB.cc) { m.innerHTML = '<p class="muted">ยังไม่มีข้อมูลบัตรเครดิต</p>'; return; }
  const B = ccBlock(DB.cc);
  const nav = `<div class="frow subnav only-m" style="margin-bottom:10px">${CCV_T.map(([k, l, ic]) => `<button class="chip ${CCV === k ? "on" : ""}" data-ccv="${k}">${IC(ic, 15)} ${l}</button>`).join("")}</div>`;
  if (CCV === "sum") { m.innerHTML = nav + B.HEAD + B.SUM; ccCharts(DB.cc); }
  else if (CCV === "pay") { m.innerHTML = nav + B.HEAD + B.PAY; ccPayView(DB.cc); }
  else { m.innerHTML = nav + B.HEAD + ccTxShell(); cfrEnhance(m); ccSync(); ccUpd(); }
  let tm;
  m.onclick = (e) => {
    const v = e.target.closest("[data-ccv]"); if (v) { CCV = v.dataset.ccv; render(); shellSync(); return window.scrollTo(0, 0); }
    if (CCV === "tx") return ccTxClick(e);
    const tr = e.target.closest("tr[data-ccs]"), b = e.target.closest("[data-ccg]");
    if (b) { const ai = DB.accounts.findIndex((a) => dg(a.acc) === dg(b.dataset.ccg)); if (ai < 0) return; resetF(); F.accs.add(ai); F.q = "441770"; F.flm = "d"; return go("ana"); }
    if (!tr || e.target.closest("button")) return;
    CCS = CCS === tr.dataset.ccs ? "" : tr.dataset.ccs; ccPayView(DB.cc); $("#ccPay").scrollIntoView({ behavior: "smooth", block: "start" }); };
  m.onchange = (e) => {
    if (e.target.id === "ccSrc") { CCS = e.target.value; ccPayView(DB.cc); return; }
    if (e.target.id === "ccYr") { const y = e.target.value; CCF.from = y ? y + "-01-01" : ""; CCF.to = y ? y + "-12-31" : ""; CCF.lim = 300; ccSync(); ccUpd(); }
    if (e.target.id === "ccFrom" || e.target.id === "ccTo") { CCF[e.target.id === "ccFrom" ? "from" : "to"] = e.target.value; CCF.lim = 300; ccSync(); ccUpd(); }
  };
  m.oninput = (e) => {
    const t = e.target; if (CCV !== "tx") return;
    if (t.id === "ccQ" || t.id === "ccMin" || t.dataset.cf != null) { clearTimeout(tm); tm = setTimeout(() => {
      if (t.id === "ccQ") CCF.q = t.value; else if (t.id === "ccMin") CCF.min = t.value; else CCF.cf[t.dataset.cf] = t.value;
      CCF.lim = 300; ccSync(); ccUpd(); }, 250); }
  };
}
const ccTrips = (C) => (C.trips || []).length ? accd(`${IC("route", 16)} เดินทางต่างประเทศ`, `${C.trips.length} ทริป · ${M(C.trips.reduce((t, x) => t + x.amt, 0))}`, `<div class="tblwrap"><table><tr><th>#</th><th>วันแรก</th><th>วันสุดท้าย</th><th>ประเทศ</th><th class="n">ยอด (บาท)</th><th class="n">ครั้ง</th><th>รายการใหญ่สุด</th></tr>${C.trips.map((t) => `<tr><td>${t.no}</td><td>${dTh(t.start)}</td><td>${dTh(t.end)}</td><td>${esc(t.countries)}</td><td class="n">${fmt(t.amt)}</td><td class="n">${fmt0(t.n)}</td><td><small>${t.top.slice(0, 2).map(([v, d]) => `${esc(d)} ${fmt0(v)}`).join("<br>")}</small></td></tr>`).join("")}</table></div>`) : "";
function ccTxShell() {
  const C = DB.cc, cnt = (f) => fmt0(C.tx.filter(f).length), yrs = [...new Set(C.tx.map((r) => r[0].slice(0, 4)))].sort().reverse();
  const types = [...new Map(C.tx.map((r) => [r[4], r[5]])).entries()].sort((a, b) => a[0].localeCompare(b[0], "th")), ctry = [...new Set(C.tx.map((r) => r[6]))].sort((a, b) => (a === "ไทย" ? -1 : b === "ไทย" ? 1 : a.localeCompare(b, "th")));
  const cinfo = Object.fromEntries((C.card_info || []).map((c) => [c.card, c]));
  return `<div class="card fcard" id="ccF">
   <div class="fline"><label class="sbox" style="flex:1 1 320px">${IC("search", 16)}<input type="search" id="ccQ" value="${esc(CCF.q)}" placeholder="ค้นหาร้านค้า / สินค้า / เมือง / ประเภท"></label></div>
   <div class="fline">${["card", "type", "nat", "per", "ctry"].map((k) => `<button class="pill" data-ccd="${k}"><span></span></button>`).join("")}
    <input type="number" id="ccMin" class="pin" min="0" step="1000" value="${esc(CCF.min)}" placeholder="ยอดขั้นต่ำ (บาท)">
    <button class="ibx" id="ccClr" hidden title="ล้างตัวกรอง" aria-label="ล้างตัวกรอง">${IC("fx", 16)}</button><span id="ccSum" class="muted fsum"></span></div>
   <div class="ddp" data-ccp="card" hidden><div class="frow">${C.cards.map((c) => `<button class="chip" data-ccc="${c.card}"><span class="dot" style="background:${CARDC[c.card] || "#5B6B7F"}"></span>${esc(cinfo[c.card] ? cinfo[c.card].full : "x" + c.card)} <small class="muted">${esc(cinfo[c.card] ? cinfo[c.card].ctype || "" : "")} · ${cnt((r) => r[1] === c.card)}</small></button>`).join("")}</div></div>
   <div class="ddp" data-ccp="type" hidden><div class="frow"><button class="chip" data-cct="*">เลือกทั้งหมด / ล้าง</button>${types.map(([t, n]) => `<button class="chip" data-cct="${esc(t)}"><span class="dot" style="background:${NATC[n] || "#9E9E9E"}"></span>${esc(t)} <small class="muted">${cnt((r) => r[4] === t)}</small></button>`).join("")}</div></div>
   <div class="ddp" data-ccp="nat" hidden><div class="frow">${Object.entries(NATL).map(([k, l]) => `<button class="chip" data-ccn="${k}"><span class="dot" style="background:${NATC[k]}"></span>${l} <small class="muted">${cnt((r) => r[5] === k)}</small></button>`).join("")}</div>
     <p class="muted" style="font-size:.8rem;margin:0">ค่าเริ่มต้น = ใช้ส่วนตัว + บริจาค/ทำบุญ (ไม่รวมรายการชำระค่าบัตร/คืนเงินซึ่งเป็นยอดติดลบ)</p></div>
   <div class="ddp" data-ccp="per" hidden><div class="frow"><input type="date" id="ccFrom" value="${CCF.from}"> – <input type="date" id="ccTo" value="${CCF.to}">
     <button class="chip" data-ccpp="all">ทั้งหมด</button><button class="chip" data-ccpp="before">ก่อนตั้งมูลนิธิ</button><button class="chip" data-ccpp="after">หลังตั้งมูลนิธิ</button>
     <select id="ccYr"><option value="">รายปี…</option>${yrs.map((y) => `<option value="${y}">ปี ${+y + 543}</option>`).join("")}</select></div></div>
   <div class="ddp" data-ccp="ctry" hidden><div class="frow">${ctry.map((c) => `<button class="chip" data-ccy="${esc(c)}">${esc(c)} <small class="muted">${cnt((r) => r[6] === c)}</small></button>`).join("")}</div></div>
  </div>
  <div class="grid g4 kp8" id="ccKpi" style="margin-top:12px"></div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><div class="lab" style="margin-top:0">ตามประเภท</div><div class="chartbox tall"><canvas id="cCcT2"></canvas></div></div>
    <div class="card"><div class="lab" style="margin-top:0">รายเดือน แยกตามบัตร (ล้านบาท)</div><div class="chartbox tall"><canvas id="cCcM"></canvas></div></div></div>
  <div id="ccMer"></div>
  <h2>${IC("list")} รายการ <small id="ccCnt"></small></h2>
  <div class="frow" style="margin:-4px 0 8px"><button class="ibx" id="ccXl" title="ส่งออก Excel (ทุกแถวตามตัวกรอง)" aria-label="ส่งออก Excel">${IC("xls", 16)}</button><button class="ibx" id="ccSr" title="กลับลำดับเดิม" aria-label="กลับลำดับเดิม">${IC("reset", 16)}</button><button class="ibx" id="ccCfx" title="ล้างช่องกรองคอลัมน์" aria-label="ล้างช่องกรองคอลัมน์">${IC("fx", 16)}</button></div>
  <div class="tblwrap tall" data-noxbar="1"><table id="ccT"><thead><tr>${CCOLS.map(([l, , k], c) => `<th data-cs="${c}" class="srt${k === "a" ? " n" : ""}">${l} <span class="si"></span></th>`).join("")}</tr>
    <tr class="cfr">${CCOLS.map(([, , k], c) => `<th><input data-cf="${c}" value="${esc(CCF.cf[c] || "")}" placeholder="${k === "a" ? "≥ / ช่วง" : k === "d" ? "2567 / 2024-05" : "กรอง…"}"></th>`).join("")}</tr></thead><tbody></tbody></table></div>
  <div id="ccMore" style="text-align:center;margin:8px 0"></div>`;
}
function ccSync() {                                                     // ป้ายบนปุ่มตัวกรอง + สถานะชิป
  const m = $("#main"), F = CCF, setP = (k, txt, on) => { const b = $(`[data-ccd="${k}"]`, m); if (!b) return; b.querySelector("span").textContent = txt; b.classList.toggle("on", on); };
  const cut = DB.cut || "2022-06-25";
  setP("card", F.cards.size ? `บัตร x${[...F.cards].join(", x")}` : "บัตรทุกใบ", F.cards.size > 0);
  setP("type", F.types.size ? (F.types.size === 1 ? [...F.types][0] : `${F.types.size} ประเภท`) : "ทุกประเภท", F.types.size > 0);
  const natDef = F.nats.size === 2 && F.nats.has("per") && F.nats.has("chr");
  setP("nat", !F.nats.size ? "ทุกลักษณะ (รวมชำระค่าบัตร)" : natDef ? "ใช้จ่าย (ไม่รวมชำระค่าบัตร)" : [...F.nats].map((k) => NATL[k]).join(" + "), !natDef);
  setP("per", F.from || F.to ? (F.from === cut && !F.to ? "หลังตั้งมูลนิธิ" : !F.from && F.to && F.to < cut ? "ก่อนตั้งมูลนิธิ" : `${F.from ? dTh(F.from) : "…"} – ${F.to ? dTh(F.to) : "…"}`) : "ทุกช่วงเวลา", !!(F.from || F.to));
  setP("ctry", F.ctry.size ? [...F.ctry].join(", ") : "ทุกประเทศ", F.ctry.size > 0);
  $$("[data-ccc]", m).forEach((b) => b.classList.toggle("on", F.cards.has(b.dataset.ccc)));
  $$("[data-cct]", m).forEach((b) => b.classList.toggle("on", F.types.has(b.dataset.cct)));
  $$("[data-ccn]", m).forEach((b) => b.classList.toggle("on", F.nats.has(b.dataset.ccn)));
  $$("[data-ccy]", m).forEach((b) => b.classList.toggle("on", F.ctry.has(b.dataset.ccy)));
  const f = $("#ccFrom"), t = $("#ccTo"); if (f) f.value = F.from; if (t) t.value = F.to;
  const any = F.q || F.cards.size || F.types.size || !natDef || F.ctry.size || F.from || F.to || F.min || Object.values(F.cf).some((v) => v && v.trim());
  const c = $("#ccClr"); if (c) c.hidden = !any;
  $$("#ccT [data-cs]").forEach((th) => { const i = F.sort.findIndex((x) => x[0] === +th.dataset.cs); th.querySelector(".si").textContent = i < 0 ? "" : (F.sort[i][1] > 0 ? "▲" : "▼") + (F.sort.length > 1 ? i + 1 : ""); });
}
function ccUpd() {
  const R = ccRows(), C = DB.cc, cut = DB.cut || "2022-06-25", sum = (A) => A.reduce((t, r) => t + r[7], 0);
  const tot = sum(R), aft = sum(R.filter((r) => r[0] >= cut)), abr = R.filter((r) => r[6] && r[6] !== "ไทย"), mer = new Map();
  R.forEach((r) => { const k = r[2].replace(/\s+/g, " ").trim(), e = mer.get(k) || [0, 0, r[4]]; e[0] += r[7]; e[1]++; mer.set(k, e); });
  const big = R.reduce((b, r) => (Math.abs(r[7]) > Math.abs(b ? b[7] : 0) ? r : b), null);
  $("#ccSum").textContent = `${fmt0(R.length)} / ${fmt0(C.tx.length)} รายการ · ${fmt(tot)} บาท`;
  $("#ccKpi").innerHTML = [["ยอดรวมตามตัวกรอง", M(tot), `${fmt(tot)} บาท`, ""], ["จำนวนรายการ", fmt0(R.length), `${fmt0(mer.size)} ร้านค้า / รายการ`, ""],
    ["หลังตั้งมูลนิธิ (25 มิ.ย. 65)", M(aft), tot ? `${(aft / tot * 100).toFixed(1)}% ของยอดตามตัวกรอง` : "", "r"], ["ต่างประเทศ", M(sum(abr)), `${fmt0(abr.length)} รายการ`, ""]]
    .map(([l, v, s, c]) => `<div class="card kpi ${c}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("") +
    (big ? `<div class="card kpi" style="grid-column:span 2"><div class="l">รายการใหญ่สุด</div><div class="v">${M(big[7])}</div><div class="s">${dTh(big[0])} · x${big[1]} · ${esc(big[2])}</div></div>` : "");
  // ชาร์ตตามประเภท
  ["ccT2", "ccM"].forEach((k) => { if (CH[k]) { CH[k].destroy(); delete CH[k]; } });
  const tp = new Map(); R.forEach((r) => { const e = tp.get(r[4]) || [0, 0, r[5]]; e[0] += r[7]; e[1]++; tp.set(r[4], e); });
  const T = [...tp.entries()].sort((a, b) => b[1][0] - a[1][0]).slice(0, 16);
  CH.ccT2 = new Chart($("#cCcT2"), { type: "bar", data: { labels: T.map(([t]) => (t.length > 30 ? t.slice(0, 29) + "…" : t)), datasets: [{ data: T.map(([, v]) => v[0] / 1e6), backgroundColor: T.map(([t, v]) => (CCF.types.has(t) ? "#FFD403" : NATC[v[2]] || "#9E9E9E")) }] },
    options: { indexAxis: "y", maintainAspectRatio: false, onClick: (e, el) => { if (!el.length) return; const t = T[el[0].index][0]; CCF.types.has(t) ? CCF.types.delete(t) : CCF.types.add(t); CCF.lim = 300; ccSync(); ccUpd(); },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${fmt(c.raw * 1e6)} บาท (${fmt0(T[c.dataIndex][1][1])} ครั้ง)` } } }, scales: { x: { title: { display: true, text: "ล้านบาท" } }, y: { ticks: { font: { size: 11 } } } } } });
  const ms = [...new Set(R.map((r) => r[0].slice(0, 7)))].sort(), cards = [...new Set(R.map((r) => r[1]))];
  CH.ccM = new Chart($("#cCcM"), { type: "bar", data: { labels: ms.map((x) => `${MTH[+x.slice(5)]} ${String(+x.slice(0, 4) + 543).slice(2)}`),
      datasets: cards.map((cd) => ({ label: "x" + cd, backgroundColor: CARDC[cd] || "#5B6B7F", stack: "s", data: ms.map((x) => R.filter((r) => r[1] === cd && r[0].startsWith(x)).reduce((t, r) => t + r[7], 0) / 1e6) })) },
    options: { maintainAspectRatio: false, onClick: (e, el) => { if (!el.length) return; const x = ms[el[0].index]; CCF.from = x + "-01"; CCF.to = x + "-31"; CCF.lim = 300; ccSync(); ccUpd(); },
      plugins: { legend: { labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} ${fmt(c.raw * 1e6)}` } } }, scales: { x: { stacked: true, ticks: { maxRotation: 90, autoSkip: true } }, y: { stacked: true } } } });
  // ร้านค้ารายใหญ่ตามตัวกรอง
  const MR = [...mer.entries()].sort((a, b) => b[1][0] - a[1][0]);
  $("#ccMer").innerHTML = accd(`${IC("users", 16)} ร้านค้า / รายการ รวมตามชื่อ`, `${fmt0(MR.length)} ราย`,
    `<div class="tblwrap" data-noxbar="1"><table><tr><th>#</th><th>ร้านค้า / รายการ</th><th>ประเภท</th><th class="n">ครั้ง</th><th class="n">ยอด (บาท)</th></tr>${MR.slice(0, 50).map(([k, v], i) => `<tr class="click" data-ccq="${esc(k)}"><td>${i + 1}</td><td>${esc(k)}</td><td>${esc(v[2])}</td><td class="n">${fmt0(v[1])}</td><td class="n">${fmt(v[0])}</td></tr>`).join("")}</table></div>${MR.length > 50 ? `<p class="muted" style="font-size:.8rem">แสดง 50 อันดับแรก</p>` : ""}`);
  // ตาราง
  $("#ccCnt").textContent = `${fmt0(R.length)} รายการ · ${fmt(tot)} บาท${R.length > CCF.lim ? ` · แสดง ${fmt0(CCF.lim)} แถวแรก` : ""}`;
  $("#ccT tbody").innerHTML = R.slice(0, CCF.lim).map((r) => `<tr><td>${dTh(r[0])}</td><td><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${CARDC[r[1]] || "#5B6B7F"}"></span> x${esc(r[1])}</td><td>${esc(r[2])}</td><td><small>${esc(r[3])}</small></td><td>${esc(r[4])}</td><td><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${NATC[r[5]] || "#999"}"></span> ${esc(NATL[r[5]] || r[5])}</td><td>${esc(r[6])}</td><td class="n${r[7] < 0 ? " neg" : ""}">${fmt(r[7])}</td></tr>`).join("") || `<tr><td colspan="8" class="muted" style="text-align:center">ไม่พบรายการตามตัวกรอง</td></tr>`;
  $("#ccMore").innerHTML = R.length > CCF.lim ? `<button class="chip" id="ccMoreB" title="แสดงเพิ่ม">${IC("more", 14)} ${fmt0(Math.min(500, R.length - CCF.lim))}</button> <button class="chip" id="ccAllB" title="แสดงทั้งหมด">ทั้งหมด ${fmt0(R.length)}</button>` : "";
  CCR = R;
}
let CCR = [];
function ccTxClick(e) {
  const m = $("#main"), F = CCF, b = e.target.closest("button"), upd = () => { F.lim = 300; ccSync(); ccUpd(); };
  const th = e.target.closest("th[data-cs]");
  if (th) { const c = +th.dataset.cs, i = F.sort.findIndex((x) => x[0] === c);
    if (!e.shiftKey) F.sort = i < 0 ? [[c, CCOLS[c][2] === "t" ? 1 : -1]] : [[c, -F.sort[i][1]]];
    else if (i < 0) F.sort.push([c, CCOLS[c][2] === "t" ? 1 : -1]); else if (F.sort[i][1] === (CCOLS[c][2] === "t" ? 1 : -1)) F.sort[i][1] *= -1; else F.sort.splice(i, 1);
    ccSync(); return ccUpd(); }
  const tr = e.target.closest("tr[data-ccq]"); if (tr) { F.q = tr.dataset.ccq; $("#ccQ").value = F.q; upd(); return $("#ccT").scrollIntoView({ behavior: "smooth", block: "start" }); }
  if (!b) { if (!e.target.closest("#ccF")) { $$("[data-ccp]", m).forEach((p) => (p.hidden = true)); $$("[data-ccd]", m).forEach((x) => x.classList.remove("open")); } return; }
  if (b.dataset.ccd) { const p = $(`[data-ccp="${b.dataset.ccd}"]`, m), was = p.hidden; $$("[data-ccp]", m).forEach((x) => (x.hidden = true)); $$("[data-ccd]", m).forEach((x) => x.classList.remove("open")); p.hidden = !was; b.classList.toggle("open", was); return; }
  const tog = (S, v) => (S.has(v) ? S.delete(v) : S.add(v));
  if (b.dataset.ccc) { tog(F.cards, b.dataset.ccc); return upd(); }
  if (b.dataset.cct) { if (b.dataset.cct === "*") { if (F.types.size) F.types.clear(); else $$("[data-cct]", m).forEach((x) => x.dataset.cct !== "*" && F.types.add(x.dataset.cct)); } else tog(F.types, b.dataset.cct); return upd(); }
  if (b.dataset.ccn) { tog(F.nats, b.dataset.ccn); return upd(); }
  if (b.dataset.ccy) { tog(F.ctry, b.dataset.ccy); return upd(); }
  if (b.dataset.ccpp) { const cut = DB.cut || "2022-06-25", p = b.dataset.ccpp; F.from = p === "after" ? cut : ""; F.to = p === "before" ? new Date(Date.parse(cut) - 864e5).toISOString().slice(0, 10) : ""; $("#ccYr").value = ""; return upd(); }
  if (b.id === "ccClr") { const keep = F.sort; CCF = CCF0(); CCF.sort = keep; $("#ccQ").value = ""; $("#ccMin").value = ""; $$("[data-cf]", m).forEach((x) => (x.value = "")); $("#ccYr").value = ""; ccSync(); return ccUpd(); }
  if (b.id === "ccCfx") { F.cf = {}; $$("[data-cf]", m).forEach((x) => (x.value = "")); return upd(); }
  if (b.id === "ccSr") { F.sort = [[0, -1]]; ccSync(); return ccUpd(); }
  if (b.id === "ccMoreB") { F.lim += 500; return ccUpd(); }
  if (b.id === "ccAllB") { F.lim = CCR.length; return ccUpd(); }
  if (b.id === "ccXl") { const rows = [CCOLS.map((c) => c[0])].concat(CCR.map((r) => [dTh(r[0]), "x" + r[1], r[2], r[3], r[4], NATL[r[5]] || r[5], r[6], r[7]]));
    return download2("รายการบัตรเครดิต (ตามตัวกรอง).xlsx", xlsxBlob("รายการบัตรเครดิต", rows, [12, 8, 36, 24, 30, 18, 12, 14])); }
}
// ชาร์ต "ค่าบัตรจ่ายโดยบัญชีใด" (ผู้สั่งงาน 18 พ.ย. 69): บัญชีต้นทาง -> บัตร + รายเดือน + รายการรายครั้ง ; กดแถวบัญชีต้นทางในตารางเพื่อดูเฉพาะบัญชีนั้น
function miniFlow(el, L, R, links, hd) {                                    // L, R: [{id, lab, sub, v, col}] ; links: [{a, b, v}]
  const W = Math.max(560, el.clientWidth || 760), LW = W > 900 ? 360 : 200, bw = 14, pad = 8, tot = L.reduce((t, x) => t + x.v, 0) || 1;
  const H0 = Math.max(180, Math.max(L.length, R.length) * 48), sc = (H0 - pad * (Math.max(L.length, R.length) - 1)) / tot;
  const put = (A) => { let y = 22; A.forEach((n) => { n.h = Math.max(16, n.v * sc); n.y = y; n.o = y; y += n.h + pad; }); return y; };
  const H = Math.max(put(L), put(R)), xL = LW, xR = W - (W > 900 ? 300 : 170) - bw, cut = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
  const byL = Object.fromEntries(L.map((n) => [n.id, n])), byR = Object.fromEntries(R.map((n) => [n.id, n]));
  let svg = `<text x="${xL + bw}" y="13" text-anchor="end" class="flh">${hd ? hd[0] : "บัญชีที่จ่าย"}</text><text x="${xR}" y="13" class="flh">${hd ? hd[1] : "บัตรเครดิต"}</text>`;
  links.forEach((l) => { const a = byL[l.a], b = byR[l.b]; if (!a || !b) return; const th = Math.max(1, l.v * sc), y0 = a.o + th / 2, y1 = b.o + th / 2, mx = (xL + bw + xR) / 2; a.o += th; b.o += th;
    svg += `<path class="fl" d="M${xL + bw},${y0.toFixed(1)} C${mx},${y0.toFixed(1)} ${mx},${y1.toFixed(1)} ${xR},${y1.toFixed(1)}" stroke="${a.col}" stroke-width="${th.toFixed(1)}" data-tip="${esc(a.lab)} → ${esc(b.lab)} : ${fmt(l.v)} บาท (${fmt0(l.n)} ครั้ง)"><title>${esc(a.lab)} → ${esc(b.lab)} : ${fmt(l.v)} บาท (${fmt0(l.n)} ครั้ง)</title></path>`; });
  L.forEach((n) => { svg += `<g><rect x="${xL}" y="${n.y.toFixed(1)}" width="${bw}" height="${n.h.toFixed(1)}" rx="3" fill="${n.col}"/><text x="${xL - 6}" y="${(n.y + n.h / 2 - 3).toFixed(1)}" text-anchor="end" class="fl1">${esc(cut(n.lab, W > 900 ? 44 : 24))}</text><text x="${xL - 6}" y="${(n.y + n.h / 2 + 12).toFixed(1)}" text-anchor="end" class="fl2">${M(n.v)} · ${esc(n.sub)}</text></g>`; });
  R.forEach((n) => { svg += `<g><rect x="${xR}" y="${n.y.toFixed(1)}" width="${bw}" height="${n.h.toFixed(1)}" rx="3" fill="${n.col}"/><text x="${xR + bw + 6}" y="${(n.y + n.h / 2 - 3).toFixed(1)}" class="fl1">${esc(cut(n.lab, 34))}</text><text x="${xR + bw + 6}" y="${(n.y + n.h / 2 + 12).toFixed(1)}" class="fl2">${M(n.v)} · ${esc(n.sub)}</text></g>`; });
  el.innerHTML = `<svg width="${W}" height="${Math.ceil(H + 6)}" viewBox="0 0 ${W} ${Math.ceil(H + 6)}">${svg}</svg>`;
}
function ccPayView(C) {
  const box = $("#ccPay"); if (!box) return;
  const P = (C.pay && C.pay.list) || [];
  if (!P.length) { box.innerHTML = ""; return; }
  const NONE = "(ไม่พบ)", nm = Object.fromEntries(C.pay.src.map((s) => [s.acc, s])), key = (r) => r[3] || NONE;
  const srcs = [...new Set(P.map(key))], sel = srcs.includes(CCS) || (CCS && /^\(/.test(CCS)) ? (srcs.includes(CCS) ? CCS : NONE) : "";
  const rows = P.filter((r) => !sel || key(r) === sel), tot = rows.reduce((t, r) => t + r[2], 0);
  const lab = (k) => (k === NONE ? "ไม่พบบัญชีต้นทาง" : (nm[k] ? nm[k].name : k).replace(/^KBNK /, "KBANK ")), col = (k) => (k === NONE ? "#9AA5B4" : nm[k] && nm[k].t1 ? "#B3261E" : "#00264D");
  const CARDC = { "4615": "#1565C0", "4260": "#6A1B9A", "6834": "#00897B", "7787": "#F9A825" }, cinfo = Object.fromEntries((C.card_info || []).map((c) => [c.card, c]));
  const HOWL = ["", "เลขบัญชีบัตร", "ยอด + วันที่", "ถอนเงินสด → เคาน์เตอร์", "ไม่พบ"];
  const isAcc = sel && sel !== NONE && DB.accounts.some((a) => dg(a.acc) === dg(sel));
  box.innerHTML = `<h2>${IC("flow")} ค่าบัตรจ่ายโดยบัญชีใด <small>${sel ? esc(lab(sel)) : "ทุกบัญชี"} · ${fmt0(rows.length)} ครั้ง · ${fmt(tot)} บาท</small></h2>
  <div class="fline" style="margin-bottom:8px">${fSel('id="ccSrc"', sel, `ทุกบัญชีต้นทาง · ${fmt0(P.length)} ครั้ง`, srcs.map((k) => [k, `${lab(k)} · ${fmt0(P.filter((r) => key(r) === k).length)} ครั้ง`]))}
    ${isAcc ? `<button class="chip" data-ccg="${esc(sel)}">${IC("flow", 13)} ดูในหน้าวิเคราะห์</button>` : ""}</div>
  <div class="card flowcard"><div id="ccFl" class="flow"></div></div>
  <div class="card" style="margin-top:10px"><div class="lab" style="margin-top:0">รายเดือน (ล้านบาท) — ${sel ? "แยกตามบัตร" : "แยกตามบัญชีที่จ่าย"}</div><div class="chartbox"><canvas id="cCcP"></canvas></div></div>
  ${accd(`${IC("list", 16)} รายการชำระรายครั้ง`, `${fmt0(rows.length)} ครั้ง`, `<div class="tblwrap tall"><table><tr><th>วันเวลาโอน (ธนาคาร)</th><th>บัญชีที่จ่าย</th><th>บัตร</th><th class="n">ยอด (บาท)</th><th>วิธีจับคู่</th></tr>${rows.map((r) => `<tr><td>${ccTm(r[0])}</td><td>${nm[r[3]] && nm[r[3]].t1 ? `<b style="color:var(--red)">${esc(lab(key(r)))}</b>` : esc(lab(key(r)))}</td><td>x${esc(r[1])}</td><td class="n">${fmt(r[2])}</td><td>${HOWL[r[4]] || ""}</td></tr>`).join("")}</table></div>`, !!sel)}`;
  const agg = (kf) => { const m = new Map(); rows.forEach((r) => { const k = kf(r), e = m.get(k) || [0, 0]; e[0] += r[2]; e[1]++; m.set(k, e); }); return m; };
  const aL = agg(key), aR = agg((r) => r[1]), aK = agg((r) => key(r) + "|" + r[1]);
  const L = [...aL.entries()].sort((a, b) => b[1][0] - a[1][0]).map(([k, v]) => ({ id: k, lab: lab(k), sub: `${fmt0(v[1])} ครั้ง`, v: v[0], col: col(k) }));
  const R = [...aR.entries()].sort((a, b) => b[1][0] - a[1][0]).map(([k, v]) => ({ id: k, lab: cinfo[k] ? cinfo[k].full : "x" + k, sub: `${fmt0(v[1])} ครั้ง`, v: v[0], col: CARDC[k] || "#5B6B7F" }));
  const links = [...aK.entries()].map(([k, v]) => ({ a: k.split("|")[0], b: k.split("|")[1], v: v[0], n: v[1] })).sort((a, b) => L.findIndex((x) => x.id === a.a) - L.findIndex((x) => x.id === b.a) || R.findIndex((x) => x.id === a.b) - R.findIndex((x) => x.id === b.b));
  miniFlow($("#ccFl"), L, R, links);
  enhance && enhance(box);
  if (CH.ccP) { CH.ccP.destroy(); delete CH.ccP; }
  const ms = [...new Set(rows.map((r) => String(r[0]).slice(0, 7)))].sort(), ser = sel ? R.map((x) => [x.id, x.lab, x.col, (r) => r[1]]) : L.map((x) => [x.id, x.lab, x.col, key]);
  CH.ccP = new Chart($("#cCcP"), { type: "bar", data: { labels: ms.map((m) => `${MTH[+m.slice(5)]} ${String(+m.slice(0, 4) + 543).slice(2)}`),
      datasets: ser.map(([id, l, c, kf]) => ({ label: l.length > 40 ? l.slice(0, 39) + "…" : l, backgroundColor: c, stack: "s", data: ms.map((m) => rows.filter((r) => String(r[0]).slice(0, 7) === m && kf(r) === id).reduce((t, r) => t + r[2], 0) / 1e6) })) },
    options: { maintainAspectRatio: false, scales: { x: { stacked: true, ticks: { maxRotation: 90, autoSkip: true } }, y: { stacked: true, title: { display: true, text: "ล้านบาท" } } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} ${fmt(c.raw * 1e6)}` } } } } });
}
const NATC = { per: "#B3261E", chr: "#1B7A4A", fin: "#9E9E9E" };
const ccTm = (t) => (String(t).length > 10 ? `${dTh(String(t).slice(0, 10))} ${String(t).slice(11)}` : dTh(t));
function ccBlock(C) {
  const nat = Object.fromEntries(C.nature.map((x) => [x.k, x])), t1 = C.pay.src.filter((s) => s.t1).reduce((t, s) => t + s.amt, 0);
  const CI = C.card_info || [], RF = C.card_refunds || [], rfSum = RF.reduce((t, r) => t + r.amt, 0), over = CI.reduce((t, c) => t + (c.bal < 0 ? -c.bal : 0), 0);
  const trips = C.trips.reduce((t, x) => t + x.amt, 0);
  const HEAD = `<h2>${IC("card")} การใช้บัตรเครดิต ${esc(C.holder || "")} <small>KBANK VISA x${C.cards.map((c) => c.card).join(" / x")} · ${dTh(C.range[0])} – ${dTh(C.range[1])} · statement ${C.files} ฉบับ</small></h2>`;
  const SUM1 = `<div class="grid g4 kp8">${[["ยอดใช้จ่ายสุทธิ", C.total, `${fmt0(C.n)} รายการ`, ""], ["ใช้ส่วนตัว", nat.per?.amt || 0, `${((nat.per?.amt || 0) / C.total * 100).toFixed(1)}%`, "r"], ["บริจาค / ทำบุญ", nat.chr?.amt || 0, `${((nat.chr?.amt || 0) / C.total * 100).toFixed(2)}% · ${(C.chr || []).length} รายการ`, "g"],
    ["สินค้าแบรนด์เนม / เครื่องประดับ", (C.types.find((t) => t.k === "lux") || {}).amt || 0, `${(C.types.find((t) => t.k === "lux") || {}).n || 0} รายการ`, ""],
    ["ชำระค่าบัตรจากบัญชีรับบริจาค", t1, `${(t1 / C.pay.total * 100).toFixed(1)}% ของยอดชำระ`, "r"], ["เงินชำระเกินในบัตร โอนคืนเข้าบัญชีส่วนตัว", rfSum, RF.length ? `${RF.length} ครั้ง · ยังค้างในบัตรอีก ${M(over)}` : "ไม่พบ", "x"],
    ["เดินทางต่างประเทศ", trips, `${C.trips.length} ทริป`, ""], ["หลังตั้งมูลนิธิ (25 มิ.ย. 65)", C.period["หลังตั้งมูลนิธิ"]?.[0] || 0, `${fmt0(C.period["หลังตั้งมูลนิธิ"]?.[1] || 0)} รายการ`, ""]]
    .map(([l, v, s, c]) => `<div class="card kpi ${c}"><div class="l">${l}</div><div class="v">${M(v)}</div><div class="s">${fmt(v)} บาท</div><div class="s">${s}</div></div>`).join("")}</div>
  <div class="card" style="margin-top:12px"><div class="lab" style="margin-top:0">รายปี (พ.ศ.) แยกประเภทหลัก — ชาร์ตตามประเภท / รายเดือน และร้านค้า อยู่หน้ารายการใช้จ่าย</div><div class="chartbox tall"><canvas id="cCcY"></canvas></div></div>`;
  const PAY = `${CI.length ? `<h2>${IC("card")} บัตรแต่ละใบ <small>เลขบัญชีบัตรใน statement ธนาคาร = 6 หลักแรก + 4 หลักท้ายของเลขบัตร</small></h2>
  <div class="tblwrap"><table><tr><th>เลขบัตร</th><th>บัญชีบัตร (statement ธนาคาร)</th><th>ประเภท</th><th>ช่วงรายการ</th><th class="n">ใช้จ่ายสุทธิ</th><th class="n">ชำระเข้าบัตร</th><th class="n">จากบัญชีรับบริจาค</th><th class="n">ยอดคงค้างล่าสุด</th></tr>
    ${CI.map((c) => `<tr><td><b>${esc(c.full)}</b></td><td>KBANK ${esc(c.acc)}</td><td>${esc(c.ctype)}</td><td>${dTh(c.first)} – ${dTh(c.last)} <small class="muted">(${c.stmts} ฉบับ)</small></td><td class="n">${fmt(c.amt)}</td><td class="n">${fmt(c.pay)}</td><td class="n">${c.pay_t1 ? `<b style="color:var(--red)">${fmt(c.pay_t1)}</b>` : ""}</td><td class="n">${c.bal < 0 ? `<b>${fmt(c.bal)}</b><br><small class="muted">ชำระเกิน</small>` : fmt(c.bal || 0)}</td></tr>`).join("")}</table></div>
  ${RF.length ? `<p class="muted" style="font-size:.86rem;margin:.5em 0 0">${IC("warn", 14)} ยอดเงินเกินในบัตรที่โอนคืนเข้าบัญชีเงินฝาก: ${RF.map((r) => `บัตร x${r.card} ${dTh(r.d)} <b>${fmt(r.amt)}</b> บาท → ${esc((r.name || "ไม่พบใน statement ธนาคาร").replace(/^KBNK /, "KBANK "))}${r.time ? " (" + esc(r.time) + ")" : ""}`).join(" ; ")}</p>` : ""}` : ""}
  <h2>${IC("bank")} เงินที่ใช้ชำระค่าบัตรมาจากบัญชีใด <small>จับคู่ statement ธนาคาร ยอดเท่ากัน ห่าง ≤ 3 วัน</small></h2>
  <div class="tblwrap"><table><tr><th>บัญชีต้นทาง</th><th class="n">ยอด (บาท)</th><th class="n">ครั้ง</th><th class="n">ก่อนตั้งมูลนิธิ</th><th class="n">หลังตั้งมูลนิธิ</th></tr>
    ${C.pay.src.map((s) => `<tr class="click" data-ccs="${esc(s.acc)}" title="กดเพื่อดูชาร์ตการชำระของบัญชีนี้"><td>${s.t1 ? `<b style="color:var(--red)">${esc(s.name.replace(/^KBNK /, "KBANK "))}</b> <span class="badge r">บัญชีรับบริจาค</span>` : esc(s.name.replace(/^KBNK /, "KBANK "))}</td><td class="n">${fmt(s.amt)}</td><td class="n">${fmt0(s.n)}</td><td class="n">${fmt(s.before)}</td><td class="n">${fmt(s.after)}</td></tr>`).join("")}
    ${(C.pay.bank_unmatched.by || []).map((r) => `<tr><td>${esc(r[0].replace(/^KBNK /, "KBANK "))} <small class="muted">(ไม่อยู่ใน statement บัตรชุดนี้)</small></td><td class="n">${fmt(r[1])}</td><td class="n">${fmt0(r[2])}</td><td></td><td></td></tr>`).join("")}</table></div>
  ${(C.pay.how || []).length ? `<p class="muted" style="font-size:.84rem;margin:.5em 0 0">วิธีจับคู่: ${C.pay.how.map((h) => `${esc(h.how)} <b>${fmt(h.amt)}</b> บาท (${fmt0(h.n)} ครั้ง)`).join(" · ")}</p>` : ""}
  ${(C.pay.cash || []).map((c) => `<p style="font-size:.9rem;margin:.4em 0 0">${IC("warn", 14)} ชำระบัตร x${c.card} ที่เคาน์เตอร์ <b>${fmt(c.amt)}</b> บาท เมื่อ ${dTh(c.d)} ตรงกับการถอนเงินสดยอดเท่ากันจาก <b style="color:var(--red)">${esc(c.name.replace(/^KBNK /, "KBANK "))}</b> เวลา ${esc(c.time)}</p>`).join("")}
  <div id="ccPay"></div>
  ${(C.pay_big || []).length || (C.trace || []).length ? `<h2>${IC("clock")} ตารางเวลาเส้นเงินที่ใช้ชำระค่าบัตร <small>ส่วนสืบสวน · เวลาจาก statement ธนาคาร (รายการในบัตรมีเฉพาะวันที่)</small></h2>` : ""}
  ${(C.pay_big || []).length ? accd(`${IC("list", 16)} รายการชำระค่าบัตรตั้งแต่ 300,000 บาท เรียงตามเวลา`, `${C.pay_big.length} รายการ · ${M(C.pay_big.reduce((t, x) => t + x.amt, 0))}`,
    `<div class="tblwrap"><table><tr><th>วันเวลาโอน (ธนาคาร)</th><th>บัญชีต้นทาง</th><th>บัตร</th><th class="n">ยอดชำระ (บาท)</th><th>วิธีจับคู่</th><th>รายการใช้บัตรวันเดียวกัน / ใกล้เคียง</th></tr>${C.pay_big.map((x) => `<tr><td>${ccTm(x.t)}</td><td>${x.t1 ? `<b style="color:var(--red)">${esc(x.src.replace(/^KBNK /, "KBANK "))}</b>` : esc(x.src.replace(/^KBNK /, "KBANK "))}</td><td>x${esc(x.card)}</td><td class="n"><b>${fmt(x.amt)}</b></td><td>${["", "เลขบัญชีบัตร", "ยอด + วันที่", "ถอนเงินสด → เคาน์เตอร์", "ไม่พบ"][x.how] || ""}</td><td>${esc(x.use || "")}</td></tr>`).join("")}</table></div>`) : ""}
  ${(C.trace || []).map((t) => accd(`${IC("route", 16)} ${esc(t.title)}`, `${t.rows.length} แถว`,
    `<p class="muted" style="font-size:.84rem;margin:0 0 6px">${esc(t.note)}</p>${(t.leads || []).length ? `<div class="lab" style="color:var(--red)">${IC("search", 14)} เบาะแสที่พบ</div><ul style="margin:.2em 0 .6em 1.1em;padding:0;font-size:.9rem">${t.leads.map((l) => `<li>${esc(l.replace(/KBNK /g, "KBANK "))}</li>`).join("")}</ul>` : ""}
    <div class="tblwrap"><table><tr><th>วันเวลา</th><th>บัญชี / บัตร</th><th>รายการ / คู่โอน</th><th class="n">เงินเข้า</th><th class="n">เงินออก / ใช้บัตร</th><th class="n">คงเหลือ</th><th>หมายเหตุ</th></tr>${t.rows.map((r) => `<tr${r.note ? ' style="background:#FFF4CC"' : ""}><td>${ccTm(r.t)}</td><td>${r.t1 ? `<b style="color:var(--red)">${esc(r.src.replace(/^KBNK /, "KBANK "))}</b>` : esc(r.src.replace(/^KBNK /, "KBANK "))}</td><td>${esc(r.desc.replace(/KBNK /g, "KBANK "))}</td><td class="n">${r.in ? fmt(r.in) : ""}</td><td class="n">${r.out ? fmt(r.out) : ""}</td><td class="n">${r.bal == null ? "" : fmt(r.bal)}</td><td><b>${esc(r.note || "")}</b></td></tr>`).join("")}</table></div>`)).join("")}
`;
  const SUM2 = `<h2>${IC("list")} ประเภทการใช้จ่าย</h2>
  <div class="tblwrap"><table><tr><th>ประเภท</th><th>ลักษณะ</th><th class="n">ยอด (บาท)</th><th class="n">ครั้ง</th><th class="n">ก่อนตั้ง</th><th class="n">หลังตั้ง</th></tr>
    ${C.types.map((t) => `<tr><td>${esc(t.label)}</td><td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${NATC[t.nat]}"></span> ${esc({ per: "ใช้ส่วนตัว", chr: "บริจาค/ทำบุญ" }[t.nat] || t.nat)}</td><td class="n">${fmt(t.amt)}</td><td class="n">${fmt0(t.n)}</td><td class="n">${fmt(t.before)}</td><td class="n">${fmt(t.after)}</td></tr>`).join("")}</table></div>

  ${accd(`${IC("route", 16)} เดินทางต่างประเทศ`, `${C.trips.length} ทริป · ${M(trips)}`, `<div class="tblwrap"><table><tr><th>#</th><th>วันแรก</th><th>วันสุดท้าย</th><th>ประเทศ</th><th class="n">ยอด (บาท)</th><th class="n">ครั้ง</th><th>รายการใหญ่สุด</th></tr>${C.trips.map((t) => `<tr><td>${t.no}</td><td>${dTh(t.start)}</td><td>${dTh(t.end)}</td><td>${esc(t.countries)}</td><td class="n">${fmt(t.amt)}</td><td class="n">${fmt0(t.n)}</td><td><small>${t.top.slice(0, 2).map(([v, d]) => `${esc(d)} ${fmt0(v)}`).join("<br>")}</small></td></tr>`).join("")}</table></div>`)}


  `;
  return { HEAD: HEAD.replace("</h2>", ` ${infoI(CCNOTE)}</h2>`), SUM: SUM1 + SUM2, PAY };
}
const CCNOTE = "จัดประเภทจากชื่อร้านค้าตาม statement บัตร (ไม่ใช่รายการสินค้าจริง) ต้องยืนยันด้วยใบเสร็จ ; รายงานฉบับเต็ม + Excel Pivot อยู่ในโฟลเดอร์ 4_รายงานนำเสนอ/8_บัตรเครดิต";
function ccCharts(C) {
  if (!C) return;
  const T = C.types.filter((t) => t.amt > 0).slice(0, 14);
  if ($("#cCcT")) CH.ccT = new Chart($("#cCcT"), { type: "bar", data: { labels: T.map((t) => t.label.length > 30 ? t.label.slice(0, 29) + "…" : t.label), datasets: [{ label: "ล้านบาท", data: T.map((t) => t.amt / 1e6), backgroundColor: T.map((t) => NATC[t.nat]) }] },
    options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${fmt(c.raw * 1e6)} บาท (${fmt0(T[c.dataIndex].n)} ครั้ง)` } } }, scales: { y: { ticks: { font: { size: 11 } } } } } });
  const keys = C.types.slice(0, 6).map((t) => t.k + ":" + t.nat), cols = ["#00264D", "#B3261E", "#1565C0", "#8E44AD", "#16A085", "#D35400"];
  if ($("#cCcY")) CH.ccY = new Chart($("#cCcY"), { type: "bar", data: { labels: C.years.map((y) => String(y.y + 543)), datasets: [...keys.map((k, i) => ({ label: C.types[i].label.split(" / ")[0], data: C.years.map((y) => (y.types[k] || 0) / 1e6), backgroundColor: cols[i], stack: "s" })),
    { label: "อื่น ๆ", data: C.years.map((y) => (y.amt - keys.reduce((t, k) => t + (y.types[k] || 0), 0)) / 1e6), backgroundColor: "#BDC3C7", stack: "s" }] },
    options: { maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} ${fmt(c.raw * 1e6)}` } } }, scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "ล้านบาท" } } } } });
}

/* ---------- งานและความคืบหน้า (รวม 2 เมนู ; ผู้สั่งงาน 18 พ.ย. 69) : ตารางงานเดียว กรองได้ การ์ดมีตัวเลข ---------- */
let WF = { type: "", st: "", own: "", q: "" };
const WST = { done: ["เสร็จแล้ว", "g", "#1B7A4A"], doing: ["กำลังดำเนินการ", "", "#1565C0"], wait: ["รอผล / รอนัด", "y", "#E0A800"], todo: ["ยังไม่เสร็จ / ต้องทำ", "r", "#B3261E"], none: ["ไม่ระบุสถานะ", "", "#9E9E9E"] };
function workRows() {
  const R = [], today = isoNow().slice(0, 10);
  const stOf = (s, dflt) => (!s ? dflt : /มาพบแล้ว|เรียบร้อย|เสร็จ|ได้แล้ว|แล้วเสร็จ/.test(s) ? "done" : /ยังไม่/.test(s) ? "todo" : /รอ|ออกแล้ว|ขอแล้ว|นัด/.test(s) ? "wait" : "doing");
  C.todo.forEach((t) => R.push({ type: t.extra2 || "งานผู้วิเคราะห์ (ในเว็บ)", ic: "clock", title: t.title, detail: t.detail || "", own: t.extra1 || "", date: t.date || "", stx: t.status || "ต้องทำ",
    st: /เสร็จ/.test(t.status || "") ? "done" : /รอ/.test(t.status || "") ? "wait" : /กำลัง|ดำเนิน/.test(t.status || "") ? "doing" : "todo", sec: "todo", id: t.id }));
  C.done.forEach((t) => R.push({ type: "งานผู้วิเคราะห์ (ในเว็บ)", ic: "check", title: t.title, detail: t.detail || "", own: t.extra1 || "", date: t.date || "", stx: t.status || "เสร็จแล้ว", st: "done", sec: "done", id: t.id }));
  progTasks().forEach((t) => R.push({ type: "งานชุดทำคดี", ic: "check", title: (t.no ? t.no + ". " : "") + t.title, detail: [t.detail, t.prob ? "ปัญหา: " + t.prob : "", t.note].filter(Boolean).join(" · "), own: t.owner, date: t.date || "", stx: t.due || "", st: t.st === "none" ? "none" : t.st }));
  tsSus().forEach((r) => R.push({ type: "หมายเรียกผู้ต้องหา", ic: "scale", title: r.name, detail: [r.issue, r.off, r.note].filter(Boolean).join(" · "), own: r.off || "", date: pDate(r.date) || "", stx: r.st, st: stOf(r.st, pDate(r.date) > today ? "wait" : "none") }));
  tsWit().forEach((s) => s.rows.forEach((r) => R.push({ type: "หมายเรียกพยาน", ic: "users", title: r.name, detail: [s.title, r.sub, r.note].filter(Boolean).join(" · "), own: r.off || "", date: pDate(r.date) || "", stx: r.st, st: stOf(r.st, pDate(r.date) > today ? "wait" : "none") })));
  tsAnu().forEach((r) => R.push({ type: "หมายเรียกเอกสาร / รถ", ic: "doc", title: r.name, detail: r.prov, own: "", date: pDate(r.meet) || "", stx: r.meet ? "นัด " + r.meet : "", st: pDate(r.meet) && pDate(r.meet) > today ? "wait" : "none" }));
  ((DB.cc && DB.cc.card_info) || []).filter((c) => c.bal < -0.005).forEach((c) => R.push({ type: "เสนออายัดทรัพย์สิน", ic: "lock", title: `เสนออายัดยอดชำระเกินในบัตรเครดิต ${c.full} จำนวน ${fmt(-c.bal)} บาท`,
    detail: `ยอดคงค้างติดลบ ณ รอบบิล ${dTh(c.bal_date)} · เงินชำระเข้าบัตรมาจากบัญชีรับบริจาค ${fmt(c.pay_t1)} บาท · ขอยอดปัจจุบันและรายการหลังรอบบิลจากธนาคารก่อน แล้วเสนอ พงส. อายัด + ระงับการคืนเงิน`,
    own: "", date: "", stx: "ยังไม่อยู่ในรายการอายัด", st: "todo", go: "asset" }));
  accRows().rows.forEach((r) => R.push({ type: "ขอข้อมูลบัญชี (STM)", ic: "bank", title: `${r.bank} ${r.acc} ${r.name}`.trim(),
    detail: [r.sheet && r.sheet.ref ? "หนังสือ " + r.sheet.ref : "", r.sheet && r.sheet.wd ? "ถอนเงิน: " + r.sheet.wd : "", r.sheet ? r.sheet.note : "", r.fz ? `อายัด ${fmt(r.fz.amt)} บาท` : ""].filter(Boolean).join(" · "),
    own: "", date: "", stx: r.st, st: r.ai >= 0 || r.cc ? "done" : /รอนำเข้า/.test(r.st) ? "doing" : /ขอแล้ว|รอ/.test(r.st) ? "wait" : "todo", go: "acct" }));
  tsCo().forEach((r) => R.push({ type: "หมายเรียกนิติบุคคล", ic: "build", title: r.name, detail: r.type, own: "", date: "", stx: "", st: "none" }));
  return R;
}
/* งาน / ความคืบหน้า รุ่น 19 พ.ย. 69 (ผู้ใช้สั่ง "ธีมเดียวกัน ... แสดงเป็นรายการมีตัวกรองเหมือนหน้าอื่น ๆ"):
   การ์ดสถานะ (กดกรอง) + ความคืบหน้ารายหมวด (กดกรอง) + ตารางรายการกลาง XT */
function pWork() {
  const R = workRows().sort((a, b) => (a.st === "done") - (b.st === "done") || String(b.date).localeCompare(String(a.date)));
  const types = [...new Set(R.map((r) => r.type))], done = R.filter((r) => r.st === "done").length, pct = R.length ? Math.round(done / R.length * 100) : 0;
  const n = (k) => R.filter((r) => r.st === k).length, m = $("#main");
  m.innerHTML = `<div class="ahd"><h2>${IC("list")} งานและความคืบหน้า <small>${tsStamp()}</small> ${syncBtn()}</h2><button class="btn" onclick="editItem('todo')">+ เพิ่มงาน</button></div>
  <div class="acards"><button class="acard tot" data-wst=""><span class="aic">${IC("check", 24)}</span><span class="acv">${pct}%</span><span class="acl">ความคืบหน้ารวมทุกงาน</span><span class="acs">เสร็จ ${fmt0(done)} / ${fmt0(R.length)} งาน</span>
      <span class="abar dfbar">${Object.entries(WST).map(([k, v]) => `<i style="width:${R.length ? (n(k) / R.length * 100).toFixed(1) : 0}%;background:${v[2]}"></i>`).join("")}</span></button>
    ${Object.entries(WST).filter(([k]) => n(k)).map(([k, v]) => `<button class="acard" data-wst="${k}" style="--c:${v[2]}"><span class="aic">${IC({ done: "check", doing: "clock", wait: "cal", todo: "warn", none: "list" }[k], 24)}</span><span class="acv">${fmt0(n(k))}</span><span class="acl">${v[0]}</span><span class="acs">${R.length ? Math.round(n(k) / R.length * 100) : 0}% ของงานทั้งหมด</span><span class="abar"><i style="width:${R.length ? (n(k) / R.length * 100).toFixed(1) : 0}%"></i></span></button>`).join("")}</div>
  <div class="card wprog"><div class="lab" style="margin-top:0">ความคืบหน้ารายหมวดงาน</div>${types.map((t) => { const v = R.filter((r) => r.type === t), d = v.filter((r) => r.st === "done").length;
    return `<button class="wpr" data-wty="${esc(t)}"><span class="wpi">${IC(v[0].ic, 16)}</span><span class="wpt">${esc(t)}</span><span class="wpb"><i style="width:${v.length ? d / v.length * 100 : 0}%"></i></span><span class="wpn">${d}/${v.length}</span></button>`; }).join("")}</div>
  <div id="wkX"></div>`;
  const S = xtS("work");
  const X = xtMount($("#wkX"), { id: "work", title: "ตารางงาน", ph: "ค้นหางาน / ชื่อ / รายละเอียด / ผู้รับผิดชอบ", rows: R, xl: "ตารางงาน (ตามตัวกรอง)",
    search: (r) => `${r.title} ${r.detail} ${r.own} ${r.stx} ${r.type}`,
    cols: [["#", () => 0, "n"], ["วันที่", (r) => r.date || "", "d"], ["หมวด", (r) => r.type, "t", (r) => `${IC(r.ic, 14)} ${esc(r.type)}`],
      ["งาน", (r) => `${r.title} ${r.detail || ""}`, "t", (r) => `<b>${esc(r.title)}</b>${r.detail ? `<br><small class="muted">${esc(r.detail.length > 180 ? r.detail.slice(0, 179) + "…" : r.detail)}</small>` : ""}`],
      ["ผู้รับผิดชอบ", (r) => r.own || "", "t"], ["สถานะ", (r) => WST[r.st][0], "t", (r) => `<span class="badge ${WST[r.st][1]}">${WST[r.st][0]}</span>${r.stx && r.stx !== WST[r.st][0] ? `<br><small class="muted">${esc(r.stx)}</small>` : ""}`],
      ["", () => "", "x", (r) => (r.sec ? `<button class="chip" onclick="editItem('${r.sec}','${r.id}')">แก้ไข</button>` : r.go ? `<span class="muted">${IC("next", 14)}</span>` : "")]],
    facets: [["type", "ทุกหมวดงาน", (r) => r.type], ["st", "ทุกสถานะ", (r) => r.st, Object.entries(WST).filter(([k]) => n(k)).map(([k, v]) => [k, v[0], v[2]])], ["own", "ทุกผู้รับผิดชอบ", (r) => r.own || "(ไม่ระบุ)"]],
    rowAttr: (r) => (r.go ? 'class="click"' : ""), onRow: (r, e) => { if (r.go && !e.target.closest("button")) go(r.go); },
    onUpdate: () => { $$("[data-wst]", m).forEach((b) => b.classList.toggle("on", b.dataset.wst ? !!(S.f.st && S.f.st.has(b.dataset.wst)) : !(S.f.st && S.f.st.size)));
      $$("[data-wty]", m).forEach((b) => b.classList.toggle("on", !!(S.f.type && S.f.type.has(b.dataset.wty)))); },
    note: "งานที่เพิ่มในเว็บ (ปุ่ม + เพิ่มงาน / แก้ไข — เก็บในเครื่องนี้ หรือ Google Sheet ถ้าตั้งค่าไว้) + แท็บชีตชุดทำคดี: สิ่งที่ดำเนินการ / หมายเรียกผู้ต้องหา / พยาน / เอกสาร-รถ / คุมบัญชี / นิติบุคคล (อ่านอย่างเดียว) · งานค้างเรียงไว้ด้านบน" });
  m.onclick = (e) => { const b = e.target.closest("button"); if (b && tsClick(b)) return;
    const s = e.target.closest("[data-wst]"); if (s) { xtSet("work", "st", s.dataset.wst, true); return X.upd(); }
    const t = e.target.closest("[data-wty]"); if (t) { xtSet("work", "type", t.dataset.wty, true); X.upd(); return $("#wkX").scrollIntoView({ behavior: "smooth", block: "start" }); } };
}

/* ---------- วิเคราะห์เส้นเงิน ---------- */
const T0 = Date.UTC(2015, 0, 1) / 60000;
const KCOL = ["#1565C0", "#00897B", "#B3261E", "#9E9E9E", "#FFD403"];
const IN_K = [0, 1, 4];
let F = null, TXM = null, SHOWN = 200;
const txSec = (i) => (DB.txs && DB.txs[i] >= 0 ? DB.txs[i] : -1);
// คู่ถอนเงินสด-ฝาก (ผู้สั่งงาน 18 พ.ย. 69): F.cpm = all (ทั้งหมด) | raw (เส้นโอนตาม statement ไม่จับคู่) | pair (เฉพาะคู่ถอน-ฝาก) ; F.pq = ประเภทคู่ที่เลือก (ว่าง = ทุกประเภท)
const txQ = (i) => (DB.txq ? DB.txq[i] : 0);
const pqOn = (q) => !F.pq.size || F.pq.has(q);
const cpOf = (i) => { const q = txQ(i); return q && (F.cpm === "raw" || !pqOn(q)) ? DB.txo[i] : DB.tx[i][4]; };
const PKC = ["", "#1B7A4A", "#2E7D32", "#9E9D24", "#00838F", "#0277BD", "#6A1B9A", "#AD1457", "#00264D"];
const txT = (i) => { const r = DB.tx[i]; if (r[2] === 4) return "(ทั้งเดือน)"; const sec = txSec(i); return min2iso(r[1]).slice(11, 16) + (sec >= 0 ? ":" + String(sec).padStart(2, "0") : ""); };
const TXS0 = () => [["t", 1]];                                          // ค่าเริ่มต้นตารางรายการ: วันที่-เวลา เก่า -> ใหม่ (ผู้สั่งงาน 18 พ.ย. 69)
let TXS = TXS0();
const TXC = { t: "วันเวลา", a: "บัญชี", k: "ประเภท", v: "ยอด", c: "คู่โอน", g: "กลุ่มคู่โอน" };
const txKey = (k, i) => { const r = DB.tx[i]; switch (k) { case "t": return r[1] * 60 + Math.max(0, txSec(i)); case "a": return DB.accounts[r[0]].name || ""; case "k": return r[2]; case "v": return r[3];
  case "c": { const c = DB.cps[cpOf(i)]; return (c[1] || c[0] || ""); } default: return DB.groups[DB.cps[cpOf(i)][3]][1]; } };
function txSort(idx) {
  const ks = TXS.map(([k, d]) => { const m = new Map(); for (const i of idx) m.set(i, txKey(k, i)); return [m, d]; });
  return [...idx].sort((x, y) => { for (const [m, d] of ks) { const a = m.get(x), b = m.get(y); if (a === b) continue;
    const c = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "th"); if (c) return c * d; } return x - y; });
}
const day2min = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 60000 - T0;
const min2iso = (m) => new Date((m + T0) * 60000).toISOString();
function prep() {
  const n = DB.tx.length; TXM = new Int32Array(n);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const t = DB.tx[i][1]; const d = new Date((t + T0) * 60000); TXM[i] = d.getUTCFullYear() * 12 + d.getUTCMonth(); if (t < lo) lo = t; if (t > hi) hi = t; }
  DB.lo = min2iso(lo).slice(0, 10); DB.hi = min2iso(hi).slice(0, 10);
  resetF();
}
let FHIST = [];                                                        // ประวัติตัวกรองก่อนกดชาร์ต/ตาราง (ปุ่มย้อนกลับ ; ผู้สั่งงาน 18 พ.ย. 69)
const fSnap = () => ({ ...F, accs: new Set(F.accs), kinds: new Set(F.kinds), cpg: new Set(F.cpg), pq: new Set(F.pq), chain: (F.chain || []).map((a) => (Array.isArray(a) ? [...a] : [a])) });
function resetF() { FHIST = []; F = { from: DB.lo, to: DB.hi, accs: new Set(), kinds: new Set(), cpg: new Set(), min: 0, q: "", gran: "auto", cps: "t", flm: "g", fln: innerWidth > 1100 ? 14 : 8, cpm: "raw", pq: new Set(), flt: "fifo", chain: [], flc: innerWidth > 1100 ? 5 : 3, dn: false }; SHOWN = 200; }
function filterTx() {
  const a = day2min(F.from), b = day2min(F.to) + 1440, q = F.q.trim().toLowerCase();
  const out = [];
  for (let i = 0; i < DB.tx.length; i++) {
    const r = DB.tx[i];
    if (r[1] < a || r[1] >= b) continue;
    if (F.accs.size && !F.accs.has(r[0])) continue;
    if (F.kinds.size && !F.kinds.has(r[2])) continue;
    if (r[3] < F.min) continue;
    if (F.cpm === "pair" && !(txQ(i) && pqOn(txQ(i)))) continue;
    const cp = DB.cps[cpOf(i)];
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
  const PKS = (DB.pk || []).map(() => [0, 0]); (DB.txq || []).forEach((q, i) => { if (q) { PKS[q][0]++; PKS[q][1] += DB.tx[i][3]; } });
  const CPM_BTNS = [["raw", "ยอดโอนตรง (ค่าเริ่มต้น)"], ["all", "รวมคู่ถอน-ฝากเงินสด"], ["pair", "เฉพาะคู่ถอน-ฝากเงินสด"]].map(([k, l]) => `<button class="chip" data-cm="${k}">${l}</button>`).join("");
  const PQ_BTNS = (DB.pk || []).map((l, q) => (q && PKS[q][0] ? `<button class="chip" data-pq="${q}" title="${fmt(PKS[q][1])} บาท"><span class="dot" style="background:${PKC[q]}"></span>${esc(l)} <small>${fmt0(PKS[q][0])} · ${M(PKS[q][1])}</small></button>` : "")).join("") + (DB.pk ? `<button class="chip" data-pq="0">ทุกประเภท</button>` : "");
  // ลำดับหน้า (ผู้สั่งงาน 17 พ.ย. 69): ตัวเลขในกล่องบนสุด → แถบตัวกรอง → ชาร์ตเส้นเงิน → ตารางคู่โอนรายใหญ่ → ตารางรายการ (เต็มความกว้าง ไม่วางคู่กัน) → ชาร์ตอื่น
  $("#main").innerHTML = `
  <div class="grid g4 kp8" id="aKpi"></div>
  <div class="card fcard" id="fCard">
   <div class="fline">
    <label class="sbox">${IC("search", 16)}<input type="search" id="fQ" value="${esc(F.q)}" placeholder="ค้นหาคู่โอน (ชื่อ / เลขบัญชี)"></label>
    <label class="sbox">${IC("users", 16)}<input type="search" id="dnQ" placeholder="ค้นหาผู้บริจาค (ชื่อ / เลขบัญชี) แล้วกด Enter"><button class="sgo" id="dnGo" title="ค้นหาผู้บริจาค">${IC("search", 16)}</button></label>
   </div>
   <div class="fline">
    ${["per", "acc", "kind", "cpg", "cash"].map((k) => `<button class="pill" data-dd="${k}"><span></span></button>`).join("")}
    <input type="number" id="fMin" class="pin" min="0" step="1000" value="${F.min || ""}" placeholder="ยอดขั้นต่ำ (บาท)">
    <button class="ibx" id="fClear" hidden title="ล้างตัวกรอง" aria-label="ล้างตัวกรอง">${IC("fx", 16)}</button>
    <span id="fSum" class="muted fsum"></span>
   </div>
   <div class="ddp" data-ddp="per" hidden><div class="frow"><input type="date" id="fFrom" value="${F.from}"> – <input type="date" id="fTo" value="${F.to}">
      <button class="chip" data-p="all">ทั้งหมด</button><button class="chip" data-p="before">ก่อนตั้งมูลนิธิ</button><button class="chip" data-p="after">หลังตั้งมูลนิธิ</button>
      <select id="fYr"><option value="">รายปี…</option>${yrs.slice().reverse().map((y) => `<option value="${y}">ปี ${y + 543}</option>`).join("")}</select></div></div>
   <div class="ddp" data-ddp="acc" hidden><div class="accgroups">${Object.keys(gAcc).map((g) => `<div class="accg" style="--c:${DB.groups[g][2]}"><button class="ghead" data-g="${g}" title="กดเพื่อเลือก / ยกเลิกทั้งกลุ่ม"><span class="dot" style="background:${DB.groups[g][2]}"></span><b>${esc(DB.groups[g][1].split(" (")[0])}</b><span class="n" data-gn="${g}"></span></button>
        ${gAcc[g].map((i) => { const a = DB.accounts[i]; return `<label title="${a.bank} ${a.acc}"><input type="checkbox" data-a="${i}"><span>${esc(a.name)}</span><small>${a.bank} ${a.acc}</small></label>`; }).join("")}</div>`).join("")}</div></div>
   <div class="ddp" data-ddp="kind" hidden><div class="frow">${DB.kinds.map((k, i) => `<button class="chip" data-k="${i}"><span class="dot" style="background:${KCOL[i]}"></span>${k}</button>`).join("")}</div></div>
   <div class="ddp" data-ddp="cpg" hidden><div class="frow">${usedCpg.map((g) => `<button class="chip" data-c="${g}"><span class="dot" style="background:${DB.groups[g][2]}"></span>${esc(DB.groups[g][1].split(" (")[0])}</button>`).join("")}</div></div>
   <div class="ddp" data-ddp="cash" hidden><div class="frow">${CPM_BTNS}</div>
     <div class="frow" id="pqRow" hidden><label>ประเภทคู่</label>${PQ_BTNS}</div>
     ${infoI("ยอดโอนตรง = ตาม statement (ถอนเงินสดยังเป็นถอนเงินสด) ; รวมคู่ถอน-ฝาก = รายการถอนเงินสดที่จับคู่กับการฝากได้ แสดงเป็นเงินเข้าบัญชีผู้ฝาก")}</div>
  </div>
  <div id="dnRes" class="dnres"></div>
  <h2>${IC("flow")} เส้นเงินตามตัวกรอง ${infoI("ยอดตาม statement ของบัญชีที่เลือก — การโอนระหว่างบัญชีที่มี statement ทั้งสองฝั่งจะปรากฏทั้งฝั่งออกและฝั่งเข้า ; เงินบริจาคเข้าบัญชีมูลนิธิเป็นยอดรวมรายเดือน · กดกล่องเพื่อกรอง · กล่องที่มี ▶ = บัญชีที่มี statement กดเพื่อคลี่ทอดถัดไป (กดได้หลายกล่อง กดซ้ำเพื่อเอาออก) · ไล่แบบเข้าก่อนออกก่อน = เงินที่เข้า ณ เวลาใด จับกับรายการเงินออกถัดไปตามเวลาจนครบยอด · ตามสัดส่วน = โอนออกตามสัดส่วนยอดที่ไล่มาต่อยอดคงเหลือ (ตรงกับรายงาน) · เป็นการไล่ตามลำดับเวลา (ข้อสันนิษฐาน) ไม่ใช่การระบุตัวเงิน")}</h2>
  <button class="fback" id="flBack" hidden title="ย้อนกลับ" aria-label="ย้อนกลับ">${IC("back", 20)}<span></span></button>
  <div class="fltools">
    <select id="flM" title="มุมมอง"><option value="g">แสดงเป็นกลุ่ม</option><option value="d">แสดงรายบัญชี</option></select>
    <select id="flN" title="จำนวนกล่องต่อคอลัมน์">${[8, 14, 24, 32].map((n) => `<option value="${n}">${n} กล่อง</option>`).join("")}</select>
    <select id="flC" title="จำนวนคอลัมน์ที่แสดงพร้อมกัน">${[3, 4, 5, 6, 8].map((n) => `<option value="${n}">${n} คอลัมน์</option>`).join("")}</select>
    <select id="flT" title="วิธีไล่เงินเมื่อกดกล่อง ▶ คลี่ทอดถัดไป (กดได้หลายกล่อง)"><option value="fifo">ไล่แบบ เข้าก่อนออกก่อน</option><option value="pro">ไล่แบบ ตามสัดส่วน (ตรงกับรายงาน)</option><option value="all">ทุกรายการในช่วง (ไม่ไล่)</option></select>
    <button class="ibx" id="flClr" hidden title="ยุบทอดที่คลี่ทั้งหมด" aria-label="ยุบทอด">${IC("shrink", 16)}</button></div>
  <div class="card flowcard"><div id="flow" class="flow"></div><div id="flTip" class="fltip" hidden></div></div>
  <div id="tlBox"></div>
  <div id="tCp"></div>
  <h2 id="txH">${IC("list")} รายการ <small id="txLab"></small> <span class="ibxs"><button class="ibx" id="txReset" title="กลับลำดับเดิม (วันที่-เวลา)" aria-label="กลับลำดับเดิม">${IC("reset", 16)}</button><button class="ibx" id="txXlsx" title="ส่งออก Excel" aria-label="ส่งออก Excel">${IC("xls", 16)}</button><button class="ibx" id="fCsv" title="ส่งออก CSV" aria-label="ส่งออก CSV">${IC("csv", 16)}</button></span></h2>
  <div class="tblwrap tbl1" id="tTx"></div>
  <p style="text-align:center"><button class="chip" id="more" title="แสดงเพิ่ม" aria-label="แสดงเพิ่ม">${IC("more", 16)}</button></p>
  <h2>ตามเวลา <small id="granLab"></small> <button class="ibx" id="gBtn" title="สลับ รายเดือน / รายปี" aria-label="สลับ รายเดือน / รายปี">${IC("swap", 16)}</button></h2>
  <div class="card"><div class="chartbox"><canvas id="cTime"></canvas></div></div>
  <div class="grid g2" style="margin-top:12px">
    <div><h2>ตามกลุ่มคู่โอน</h2><div class="card"><div class="chartbox tall"><canvas id="cCpg"></canvas></div></div></div>
    <div><h2>ตามบัญชี</h2><div class="card"><div class="chartbox tall"><canvas id="cAcc"></canvas></div></div></div>
  </div>
  `;
  const m = $("#main");
  const ddClose = () => { $$("[data-ddp]", m).forEach((p) => (p.hidden = true)); $$("[data-dd]", m).forEach((x) => x.classList.remove("open")); };
  m.onclick = (e) => {
    if (!e.target.closest("#fCard")) ddClose();
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.dd) { const p = $(`[data-ddp="${b.dataset.dd}"]`, m), was = p.hidden; ddClose(); p.hidden = !was; b.classList.toggle("open", was); return; }
    if (b.dataset.p) { const p = b.dataset.p; F.from = p === "after" ? DB.cut : /^\d+$/.test(p) ? p + "-01-01" : DB.lo; F.to = p === "before" ? "2022-06-24" : /^\d+$/.test(p) ? p + "-12-31" : DB.hi; $("#fFrom").value = F.from; $("#fTo").value = F.to; }
    else if (b.dataset.g) { const ids = gAcc[b.dataset.g]; const all = ids.every((i) => F.accs.has(i)); ids.forEach((i) => (all ? F.accs.delete(i) : F.accs.add(i))); }
    else if (b.dataset.k) tog(F.kinds, +b.dataset.k);
    else if (b.dataset.c) tog(F.cpg, +b.dataset.c);
    else if (b.id === "fClear") { resetF(); return pAna(); }
    else if (b.id === "fCsv") return csv();
    else if (b.id === "gBtn") F.gran = (F._g === "y") ? "m" : "y";
    else if (b.id === "more") { SHOWN += 300; return upd(true); }
    else if (b.id === "txReset") { TXS = TXS0(); return upd(true); }
    else if (b.id === "txXlsx") return txXlsx();
    else if (b.dataset.cs) F.cps = b.dataset.cs;
    else if (b.dataset.fm) F.flm = b.dataset.fm;
    else if (b.dataset.cm) { FHIST.push(fSnap()); F.cpm = b.dataset.cm; }
    else if (b.dataset.pq != null) { FHIST.push(fSnap()); const q = +b.dataset.pq; if (!q) F.pq.clear(); else { tog(F.pq, q); if (F.cpm === "raw") F.cpm = "all"; } }
    else if (b.dataset.fn) F.fln = +b.dataset.fn;
    else if (b.dataset.fc) F.flc = +b.dataset.fc;
    else if (b.id === "flClr") { FHIST.push(fSnap()); F.chain = []; }
    else if (b.id === "flBack" || b.closest("#flBack")) { if (!FHIST.length) return; F = FHIST.pop(); $("#fFrom").value = F.from; $("#fTo").value = F.to; $("#fQ").value = F.q; $("#fMin").value = F.min || ""; const y = F._y; delete F._y; if (y != null) { upd(); setTimeout(() => scrollTo({ top: y }), 30); return; } }
    else if (b.id === "dnGo") return donorSearch($("#dnQ").value);
    else if (b.dataset.dn != null) return donorDetail(+b.dataset.dn);
    else if (b.dataset.dnb != null) return donorSearch($("#dnQ").value);
    else return;
    SHOWN = 200; upd();
  };
  $("#dnQ").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); donorSearch(e.target.value); } };
  $("#dnQ").oninput = (e) => { if (e.target.value.trim()) return; $("#dnRes").innerHTML = ""; if (F.dn) { F.dn = false; DNT = null; upd(); } };   // ลบข้อความค้นหา = ปิดผลค้นหาผู้บริจาค
  m.onchange = (e) => { const t = e.target;
    if (t.id === "fFrom") F.from = t.value || DB.lo; else if (t.id === "fTo") F.to = t.value || DB.hi; else if (t.dataset.a) tog(F.accs, +t.dataset.a, t.checked);
    else if (t.id === "flM") F.flm = t.value; else if (t.id === "flN") F.fln = +t.value; else if (t.id === "flC") F.flc = +t.value; else if (t.id === "flT") F.flt = t.value === "all" ? false : t.value;
    else if (t.id === "fYr") { if (!t.value) return; F.from = t.value + "-01-01"; F.to = t.value + "-12-31"; $("#fFrom").value = F.from; $("#fTo").value = F.to; }
    else return; upd(); };
  let tmr; m.oninput = (e) => { const t = e.target; if (t.id !== "fMin" && t.id !== "fQ") return; clearTimeout(tmr); tmr = setTimeout(() => { F.min = +$("#fMin").value || 0; F.q = $("#fQ").value; upd(); }, 280); };
  const tog = (s, v, on) => ((on ?? !s.has(v)) ? s.add(v) : s.delete(v));
  let IDX = [], SORTED = [];
  ANA_UPD = () => upd();
  function txXlsx() {                                                  // ส่งออก Excel (.xlsx) ทุกแถวที่กรอง เรียงตามที่ตั้งไว้ (ผู้สั่งงาน 18 พ.ย. 69)
    const H = ["วันที่", "เวลา", "ธนาคาร", "เลขบัญชี", "ชื่อบัญชี", "ประเภทรายการ", "ยอด (บาท)", "ครั้ง", "บัญชีคู่โอน", "ธนาคารคู่โอน", "ชื่อคู่โอน", "กลุ่มคู่โอน", "คู่ถอน-ฝาก"];
    const rows = (SORTED.length ? SORTED : IDX).map((i) => { const r = DB.tx[i], a = DB.accounts[r[0]], c = DB.cps[cpOf(i)], iso = min2iso(r[1]), q = txQ(i);
      return [iso.slice(0, 10), txT(i), a.bank, a.acc, a.name, DB.kinds[r[2]], r[3], r[5] || 1, c[0] || "", c[2] || "", c[1] || "", DB.groups[c[3]][1], q ? DB.pk[q] : ""]; });
    download2(`รายการที่กรอง ${F.from} ถึง ${F.to}.xlsx`, xlsxBlob("รายการ", [H, ...rows], [12, 9, 8, 15, 32, 22, 15, 7, 18, 10, 32, 30, 34]));
    toast(`ส่งออก ${fmt0(rows.length)} แถว`);
  }
  function csv() {
    const L = ["วันเวลา,ธนาคาร,บัญชี,ชื่อบัญชี,ประเภทรายการ,ยอด,ครั้ง,บัญชีคู่โอน,ธนาคารคู่โอน,ชื่อคู่โอน,กลุ่มคู่โอน"];
    const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    IDX.forEach((i) => { const r = DB.tx[i], a = DB.accounts[r[0]], c = DB.cps[cpOf(i)]; L.push([min2iso(r[1]).slice(0, 10) + " " + txT(i), a.bank, q("'" + a.acc), q(a.name), DB.kinds[r[2]], r[3], r[5] || 1, q(c[0] ? "'" + c[0] : ""), c[2], q(c[1]), q(DB.groups[c[3]][1])].join(",")); });
    download("รายการที่กรอง.csv", L.join("\r\n"), "text/csv");
  }
  function upd(tableOnly) {
    IDX = filterTx();
    const K = DB.kinds.map(() => [0, 0]), byG = {}, byA = {}, byC = new Map(), byT = new Map(), pair = new Map();
    const span = (+F.to.slice(0, 4) * 12 + +F.to.slice(5, 7)) - (+F.from.slice(0, 4) * 12 + +F.from.slice(5, 7));
    const gy = F.gran === "y" || (F.gran === "auto" && span > 47); F._g = gy ? "y" : "m";
    for (const i of IDX) {
      const r = DB.tx[i], k = r[2], amt = r[3], n = r[5] || 1, ci = cpOf(i), c = DB.cps[ci], inn = IN_K.includes(k) ? 0 : 1;
      K[k][0] += amt; K[k][1] += n;
      const pk = ci * 64 + r[0]; let pv = pair.get(pk); if (!pv) pair.set(pk, (pv = [0, 0, 0, 0])); pv[inn] += amt; pv[2 + inn] += n;
      (byG[c[3]] = byG[c[3]] || [0, 0])[inn] += amt;
      (byA[r[0]] = byA[r[0]] || [0, 0])[inn] += amt;
      let o = byC.get(ci); if (!o) byC.set(ci, (o = [0, 0, 0])); o[inn] += amt; o[2] += n;
      const tk = gy ? Math.floor(TXM[i] / 12) : TXM[i]; let t = byT.get(tk); if (!t) byT.set(tk, (t = [0, 0, 0, 0, 0])); t[k] += amt;
    }
    const tin = K[0][0] + K[1][0] + K[4][0], tout = K[2][0] + K[3][0];
    $("#aKpi").innerHTML = [["เงินเข้ารวม", tin, K[0][1] + K[1][1] + K[4][1], ""], ["เงินออกรวม", tout, K[2][1] + K[3][1], "r"], ["ถอนเงินสด", K[3][0], K[3][1], "x"], ["ฝากเงินสด", K[1][0], K[1][1], "g"], ["โอนออก / จ่าย", K[2][0], K[2][1], "r"], ["โอนเข้า / รับเงิน", K[0][0], K[0][1], ""], ["รับบริจาค", K[4][0], K[4][1], "y"], ["สุทธิ (เข้า − ออก)", tin - tout, IDX.length, ""]]
      .map(([l, v, n, c]) => `<div class="card kpi ${c}"><div class="l">${l}</div><div class="v">${M(v)}</div><div class="s">${fmt(v)} บาท</div><div class="s">${fmt0(n)} ${l.startsWith("สุทธิ") ? "แถวข้อมูล" : "ครั้ง"}</div></div>`).join("");
    $("#fSum").textContent = `${fmt0(IDX.length)} แถว`;
    { const yr = F.from.slice(5) === "01-01" && F.to === F.from.slice(0, 4) + "-12-31" ? F.from.slice(0, 4) : "";
      const pk_ = F.from <= DB.lo && F.to >= DB.hi ? "all" : F.from <= DB.lo && F.to === "2022-06-24" ? "before" : F.from === DB.cut && F.to >= DB.hi ? "after" : "";
      const gl = (g) => DB.groups[g][1].split(" (")[0];
      const L = { per: [pk_ === "all" ? "ทุกช่วงเวลา" : pk_ === "before" ? "ก่อนตั้งมูลนิธิ" : pk_ === "after" ? "หลังตั้งมูลนิธิ" : yr ? "ปี " + (+yr + 543) : `${dTh(F.from)} – ${dTh(F.to)}`, pk_ !== "all"],
        acc: [F.accs.size === 1 ? DB.accounts[[...F.accs][0]].name : F.accs.size ? `บัญชี ${F.accs.size}` : "ทุกบัญชี", F.accs.size > 0],
        kind: [F.kinds.size === 1 ? DB.kinds[[...F.kinds][0]].split(" (")[0] : F.kinds.size ? `ประเภทรายการ ${F.kinds.size}` : "ทุกประเภทรายการ", F.kinds.size > 0],
        cpg: [F.cpg.size === 1 ? "คู่โอน: " + gl([...F.cpg][0]) : F.cpg.size ? `กลุ่มคู่โอน ${F.cpg.size}` : "ทุกกลุ่มคู่โอน", F.cpg.size > 0],
        cash: [F.cpm === "raw" ? "ยอดโอนตรง" : (F.cpm === "pair" ? "เฉพาะคู่ถอน-ฝาก" : "รวมคู่ถอน-ฝาก") + (F.pq.size ? ` · ${F.pq.size} ประเภท` : ""), F.cpm !== "raw"] };
      $$("[data-dd]", m).forEach((b_) => { const v = L[b_.dataset.dd]; b_.firstElementChild.textContent = v[0]; b_.classList.toggle("on", v[1]); });
      $$("[data-p]", m).forEach((b_) => b_.classList.toggle("on", b_.dataset.p === pk_));
      $("#fYr").value = yr && !pk_ ? yr : "";
      $("#pqRow").hidden = F.cpm === "raw";
      $("#fMin").classList.toggle("on", F.min > 0);
      $("#fClear").hidden = !(pk_ !== "all" || F.accs.size || F.kinds.size || F.cpg.size || F.min || F.q || F.cpm !== "raw" || F.pq.size || F.dn);
      $("#flM").value = F.flm; $("#flN").value = F.fln; $("#flC").value = F.flc; $("#flT").value = F.flt === false ? "all" : F.flt === "pro" ? "pro" : "fifo"; }
    $$("[data-k]", m).forEach((b) => b.classList.toggle("on", F.kinds.has(+b.dataset.k)));
    $$("[data-c]", m).forEach((b) => b.classList.toggle("on", F.cpg.has(+b.dataset.c)));
    $$("[data-g]", m).forEach((b) => b.classList.toggle("on", gAcc[b.dataset.g].every((i) => F.accs.has(i))));
    $$("[data-a]", m).forEach((b) => (b.checked = F.accs.has(+b.dataset.a)));
    $$("[data-gn]", m).forEach((e) => { const ids = gAcc[e.dataset.gn]; e.textContent = `${ids.filter((i) => F.accs.has(i)).length}/${ids.length}`; });
    $$("button[data-cs]", m).forEach((b) => b.classList.toggle("on", F.cps === b.dataset.cs));
    $$("[data-fm]", m).forEach((b) => b.classList.toggle("on", F.flm === b.dataset.fm));
    $$("[data-cm]", m).forEach((b) => b.classList.toggle("on", F.cpm === b.dataset.cm));
    $$("[data-pq]", m).forEach((b) => { const q = +b.dataset.pq; b.classList.toggle("on", q ? F.pq.has(q) : !F.pq.size); b.disabled = F.cpm === "raw"; });
    $$("[data-fn]", m).forEach((b) => b.classList.toggle("on", F.fln === +b.dataset.fn));
    $$("[data-fc]", m).forEach((b) => b.classList.toggle("on", F.flc === +b.dataset.fc));
    { const c_ = $("#flClr"); if (c_) c_.hidden = !F.chain.length; }
    { const fb_ = $("#flBack"); if (fb_) { fb_.hidden = !FHIST.length; fb_.querySelector("span").textContent = FHIST.length > 1 ? FHIST.length : ""; } }
    drawFlow($("#flow"), pair); ONRS = () => TAB === "ana" && drawFlow($("#flow"), pair);
    tlRender();
    // ตาราง
    // คู่โอนรายใหญ่ (ผู้ใช้สั่ง 19 พ.ย. 69): ตารางรายการกลาง XT — เลือก 50 / 100 / 200 / ทุกรายการ + ค้นหาชื่อคู่โอน + ตัวกรองกลุ่ม/ธนาคาร + เรียง + กรองรายคอลัมน์ ; กดแถว = ใช้เป็นคำค้นของหน้า
    const cpRows = [...byC.entries()].filter((x) => x[1][0] + x[1][1] > 0).map(([ci, v]) => { const c = DB.cps[ci]; return { ci, nm: c[1] || "", acc: c[0] || "", bank: c[2] || "", g: c[3], gl: DB.groups[c[3]][1].split(" (")[0], i: v[0], o: v[1], n: v[2], t: v[0] + v[1] }; });
    xtMount($("#tCp"), { id: "anaCp", title: "คู่โอนรายใหญ่ (ตามตัวกรองของหน้า)", ph: "ค้นหาชื่อคู่โอน / เลขบัญชี / ธนาคาร", rows: cpRows, lims: [50, 100, 200, 0], xl: "คู่โอนรายใหญ่ (ตามตัวกรอง)",
      search: (r) => `${r.nm} ${r.acc} ${r.bank} ${r.gl}`, sort0: [[7, -1]], sum: (R) => `เข้า ${M(R.reduce((t, r) => t + r.i, 0))} · ออก ${M(R.reduce((t, r) => t + r.o, 0))}`,
      cols: [["#", () => 0, "n"], ["คู่โอน", (r) => r.nm, "t", (r) => (r.nm ? `<b style="font-weight:600">${esc(r.nm)}</b>` : `<span class="muted">ไม่ระบุชื่อ</span>`)], ["บัญชี", (r) => `${r.bank} ${r.acc}`.trim(), "t"],
        ["กลุ่ม", (r) => r.gl, "t", (r) => `<span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${DB.groups[r.g][2]}"></span> ${esc(r.gl)}`],
        ["เงินเข้า (บาท)", (r) => r.i, "a", (r) => (r.i ? fmt(r.i) : "")], ["เงินออก (บาท)", (r) => r.o, "a", (r) => (r.o ? fmt(r.o) : "")], ["ครั้ง", (r) => r.n, "a", (r) => fmt0(r.n)], ["รวมเข้า + ออก", (r) => r.t, "a", (r) => fmt(r.t)]],
      facets: [["g", "ทุกกลุ่มคู่โอน", (r) => r.gl, [...new Map(cpRows.map((r) => [r.gl, DB.groups[r.g][2]])).entries()].map(([l, c]) => [l, l, c])], ["bank", "ทุกธนาคาร", (r) => r.bank || "(ไม่ระบุ)"]],
      rowAttr: () => 'class="click" title="ดูรายการของคู่โอนนี้"', onRow: (r) => { const s = fSnap(); s._y = scrollY; FHIST.push(s); F.q = r.acc || r.nm; $("#fQ").value = F.q; upd(); setTimeout(() => { const t = $("#txH"); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30); } });
    SORTED = txSort(IDX);
    const big = SORTED.slice(0, SHOWN);
    $("#txLab").textContent = `${fmt0(big.length)} / ${fmt0(IDX.length)} แถว · ${TXS.map(([k, d]) => `${TXC[k]} ${d > 0 ? "↑" : "↓"}`).join(" , ")}`;
    $("#more").hidden = big.length >= IDX.length;
    const th = (k, l, cls) => { const n = TXS.findIndex((x) => x[0] === k); return `<th class="srt ${cls || ""} ${n >= 0 ? "on" : ""}" data-ts="${k}">${l}${n >= 0 ? ` <small>${TXS[n][1] > 0 ? "▲" : "▼"}${TXS.length > 1 ? n + 1 : ""}</small>` : ""}</th>`; };
    $("#tTx").innerHTML = `<table><tr>${th("t", "วันเวลา")}${th("a", "บัญชี")}${th("k", "ประเภท")}${th("v", "ยอด (บาท)", "n")}${th("c", "คู่โอน")}${th("g", "กลุ่มคู่โอน")}</tr>` +
      big.map((i) => { const r = DB.tx[i], a = DB.accounts[r[0]], c = DB.cps[cpOf(i)], iso = min2iso(r[1]), q = txQ(i); return `<tr class="click" data-ti="${i}" title="กดเพื่อไล่เงินเป็นทอดจากรายการนี้ (Timeline ด้านบน)"><td>${dTh(iso)} ${txT(i)}</td><td>${esc(a.name)} <small class="muted">${a.bank} ${a.acc}</small></td><td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${KCOL[r[2]]}"></span> ${DB.kinds[r[2]].split(" (")[0]}</td><td class="n">${fmt(r[3])}</td><td>${esc(c[1])} ${c[2]} ${c[0]}${q && F.cpm !== "raw" && pqOn(q) ? `<br><small style="color:${PKC[q]}">● คู่ถอน-ฝาก: ${esc(DB.pk[q])}${DB.txp && DB.txp[i] ? ` — ถอน ${fmt(DB.txp[i][0])} บาท ฝาก ${fmt(DB.txp[i][1])} บาท` : ""}</small>` : ""}</td><td>${esc(DB.groups[c[3]][1].split(" (")[0])}</td></tr>`; }).join("") + "</table>";
    $("#tTx").onclick = (e) => { const h = e.target.closest("th[data-ts]");
      if (!h) { const tr = e.target.closest("tr[data-ti]"); if (tr) { TLS.hist.push(TLS.seed); TLS.keep = true; TLS.seed = tlSeedTx(+tr.dataset.ti); TLS.v = "lst"; TLS.open = true; tlRender(); $("#tlBox").scrollIntoView({ behavior: "smooth", block: "start" }); } return; } const k = h.dataset.ts, n = TXS.findIndex((x) => x[0] === k);
      if (n < 0) TXS.push([k, k === "v" ? -1 : 1]); else if (TXS[n][1] === (k === "v" ? -1 : 1)) TXS[n][1] *= -1; else TXS.splice(n, 1);
      if (!TXS.length) TXS = TXS0(); SHOWN = 200; upd(true); };
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
    CH.cpg = hb("#cCpg", gs, (k) => DB.groups[k[0]][1].split(" (")[0], null, (g) => { FHIST.push(fSnap()); tog(F.cpg, +g); upd(); });
    const as = Object.entries(byA).sort((x, y) => (y[1][0] + y[1][1]) - (x[1][0] + x[1][1])).slice(0, 14);
    CH.acc = hb("#cAcc", as, (k) => { const a = DB.accounts[k[0]]; return `${a.name.slice(0, 26)} (${a.bank} ${a.acc})`; }, null, (a) => { FHIST.push(fSnap()); tog(F.accs, +a); upd(); });
  }
  const fb = $("#flow"), tip = $("#flTip");
  fb.onmousemove = (e) => { const t = e.target.closest("[data-tip]"); if (!t) { tip.hidden = true; return; } tip.textContent = t.dataset.tip; tip.hidden = false; tip.style.left = Math.max(4, Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 14)) + "px"; tip.style.top = (e.clientY + 16) + "px"; };
  fb.onmouseleave = () => (tip.hidden = true);
  fb.onclick = (e) => {
    if (e.target.closest("[data-dnoff]")) { F.dn = false; DNT = null; tip.hidden = true; return upd(); }
    const g = e.target.closest("[data-n]"); if (!g || F.dn) { const t = e.target.closest("[data-tip]"); if (t) toast(t.dataset.tip); return; }
    const col = +g.dataset.n.split(":")[0], id = g.dataset.n.split(":")[1], k = +id.slice(1);
    if (col >= 2 && id !== "o" && srcAccs(id).length) { FHIST.push(fSnap()); const at = col - 2;
      const C = (F.chain || []).map((a) => (Array.isArray(a) ? [...a] : [a])), S = C[at] || [];
      if (S.includes(id)) { const S2 = S.filter((x) => x !== id); F.chain = S2.length ? C.slice(0, at).concat([S2], C.slice(at + 1)) : C.slice(0, at); }
      else { C[at] = S.concat([id]); F.chain = C.slice(0, at + 1).concat(C.slice(at + 1)); }
      tip.hidden = true; return upd(); }
    if (col >= 3) { toast("บัญชีนี้ยังไม่มี statement จึงไล่ทอดต่อไม่ได้"); return; }
    if ("gcGa".includes(id[0])) FHIST.push(fSnap());
    if (id[0] === "g") tog(F.cpg, k);
    else if (id[0] === "c") { const cp = DB.cps[k]; F.q = cp[0] || cp[1]; $("#fQ").value = F.q; }
    else if (id[0] === "G") { const ids = gAcc[k] || [], all = ids.every((i) => F.accs.has(i)); ids.forEach((i) => (all ? F.accs.delete(i) : F.accs.add(i))); }
    else if (id[0] === "a") tog(F.accs, k);
    else return;
    tip.hidden = true; upd();
  };
  upd();
}

/* ---------- ค้นหาผู้บริจาค (donors.enc โหลดเมื่อใช้ ; ผู้สั่งงาน 18 พ.ย. 69) ---------- */
let DN = null, DNH = [];
async function loadDonors() {
  if (DN) return DN;
  const f = await fetchEnc("donors.enc");
  DN = await gunzipJSON(await decrypt(KEY, f));
  DN.t1s = DN.t1.map((t) => (t.match(/\d{10}/) || [t])[0].replace(/^(\d{3})(\d)(\d{5})(\d)$/, "$1-$2-$3-$4"));
  return DN;
}
const dnDay = (d) => { if (d < 0) return ""; const t = new Date(Date.UTC(2015, 0, 1) + d * 864e5); return `${t.getUTCDate()} ${MTH[t.getUTCMonth() + 1]} ${String(t.getUTCFullYear() + 543).slice(2)}`; };
async function donorSearch(q) {
  const box = $("#dnRes"); q = String(q || "").trim();
  if (q.length < 3) { box.innerHTML = '<p class="muted">พิมพ์ชื่อ หรือ เลขบัญชี อย่างน้อย 3 ตัวอักษร</p>'; return; }
  box.innerHTML = '<p class="muted">กำลังถอดรหัสข้อมูลผู้บริจาค…</p>';
  let D; try { D = await loadDonors(); } catch (e) { box.innerHTML = `<p class="muted">โหลดข้อมูลผู้บริจาคไม่ได้: ${esc(e.message)}</p>`; return; }
  const ql = q.toLowerCase().replace(/[\s-]/g, ""), agg = new Map();
  D.d.forEach((d, i) => { if ((d[0] + d[2]).toLowerCase().replace(/[\s-]/g, "").includes(ql)) agg.set(i, { t: 0, n: 0, by: D.t1.map(() => 0), f: 1e9, l: -1 }); });
  for (const x of D.x) { const a = agg.get(x[0]); if (!a) continue; a.t += x[4]; a.n += x[5]; a.by[x[1]] += x[4]; if (x[2] >= 0) { a.f = Math.min(a.f, x[2]); a.l = Math.max(a.l, x[2]); } }
  DNH = [...agg.entries()].sort((a, b) => b[1].t - a[1].t);
  const tot = DNH.reduce((s, [, a]) => s + a.t, 0);
  box.innerHTML = !DNH.length ? `<p class="muted">ไม่พบ "${esc(q)}" ในผู้บริจาค ${fmt0(D.d.length)} บัญชี</p>` :
    `<p class="muted" style="font-size:.84rem">พบ ${fmt0(DNH.length)} บัญชี รวม ${fmt(tot)} บาท${DNH.length > 100 ? " (แสดง 100 อันดับแรก)" : ""}</p>
    <div class="tblwrap tbl1"><table><tr><th>#</th><th>ผู้บริจาค</th><th>บัญชี</th><th>ประเภท</th>${D.t1s.map((t) => `<th class="n">เข้า ${t}</th>`).join("")}<th class="n">รวม (บาท)</th><th class="n">ครั้ง</th><th>ช่วงเวลา</th></tr>
    ${DNH.slice(0, 100).map(([i, a], k) => { const d = D.d[i]; return `<tr class="click" data-dnr="${i}"><td>${k + 1}</td><td>${esc(d[2]) || '<span class="muted">ไม่ระบุชื่อ</span>'}</td><td>${esc(d[1])} ${esc(d[0])}</td><td>${esc(d[3])}</td>${a.by.map((v) => `<td class="n">${v ? fmt(v) : ""}</td>`).join("")}<td class="n"><b>${fmt(a.t)}</b></td><td class="n">${fmt0(a.n)}</td><td>${dnDay(a.f)} – ${dnDay(a.l)}</td></tr>`; }).join("")}</table></div>`;
  if (DNH.length) { box.insertAdjacentHTML("afterbegin", `<p style="margin:6px 0"><button class="btn" id="dnAll">${IC("flow", 15)} แสดงเส้นเงินของผลค้นหานี้ (${fmt0(Math.min(DNH.length, 300))} บัญชี) ในชาร์ตเส้นเงิน</button></p>`);
    donorShow(DNH.slice(0, 300).map((x) => x[0]), DNH.length === 1 ? (D.d[DNH[0][0]][2] || D.d[DNH[0][0]][0]) : `ผลค้นหา "${q}" ${fmt0(Math.min(DNH.length, 300))} บัญชี`); }
  box.onclick = (e) => { if (e.target.closest("#dnAll")) return donorShow(DNH.slice(0, 300).map((x) => x[0]), `ผลค้นหา "${q}" ${fmt0(Math.min(DNH.length, 300))} บัญชี`);
    const tr = e.target.closest("tr[data-dnr]"); if (tr) donorDetail(+tr.dataset.dnr); };
}
function dnFlow(el, hits, D) {                                          // ชาร์ต 2 คอลัมน์: ผู้บริจาค (12 อันดับ + อื่นๆ) -> บัญชีรับบริจาค
  const top = hits.slice(0, 12), rest = hits.slice(12), L = top.map(([i, a]) => ({ lab: D.d[i][2] || `${D.d[i][1]} ${D.d[i][0]}`, sub: `${D.d[i][1]} ${D.d[i][0]}`, v: a.t, by: a.by }));
  if (rest.length) L.push({ lab: `ผู้บริจาครายอื่น ${fmt0(rest.length)} บัญชี`, sub: "", v: rest.reduce((t, [, a]) => t + a.t, 0), by: D.t1.map((_, k) => rest.reduce((t, [, a]) => t + a.by[k], 0)) });
  const R = D.t1.map((t, k) => ({ lab: t.replace(/^KBANK \d+ /, ""), sub: D.t1s[k], v: L.reduce((s_, x) => s_ + x.by[k], 0), col: ["#1A237E", "#1565C0", "#26C6DA"][k] || "#1565C0" })).filter((x) => x.v > 0);
  const W = Math.max(640, el.clientWidth || 800), LW = W > 900 ? 300 : 180, bw = 14, pad = 6, tot = L.reduce((s_, x) => s_ + x.v, 0) || 1;
  const H0 = Math.max(260, L.length * 30), sc = (H0 - pad * Math.max(L.length - 1, R.length - 1)) / tot;
  let y = 22; L.forEach((n) => { n.h = Math.max(16, n.v * sc); n.y = y; n.o = y; y += n.h + pad; });
  let y2 = 22; R.forEach((n) => { n.h = Math.max(16, n.v * sc); n.y = y2; n.o = y2; y2 += n.h + pad; });
  const H = Math.max(y, y2), xL = LW, xR = W - LW - bw, cut = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
  let svg = `<text x="${xL + bw}" y="13" text-anchor="end" class="flh">ผู้บริจาค</text><text x="${xR}" y="13" class="flh">บัญชีรับบริจาค</text>`;
  L.forEach((n) => { R.forEach((r, k0) => { const k = D.t1.findIndex((t) => t.replace(/^KBANK \d+ /, "") === r.lab); const v = n.by[k] || 0; if (!v) return; const th = Math.max(1, v * sc), y0 = n.o + th / 2, y1 = r.o + th / 2, mx = (xL + bw + xR) / 2;
    n.o += th; r.o += th; svg += `<path class="fl" d="M${xL + bw},${y0.toFixed(1)} C${mx},${y0.toFixed(1)} ${mx},${y1.toFixed(1)} ${xR},${y1.toFixed(1)}" stroke="${r.col}" stroke-width="${th.toFixed(1)}" data-tip="${esc(n.lab)} → ${esc(r.sub)} : ${fmt(v)} บาท"/>`; }); });
  L.forEach((n) => { svg += `<g data-tip="${esc(n.lab)} ${esc(n.sub)} : ${fmt(n.v)} บาท"><rect x="${xL}" y="${n.y.toFixed(1)}" width="${bw}" height="${n.h.toFixed(1)}" rx="3" fill="#F9A825"/><text x="${xL - 6}" y="${(n.y + n.h / 2 + 4).toFixed(1)}" text-anchor="end" class="fl1">${esc(cut(n.lab, W > 900 ? 34 : 20))} <tspan class="fl2">${M(n.v)}</tspan></text></g>`; });
  R.forEach((n) => { svg += `<g data-tip="${esc(n.sub)} ${esc(n.lab)} : ${fmt(n.v)} บาท"><rect x="${xR}" y="${n.y.toFixed(1)}" width="${bw}" height="${n.h.toFixed(1)}" rx="3" fill="${n.col}"/><text x="${xR + bw + 6}" y="${(n.y + n.h / 2 - 3).toFixed(1)}" class="fl1">${esc(cut(n.sub, 20))}</text><text x="${xR + bw + 6}" y="${(n.y + n.h / 2 + 12).toFixed(1)}" class="fl2">${M(n.v)} · ${esc(cut(n.lab, 26))}</text></g>`; });
  el.innerHTML = `<svg width="${W}" height="${Math.ceil(H + 6)}" viewBox="0 0 ${W} ${Math.ceil(H + 6)}">${svg}</svg>`;
}
async function donorDetail(i) {
  const D = await loadDonors(), d = D.d[i], box = $("#dnRes");
  const rows = D.x.filter((x) => x[0] === i).sort((a, b) => a[2] - b[2] || String(a[3]).localeCompare(String(b[3])));
  const tot = rows.reduce((s, x) => s + x[4], 0), n = rows.reduce((s, x) => s + x[5], 0);
  donorShow([i], d[2] || `${d[1]} ${d[0]}`);
  box.innerHTML = `<p><button class="btn o" data-dnb="1">← กลับผลค้นหา</button> <span class="muted" style="font-size:.84rem">เส้นเงินของผู้บริจาครายนี้แสดงอยู่ในชาร์ต "เส้นเงินตามตัวกรอง" ด้านล่าง</span></p>
    <div class="grid g3"><div class="card kpi"><div class="l">${esc(d[2]) || "ไม่ระบุชื่อ"}</div><div class="v">${M(tot)}</div><div class="s">${esc(d[1])} ${esc(d[0])} · ${esc(d[3])}</div></div>
    ${D.t1s.map((t, k) => { const v = rows.filter((x) => x[1] === k).reduce((s, x) => s + x[4], 0); return v ? `<div class="card kpi y"><div class="l">เข้าบัญชี ${t}</div><div class="v">${M(v)}</div><div class="s">${fmt(v)} บาท</div></div>` : ""; }).join("")}</div>
    <div class="tblwrap tbl1" style="margin-top:8px"><table><tr><th>วันที่</th><th>เวลา</th><th>เข้าบัญชีรับบริจาค</th><th>ประเภทรายการ</th><th class="n">ยอด (บาท)</th><th class="n">ครั้ง</th></tr>
    ${rows.map((x) => `<tr><td>${dnDay(x[2])}</td><td>${esc(x[3])}</td><td>${esc(D.t1[x[1]])}</td><td>${esc(D.kinds[x[6]] || "")}</td><td class="n">${fmt(x[4])}</td><td class="n">${fmt0(x[5])}</td></tr>`).join("")}
    <tr><td colspan="4"><b>รวม</b></td><td class="n"><b>${fmt(tot)}</b></td><td class="n"><b>${fmt0(n)}</b></td></tr></table></div>
    <p class="muted" style="font-size:.8rem">แถวที่จำนวนครั้งมากกว่า 1 = ยอดรวมรายย่อย (ไฟล์ Pivot ไม่แตกรายการ) — รายครั้งดูในไฟล์ EDIT</p>`;
  const mon = new Map(); for (const x of rows) { if (x[2] < 0) continue; const t = new Date(Date.UTC(2015, 0, 1) + x[2] * 864e5), k = t.getUTCFullYear() * 12 + t.getUTCMonth(); let o = mon.get(k); if (!o) mon.set(k, (o = D.t1.map(() => 0))); o[x[1]] += x[4]; }
  const ks = [...mon.keys()].sort((a, b) => a - b);
  if (ks.length) { box.insertAdjacentHTML("beforeend", `<div class="card" style="margin-top:8px"><div class="lab" style="margin:0 0 4px">ยอดบริจาครายเดือน — ${esc(d[2] || d[0])}</div><div class="chartbox"><canvas id="cDn"></canvas></div></div>`);
    CH.dn && CH.dn.destroy(); CH.dn = new Chart($("#cDn"), { type: "bar", data: { labels: ks.map((k) => `${MTH[k % 12 + 1]} ${String(Math.floor(k / 12) + 543).slice(2)}`),
      datasets: D.t1.map((t, j) => ({ label: D.t1s[j], data: ks.map((k) => mon.get(k)[j]), backgroundColor: ["#1A237E", "#1565C0", "#26C6DA"][j], stack: "s" })).filter((ds) => ds.data.some((v) => v)) },
      options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "บาท" } } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} ${fmt(c.raw)}` } } } } }); }
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
      home: "เรื่องราวคดีโดยย่อ", brief: DB.formal ? `${Object.keys(DB.formal.suspects).length} ผู้ต้องหา · 9 บท` : "", recs: `${(C.recs || []).length} ข้อ · เสร็จ ${(C.recs || []).filter((r) => r.status === "เสร็จแล้ว").length}`,
      over: M(DB.over.donor_in) + " เงินเข้า 3 บัญชี", case: `${(C.events || []).length} เหตุการณ์`, charges: `${C.charges.length} ราย`, defences: `${C.defences.length} ประเด็น`,
      work: (() => { const R = workRows(); return `เสร็จ ${R.filter((r) => r.st === "done").length}/${R.length} งาน`; })(),
      asset: `${M(S.reduce((t, s) => t + s.tot[0] + s.tot[1], 0))} · อายัด ${M(fz.reduce((t, r) => t + r.amt, 0))}`,
      cc: DB.cc ? `${M(DB.cc.total)} · ${fmt0(DB.cc.n)} รายการ` : "",
      ppl: `${people().length} ราย · ${imgBy((i) => i.cat === "บุคคล").length} ภาพ`,
      acct: `${DB.accounts.length} บัญชีมี STM · ขอแล้ว ${A.length} · อายัด ${fz.length} บัญชี`,
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

/* ---------- เครื่องไล่เงินเป็นทอดกลาง (ชาร์ตเส้นเงิน + Timeline ใช้ร่วมกัน ; ผู้ใช้สั่ง 19 พ.ย. 69) ----------
   runTrace(items, mode, cont, maxHop, boxOf) -> { P, cut }
   items: [{ i, amt }] = รายการโอนออกทอด 1 (ต้นสาย) หรือ [{ ai, t, amt }] = เงินเข้าบัญชี ai ณ เวลา t
   mode "fifo" = เข้าก่อนออกก่อน: เงินที่เข้าบัญชี ณ เวลาใด จับกับรายการเงินออกของบัญชีนั้นตั้งแต่เวลานั้น เรียงตามเวลาจนครบยอด (รายการเงินออก 1 รายการใช้ได้ไม่เกินยอดของมัน)
   mode "pro"  = ตามสัดส่วน (กติกาเดียวกับ Timeline กรรมฟอกเงินในรายงาน): ไล่ทุกรายการของทุกบัญชีตามลำดับเวลาจริง เงินที่ไล่มาในบัญชีถูกโอนออกตามสัดส่วน
                 ยอดที่ไล่มา : ยอดคงเหลือในบัญชี ณ เวลาโอน (ยอดคงเหลือคำนวณจากรายการใน statement ; ถ้าต่ำกว่ายอดที่ไล่มา ถือว่าเงินที่โอนออกมาจากยอดที่ไล่มาก่อน)
   ทั้งสองแบบใช้บัญชีคุมยอดชุดเดียวทุกสาย จึงไม่นับรายการเงินออกซ้ำ และยอดปลายสายรวม = ยอดต้นสาย ; เป็นข้อสันนิษฐานตามลำดับเวลา ไม่ใช่การระบุตัวเงิน
   cont(hop, ci) = เงินที่โอนไปคู่โอน ci ในทอด hop ไล่ต่อหรือไม่ (ชาร์ต = เฉพาะกล่องที่คลี่ / Timeline = ทุกสาย) ; boxOf(ci) = รหัสกล่องสำหรับชาร์ต */
let TXORD = null;
function txOrder() {                                                    // ทุกรายการเรียงตามเวลา (เงินเข้าก่อนเงินออกในนาทีเดียวกัน) — สร้างครั้งเดียว
  if (TXORD) return TXORD;
  const n = DB.tx.length, o = new Int32Array(n); for (let i = 0; i < n; i++) o[i] = i;
  TXORD = o.sort((a, b) => DB.tx[a][1] - DB.tx[b][1] || (IN_K.includes(DB.tx[b][2]) - IN_K.includes(DB.tx[a][2])) || a - b);
  return TXORD;
}
function runTrace(items, mode, cont, maxHop, boxOf) {
  const P = []; let cut = false;
  const endOf = (i, dai, from, hop, ci) => (dai < 0 ? (DB.tx[i][2] === 3 ? "ถอนเงินสด" : "ปลายทางไม่มี statement") : dai === from ? "โอนภายในบัญชีเดียวกัน"
    : hop >= maxHop ? `ถึงทอดที่ ${maxHop} (หยุดไล่)` : !cont(hop, ci) ? "ไม่ได้คลี่ทอดต่อ" : "");
  if (mode !== "pro") {
    const outs = new Map(), used = new Map(), jump = new Map();
    const getOuts = (ai) => { let o = outs.get(ai); if (!o) { o = txOfAcc(ai).filter((i) => !IN_K.includes(DB.tx[i][2])).sort((p, q) => DB.tx[p][1] - DB.tx[q][1] || p - q); outs.set(ai, o); used.set(ai, new Float64Array(o.length)); jump.set(ai, Int32Array.from(o, (_, k) => k)); } return o; };
    const find = (J, k) => { let r = k; while (r < J.length && J[r] !== r) r = J[r]; while (k < J.length && J[k] !== k) { const nx = J[k]; J[k] = r; k = nx; } return r; };
    const addTx = (i, take, hop, par, t0, sbox) => {
      if (P.length >= TL_CAP) { cut = true; return; }
      const r = DB.tx[i], ci = cpOf(i), dai = accOfCp(ci), end = endOf(i, dai, r[0], hop, ci);
      const p = { id: P.length, par, hop, t: r[1], i, from: r[0], ci, to: dai, amt: take, full: r[3], t0, end, sbox };
      P.push(p);
      if (!end) push(dai, r[1], take, hop + 1, p.id, boxOf(ci));
    };
    const push = (ai, t, amt, hop, par, sbox) => {
      const o = getOuts(ai), U = used.get(ai), J = jump.get(ai);
      let lo = 0, hi = o.length; while (lo < hi) { const m = (lo + hi) >> 1; if (DB.tx[o[m]][1] < t) lo = m + 1; else hi = m; }
      let k = find(J, lo), rem = amt;
      while (rem > 0.005 && k < o.length && !cut) {
        const i = o[k], take = Math.min(rem, DB.tx[i][3] - U[k]);
        if (take > 0.005) { U[k] += take; rem -= take; addTx(i, take, hop, par, t, sbox); }
        if (DB.tx[i][3] - U[k] <= 0.005) { J[k] = k + 1; k = find(J, k); } else break;
      }
      if (rem > 0.005 && !cut) P.push({ id: P.length, par, hop, t, i: -1, from: ai, ci: -1, to: -1, amt: rem, full: 0, t0: t, end: "คงอยู่ในบัญชี (ยังไม่พบรายการโอนออก)", sbox });
    };
    for (const x of items) { if (cut) break; if (x.i != null) addTx(x.i, x.amt, 1, -1, DB.tx[x.i][1], ""); else push(x.ai, x.t, x.amt, 1, -1, ""); }
    return { P, cut };
  }
  // ---- ตามสัดส่วน ----
  const nA = DB.accounts.length, bal = new Float64Array(nA), B = new Map(), last = new Map(), abox = new Map(), crumb = new Map();
  const seedOut = new Map(), seedIn = items.filter((x) => x.i == null).sort((a, b) => a.t - b.t); let si = 0;
  for (const x of items) if (x.i != null) seedOut.set(x.i, (seedOut.get(x.i) || 0) + x.amt);
  const bucket = (ai) => { let b = B.get(ai); if (!b) B.set(ai, (b = new Float64Array(maxHop + 2))); return b; };
  const crumbAdd = (ai, v, t, h) => { const c = crumb.get(ai) || [0, t, h]; c[0] += v; c[1] = t; c[2] = Math.min(c[2], h); crumb.set(ai, c); };
  const deliver = (i, take, hop, t0, sbox) => {                       // เงิน take ออกจากรายการ i (ทอด hop)
    if (P.length >= TL_CAP) { cut = true; return; }
    const r = DB.tx[i], ci = cpOf(i), dai = accOfCp(ci), end = endOf(i, dai, r[0], hop, ci);
    P.push({ id: P.length, par: -1, hop, t: r[1], i, from: r[0], ci, to: dai, amt: take, full: r[3], t0, end, sbox });
    if (!end) { bucket(dai)[hop + 1] += take; last.set(dai, r[1]); if (!abox.has(dai)) abox.set(dai, boxOf(ci)); }
  };
  const ord = txOrder();
  let firstT = Infinity; for (const x of items) firstT = Math.min(firstT, x.i != null ? DB.tx[x.i][1] : x.t);
  for (let q = 0; q < ord.length && !cut; q++) {
    const i = ord[q], r = DB.tx[i], ai = r[0], inflow = IN_K.includes(r[2]);
    while (si < seedIn.length && seedIn[si].t <= r[1]) { const s = seedIn[si++]; bucket(s.ai)[1] += s.amt; last.set(s.ai, s.t); }
    if (inflow) { bal[ai] += r[3]; continue; }
    if (seedOut.has(i)) { deliver(i, seedOut.get(i), 1, r[1], ""); bal[ai] -= r[3]; continue; }   // รายการต้นสาย ไม่หักจากยอดที่ไล่มา (กันนับซ้ำ)
    if (r[1] >= firstT) {
      const b = B.get(ai);
      if (b) { let tot = 0; for (let h = 1; h <= maxHop; h++) tot += b[h];
        if (tot > 0.005) {
          const tr = Math.min(tot, r[3] * tot / Math.max(bal[ai], tot));
          for (let h = 1; h <= maxHop; h++) { if (b[h] <= 0) continue; const take = tr * b[h] / tot; b[h] -= take;
            if (take >= 1) deliver(i, take, h, last.get(ai) ?? r[1], abox.get(ai) || ""); else crumbAdd(ai, take, r[1], h); }
          let left = 0; for (let h = 1; h <= maxHop; h++) left += b[h];
          if (left < 1) { crumbAdd(ai, left, r[1], 1); B.delete(ai); }
        } }
    }
    bal[ai] -= r[3];
  }
  while (si < seedIn.length) { const s = seedIn[si++]; bucket(s.ai)[1] += s.amt; last.set(s.ai, s.t); }
  for (const [ai, b] of B) for (let h = 1; h <= maxHop; h++) if (b[h] > 0.005) P.push({ id: P.length, par: -1, hop: h, t: last.get(ai) || 0, i: -1, from: ai, ci: -1, to: -1, amt: b[h], full: 0, t0: last.get(ai) || 0, end: "คงอยู่ในบัญชี (ยังไม่พบรายการโอนออก)", sbox: abox.get(ai) || "" });
  for (const [ai, c] of crumb) if (c[0] > 0.005) P.push({ id: P.length, par: -1, hop: c[2], t: c[1], i: -1, from: ai, ci: -1, to: -1, amt: c[0], full: 0, t0: c[1], end: "เศษยอดย่อย (ต่ำกว่า 1 บาทต่อรายการ)", sbox: abox.get(ai) || "" });
  return { P, cut };
}
const trMode = () => (F && F.flt === "pro" ? "pro" : "fifo");
const trName = (m) => (m === "pro" ? "ตามสัดส่วน" : "เข้าก่อนออกก่อน");

/* ---------- Timeline เส้นเงินเป็นทอด (ผู้ใช้สั่ง 19 พ.ย. 69) ----------
   ต้นสาย = รายการทอด 1 ของกล่องที่คลี่ในชาร์ต (F.chain[0]) หรือแถวใดก็ได้ที่กด (ตารางรายการ / ตาราง timeline) ; กรองช่วงวัน-เวลาเริ่มต้นได้
   วิธีไล่: เงินที่เข้าบัญชีที่มี statement ณ เวลาใด จับกับรายการเงินออกของบัญชีนั้นตั้งแต่เวลานั้น เรียงตามเวลาจนครบยอด (รายการเงินออก 1 รายการใช้ได้ไม่เกินยอดของมัน)
   ไล่ต่อไม่เกิน TL_MAX ทอด — เป็นการไล่ตามลำดับเวลา (ข้อสันนิษฐาน) ไม่ใช่การระบุตัวเงิน ; ยอดปลายสายรวม = ยอดต้นสาย */
let TLS = { v: "lst", from: "", to: "", seed: null, hist: [], open: false }, TLC = { key: "", res: null, ck: null };
const TL_MAX = 10, TL_CAP = 30000;
const TLV = [["lst", "รายการ"], ["grp", "รวมก้อน"], ["hop", "ตามทอด"], ["end", "ปลายสาย"]];
const tlAcc = (ai) => { const a = DB.accounts[ai]; return `${a.name || ""} · ${a.bank} ${a.acc}`; };
const tlCp = (ci) => { const c = DB.cps[ci]; return `${c[1] || DB.groups[c[3]][1].split(" (")[0]}${c[0] ? ` · ${c[2]} ${c[0]}` : ""}`; };
const tlIso = (t, i) => { const s = min2iso(t); return `${s.slice(0, 10)} ${s.slice(11, 16)}${i != null && i >= 0 && txSec(i) >= 0 ? ":" + String(txSec(i)).padStart(2, "0") : ""}`; };
const tlTh = (s) => `${dTh(s.slice(0, 10))} ${s.slice(11)}`;
const tlMin = (s) => (s ? day2min(s.slice(0, 10)) + (+s.slice(11, 13) || 0) * 60 + (+s.slice(14, 16) || 0) : null);
const tlGap = (m) => {                                                  // ระยะเวลา: นาที / ชม. / ปี เดือน วัน (ผู้ใช้สั่ง 19 พ.ย. 69)
  if (m == null || m < 0) return ""; if (m < 60) return `${Math.round(m)} นาที`; if (m < 1440) return `${Math.floor(m / 60)} ชม. ${Math.round(m % 60)} นาที`;
  let d = Math.round(m / 1440); const y = Math.floor(d / 365); d -= y * 365; const mo = Math.floor(d / 30); d -= mo * 30;
  return [y ? `${y} ปี` : "", mo ? `${mo} เดือน` : "", d || (!y && !mo) ? `${d} วัน` : ""].filter(Boolean).join(" ");
};
function tlSeedTx(i) {                                                  // แถวในตารางรายการ -> ต้นสาย
  const r = DB.tx[i], out = !IN_K.includes(r[2]);
  return { label: `${out ? "รายการโอนออก" : "เงินเข้า"} ${tlTh(tlIso(r[1], i))} · ${DB.accounts[r[0]].name || DB.accounts[r[0]].acc} ${out ? "→ " + tlCp(cpOf(i)) : ""} · ${fmt(r[3])} บาท`,
    items: out ? [{ i, amt: r[3] }] : [{ ai: r[0], t: r[1], amt: r[3] }] };
}
function tlSeeds() {
  if (TLS.seed) return TLS.seed;
  const C0 = ((F.chain || [])[0] || []).filter((id) => /^[cg]\d/.test(id)); if (!C0.length || F.dn) return null;
  const set = new Set(C0), det = F.flm === "d", items = [];
  for (const i of filterTx()) { const r = DB.tx[i]; if (IN_K.includes(r[2])) continue; const ci = cpOf(i); if (set.has(det ? "c" + ci : "g" + DB.cps[ci][3])) items.push({ i, amt: r[3] }); }
  return { label: `${C0.map((id) => flowInfo0(id).lab).join(" + ")} — รายการทอด 1 ตามชาร์ต`, items, chart: true };
}
function tlTrace(sd) {
  const a = tlMin(TLS.from), b = tlMin(TLS.to), tOf = (x) => (x.i != null ? DB.tx[x.i][1] : x.t);
  const items = sd.items.filter((x) => sd.items.length === 1 || ((a == null || tOf(x) >= a) && (b == null || tOf(x) <= b))).sort((x, y) => tOf(x) - tOf(y));   // ต้นสายแถวเดียว ไม่ใช้ช่วงเวลา
  const { P, cut } = runTrace(items, trMode(), () => true, TL_MAX, () => "");
  return { P, cut, n: items.length, total: items.reduce((t, x) => t + x.amt, 0), label: sd.label, mode: trMode(), t1: items.length ? tOf(items[0]) : null, t2: items.length ? tOf(items[items.length - 1]) : null };
}
const tlTo = (p) => (p.i < 0 ? "(คงอยู่ในบัญชี)" : p.to >= 0 ? tlAcc(p.to) : tlCp(p.ci));
function tlRender() {
  const box = $("#tlBox"); if (!box) return;
  box.onclick = (e) => { if (e.target.closest("#tlX")) return; const v = e.target.closest("[data-tlv]"); if (v) { TLS.v = v.dataset.tlv; TLS.keep = true; return tlRender(); }
    if (e.target.closest(".tlh") && !e.target.closest("button")) { TLS.open = false; TLS.keep = true; return tlRender(); }
    const b = e.target.closest("[data-tl]"); if (!b) return; if (b.dataset.tl === "open" || b.dataset.tl === "close") { TLS.open = b.dataset.tl === "open"; TLS.keep = true; return tlRender(); } if (b.dataset.tl === "back") { TLS.seed = TLS.hist.pop() || null; TLS.keep = true; return tlRender(); } if (b.dataset.tl === "rep") tlReport(); };
  box.onchange = (e) => { if (e.target.id === "tlFrom" || e.target.id === "tlTo") { TLS[e.target.id === "tlFrom" ? "from" : "to"] = e.target.value; TLS.keep = true; tlRender(); } };
  const ck = JSON.stringify(F.chain) + trMode(); if (TLC.ck !== null && TLC.ck !== ck && TLS.seed && !TLS.keep) { TLS.seed = null; TLS.hist = []; } TLC.ck = ck; TLS.keep = false;
  if (!TLS.open) { box.innerHTML = `<button class="tlbar0" data-tl="open" title="เปิดวิเคราะห์">${IC("route", 16)} <b>Timeline เส้นเงินเป็นทอด</b><span class="tlgo">${IC("more", 16)}</span></button>`; return; }
  const sd = tlSeeds();
  const hd = `<div class="tlh"><h2>${IC("route")} Timeline เส้นเงินเป็นทอด ${infoI("ต้นสาย = รายการทอด 1 ของกล่องที่คลี่ในชาร์ต หรือแถวที่กด (ตารางรายการ / ตารางนี้) · ไล่ตามวิธีที่เลือกในชาร์ต ไม่เกิน " + TL_MAX + " ทอด · ตามทอด = สรุปรายทอดว่าเงินแยกไปทางใด · ปลายสาย = เงินไปจบที่ใด รวมเท่ายอดต้นสาย · เป็นการไล่ตามลำดับเวลา (ข้อสันนิษฐาน) ไม่ใช่การระบุตัวเงิน")}</h2>${TLS.seed ? ibx("back", TLS.hist.length ? "ย้อนกลับ" : "กลับไปตามชาร์ต", 'data-tl="back"') : ""}${ibx("less", "ซ่อน", 'data-tl="close"')}</div>`;
  if (!sd || !sd.items.length) { box.innerHTML = `<div class="card tlc">${hd}<p class="muted" style="margin:4px 0 0">เลือกกล่อง ▶ ในชาร์ต หรือแถวในตารางรายการ</p></div>`; return; }
  const key = [sd.label, sd.items.length, sd.items.reduce((t, x) => t + x.amt, 0).toFixed(2), TLS.from, TLS.to, trMode()].join("|");
  if (TLC.key !== key) { TLC.res = tlTrace(sd); TLC.key = key; }
  const T = TLC.res, P = T.P, L = P.filter((p) => p.end), sumE = (rx) => L.filter((p) => rx.test(p.end)).reduce((t, p) => t + p.amt, 0);
  const last = P.reduce((m, p) => Math.max(m, p.t), T.t1 || 0), hopMax = P.reduce((m, p) => Math.max(m, p.hop), 0);
  const kp = [["ยอดต้นสาย", M(T.total), `${fmt0(T.n)} รายการ`], ["ไล่ได้ลึกสุด", `${hopMax} ทอด`, `${fmt0(P.length)} รายการย่อย`], ["ระยะเวลาต้นสาย → สุดสาย", tlGap(last - (T.t1 || last)), T.t1 != null ? `${tlTh(tlIso(T.t1))} – ${tlTh(tlIso(last))}` : ""],
    ["ถอนเป็นเงินสด", M(sumE(/ถอนเงินสด/)), ""], ["ไปบัญชีที่ไม่มี statement", M(sumE(/ไม่มี statement/)), ""], ["คงอยู่ในบัญชี / หยุดไล่", M(sumE(/คงอยู่|หยุดไล่|บัญชีเดียวกัน/)), ""]];
  box.innerHTML = `<div class="card tlc">${hd}
    <div class="tlsrc">${IC("flow", 15)} <b>ต้นสาย:</b> ${esc(T.label)} · <b>วิธีไล่:</b> ${trName(T.mode)}${T.cut ? ` <span class="badge r">ตัดที่ ${fmt0(TL_CAP)} รายการ — ใช้ช่วงเวลาให้แคบลง</span>` : ""}</div>
    <div class="tlbar"><div class="seg">${TLV.map(([k, l]) => `<button data-tlv="${k}" class="${TLS.v === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <label class="tlt">เริ่ม <input type="datetime-local" id="tlFrom" value="${TLS.from}"></label><label class="tlt">ถึง <input type="datetime-local" id="tlTo" value="${TLS.to}"></label>
      ${ibx("doc", "รายงานสรุปเส้นเงิน (Word)", 'data-tl="rep"')}</div>
    <div class="tlk">${kp.map(([l, v, s]) => `<div><small>${l}</small><b>${v}</b>${s ? `<span>${s}</span>` : ""}</div>`).join("")}</div>
    <div id="tlX"></div></div>`;
  tlView(T);
}
function tlAgg(T) {
  const G = new Map(), H = new Map(), E = new Map();
  for (const p of T.P) {
    const gk = `${p.hop}|${p.from}|${p.i < 0 ? "rem" : p.to >= 0 ? "a" + p.to : "c" + p.ci}`;
    let g = G.get(gk); if (!g) G.set(gk, (g = { hop: p.hop, from: tlAcc(p.from), to: tlTo(p), n: 0, amt: 0, t1: p.t, t2: p.t, end: p.end || "ไล่ต่อ" })); g.n++; g.amt += p.amt; g.t1 = Math.min(g.t1, p.t); g.t2 = Math.max(g.t2, p.t);
    let h = H.get(p.hop); if (!h) H.set(p.hop, (h = { hop: p.hop, n: 0, amt: 0, fwd: 0, cash: 0, nst: 0, rem: 0, oth: 0, t1: p.t, t2: p.t, acc: new Set() })); h.n++; h.amt += p.amt; h.acc.add(p.from); h.t1 = Math.min(h.t1, p.t); h.t2 = Math.max(h.t2, p.t);
    if (!p.end) h.fwd += p.amt; else if (/ถอนเงินสด/.test(p.end)) h.cash += p.amt; else if (/ไม่มี statement/.test(p.end)) h.nst += p.amt; else if (/คงอยู่/.test(p.end)) h.rem += p.amt; else h.oth += p.amt;
    if (p.end) { const ek = `${p.end}|${p.i < 0 ? "a" + p.from : "c" + p.ci}`; let e = E.get(ek); if (!e) E.set(ek, (e = { end: p.end, to: p.i < 0 ? tlAcc(p.from) : tlCp(p.ci), n: 0, amt: 0, h1: p.hop, h2: p.hop, t1: p.t, t2: p.t })); e.n++; e.amt += p.amt; e.h1 = Math.min(e.h1, p.hop); e.h2 = Math.max(e.h2, p.hop); e.t1 = Math.min(e.t1, p.t); e.t2 = Math.max(e.t2, p.t); }
  }
  return { G: [...G.values()], H: [...H.values()].sort((a, b) => a.hop - b.hop), E: [...E.values()] };
}
function tlView(T) {
  const host = $("#tlX"), A = tlAgg(T), money = (k) => (r) => fmt(r[k]), tt = (k) => (r) => tlTh(tlIso(r[k]));
  const reseed = (p) => { TLS.hist.push(TLS.seed); TLS.keep = true;
    TLS.seed = { label: `แถว ทอด ${p.hop} · ${tlTh(tlIso(p.t, p.i))} · ${tlAcc(p.from)} → ${tlTo(p)} · ${fmt(p.amt)} บาท`, items: p.i >= 0 ? [{ i: p.i, amt: p.amt }] : [{ ai: p.from, t: p.t0, amt: p.amt }] }; tlRender(); };
  const sumA = (R) => `รวมทุกทอด ${M(R.reduce((t, r) => t + r.amt, 0))}`;
  if (TLS.v === "grp") return xtMount(host, { id: "tlG", title: "รวมก้อนตามทอด / ผู้โอน / ผู้รับ", ph: "ค้นหาชื่อ / เลขบัญชี", rows: A.G, xl: "Timeline เส้นเงิน - รวมก้อน", sort0: [[0, 1], [5, 1]], sum: sumA,
    cols: [["ทอด", (r) => r.hop, "a"], ["จาก", (r) => r.from, "t"], ["ไปยัง", (r) => r.to, "t"], ["ครั้ง", (r) => r.n, "a"], ["ยอดรวม (บาท)", (r) => r.amt, "a", money("amt")], ["ครั้งแรก", (r) => tlIso(r.t1), "t", tt("t1")], ["ครั้งสุดท้าย", (r) => tlIso(r.t2), "t", tt("t2")], ["ปลายทาง", (r) => r.end, "t"]],
    facets: [["hop", "ทุกทอด", (r) => "ทอด " + r.hop, [...new Set(A.G.map((r) => r.hop))].sort((a, b) => a - b).map((h) => ["ทอด " + h, "ทอด " + h])], ["end", "ทุกปลายทาง", (r) => r.end]] });
  if (TLS.v === "hop") return xtMount(host, { id: "tlH", title: "สรุปตามทอด", ph: "ค้นหา", rows: A.H, xl: "Timeline เส้นเงิน - ตามทอด", sort0: [[0, 1]], sum: sumA,
    cols: [["ทอด", (r) => r.hop, "a"], ["บัญชีผู้โอน", (r) => r.acc.size, "a"], ["รายการ", (r) => r.n, "a"], ["ยอดในทอดนี้ (บาท)", (r) => r.amt, "a", money("amt")], ["ไล่ต่อทอดถัดไป", (r) => r.fwd, "a", money("fwd")],
      ["ถอนเงินสด", (r) => r.cash, "a", money("cash")], ["ไปบัญชีไม่มี statement", (r) => r.nst, "a", money("nst")], ["คงอยู่ในบัญชี", (r) => r.rem, "a", money("rem")], ["อื่น ๆ", (r) => r.oth, "a", money("oth")], ["ช่วงเวลา", (r) => tlIso(r.t1), "t", (r) => `${tlTh(tlIso(r.t1))} – ${tlTh(tlIso(r.t2))}`]] });
  if (TLS.v === "end") return xtMount(host, { id: "tlE", title: "ปลายสาย — เงินไปจบที่ใด", ph: "ค้นหาปลายทาง", rows: A.E, xl: "Timeline เส้นเงิน - ปลายสาย", sort0: [[2, -1]], sum: (R) => `${M(R.reduce((t, r) => t + r.amt, 0))} จากต้นสาย ${M(T.total)}`,
    cols: [["ประเภทปลายสาย", (r) => r.end, "t"], ["ปลายทาง", (r) => r.to, "t"], ["ยอด (บาท)", (r) => r.amt, "a", money("amt")], ["ครั้ง", (r) => r.n, "a"], ["ทอด", (r) => r.h1, "a", (r) => (r.h1 === r.h2 ? r.h1 : `${r.h1}–${r.h2}`)], ["ครั้งแรก", (r) => tlIso(r.t1), "t", tt("t1")], ["ครั้งสุดท้าย", (r) => tlIso(r.t2), "t", tt("t2")]],
    facets: [["end", "ทุกประเภทปลายสาย", (r) => r.end]] });
  return xtMount(host, { id: "tlL", title: "รายการเรียงตามเวลา", ph: "ค้นหาชื่อ / เลขบัญชี", rows: T.P, xl: "Timeline เส้นเงิน - รายการ", sort0: [[1, 1]], sum: sumA,
    cols: [["ทอด", (r) => r.hop, "a"], ["วันเวลา", (r) => tlIso(r.t, r.i), "t", (r) => tlTh(tlIso(r.t, r.i))], ["จาก", (r) => tlAcc(r.from), "t"], ["ไปยัง", tlTo, "t"], ["ยอดที่ไล่มา (บาท)", (r) => r.amt, "a", money("amt")],
      ["ยอดรายการเต็ม", (r) => r.full, "a", (r) => (r.i < 0 ? "" : fmt(r.full))], ["ห่างจากเงินเข้า", (r) => (r.hop > 1 || r.par >= 0 ? r.t - r.t0 : -1), "a", (r) => (r.par >= 0 ? tlGap(r.t - r.t0) : "")], ["ปลายทาง", (r) => r.end || "ไล่ต่อ", "t"]],
    facets: [["hop", "ทุกทอด", (r) => "ทอด " + r.hop, [...new Set(T.P.map((r) => r.hop))].sort((a, b) => a - b).map((h) => ["ทอด " + h, "ทอด " + h])], ["end", "ทุกปลายทาง", (r) => r.end || "ไล่ต่อ"]],
    rowAttr: () => 'class="click" title="เริ่มไล่จากแถวนี้"', onRow: reseed });
}
function tlReport() {
  const T = TLC.res; if (!T) return;
  const A = tlAgg(T), e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const tb = (h, rows) => `<table><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c, j) => `<td${typeof c === "number" ? ' class="n"' : ""}>${typeof c === "number" ? (j === 0 || Number.isInteger(c) && c < 1e4 ? c : fmt(c)) : e(c)}</td>`).join("")}</tr>`).join("")}</table>`;
  const last = T.P.reduce((m, p) => Math.max(m, p.t), T.t1 || 0);
  const E = A.E.slice().sort((a, b) => b.amt - a.amt), G = A.G.slice().sort((a, b) => a.hop - b.hop || a.t1 - b.t1);
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>รายงานสรุปเส้นเงิน</title>
  <style>body{font-family:"TH Sarabun New","Leelawadee UI",sans-serif;font-size:15pt}h1{font-size:20pt;color:#00264D;margin:0}h2{font-size:16pt;color:#00264D;border-bottom:2px solid #FFD403;margin-top:18pt}
  table{border-collapse:collapse;width:100%;font-size:12pt}th{background:#00264D;color:#fff;padding:3pt}td{border:1px solid #bbb;padding:2pt 3pt;vertical-align:top}td.n{text-align:right}.note{font-size:12pt;color:#555}</style></head><body>
  <h1>รายงานสรุปเส้นเงิน (ไล่เป็นทอดตามลำดับเวลา)</h1><p>ต้นสาย: ${e(T.label)}<br>ช่วงต้นสาย: ${T.t1 != null ? e(tlTh(tlIso(T.t1)) + " – " + tlTh(tlIso(T.t2))) : "-"}${TLS.from || TLS.to ? ` (กำหนดช่วงเริ่ม ${e(TLS.from || "…")} ถึง ${e(TLS.to || "…")})` : ""}<br>
  ยอดต้นสาย ${fmt(T.total)} บาท (${fmt0(T.n)} รายการ) · ไล่ได้ลึกสุด ${T.P.reduce((m, p) => Math.max(m, p.hop), 0)} ทอด · ${fmt0(T.P.length)} รายการย่อย · ระยะเวลาต้นสายถึงสุดสาย ${tlGap(last - (T.t1 || last))}<br>สร้างเมื่อ ${e(dTh(isoNow().slice(0, 10)))} จากข้อมูล statement ณ ${e(dTh(DB.made))}</p>
  <h2>1. สรุปตามทอด</h2>${tb(["ทอด", "บัญชีผู้โอน", "รายการ", "ยอดในทอด", "ไล่ต่อ", "ถอนเงินสด", "ไม่มี statement", "คงอยู่ในบัญชี", "อื่น ๆ"], A.H.map((h) => [h.hop, h.acc.size, h.n, h.amt, h.fwd, h.cash, h.nst, h.rem, h.oth]))}
  <h2>2. ปลายสาย — เงินไปจบที่ใด</h2>${tb(["ประเภทปลายสาย", "ปลายทาง", "ยอด (บาท)", "ครั้ง", "ทอด", "ช่วงเวลา"], E.slice(0, 150).map((r) => [r.end, r.to, r.amt, r.n, r.h1 === r.h2 ? String(r.h1) : `${r.h1}–${r.h2}`, `${tlTh(tlIso(r.t1))} – ${tlTh(tlIso(r.t2))}`]))}
  ${E.length > 150 ? `<p class="note">แสดง 150 อันดับแรกจาก ${E.length} ปลายทาง (ทั้งหมดอยู่ใน Excel)</p>` : ""}
  <h2>3. เส้นเงินรวมก้อน เรียงตามทอดและเวลา</h2>${tb(["ทอด", "จาก", "ไปยัง", "ครั้ง", "ยอดรวม (บาท)", "ครั้งแรก", "ครั้งสุดท้าย", "ปลายทาง"], G.slice(0, 300).map((r) => [r.hop, r.from, r.to, r.n, r.amt, tlTh(tlIso(r.t1)), tlTh(tlIso(r.t2)), r.end]))}
  ${G.length > 300 ? `<p class="note">แสดง 300 แถวแรกจาก ${G.length} แถว (ทั้งหมดอยู่ใน Excel)</p>` : ""}
  <p class="note">วิธีไล่: เงินที่เข้าบัญชีที่มี statement ณ เวลาใด จับกับรายการเงินออกของบัญชีนั้นตั้งแต่เวลานั้นเป็นต้นไป เรียงตามเวลาจนครบยอด (รายการเงินออก 1 รายการใช้ได้ไม่เกินยอดของมัน) ไล่ต่อไม่เกิน ${TL_MAX} ทอด — เป็นการไล่ตามลำดับเวลา (ข้อสันนิษฐาน) ไม่ใช่การระบุตัวเงิน ต้องตรวจทานกับ statement ก่อนอ้างอิง</p></body></html>`;
  download2("รายงานสรุปเส้นเงิน (ไล่เป็นทอด).doc", new Blob(["﻿" + html], { type: "application/msword" }));
}

/* ---------- ชาร์ตเส้นเงินตามตัวกรอง (เงินเข้า → บัญชี → เงินออก) ---------- */
// ชาร์ตเส้นเงินหลายทอด (ผู้สั่งงาน 18 พ.ย. 69): คอลัมน์ 0 = เงินเข้าจาก / 1 = บัญชีตามตัวกรอง / 2 = เงินออกไป
//   กดกล่องในคอลัมน์ที่ 2 ขึ้นไปที่เป็นบัญชีมี statement -> คลี่ทอดถัดไป (เงินที่บัญชีนั้นโอนต่อ) ไล่ต่อได้เรื่อยๆ (F.chain) ; เลือกจำนวนคอลัมน์ที่เห็นพร้อมกัน (F.flc)
let ACCNO = null;
const accOfCp = (ci) => { if (!ACCNO) { ACCNO = new Map(); DB.accounts.forEach((a, i) => ACCNO.set(dg(a.acc), i)); } const k = dg(DB.cps[ci][0]); return k && ACCNO.has(k) ? ACCNO.get(k) : -1; };
let TXA = null;
const txOfAcc = (ai) => { if (!TXA) { TXA = DB.accounts.map(() => []); DB.tx.forEach((r, i) => TXA[r[0]].push(i)); } return TXA[ai] || []; };
function flowBuild(pair) {
  // รุ่น 19 พ.ย. 69: F.chain = [[กล่องที่คลี่ในคอลัมน์ทอด 1], [ทอด 2], …] คลี่ได้หลายกล่องต่อคอลัมน์ ; โหมดไล่ตามเวลา (F.flt = fifo / pro) ใช้ runTrace บัญชีคุมยอดชุดเดียว
  //   และเมื่อมีกล่องที่คลี่ ชาร์ตแสดงเฉพาะเส้นที่ไล่: คอลัมน์ 0–2 เหลือเฉพาะบัญชีที่โอนเข้ากล่องที่คลี่ (ผู้ใช้สั่ง "แสดงเฉพาะเส้นที่ไฮไลท์ ไม่ใช่ทุกรายการ")
  const det = F.flm === "d", N = F.fln, L = new Map(), R = new Map(), Mi = new Map();
  const lid = (ci) => (det ? "c" + ci : "g" + DB.cps[ci][3]), mid = (ai) => (det ? "a" + ai : "G" + DB.accounts[ai].g);
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  const top = (m) => new Set([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, N).map((x) => x[0]));
  const cols = [new Map(), new Map(), new Map()], links = new Map();
  const nd = (c, id) => { while (cols.length <= c) cols.push(new Map()); let n = cols[c].get(id); if (!n) cols[c].set(id, (n = { id, c, in: 0, out: 0 })); return n; };
  const lk = (a, b, v, n) => { const k = a + ">" + b; let o = links.get(k); if (!o) links.set(k, (o = { a, b, v: 0, n: 0 })); o.v += v; o.n += n; };
  const CH = (F.chain || []).filter((a) => a && a.length), time = F.flt !== false, chain = [];
  if (time && CH.length) {
    const s0 = new Set(CH[0]), seeds = [], srcA = new Map(), col2 = new Map();
    for (const i of filterTx()) { const r = DB.tx[i]; if (IN_K.includes(r[2])) continue; const ci = cpOf(i), d = lid(ci); if (!s0.has(d)) continue;
      seeds.push({ i, amt: r[3] }); add(srcA, r[0], r[3]); const e = col2.get(r[0] + "|" + d) || [0, 0]; e[0] += r[3]; e[1]++; col2.set(r[0] + "|" + d, e); }
    if (seeds.length) {
      // คอลัมน์ 0–2 เฉพาะเส้นที่ไล่
      //   (ไม่แสดงคอลัมน์เงินเข้าจาก เพราะเงินเข้าทั้งหมดของบัญชีต้นทางไม่ใช่เส้นที่ไล่ — ชาร์ตเริ่มที่บัญชีผู้โอนทอด 1)
      for (const [ai, v] of srcA) add(Mi, mid(ai), v);
      const kM = top(Mi);
      for (const [k2, e] of col2) { const [ai, d] = k2.split("|"), m0 = mid(+ai), m = kM.has(m0) ? m0 : "O"; nd(1, m).out += e[0]; nd(2, d).in += e[0]; lk("1:" + m, "2:" + d, e[0], e[1]); }
      // ทอดถัดไป
      const maxHop = CH.length + 1;
      const { P } = runTrace(seeds, F.flt === "pro" ? "pro" : "fifo", (hop, ci) => hop - 1 < CH.length && CH[hop - 1].includes(lid(ci)), maxHop, lid);
      let reach = 1;
      for (let h = 2; h <= maxHop; h++) {
        const c = h + 1, ps = P.filter((p) => p.hop === h && p.sbox && cols[c - 1] && cols[c - 1].has(p.sbox)); if (!ps.length) break;
        const agg = new Map(); ps.forEach((p) => { const d = p.i < 0 ? "rem" : lid(p.ci), e = agg.get(d) || [0, 0]; e[0] += p.amt; e[1]++; agg.set(d, e); });
        const kk = new Set([...agg.entries()].filter(([d]) => d !== "rem").sort((a, b) => b[1][0] - a[1][0]).slice(0, N).map((x) => x[0]));
        CH[h - 2].forEach((id) => { if (cols[c - 1].has(id)) cols[c - 1].get(id).out = 0; });
        const lagg = new Map();
        ps.forEach((p) => { const d0 = p.i < 0 ? "rem" : lid(p.ci), d = d0 === "rem" || kk.has(d0) ? d0 : "o", k = p.sbox + ">" + d, e = lagg.get(k) || [0, 0]; e[0] += p.amt; e[1] += p.i < 0 ? 0 : 1; lagg.set(k, e); });
        for (const [k, e] of lagg) { const [sb, d] = k.split(">"); nd(c, d).in += e[0]; nd(c - 1, sb).out += e[0]; lk((c - 1) + ":" + sb, c + ":" + d, e[0], e[1]); }
        chain.push(CH[h - 2].filter((id) => cols[c - 1].has(id))); reach = h;
      }
      return { cols, links: [...links.values()], chain };
    }
  }
  // ไม่มีกล่องที่คลี่ หรือโหมด "ทุกรายการในช่วง": ชาร์ตตามตัวกรองเดิม
  for (const [key, v] of pair) { const ci = Math.floor(key / 64), ai = key % 64; if (v[0]) add(L, lid(ci), v[0]); if (v[1]) add(R, lid(ci), v[1]); add(Mi, mid(ai), v[0] + v[1]); }
  const kL = top(L), kR = top(R), kM = top(Mi);
  for (const [key, v] of pair) {
    const ci = Math.floor(key / 64), ai = key % 64, m0 = mid(ai), m = kM.has(m0) ? m0 : "O", l0 = lid(ci);
    if (v[0]) { const l = kL.has(l0) ? l0 : "o"; nd(0, l).out += v[0]; nd(1, m).in += v[0]; lk("0:" + l, "1:" + m, v[0], v[2]); }
    if (v[1]) { const r = kR.has(l0) ? l0 : "o"; nd(2, r).in += v[1]; nd(1, m).out += v[1]; lk("1:" + m, "2:" + r, v[1], v[3]); }
  }
  if (!time) {
    const a0 = day2min(F.from), b0 = day2min(F.to) + 1440;
    for (let k = 0; k < CH.length; k++) {
      const c = 2 + k, ids = CH[k].filter((id) => cols[c] && cols[c].has(id) && srcAccs(id).length); if (!ids.length) break;
      const out = new Map(), tot = new Map();
      for (const id of ids) for (const ai of srcAccs(id)) for (const i of txOfAcc(ai)) { const r = DB.tx[i];
        if (r[1] < a0 || r[1] >= b0 || IN_K.includes(r[2]) || r[3] < F.min) continue;
        if (F.cpm === "pair" && !(txQ(i) && pqOn(txQ(i)))) continue;
        const d = lid(cpOf(i)); if (d === id) continue; const k2 = id + ">" + d, o = out.get(k2) || [0, 0]; o[0] += r[3]; o[1] += r[5] || 1; out.set(k2, o); add(tot, d, r[3]); }
      if (!out.size) break;
      const kk = new Set([...tot.entries()].sort((x, y) => y[1] - x[1]).slice(0, N).map((x) => x[0]));
      ids.forEach((id) => (cols[c].get(id).out = 0));
      for (const [k2, v] of out) { const [id, d] = k2.split(">"), dd = kk.has(d) ? d : "o"; nd(c + 1, dd).in += v[0]; cols[c].get(id).out += v[0]; lk(c + ":" + id, (c + 1) + ":" + dd, v[0], v[1]); }
      chain.push(ids);
    }
  }
  return { cols, links: [...links.values()], chain };
}
function srcAccs(id) {                                                  // กล่องในคอลัมน์เงินออก -> บัญชีที่มี statement ที่ไล่ต่อได้
  if (id[0] === "c") { const ai = accOfCp(+id.slice(1)); return ai >= 0 ? [ai] : []; }
  if (id[0] === "g") { const g = +id.slice(1); return DB.accounts.map((a, i) => (a.g === g ? i : -1)).filter((i) => i >= 0); }
  return [];
}
/* ---------- ไล่เงินผู้บริจาค (ผู้สั่งงาน 18 พ.ย. 69): ผู้บริจาค -> บัญชีรับบริจาค -> รายการโอนออกถัดไปตามเวลา จนครบยอดที่บริจาค หรือจนหมดรายการ ----------
   วิธี: เงินบริจาคแต่ละครั้ง (วัน-เวลา ยอด) จับกับรายการเงินออกของบัญชีนั้นที่เกิดหลังจากนั้น เรียงตามเวลา จนครบยอด (รายการเงินออก 1 รายการใช้ได้ไม่เกินยอดของมัน)
   ถ้าปลายทางเป็นบัญชีที่มี statement ไล่ต่อด้วยวิธีเดียวกันจากเวลาที่เงินเข้า (ไม่เกิน DN_MAXD ทอด) ; เป็นการไล่ตามลำดับเวลา (ข้อสันนิษฐาน) ไม่ใช่การระบุตัวเงิน */
let DNT = null, DNQ = null, ANA_UPD = null;
const DN_MAXD = 6;
function donorTrace() {
  const D = DN, q = DNQ; if (!D || !q) return null;
  const idset = new Set(q.ids), t1ai = D.t1.map((t) => { const k = dg((t.match(/\d{10}/) || [""])[0]); return DB.accounts.findIndex((a) => dg(a.acc) === k); });
  const dons = []; let undated = 0, total = 0;
  for (const x of D.x) { if (!idset.has(x[0])) continue; total += x[4];
    if (x[2] < 0 || t1ai[x[1]] < 0) { undated += x[4]; continue; }
    const tm = String(x[3] || "").split(":"); dons.push({ ai: t1ai[x[1]], t: x[2] * 1440 + (+tm[0] || 0) * 60 + (+tm[1] || 0), amt: x[4] }); }
  dons.sort((a, b) => a.t - b.t);
  const outs = new Map(), used = new Map(), jump = new Map();
  const getOuts = (ai) => { let o = outs.get(ai); if (!o) { o = txOfAcc(ai).filter((i) => !IN_K.includes(DB.tx[i][2])).sort((a, b) => DB.tx[a][1] - DB.tx[b][1] || a - b); outs.set(ai, o); used.set(ai, new Float64Array(o.length)); jump.set(ai, Int32Array.from(o, (_, k) => k)); } return o; };
  const find = (J, k) => { let r = k; while (r < J.length && J[r] !== r) r = J[r]; while (k < J.length && J[k] !== k) { const nx = J[k]; J[k] = r; k = nx; } return r; };
  const det = F.flm === "d", cols = [new Map(), new Map()], links = new Map();
  const nd = (c, id) => { while (cols.length <= c) cols.push(new Map()); let n = cols[c].get(id); if (!n) cols[c].set(id, (n = { id, c, in: 0, out: 0 })); return n; };
  const lk = (c, a, b, v) => { const k = c + ":" + a + ">" + (c + 1) + ":" + b; let o = links.get(k); if (!o) links.set(k, (o = { c, a, b, v: 0, n: 0 })); o.v += v; o.n++; nd(c, a).out += v; nd(c + 1, b).in += v; };
  const nid = (ai) => (det ? "a" + ai : "G" + DB.accounts[ai].g);
  function push(ai, t, amt, c) {                                        // เงิน amt เข้าบัญชี ai (กล่องคอลัมน์ c) ณ เวลา t
    const o = getOuts(ai), U = used.get(ai), J = jump.get(ai);
    let lo = 0, hi = o.length; while (lo < hi) { const m = (lo + hi) >> 1; if (DB.tx[o[m]][1] < t) lo = m + 1; else hi = m; }
    let k = find(J, lo), rem = amt;
    while (rem > 0.005 && k < o.length) {
      const i = o[k], r = DB.tx[i], take = Math.min(rem, r[3] - U[k]);
      if (take > 0.005) { U[k] += take; rem -= take; const ci = cpOf(i), dai = accOfCp(ci);
        if (dai >= 0 && dai !== ai && c < DN_MAXD) { lk(c, nid(ai), nid(dai), take); push(dai, r[1], take, c + 1); }
        else lk(c, nid(ai), det ? "c" + ci : "g" + DB.cps[ci][3], take); }
      if (r[3] - U[k] <= 0.005) { J[k] = k + 1; k = find(J, k); } else break;
    }
    if (rem > 0.005) lk(c, nid(ai), "rem", rem);
  }
  for (const d of dons) { lk(0, "D", nid(d.ai), d.amt); push(d.ai, d.t, d.amt, 1); }
  if (undated > 0.005) lk(0, "D", "und", undated);
  // ย่อกล่องต่อคอลัมน์ (คอลัมน์ 2 ขึ้นไป) ไม่เกิน F.fln
  const keep = cols.map((m, c) => (c < 2 ? null : new Set([...m.values()].sort((a, b) => Math.max(b.in, b.out) - Math.max(a.in, a.out)).slice(0, F.fln).map((n) => n.id))));
  const mp = (c, id) => (keep[c] && !keep[c].has(id) && id !== "rem" ? "o" : id);
  const C2 = cols.map(() => new Map()), L2 = new Map();
  for (const l of links.values()) { const a = mp(l.c, l.a), b = mp(l.c + 1, l.b), k = l.c + ":" + a + ">" + (l.c + 1) + ":" + b;
    let o = L2.get(k); if (!o) L2.set(k, (o = { a: l.c + ":" + a, b: (l.c + 1) + ":" + b, v: 0, n: 0 })); o.v += l.v; o.n += l.n;
    for (const [c, id, key] of [[l.c, a, "out"], [l.c + 1, b, "in"]]) { let n = C2[c].get(id); if (!n) C2[c].set(id, (n = { id, c, in: 0, out: 0 })); n[key] += l.v; } }
  const rem = [...links.values()].filter((l) => l.b === "rem").reduce((t, l) => t + l.v, 0);
  return { key: `${F.flm}|${F.fln}|${F.cpm}|${[...F.pq].join(",")}`, cols: C2, links: [...L2.values()], total, undated, n: dons.length, rem, name: q.name };
}
function donorShow(ids, name) {                                         // เรียกจากผลค้นหา / รายละเอียดผู้บริจาค -> แสดงในชาร์ต "เส้นเงินตามตัวกรอง"
  DNQ = { ids, name }; F.dn = true; DNT = null;
  if (ANA_UPD) ANA_UPD();
  const el = $("#flow"); if (el) el.closest(".flowcard").scrollIntoView({ behavior: "smooth", block: "start" });
}
function flowInfo(id) {                                                 // ป้ายตามตั้งค่า (ชื่อ / เลขบัญชี / ทั้งสอง)
  const o = flowInfo0(id), m = PREF.chartLab || "name";
  if (m === "name" || !o.sub || !/\d{4}/.test(o.sub)) return o;
  return m === "acc" ? { ...o, lab: o.sub, sub: o.lab } : { ...o, lab: `${o.lab} · ${o.sub}`, sub: "" };
}
function flowInfo0(id) {
  const t = id[0], k = +id.slice(1);
  if (id === "o" || id === "O") return { lab: "อื่นๆ (รวม)", sub: "", col: "#B0B8C4" };
  if (id === "D") return { lab: DNQ ? DNQ.name : "ผู้บริจาค", sub: "ผู้บริจาค", col: "#F9A825" };
  if (id === "rem") return { lab: "ยังไม่พบรายการโอนออกต่อ (คงอยู่ในบัญชี)", sub: "", col: "#90A4AE" };
  if (id === "nst") return { lab: "บัญชีปลายทางไม่มี statement (ไล่ต่อไม่ได้)", sub: "", col: "#B0BEC5" };
  if (id === "und") return { lab: "ยอดรวมรายย่อย (ไม่มีวันที่รายครั้ง ไล่ต่อไม่ได้)", sub: "", col: "#CFD8DC" };
  if (t === "g" || t === "G") return { lab: DB.groups[k][1].split(" (")[0], sub: "", col: DB.groups[k][2] };
  if (t === "c") { const c = DB.cps[k]; return { lab: c[1] || (c[0] ? `${c[2]} ${c[0]}` : DB.groups[c[3]][1].split(" (")[0]), sub: `${c[2]} ${c[0]}`.trim(), col: DB.groups[c[3]][2] }; }
  const a = DB.accounts[k]; return { lab: a.name || `${a.bank} ${a.acc}`, sub: `${a.bank} ${a.acc}`, col: DB.groups[a.g][2] };
}
function drawFlow(box, pair) {
  if (!box) return;
  const dkey = `${F.flm}|${F.fln}|${F.cpm}|${[...F.pq].join(",")}`;
  if (F.dn && DN && DNQ && (!DNT || DNT.key !== dkey)) DNT = donorTrace();
  const dn = F.dn && DNT ? DNT : null;
  let fb = dn ? { cols: dn.cols, links: dn.links, chain: [] } : flowBuild(pair);
  if (!dn && PREF.flAuto !== false) {                                   // ผู้ใช้เลือกแสดง N คอลัมน์ -> คลี่กล่องใหญ่สุดที่ไล่ต่อได้ของคอลัมน์สุดท้ายจนครบ (ผู้สั่งงาน 19 พ.ย. 69)
    for (let g = 0; g < 8 && 3 + fb.chain.length < F.flc; g++) {
      const last = fb.cols[2 + fb.chain.length]; if (!last) break;
      const usedIds = new Set(fb.chain.flat()), nx = [...last.values()].filter((n) => n.id.length > 1 && n.id !== "rem" && n.id !== "nst" && !usedIds.has(n.id) && srcAccs(n.id).length).sort((a, b) => Math.max(b.in, b.out) - Math.max(a.in, a.out))[0];
      if (!nx) break;
      F.chain = fb.chain.map((a) => [...a]).concat([[nx.id]]); const nb = flowBuild(pair); if (nb.chain.length <= fb.chain.length) break; fb = nb;
    }
  }
  const { cols: C0, links: L0, chain } = fb;
  if (!L0.length) { box.innerHTML = '<p class="muted" style="padding:20px">ไม่มีรายการตามตัวกรอง</p>'; return; }
  const nc = C0.length, first = dn ? 0 : Math.max(C0[0] && C0[0].size ? 0 : 1, nc - Math.max(3, F.flc)), vis = [];
  for (let c = first; c < nc; c++) vis.push(c);
  const cols = vis.map((c) => [...C0[c].values()].map((n) => ({ ...n, v: c === vis[0] && c === 0 ? n.out : Math.max(n.in, n.out), exp: !dn && c >= 2 && n.id !== "o" && srcAccs(n.id).length > 0, sel: !dn && c >= 2 && (chain[c - 2] || []).includes(n.id) }))
    .sort((a, b) => (a.id.length === 1) - (b.id.length === 1) || b.v - a.v));
  const links = L0.filter((l) => +l.a.split(":")[0] >= first);
  const W = Math.max(720, box.clientWidth, vis.length * 250), wide = W > 1000, bw = 14, pad = 7, minH = 20, top = 26;
  const LW = wide ? 250 : 150, gap = (W - LW - bw - (wide ? 200 : 120)) / Math.max(1, vis.length - 1);
  const H0 = Math.max(wide ? 520 : 420, Math.max(...cols.map((c) => c.length)) * 30);
  const sc = Math.min(...cols.filter((c) => c.length).map((c) => (H0 - pad * (c.length - 1)) / c.reduce((t, n) => t + n.v, 0)));
  const pos = {}; let H = 0;
  cols.forEach((c, j) => { let y = top; const x = LW + j * gap; c.forEach((n) => { n.h = Math.max(minH, n.v * sc); n.y = y; n.x = x; n.oi = y; n.oo = y; n.inf = flowInfo(n.id); pos[vis[j] + ":" + n.id] = n; y += n.h + pad; }); H = Math.max(H, y - pad); });
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const mcL = wide ? 30 : 17, mcM = Math.max(10, Math.floor((gap - 40) / 7.2)), mcR = wide ? 28 : 16;
  let svg = "";
  links.sort((a, b) => (pos[a.a]?.y || 0) - (pos[b.a]?.y || 0) || (pos[a.b]?.y || 0) - (pos[b.b]?.y || 0));
  for (const l of links) {
    const s = pos[l.a], t = pos[l.b]; if (!s || !t) continue;
    const th = Math.max(1, l.v * sc), y0 = s.oo + th / 2, y1 = t.oi + th / 2, x0 = s.x + bw, x1 = t.x, mx = (x0 + x1) / 2;
    s.oo += th; t.oi += th;
    svg += `<path class="fl" d="M${x0.toFixed(1)},${y0.toFixed(1)} C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}" stroke="${s.inf.col}" stroke-width="${th.toFixed(1)}" data-tip="${esc(s.inf.lab)} → ${esc(t.inf.lab)} : ${fmt(l.v)} บาท (${fmt0(l.n)} ครั้ง)"/>`;
  }
  cols.forEach((c, j) => c.forEach((n) => {
    const ci = vis[j], f = n.inf, isL = j === 0 && ci === 0, last = j === cols.length - 1, mc = isL ? mcL : last ? mcR : mcM;
    const io = (ci === 1 && n.in > 0) || n.sel || (dn && n.in > 0 && n.out > 0);
    const amt = io ? `เข้า ${M(n.in)} · ออก ${M(n.out)}` : M(n.v);
    const tip = `${f.lab}${f.sub ? " " + f.sub : ""} : ` + (io ? `เงินเข้า ${fmt(n.in)} / เงินออก ${fmt(n.out)} บาท` : `${fmt(n.v)} บาท`) + (n.exp ? (n.sel ? " · กดอีกครั้งเพื่อยุบ" : " · กดเพื่อไล่ทอดถัดไป") : "");
    const tx = isL ? n.x - 6 : n.x + bw + 6, an = isL ? "end" : "start", cy = n.y + n.h / 2, two = n.h >= 32;
    const mark = n.exp ? (n.sel ? " ▼" : " ▶") : "";
    svg += `<g class="fn${n.exp ? " fx" : ""}" data-n="${ci}:${n.id}" data-tip="${esc(tip)}"><rect x="${n.x}" y="${n.y.toFixed(1)}" width="${bw}" height="${n.h.toFixed(1)}" rx="3" fill="${f.col}"${n.sel ? ' stroke="#FFD403" stroke-width="3"' : ""}/>` +
      (two ? `<text x="${tx}" y="${(cy - 3).toFixed(1)}" text-anchor="${an}" class="fl1">${esc(cut(f.lab, mc))}${mark}</text><text x="${tx}" y="${(cy + 12).toFixed(1)}" text-anchor="${an}" class="fl2">${amt}${wide && f.sub && (isL || last) ? " · " + esc(cut(f.sub, 22)) : ""}</text>`
        : `<text x="${tx}" y="${(cy + 4).toFixed(1)}" text-anchor="${an}" class="fl1">${esc(cut(f.lab, Math.max(8, mc - 6)))}${mark} <tspan class="fl2">${ci === 1 ? M(n.v) : amt}</tspan></text>`) + `</g>`;
  }));
  const hdT = (ci) => (dn ? (ci === 0 ? "ผู้บริจาค" : ci === 1 ? "บัญชีรับบริจาค" : `โอนต่อ ทอด ${ci - 1}`) : ci === 0 ? "เงินเข้าจาก" : ci === 1 ? "บัญชี (statement)" : ci === 2 ? "เงินออกไป (ทอด 1)" : `ทอด ${ci - 1}${F.flt !== false ? " · " + trName(trMode()) : ""}`);
  const hd = vis.map((ci, j) => `<text x="${j === 0 && ci === 0 ? LW + bw : LW + j * gap}" y="14" text-anchor="${j === 0 && ci === 0 ? "end" : "start"}" class="flh">${hdT(ci)}</text>`).join("");
  const ban = dn ? `<div class="dnban" style="background:#FFF8E1;border:1px solid #F9A825;border-radius:8px;padding:8px 10px;margin:0 0 6px;font-size:.86rem"><b>ไล่เงินผู้บริจาค:</b> ${esc(dn.name)} — บริจาครวม ${fmt(dn.total)} บาท (${fmt0(dn.n)} ครั้งที่มีวันเวลา) · ไล่ตามรายการโอนออกถัดไปตามเวลาจนครบยอด${dn.rem > 0.5 ? ` · ยังไม่พบรายการโอนออกต่อ ${fmt(dn.rem)} บาท` : ""}${dn.undated > 0.5 ? ` · ยอดรวมรายย่อยไม่มีวันที่ ${fmt(dn.undated)} บาท` : ""}
      <button class="chip" data-dnoff="1" style="margin-left:6px">✕ กลับชาร์ตตามตัวกรอง</button><br><span class="muted">เป็นการไล่ตามลำดับเวลา (สันนิษฐาน) ไม่ใช่การระบุตัวเงิน · ไม่ใช้ตัวกรองช่วงเวลา/บัญชี · เปลี่ยน กลุ่ม/รายบัญชี และจำนวนกล่องได้</span></div>` : "";
  const sk0 = C0[0] && C0[0].size ? 0 : 1;
  box.innerHTML = ban + (first > sk0 ? `<div class="muted" style="font-size:.78rem;padding:2px 8px">◀ ${first - sk0}</div>` : "") +
    `<svg width="${W}" height="${Math.ceil(H + 8)}" viewBox="0 0 ${W} ${Math.ceil(H + 8)}">${hd}${svg}</svg>`;
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
    <div class="fline" style="margin-bottom:8px">${fSearch("ppQ", PPQ, "ค้นหาชื่อ")}${fSel('id="ppF"', PPF, "ทั้งหมด", [["img", "มีภาพ"], ["lnk", "มีลิงก์"], ["per", "บุคคล"], ["org", "นิติบุคคล"]])}<button class="pill ${PPG ? "on" : ""}" data-pg="1" title="สลับ แยกประเภท / รวมทั้งหมด">แยกประเภท</button></div>
    <span hidden></span>
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
  m.onchange = (e) => { if (e.target.id === "ppF") { PPF = e.target.value; render(); } };
  let tm; m.oninput = (e) => { if (e.target.id !== "ppQ") return; clearTimeout(tm); tm = setTimeout(() => { PPQ = e.target.value; render(); const x = $("#ppQ"); if (x) { x.focus(); x.setSelectionRange(PPQ.length, PPQ.length); } }, 300); };
}

/* ---------- ตารางขอข้อมูล STM (ตามแท็บคุมบัญชี) ---------- */
let SF = { st: "", bank: "", q: "", sys: "" };
/* ---------- บัญชี / บุคคล (รวม 4 เมนู: บัญชี · ขอ STM · บุคคล · ไล่เส้นเงิน ; ผู้สั่งงาน 18 พ.ย. 69) ---------- */
let ACS = "tbl", AXF = { g: "", st: "", fz: "", q: "", sort: "" };
const ACS_T = [["tbl", "ตารางบัญชี", "bank"], ["ppl", "บุคคล", "users"], ["trace", "ไล่เส้นเงิน", "route"]];
function pAcct() {
  if (ACS === "ppl") pPpl(); else if (ACS === "trace") pTrace(); else pAccTable();
  const m = $("#main");
  m.insertAdjacentHTML("afterbegin", `<div class="frow subnav only-m" id="acSub" style="margin-bottom:10px">${ACS_T.map(([k, l, ic]) => `<button class="chip ${ACS === k ? "on" : ""}" data-acs="${k}">${IC(ic, 15)} ${l}</button>`).join("")}</div>`);
  $("#acSub").onclick = (e) => { const b = e.target.closest("button[data-acs]"); if (!b) return; e.stopPropagation(); ACS = b.dataset.acs; PV = ""; render(); window.scrollTo(0, 0); };
}
let ACC_ROWS = null;
function accRows() {                                                    // รวมบัญชีจาก แท็บคุมบัญชี + บัญชีที่มี statement + แท็บอายัด -> 1 แถวต่อเลขบัญชี
  if (ACC_ROWS && ACC_ROWS.f === TEAM().fetched) return ACC_ROWS;
  const T1 = new Set(DB.accounts.map((a, i) => (DB.groups[a.g][0] === "t1" ? i : -1)).filter((i) => i >= 0));
  const S = DB.accounts.map(() => ({ inn: 0, out: 0, dep: 0, wd: 0, n: 0 }));
  const rx = new Map();                                                 // เลขบัญชี (ตัด 0 นำหน้า) -> {all, t1, n, by:{ai:amt}} เงินที่บัญชีที่มี statement โอนเข้า
  const cpAcc = DB.cps.map((c) => dg(c[0]));
  DB.tx.forEach((r, i) => { const s = S[r[0]]; s.n += r[5] || 1;
    if (IN_K.includes(r[2])) { s.inn += r[3]; if (r[2] === 1) s.dep += r[3]; return; }
    s.out += r[3]; if (r[2] === 3) s.wd += r[3];
    const k = cpAcc[r[4]]; if (!k) return; let e = rx.get(k); if (!e) rx.set(k, (e = { all: 0, t1: 0, n: 0, by: {} }));
    e.all += r[3]; e.n++; if (T1.has(r[0])) e.t1 += r[3]; e.by[r[0]] = (e.by[r[0]] || 0) + r[3]; });
  const cpG = new Map(); DB.cps.forEach((c) => { const k = dg(c[0]); if (k && !cpG.has(k)) cpG.set(k, c[3]); });
  const fz = tsFrz().secs.flatMap((s) => s.rows.map((r) => ({ ...r, sec: s.title }))), fzm = new Map(fz.map((r) => [dg(r.acc), r]));
  const sheet = tsR("acc").filter((r) => isNo(r[0]) && r[1]).map((r) => ({ no: r[0], acc: r[1], name: r[2], bank: r[3], ref: r[4], data: r[5], wd: r[6], br: r[8], note: r[9] }));
  const map = new Map();
  const cardK = (d) => (d.length === 16 && /^[45]/.test(d) ? d.slice(0, 6) + d.slice(-4) : d);   // เลขบัตรเครดิต 16 หลัก -> เลขบัญชีบัตร 10 หลักตาม statement ธนาคาร (ผู้ใช้ชี้ 18 พ.ย. 69)
  const put = (acc, o) => { const d0 = dg(acc), k = cardK(d0); if (!k) return; if (k !== d0) o = { ...o, card: d0.replace(/(\d{4})(?=\d)/g, "$1 ") }; const e = map.get(k) || { k, acc: String(acc), name: "", bank: "", ai: -1 }; for (const [kk, v] of Object.entries(o)) if (v != null && v !== "" && (e[kk] == null || e[kk] === "" || e[kk] === -1)) e[kk] = v; map.set(k, e); };
  DB.accounts.forEach((a, i) => put(a.acc, { acc: a.acc, name: a.name, bank: a.bank, ai: i, g: a.g }));
  sheet.forEach((r) => put(r.acc, { name: r.name, bank: r.bank, sheet: r }));
  fz.forEach((r) => put(r.acc, { name: r.name, bank: r.bank }));
  const CCI = (DB.cc && DB.cc.card_info) || [];                          // บัตรเครดิตที่มี statement บัตร (เมนูบัตรเครดิต)
  CCI.forEach((c) => put(c.acc, { name: DB.cc.holder || "", bank: "KBANK", card: c.full }));
  const ccAcc = new Map(CCI.map((c) => [c.acc, c])), ccG = CCI.map((c) => cpG.get(c.acc)).find((g) => g != null);
  map.forEach((e) => { if (e.card) { e.acc = e.k; if (e.g == null && !cpG.has(e.k) && ccG != null) e.g = ccG; } });
  const rows = [...map.values()].map((e) => { const s = e.ai >= 0 ? S[e.ai] : null, x = rx.get(e.k) || { all: 0, t1: 0, n: 0, by: {} }, a = e.ai >= 0 ? DB.accounts[e.ai] : null;
    const pc = { kpk: "kpk", lnd: "lnd", ctr: "ctr", con: "con", bld: "bld", sst: "sst", adm: "nom", pco: "pco", relp: "rel", rela: "rel" }[(DB.pmap || {})[nk(e.name || "")]];   // บัญชีในชีตที่ไม่ปรากฏใน statement: ใช้หมวดบุคคล (ชื่อ) จัดกลุ่ม
    const gp = pc ? DB.groups.findIndex((gg) => gg[0] === pc) : -1;
    const g = e.g != null ? e.g : (cpG.has(e.k) ? cpG.get(e.k) : gp >= 0 ? gp : DB.groups.findIndex((gg) => gg[0] === "oth"));
    const st = e.sheet ? e.sheet.data : "";
    if (e.ai < 0 && ccAcc.has(e.k)) return { ...e, g, s, x, fz: fzm.get(e.k) || null, st: "มี statement บัตรเครดิต", stx: st, cc: ccAcc.get(e.k), bal: null, first: "", last: "" };
    return { ...e, g, s, x, fz: fzm.get(e.k) || null, st: e.ai >= 0 ? "ในระบบวิเคราะห์" : /ได้แล้ว/.test(st) ? "ได้แล้ว รอนำเข้า" : st || "ยังไม่ขอ",
      stx: st, bal: a ? a.bal : null, first: a ? a.first : "", last: a ? a.last : "" }; });
  ACC_ROWS = { rows, T1, f: TEAM().fetched };
  return ACC_ROWS;
}
function pAccTable() {                                                 // ตารางบัญชีเรียงเป็นกลุ่ม เริ่มจากบัญชีรับบริจาค + การ์ดหน้าปกกลุ่ม (รูปเจ้าของบัญชี / โลโก้มูลนิธิ) กดดูทั้งกลุ่มได้ (ผู้สั่งงาน 18 พ.ย. 69)
  const { rows } = accRows();
  const q = AXF.q.trim().toLowerCase(), gname = (g) => (DB.groups[g] ? DB.groups[g][1].split(" (")[0] : "อื่น ๆ"), gcol = (g) => (DB.groups[g] ? DB.groups[g][2] : "#999"), gcode = (g) => (DB.groups[g] ? DB.groups[g][0] : "");
  const STS = ["ในระบบวิเคราะห์", "ได้แล้ว รอนำเข้า", ...new Set(rows.map((r) => r.st).filter((s) => !/ในระบบ|รอนำเข้า/.test(s)))];
  const pass = (r, skip) => (skip === "g" || AXF.g === "" || String(r.g) === AXF.g) && (skip === "st" || !AXF.st || r.st === AXF.st) && (!AXF.fz || (AXF.fz === "y" ? r.fz : !r.fz)) &&
    (!q || (r.acc + " " + r.name + " " + r.bank + " " + (r.sheet ? r.sheet.note + r.sheet.ref : "")).toLowerCase().includes(q));
  const ord = (a, b) => (b.x.t1 - a.x.t1) || ((b.s ? b.s.inn : 0) - (a.s ? a.s.inn : 0)) || (b.x.all - a.x.all);
  const gs = [...new Set(rows.map((r) => r.g))].sort((a, b) => a - b);                  // ลำดับกลุ่มตามข้อมูล: บัญชีรับบริจาค -> บุคคลหลัก -> บริษัท -> ญาติ -> เหรัญญิก -> ช่าง ...
  const fzs = rows.filter((r) => r.fz), fzSum = fzs.reduce((t, r) => t + r.fz.amt, 0);
  const tot = (f, k) => rows.filter(f).reduce((t, r) => t + k(r), 0);
  const PH = {}; imgBy((i) => i.cat === "บุคคล").forEach((i) => (PH[nk(i.key)] = i));
  const cover = (g, rs) => { if (gcode(g) === "t1") return imgBy((i) => i.cat === "นิติบุคคล" && /มูลนิธิ/.test(i.key || i.title)).slice(0, 1);
    const seen = new Set(), out = []; for (const r of [...rs].sort(ord)) { const i = PH[nk(r.name)]; if (i && !seen.has(i.id)) { seen.add(i.id); out.push(i); } } return out.slice(0, 3); };
  const coverH = (g, rs, sz) => { const im = cover(g, rs);
    return im.length ? `<span class="gcov" style="--c:${gcol(g)};--n:${im.length}">${im.map((i) => `<img alt="" loading="lazy" style="width:${sz}px;height:${sz}px" src="data:image/jpeg;base64,${i.th}">`).join("")}</span>`
      : `<span class="gcov ico" style="--c:${gcol(g)};width:${sz}px;height:${sz}px;background:${gcol(g)}">${IC(gcode(g) === "t1" ? "build" : /pco|con|bld|ctr/.test(gcode(g)) ? "build" : /cash/.test(gcode(g)) ? "coin" : "user", Math.round(sz * 0.5))}</span>`; };
  const kt = (key, val, ic, v, l, s, cls) => `<button class="tile ${AXF[key] === val && val !== "" ? "on" : ""}" data-axk="${key}" data-axv="${esc(val)}"><span class="ico ${cls || ""}">${IC(ic)}</span><span class="v">${v}</span><span class="l">${l}</span>${s ? `<span class="s">${s}</span>` : ""}</button>`;
  const gsum = (rs) => ({ n: rs.length, stm: rs.filter((r) => r.ai >= 0).length, inn: rs.reduce((t, r) => t + (r.s ? r.s.inn : 0), 0), out: rs.reduce((t, r) => t + (r.s ? r.s.out : 0), 0),
    t1: rs.reduce((t, r) => t + r.x.t1, 0), fz: rs.reduce((t, r) => t + (r.fz ? r.fz.amt : 0), 0), fzn: rs.filter((r) => r.fz).length });
  const card = (g) => { const rs = rows.filter((r) => r.g === g && pass(r, "g")), u = gsum(rs), isT1 = gcode(g) === "t1";
    return !rs.length ? "" : `<button class="gcard ${AXF.g === String(g) ? "on" : ""}" data-axk="g" data-axv="${g}" style="--c:${gcol(g)}">${coverH(g, rs, 64)}
      <span class="gt"><b>${esc(gname(g))}</b><small>${u.n} บัญชี · มี STM ${u.stm}</small><small>${isT1 ? `เงินเข้า ${M(u.inn)} · ออก ${M(u.out)}` : `รับจากบัญชีมูลนิธิ ${M(u.t1)}`}</small>${u.fzn ? `<small class="fz">${IC("lock", 11)} อายัด ${u.fzn} บัญชี ${M(u.fz)}</small>` : ""}</span></button>`; };
  const rowH = (r) => `<tr class="click" data-axr="${r.k}"><td>${esc(r.bank)} ${esc(r.acc)}${r.card ? `<br><small class="muted">บัตรเครดิต ${esc(r.card)}</small>` : ""}</td><td>${esc(r.name)}</td>
      <td><span class="badge ${r.ai >= 0 ? "g" : /รอนำเข้า/.test(r.st) ? "r" : /ขอแล้ว/.test(r.st) ? "y" : ""}">${esc(r.st)}</span></td><td>${r.fz ? `<span class="badge r">${IC("lock", 11)} ${fmt(r.fz.amt)}</span>` : r.cc && r.cc.bal < -0.005 ? `<span class="badge y" title="ยอดชำระเกินค้างในบัตร ณ รอบบิล ${dTh(r.cc.bal_date)} — ยังไม่อายัด">เสนออายัด ${fmt(-r.cc.bal)}</span>` : ""}</td>
      <td class="n">${r.s ? fmt(r.s.inn) : ""}</td><td class="n">${r.s ? fmt(r.s.out) : ""}</td><td class="n">${r.bal != null ? fmt(r.bal) : ""}</td><td class="n">${r.x.t1 ? fmt(r.x.t1) : ""}</td><td class="n">${r.x.all ? fmt(r.x.all) : ""}</td>
      <td>${r.ai >= 0 ? `<button class="chip" data-axa="${r.ai}">${IC("flow", 13)} วิเคราะห์</button>` : r.x.all ? `<button class="chip" data-axq="${esc(r.acc)}">${IC("flow", 13)} เงินเข้าบัญชีนี้</button>` : ""}</td></tr>`;
  const sect = (g) => { const rs = rows.filter((r) => r.g === g && pass(r)).sort(ord); if (!rs.length) return ""; const u = gsum(rs), ais = rs.filter((r) => r.ai >= 0).map((r) => r.ai);
    return `<div class="gsec" style="--c:${gcol(g)}"><div class="ghd">${coverH(g, rs, 46)}<span class="gt"><b>${esc(gname(g))}</b><small>${u.n} บัญชี · เข้า ${M(u.inn)} · ออก ${M(u.out)}${gcode(g) === "t1" ? "" : ` · รับจากบัญชีมูลนิธิ ${M(u.t1)}`}${u.fzn ? ` · อายัด ${u.fzn} บัญชี ${M(u.fz)}` : ""}</small></span>
        <span class="ga">${AXF.g === String(g) ? `<button class="chip" data-axk="g" data-axv="">← ทุกกลุ่ม</button>` : `<button class="chip" data-axk="g" data-axv="${g}">ดูเฉพาะกลุ่มนี้</button>`}${ais.length ? `<button class="chip" data-axg="${ais.join(",")}">${IC("flow", 13)} วิเคราะห์ทั้งกลุ่ม</button>` : ""}</span></div>
      <div class="tblwrap"><table><tr><th>บัญชี</th><th>ชื่อบัญชี</th><th>STM</th><th>อายัด (บาท)</th><th class="n">เงินเข้า</th><th class="n">เงินออก</th><th class="n">คงเหลือล่าสุด</th><th class="n">รับจากบัญชีมูลนิธิ</th><th class="n">รับจากบัญชีที่มี STM</th><th></th></tr>${rs.map(rowH).join("")}</table></div></div>`; };
  const shown = rows.filter((r) => pass(r)).length;
  const m = $("#main");
  m.innerHTML = `<h2>${IC("bank")} บัญชีทั้งหมด <small>${rows.length} บัญชี · ${gs.length} กลุ่ม · ${tsStamp()}</small> ${syncBtn()}</h2>
  <div class="tiles">${kt("st", "ในระบบวิเคราะห์", "chart", rows.filter((r) => r.ai >= 0).length, "มี statement ในระบบ", `เข้า ${M(tot((r) => r.s, (r) => r.s.inn))}`, "g")}
    ${kt("st", "ได้แล้ว รอนำเข้า", "warn", rows.filter((r) => r.st === "ได้แล้ว รอนำเข้า").length, "ได้ STM แล้ว รอนำเข้า", "", "r")}
    ${STS.filter((s) => !/ในระบบ|รอนำเข้า/.test(s)).map((s) => kt("st", s, /ขอแล้ว|รอ/.test(s) ? "clock" : "doc", rows.filter((r) => r.st === s).length, esc(s), "", /ขอแล้ว/.test(s) ? "y" : "")).join("")}
    ${kt("fz", "y", "lock", `${fzs.length}<small> บัญชี</small>`, "อายัดแล้ว", M(fzSum), "r")}
    <div class="tile" style="cursor:default"><span class="ico">${IC("coin")}</span><span class="v">${M(tot((r) => gcode(r.g) !== "t1", (r) => r.x.t1))}</span><span class="l">รับจากบัญชีมูลนิธิ (ทุกบัญชี)</span><span class="s">ตาม statement บัญชีมูลนิธิ</span></div></div>
  <h2>${IC("users")} กลุ่มบัญชี${AXF.g !== "" ? ` ${ibx("back", "ทุกกลุ่ม", 'data-axk="g" data-axv=""')}` : ""}</h2>
  <div class="gcards">${gs.map(card).join("")}</div>
  <div class="card fcard"><div class="fline">${fSearch("axQ", AXF.q, "ค้นหาเลขบัญชี / ชื่อ / เลขหนังสือ / หมายเหตุ")}
    ${fSel('data-axs="g"', AXF.g, "ทุกกลุ่มบัญชี", gs.map((g) => [g, DB.groups[g] ? DB.groups[g][1].split(" (")[0] : "กลุ่ม " + g]))}
    ${fSel('data-axs="st"', AXF.st, "ทุกสถานะ STM", STS.map((x) => [x, `${x} · ${rows.filter((r) => r.st === x).length}`]))}
    ${fClr('data-axk="clear"', AXF.g !== "" || AXF.st || AXF.fz || AXF.q)}</div></div>
  <h2>${IC("list")} รายบัญชี <small>${shown} / ${rows.length} บัญชี</small></h2>
  ${gs.map(sect).join("") || '<p class="muted">ไม่มีบัญชีตามตัวกรอง</p>'}
  <p class="muted" style="font-size:.82rem">รวมจาก: บัญชีที่มี statement ในระบบ + แท็บคุมบัญชี (สถานะขอ STM) + แท็บข้อมูลอายัด ของชีตชุดทำคดี · "รับจากบัญชีมูลนิธิ / บัญชีที่มี STM" ดูจาก statement ฝั่งผู้โอน (เห็นแม้บัญชีนี้ยังไม่มี statement) · คงเหลือล่าสุด = ยอดคงเหลือรายการสุดท้ายใน statement · รูปหน้าปก = ภาพบุคคลจากชีตชุดทำคดี (ถ้ามี)</p>`;
  m.onclick = (e) => { const b = e.target.closest("button");
    if (b && tsClick(b)) return;
    if (b && b.dataset.axa != null) { resetF(); F.accs.add(+b.dataset.axa); F.flm = "d"; return go("ana"); }
    if (b && b.dataset.axg != null) { resetF(); b.dataset.axg.split(",").forEach((i) => F.accs.add(+i)); F.flm = "d"; return go("ana"); }
    if (b && b.dataset.axq != null) { resetF(); F.q = b.dataset.axq; F.flm = "d"; return go("ana"); }
    if (b && b.dataset.axk) { const k = b.dataset.axk; if (k === "clear") AXF = { g: "", st: "", fz: "", q: "", sort: "" }; else AXF[k] = AXF[k] === b.dataset.axv ? "" : b.dataset.axv; render(); if (k === "g" && AXF.g !== "") { const el = $(".gsec"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); } return; }
    const tr = e.target.closest("tr[data-axr]"); if (tr) accDetail(tr.dataset.axr); };
  m.onchange = (e) => { const k = e.target.dataset.axs; if (!k) return; AXF[k] = e.target.value; render(); };
  let tm; m.oninput = (e) => { if (e.target.id !== "axQ") return; clearTimeout(tm); tm = setTimeout(() => { AXF.q = e.target.value; render(); const x = $("#axQ"); if (x) { x.focus(); x.setSelectionRange(AXF.q.length, AXF.q.length); } }, 300); };
}
function accDetail(k) {
  const { rows, T1 } = accRows(), r = rows.find((x) => x.k === k); if (!r) return;
  const top = (side) => { if (r.ai < 0) return []; const mm = new Map();
    DB.tx.forEach((t, i) => { if (t[0] !== r.ai || IN_K.includes(t[2]) !== (side === "in")) return; const ci = cpOf(i); const o = mm.get(ci) || [0, 0]; o[0] += t[3]; o[1] += t[5] || 1; mm.set(ci, o); });
    return [...mm.entries()].sort((a, b) => b[1][0] - a[1][0]).slice(0, 10); };
  const cpRow = ([ci, v]) => { const c = DB.cps[ci]; return `<tr><td>${esc(c[1] || c[0])} <small class="muted">${esc(c[2])} ${esc(c[0])}</small></td><td>${esc(DB.groups[c[3]][1].split(" (")[0])}</td><td class="n">${fmt(v[0])}</td><td class="n">${fmt0(v[1])}</td></tr>`; };
  const s = r.s, by = Object.entries(r.x.by).sort((a, b) => b[1] - a[1]);
  const kp = (l, v, c) => `<div class="card kpi ${c || ""}"><div class="l">${l}</div><div class="v">${M(v)}</div><div class="s">${fmt(v)} บาท</div></div>`;
  openModal(`<h3>${esc(r.bank)} ${esc(r.acc)}<br><small>${esc(r.name)}</small></h3>
    <p><span class="badge ${r.ai >= 0 ? "g" : ""}">${esc(r.st)}</span>${r.stx && r.stx !== r.st ? ` <small class="muted">(${esc(r.stx)})</small>` : ""}${r.fz ? ` <span class="badge r">${IC("lock", 11)} อายัด ${fmt(r.fz.amt)} บาท · ${esc(r.fz.date)} · หนังสือ ${esc(r.fz.ref)}</span>` : ""}${r.first ? ` <small class="muted">statement ${dTh(r.first)} – ${dTh(r.last)}</small>` : ""}</p>
    ${r.sheet ? `<p class="muted" style="font-size:.84rem">เลขที่หนังสือ ${esc(r.sheet.ref || "-")} · รายการถอนเงิน ${esc(r.sheet.wd || "-")}${r.sheet.note ? " · " + esc(r.sheet.note) : ""}</p>` : ""}
    <div class="grid g4">${s ? kp("เงินเข้า", s.inn) + kp("เงินออก", s.out, "r") + kp("ฝากเงินสด", s.dep, "g") + kp("ถอนเงินสด", s.wd, "x") : ""}${r.bal != null ? kp("คงเหลือล่าสุด", r.bal, "y") : ""}${kp("รับจากบัญชีมูลนิธิ", r.x.t1, "r")}${kp("รับจากบัญชีที่มี STM", r.x.all)}</div>
    ${by.length ? `<div class="lab">เงินที่บัญชีที่มี statement โอนเข้าบัญชีนี้</div><div class="tblwrap"><table><tr><th>บัญชีผู้โอน</th><th class="n">ยอด (บาท)</th></tr>${by.map(([ai, v]) => { const a = DB.accounts[ai]; return `<tr><td>${T1.has(+ai) ? "<b>" : ""}${esc(a.name)} <small class="muted">${a.bank} ${a.acc}</small>${T1.has(+ai) ? "</b> <span class='badge r'>บัญชีมูลนิธิ</span>" : ""}</td><td class="n">${fmt(v)}</td></tr>`; }).join("")}</table></div>` : ""}
    ${r.ai >= 0 ? `<div class="lab">เงินเข้าจาก 10 อันดับ</div><div class="tblwrap"><table><tr><th>คู่โอน</th><th>กลุ่ม</th><th class="n">ยอด</th><th class="n">ครั้ง</th></tr>${top("in").map(cpRow).join("")}</table></div>
      <div class="lab">เงินออกไป 10 อันดับ</div><div class="tblwrap"><table><tr><th>คู่โอน</th><th>กลุ่ม</th><th class="n">ยอด</th><th class="n">ครั้ง</th></tr>${top("out").map(cpRow).join("")}</table></div>` : ""}
    <p style="margin-top:12px">${r.ai >= 0 ? `<button class="btn" onclick="closeModal();resetF();F.accs.add(${r.ai});F.flm='d';go('ana')">${IC("flow", 15)} เปิดในหน้าวิเคราะห์</button>` : ""}
      ${r.x.all ? `<button class="btn o" onclick="closeModal();resetF();F.q='${esc(r.acc)}';F.flm='d';go('ana')">${IC("search", 15)} ดูรายการที่โอนเข้าบัญชีนี้</button>` : ""} <button class="btn o" onclick="closeModal()">ปิด</button></p>`);
  enhance($("#modalBox"));
}

/* ---------- ผลการตรวจค้น / ของกลาง ---------- */
/* ตรวจค้น รุ่น 19 พ.ย. 69 (ผู้ใช้สั่ง "แสดงเป็นรายการ มีตัวกรอง เหมือนหน้าอื่น ๆ"): การ์ดชนิดของกลาง (กดกรอง) + ที่ตั้งจุดตรวจค้น/ภาพรวม + ตารางรายการกลาง XT + ภาพของกลาง */
const SRIC = (it) => (/กระเป๋า/.test(it) ? ["bag", "#C2185B"] : /ผ้าพันคอ/.test(it) ? ["scarf", "#7B3FB8"] : /เครื่องประดับ|นาฬิกา/.test(it) ? ["gem", "#D4407A"] : ["box", "#8D6E63"]);
function pSrch() {
  const S = DB.search || { rows: [], sites: {}, report: "" }, ims = imgBy((i) => i.cat === "ตรวจค้น"), m = $("#main");
  const sites = [...new Set([...Object.keys(S.sites || {}), ...S.rows.map((r) => String(r.site))])].sort(), kinds = [...new Set(S.rows.map((r) => r.item))];
  const sm = (rs, k) => rs.reduce((t, r) => t + (r[k] || 0) * (r.n || 1), 0), qty = (rs) => rs.reduce((t, r) => t + (r.n || 1), 0), pr = S.rows.filter((r) => r.used_lo != null);
  const brand = (r) => String(r.model || "").split(/\s+[—-]\s+/)[0] || r.item, mdl = (r) => String(r.model || "").split(/\s+[—-]\s+/).slice(1).join(" — ");
  const confC = (c) => (/สูง/.test(c || "") ? "#1B7A4A" : /ปานกลาง/.test(c || "") ? "#C98A00" : "#B3261E");
  m.innerHTML = `<div class="ahd"><h2>${IC("bag")} ผลการตรวจค้น / ของกลาง <small>ตรวจค้น ${esc(S.made || "")} · ${sites.length} จุด</small></h2></div>
  <div class="acards"><button class="acard tot" data-sri=""><span class="aic">${IC("bag", 24)}</span><span class="acv">${qty(S.rows)} รายการ</span><span class="acl">ของกลางที่ตรวจยึดทั้งหมด</span><span class="acs">ประเมินมือสอง ${M(sm(pr, "used_lo"))} – ${M(sm(pr, "used_hi"))}</span><span class="abar"><i style="width:100%"></i></span></button>
    ${kinds.map((k) => { const rs = S.rows.filter((r) => r.item === k), [ic, c] = SRIC(k); return `<button class="acard" data-sri="${esc(k)}" style="--c:${c}"><span class="aic">${IC(ic, 24)}</span><span class="acv">${qty(rs)}</span><span class="acl">${esc(k)}</span><span class="acs">${sm(rs, "used_hi") ? `มือสอง ${M(sm(rs, "used_lo"))} – ${M(sm(rs, "used_hi"))}` : "ยังไม่ประเมินราคา"}</span><span class="abar"><i style="width:${(qty(rs) / qty(S.rows) * 100).toFixed(1)}%"></i></span></button>`; }).join("")}</div>
  ${sites.map((s) => `<div class="srsite">${IC("pin", 16)} <b>จุดที่ ${s}</b> <span class="muted">${esc((S.sites || {})[s] || "")}</span> <small class="muted">· ${qty(S.rows.filter((r) => String(r.site) === s))} รายการ</small></div>`).join("")}
  ${ims.some((i) => /ภาพรวม/.test(i.title)) ? accd(`${IC("img", 16)} ภาพรวมจุดตรวจค้น`, `${ims.filter((i) => /ภาพรวม/.test(i.title)).length} ภาพ`, `<div class="shots big">${ims.filter((i) => /ภาพรวม/.test(i.title)).map((i) => shot(i)).join("")}</div>`, true) : ""}
  <div id="srX"></div>
  ${ims.some((i) => !/ภาพรวม/.test(i.title)) ? accd(`${IC("img", 16)} ภาพของกลาง`, `${ims.filter((i) => !/ภาพรวม/.test(i.title)).length} ภาพ`, `<div class="shots">${ims.filter((i) => !/ภาพรวม/.test(i.title)).map((i) => shot(i, false)).join("")}</div>`) : ""}
  ${S.report ? accd(`${IC("doc", 16)} รายงานผลการตรวจค้น (ฉบับเต็ม)`, "", `<div class="pgd" style="white-space:pre-wrap">${esc(S.report)}</div>`) : ""}`;
  const XS = xtS("srch");
  const X = xtMount($("#srX"), { id: "srch", title: "รายการของกลาง", ph: "ค้นหายี่ห้อ / รุ่น / ลักษณะ / หมายเหตุ", rows: S.rows, xl: "รายการของกลาง (ตามตัวกรอง)",
    search: (r) => `${r.item} ${r.model} ${r.look} ${r.note} ${r.conf}`, sum: (R) => { const p = R.filter((r) => r.used_lo != null); return `${qty(R)} ชิ้น · มือสอง ${M(sm(p, "used_lo"))} – ${M(sm(p, "used_hi"))}`; },
    cols: [["#", () => 0, "n"], ["จุด", (r) => "จุดที่ " + r.site, "t"], ["ชนิด", (r) => r.item, "t", (r) => { const [ic, c] = SRIC(r.item); return `<span class="acat" style="--c:${c}">${IC(ic, 14)}</span> ${esc(r.item)}`; }],
      ["ยี่ห้อ", brand, "t", (r) => `<b>${esc(brand(r))}</b>`], ["รุ่น / ลักษณะ", (r) => `${mdl(r)} ${r.look || ""}`, "t", (r) => `${mdl(r) ? `<b style="font-weight:600">${esc(mdl(r))}</b><br>` : ""}<small class="muted">${esc(r.look || "")}</small>`],
      ["จำนวน", (r) => r.n || 1, "a"], ["มือสอง ต่ำสุด / ชิ้น", (r) => r.used_lo || 0, "a"], ["มือสอง สูงสุด / ชิ้น", (r) => r.used_hi || 0, "a"], ["ราคาใหม่ สูงสุด", (r) => r.new_hi || 0, "a"],
      ["ความมั่นใจ", (r) => r.conf || "", "t", (r) => (r.conf ? `<span class="srcf" style="--k:${confC(r.conf)}">${esc(r.conf)}</span>` : "")], ["หมายเหตุ", (r) => r.note || "", "t", (r) => `<small>${esc(r.note || "")}</small>`]],
    facets: [["site", "ทุกจุดตรวจค้น", (r) => "จุดที่ " + r.site], ["item", "ทุกชนิด", (r) => r.item, kinds.map((k) => [k, k, SRIC(k)[1]])], ["conf", "ทุกระดับความมั่นใจ", (r) => r.conf || "(ไม่ระบุ)"]],
    onUpdate: () => $$("[data-sri]", m).forEach((b) => b.classList.toggle("on", b.dataset.sri ? !!(XS.f.item && XS.f.item.has(b.dataset.sri)) : !(XS.f.item && XS.f.item.size))),
    note: "ราคาต่อชิ้น (บาท) เป็นช่วงราคามือสองโดยประมาณจากภาพถ่าย ไม่ใช่ราคาประเมินทางการ ต้องให้ผู้เชี่ยวชาญ / ตัวแทนเจ้าของเครื่องหมายการค้าตรวจยืนยัน" });
  m.onclick = (e) => { const a = e.target.closest("[data-sri]"); if (a) { xtSet("srch", "item", a.dataset.sri, true); X.upd(); } };
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
    ${k("work", "users", `${W.filter((r) => /มาพบ/.test(r.st)).length}<small>/${W.length}</small>`, "พยานมาพบแล้ว", "")}
    ${k("srch", "bag", SR.rows.reduce((t, r) => t + (r.n || 0), 0), "ของกลางที่ตรวจยึด", "รายการ")}
    ${k("ppl", "user", people().length, "บุคคลที่เกี่ยวข้อง", "")}
    ${k("trace", "flow", DB.sets.length, "ชุดไล่เส้นเงิน", "")}</div>
  ${big ? `<button class="banner" data-img="${big.id}">${thumbEl(big)}<span><b>${IC("zoom", 18)} ${esc(big.title)}</b></span></button>` : ""}`;
}
const newsBlock = () => { const v = imgBy((i) => i.cat === "ภาพข่าว"); return v.length ? `<h2>${IC("img")} ภาพข่าว / ภาพประกอบ <small>${v.length} ภาพ</small></h2><div class="shots big">${v.map((i) => shot(i)).join("")}</div>` : ""; };
