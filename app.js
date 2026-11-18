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
    `<label>${l}</label>` + (t === "ta" ? `<textarea data-k="${k}">${esc(it[k])}</textarea>`
      : t && t.startsWith("sel:") ? `<select data-k="${k}">${[...new Set([...t.slice(4).split("|"), it[k] || ""])].filter(Boolean).map((o) => `<option${(it[k] || t.slice(4).split("|")[0]) === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`
      : t === "list" ? `<input data-k="${k}" list="dl_${k}" value="${esc(it[k])}" placeholder="เช่น ขอข้อมูลธนาคาร / สอบปากคำ / รายงาน"><datalist id="dl_${k}">${[...new Set(typeof workRows === "function" ? workRows().map((r) => r.type) : [])].map((o) => `<option value="${esc(o)}">`).join("")}</datalist>`
      : `<input data-k="${k}" type="${t === "date" ? "date" : "text"}" value="${esc(it[k])}">`)).join("") +
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
  for (const tbl of root.querySelectorAll("table")) {
    if (tbl.dataset.enh) continue; tbl.dataset.enh = "1";
    const hr = [...tbl.rows].find((tr) => tr.querySelector("th"));
    const custom = hr && hr.querySelector("[data-ts],[data-cs]");
    if (hr && !custom) [...hr.cells].forEach((th, c) => { th.classList.add("srt"); th.title = "กดเพื่อเรียง (กดซ้ำสลับ ▲▼ / ครั้งที่ 3 เอาออก ; กดหลายคอลัมน์ = เรียงหลายชั้น)";
      th.addEventListener("click", (e) => { e.stopPropagation(); const k = tbl._sort = tbl._sort || [], n = k.findIndex((x) => x[0] === c);
        if (n < 0) k.push([c, 1]); else if (k[n][1] === 1) k[n][1] = -1; else k.splice(n, 1); sortTable(tbl); }); });
    if (tbl.closest("#tTx")) continue;                                  // ตารางรายการมีปุ่มส่งออกทุกแถวของตัวเอง
    const host = tbl.closest(".tblwrap") || tbl;
    const bar = document.createElement("div"); bar.className = "xbar";
    bar.innerHTML = `${hr && !custom ? '<button class="chip" data-xr="1" title="กลับลำดับเดิม">↺ ลำดับเดิม</button>' : ""}<button class="chip" data-xl="1">${IC("doc", 13)} Excel</button>`;
    bar.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; e.stopPropagation();
      if (b.dataset.xl) exportTable(tbl, titleNear(host)); else { tbl._sort = []; sortTable(tbl); } };
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
const TABS = [["over", "ภาพรวม", "chart"], ["case", "คดี", "book"], ["charges", "ข้อหา", "scale"], ["defences", "ข้อต่อสู้", "shield"], ["work", "งาน / ความคืบหน้า", "list"], ["acct", "บัญชี / บุคคล", "bank"], ["asset", "ทรัพย์สิน", "coin"], ["cc", "บัตรเครดิต", "card"], ["srch", "ตรวจค้น", "bag"], ["ana", "วิเคราะห์", "flow"], ["img", "ภาพ", "img"]];
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
function go(t) { PV = ""; AV = ""; if (t === "prog") t = "work"; if (t === "stm" || t === "acc") { ACS = "tbl"; t = "acct"; } else if (t === "ppl" || t === "trace") { ACS = t; t = "acct"; } TAB = TABS.some((x) => x[0] === t) ? t : "over"; history.replaceState(null, "", "#" + TAB); $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === TAB)); render(); window.scrollTo(0, 0); }
function killCharts() { Object.values(CH).forEach((c) => c.destroy()); CH = {}; }
function render() { killCharts(); ONRS = null; const m_ = $("#main"); m_.onclick = m_.onchange = m_.oninput = null; ({ over: pOver, case: pCase, charges: pCharges, defences: pDef, work: pWork, prog: pWork, acct: pAcct, asset: pAsset, cc: pCc, srch: pSrch, ana: pAna, img: pImg })[TAB](); navStats(); }
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
let EVY = "", CHV = -1, DFF = "", WKF = "todo", CHF = "";
function pCase() {
  const ev = [...C.events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const yrs = [...new Set(ev.map((e) => String(e.date).slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))];
  const show = ev.filter((e) => !EVY || String(e.date).startsWith(EVY)), wide = isWide();
  $("#main").innerHTML = `<h2>${IC("book")} รายละเอียดคดี <small>${C.case.length} หัวข้อ</small> ${addBtn("case")}</h2>
  <div class="accs">${C.case.map((s) => accd(`${sico(icFor(s.title))} ${esc(s.title)}`, "", `<div class="pgd">${esc(s.detail)}</div>${acts2("case", s.id)}`, wide)).join("")}</div>
  <h2>${IC("cal")} ลำดับเหตุการณ์ <small>${show.length} / ${ev.length} เหตุการณ์</small> ${addBtn("events")}</h2>
  <div class="fline" style="margin-bottom:8px">${fSel('id="evY"', EVY, `ทุกปี · ${ev.length} เหตุการณ์`, yrs.map((y) => [y, `ปี ${+y + 543} · ${ev.filter((e) => String(e.date).startsWith(y)).length} เหตุการณ์`]))}</div>
  <div class="accs">${show.map((e) => accd(`<span class="dt">${dTh(e.date)}</span> ${esc(e.title)}`, "", `<div class="pgd">${esc(e.detail)}</div>${acts2("events", e.id)}`, false, "tlr")).join("")}</div>${newsBlock()}`;
  $("#main").onchange = (e) => { if (e.target.id === "evY") { EVY = e.target.value; render(); } };
}
const fSel = (attr, cur, allLab, opts) => `<select class="pill fsel ${cur !== "" && cur != null ? "on" : ""}" ${attr}><option value="">${esc(allLab)}</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const fSearch = (id, val, ph) => `<label class="sbox">${IC("search", 16)}<input type="search" id="${id}" value="${esc(val)}" placeholder="${ph}"></label>`;
const fClr = (attr, on) => (on ? `<button class="pill x" ${attr}>✕ ล้างตัวกรอง</button>` : "");
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
  const m = $("#main");
  m.innerHTML = `<h2>${IC("scale")} ผู้ต้องหาและข้อหา <small>${P.length} ราย · กดการ์ดเพื่อกรองตาราง</small> ${addBtn("charges")}</h2>
  <div class="tiles"><button class="tile ${!sel ? "on" : ""}" data-cf=""><span class="ico">${IC("users")}</span><span class="v">${P.length}<small> ราย</small></span><span class="l">ผู้ต้องหาทั้งหมด</span></button>${COMBO.map(tile).join("")}</div>
  <h2>${IC("list")} ใครถูกแจ้ง / ถูกเสนอข้อหาใด <small>${show.length} ราย${sel ? " · " + esc(cLab(sel)) : ""}</small></h2>
  <div class="tblwrap"><table class="cmx"><tr><th class="pt">รูป</th><th>ผู้ต้องหา</th><th>บทบาท</th>${CATS.map(([, l]) => `<th class="c">${esc(l)}</th>`).join("")}<th>สถานะ</th></tr>
    ${show.map((p) => `<tr class="click" data-c="${p.i}"><td class="pt">${p.img ? thumbEl(p.img, "tph") : `<span class="tph">${IC("user", 22)}</span>`}</td><td><b>${esc(p.s.title)}</b></td><td>${esc(p.s.extra1)}</td>${CATS.map(([k, , , , col]) => `<td class="c">${tick(p.cats.has(k), col)}</td>`).join("")}<td>${stat(p)}</td></tr>`).join("")}
  </table></div>
  <p class="muted" style="font-size:.82rem">ข้อหาตามเนื้อหาที่บันทึกในเว็บ (ตามข่าว / มติ) ; วันนัดแจ้งข้อกล่าวหาจากแท็บ "คุมหมายเรียกผู้ต้องหา" ของชีตชุดทำคดี — กดแถวเพื่อดูข้อหารายข้อ</p>`;
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
function pDef() {
  const who = [...new Set(C.defences.map((s) => s.extra1).filter(Boolean))], show = C.defences.filter((s) => !DFF || s.extra1 === DFF);
  const ft = (k, ic, n, l) => `<button class="tile ${DFF === k ? "on" : ""}" data-df="${esc(k)}"><span class="ico">${IC(ic)}</span><span class="v">${n}</span><span class="l">${esc(l)}</span></button>`;
  $("#main").innerHTML = `<h2>${IC("shield")} ข้อต่อสู้ที่ต้องพิสูจน์ทราบ <small>${show.length} / ${C.defences.length} ประเด็น</small> ${addBtn("defences")}</h2>
  <div class="tiles">${ft("", "shield", C.defences.length, "ทั้งหมด")}${who.map((w) => ft(w, "user", C.defences.filter((s) => s.extra1 === w).length, w)).join("")}</div>
  <div class="accs" style="margin-top:6px">${show.map((s) => accd(`${sico("shield")} ${esc(s.title)}`, stDot(s.status),
    `<div class="pgm"><span class="badge">${IC("user", 13)} ${esc(s.extra1)}</span>${badge(s.status)}</div><div class="lab">${IC("search", 14)} ต้องพิสูจน์</div><div class="pgd">${esc(s.detail)}</div><div class="lab">${IC("doc", 14)} หลักฐานที่มี</div><div class="pgd">${esc(s.extra2)}</div>${acts2("defences", s.id)}`)).join("")}</div>`;
  $("#main").onclick = (e) => { const b = e.target.closest("[data-df]"); if (b) { DFF = b.dataset.df; render(); } };
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
function pAsset() { // ทรัพย์สินส่วนตัว: ตารางเดียว + สถานะ ยึด / อายัด / อยู่ระหว่างดำเนินการ (ผู้สั่งงาน 18 พ.ย. 69) + การใช้บัตรเครดิต
  const S = tsSum(), FZ = tsFrz(), fz = FZ.secs.flatMap((s) => s.rows), fzSum = fz.reduce((t, r) => t + r.amt, 0);
  const OWNS = (DB.own || []).map(([rx, lab]) => [new RegExp(rx), lab]);
  const OWN = (o) => { const h = OWNS.find(([rx]) => rx.test(o || "")); return h ? h[1] : o || "-"; };
  const AST = { seized: ["ยึดแล้ว", "r"], frozen: ["อายัดแล้ว", "r"], doing: ["อยู่ระหว่างดำเนินการ", "y"], none: ["ยังไม่มีข้อมูลยึด/อายัด", ""] };
  const R = [];
  tsLand().forEach((r) => R.push({ type: "ที่ดิน / สิ่งปลูกสร้าง", ic: "home", own: OWN(r.own), name: `${r.loc}${r.deed ? " (เลขที่ " + r.deed + ")" : ""}`, sub: [r.area, r.bld && !/ไม่พบ/.test(r.bld) ? r.bld : "", r.date ? "ได้มา " + r.date : "", /จำนอง/.test(r.mort) ? "ติดจำนอง" : ""].filter(Boolean).join(" · "), val: r.price, st: /ดำเนินการ/.test(r.act) && !/^การดำเนินการ$/.test(r.act) ? "doing" : "none", note: r.act || "" }));
  S.filter((s) => !/ที่ดิน/.test(s.name)).forEach((s) => s.items.forEach((x) => R.push({ type: secNm(s.name), ic: secIc(s.name), own: OWN(s.own[x[2]]), name: x[0], sub: "", val: x[1], st: "none", note: "" })));
  (DB.search?.rows || []).forEach((r) => R.push({ type: "ของกลางจากการค้น", ic: "bag", own: "จุดที่ " + r.site, name: `${r.item} ${r.model || ""}`.trim(), sub: r.look || "", val: ((r.used_lo || 0) + (r.used_hi || 0)) / 2 * (r.n || 1), st: "seized", note: `ประเมินมือสอง ${fmt0(r.used_lo)}–${fmt0(r.used_hi)} บาท${r.n > 1 ? " × " + r.n : ""}` }));
  FZ.secs.forEach((s) => R.push({ type: "เงินในบัญชี", ic: "lock", n: s.rows.length, own: /มูลนิธิ/.test(s.title) ? "บัญชีมูลนิธิ" : (OWNS.find(([rx]) => rx.test(s.title)) || [0, "อื่น ๆ"])[1], name: `${s.title || "บัญชีที่อายัด"} (${s.rows.length} บัญชี)`, sub: "รายบัญชีดูที่หน้า ขอ STM", val: s.rows.reduce((t, r) => t + r.amt, 0), st: "frozen", note: "", go: "stm" }));
  const types = [...new Set(R.map((r) => r.type))], owners = [...new Set(R.map((r) => r.own))];
  const q = ASF.q.trim().toLowerCase();
  const show = R.filter((r) => (!ASF.st || r.st === ASF.st) && (!ASF.type || r.type === ASF.type) && (!ASF.own || r.own === ASF.own) && (!q || (r.name + r.sub + r.note + r.own).toLowerCase().includes(q)));
  const sum = (f) => R.filter(f).reduce((t, r) => t + (r.val || 0), 0), cnt = (f) => R.filter(f).length, all = sum((r) => r.own !== "บัญชีมูลนิธิ");
  const kt = (key, val, ic, v, l, s, cls) => `<button class="tile ${ASF[key] === val && val ? "on" : ""}" data-ak="${key}" data-av="${esc(val)}"><span class="ico ${cls || ""}">${IC(ic)}</span><span class="v">${v}</span><span class="l">${l}</span>${s ? `<span class="s">${s}</span>` : ""}</button>`;
  const m = $("#main");
  const mine = (r) => r.own !== "บัญชีมูลนิธิ";
  const CARDS = [["ที่ดิน / สิ่งปลูกสร้าง", "ที่ดิน / สิ่งปลูกสร้าง", "home"], ["รถยนต์", "รถยนต์", "car"], ["ของกลางจากการค้น", "ของกลางจากการค้น", "bag"], ["เงินในบัญชี", "เงินในบัญชี (อายัดแล้ว)", "lock"]];
  const known = new Set(CARDS.map((c) => c[0])), others = types.filter((t) => !known.has(t));
  others.forEach((t) => CARDS.push([t, t === "ทรัพย์สินอื่น" ? "ทรัพย์สินอื่น (ประกัน / กองทุน-หุ้น / สลาก)" : t, "shield"]));
  const stLine = (rs) => Object.entries(AST).map(([k, v]) => { const n = rs.filter((r) => r.st === k).length; return n && k !== "none" ? `${v[0]} ${n}` : ""; }).filter(Boolean).join(" · ");
  const tcard = ([t, lab, ic], no) => { const rs = R.filter((r) => r.type === t && mine(r)), fnd = R.filter((r) => r.type === t && !mine(r)), v = rs.reduce((a, r) => a + (r.val || 0), 0);
    return `<button class="tile ${ASF.type === t ? "on" : ""}" data-ak="type" data-av="${esc(t)}"><span class="ico">${IC(ic)}</span><span class="v">${M(v)}</span><span class="l">${no}. ${esc(lab)}</span>
      <span class="s">${t === "เงินในบัญชี" ? rs.reduce((a, r) => a + (r.n || 1), 0) + " บัญชี · อายัดแล้ว" : rs.length + " รายการ" + (stLine(rs) ? " · " + stLine(rs) : "")}${fnd.length ? `<br>บัญชีมูลนิธิอีก ${M(fnd.reduce((a, r) => a + (r.val || 0), 0))} (ไม่นับเป็นทรัพย์ส่วนตัว)` : ""}</span></button>`; };
  m.innerHTML = `<h2>${IC("coin")} ทรัพย์สินส่วนตัว <small>${tsStamp()}</small> ${syncBtn()}</h2>
  <div class="tiles"><button class="tile ${!ASF.type && !ASF.st && !ASF.own && !ASF.q ? "on" : ""}" data-ak="clear"><span class="ico y">${IC("coin")}</span><span class="v">${M(all)}</span><span class="l">1. มูลค่าทรัพย์สินส่วนตัว</span><span class="s">${cnt(mine)} รายการ · ผลรวมการ์ดข้อ 2–${CARDS.length + 1}</span></button>
    ${CARDS.map((c, i) => tcard(c, i + 2)).join("")}</div>
  <div class="card fcard"><div class="fline">${fSearch("asQ", ASF.q, "ค้นหาทรัพย์สิน / ที่ตั้ง / หมายเหตุ")}
    ${fSel('data-as="st"', ASF.st, "ทุกสถานะ", Object.entries(AST).map(([k, v]) => [k, `${v[0]} · ${cnt((r) => r.st === k)} รายการ · ${M(sum((r) => r.st === k))}`]))}
    ${fSel('data-as="own"', ASF.own, "ทุกเจ้าของ / ที่พบ", owners.map((o) => [o, `${o} · ${cnt((r) => r.own === o)}`]))}
    ${fClr('data-ak="clear"', ASF.st || ASF.type || ASF.own || ASF.q)}</div></div>
  <h2>${IC("list")} รายการทรัพย์สิน <small>${show.length} / ${R.length} รายการ · ${M(show.reduce((t, r) => t + (r.val || 0), 0))}</small></h2>
  <div class="tblwrap tall"><table><tr><th>#</th><th>ประเภท</th><th>ทรัพย์สิน</th><th>เจ้าของ / ที่พบ</th><th class="n">มูลค่า (บาท)</th><th>สถานะ</th><th>หมายเหตุ</th></tr>
    ${show.map((r, i) => `<tr${r.go ? ` class="click" data-go="${r.go}"` : ""}><td>${i + 1}</td><td>${IC(r.ic, 14)} ${esc(r.type)}</td><td><b>${esc(r.name)}</b>${r.sub ? `<br><small class="muted">${esc(r.sub)}</small>` : ""}</td><td>${esc(r.own)}</td><td class="n">${r.val ? fmt0(r.val) : "–"}</td><td><span class="badge ${AST[r.st][1]}">${AST[r.st][0]}</span></td><td><small>${esc(r.note)}</small></td></tr>`).join("")}</table></div>
  <p class="muted" style="font-size:.82rem">สถานะ: "ยึดแล้ว" = ของกลางจากการตรวจค้น 11 พ.ย. 69 (มูลค่า = ค่ากลางราคาประเมินมือสอง) · "อายัดแล้ว" = เงินในบัญชีตามแท็บข้อมูลอายัด · "อยู่ระหว่างดำเนินการ" = คอลัมน์การดำเนินการของแท็บทรัพย์สินที่ดิน · ที่เหลือชีตยังไม่ระบุการยึด/อายัด ; ข้อมูลจากชีตชุดทำคดี (อ่านอย่างเดียว)</p>
  ${DB.cc ? `<p style="margin-top:10px"><button class="chip" data-ak="cc">${IC("card", 14)} ดูการใช้บัตรเครดิต (เมนูบัตรเครดิต) ${M(DB.cc.total)}</button></p>` : ""}`;
  m.onclick = (e) => { const b = e.target.closest("button"); const tr = e.target.closest("tr[data-go]");
    if (tr && !b) return go(tr.dataset.go);
    if (!b || tsClick(b)) return; const k = b.dataset.ak; if (!k) return;
    if (k === "cc") return go("cc");
    if (k === "clear") ASF = { st: "", type: "", own: "", q: "" }; else ASF[k] = ASF[k] === b.dataset.av ? "" : b.dataset.av; render(); };
  m.onchange = (e) => { const k = e.target.dataset.as; if (!k) return; ASF[k] = e.target.value; render(); };
  let tm; m.oninput = (e) => { if (e.target.id !== "asQ") return; clearTimeout(tm); tm = setTimeout(() => { ASF.q = e.target.value; render(); const x = $("#asQ"); if (x) { x.focus(); x.setSelectionRange(ASF.q.length, ASF.q.length); } }, 300); };
}
let ASF = { st: "", type: "", own: "", q: "" };
function pCc() {                                                        // เมนูบัตรเครดิต (แยกจากหน้าทรัพย์สิน ; ผู้สั่งงาน 18 พ.ย. 69)
  const m = $("#main");
  if (!DB.cc) { m.innerHTML = '<p class="muted">ยังไม่มีข้อมูลบัตรเครดิต</p>'; return; }
  m.innerHTML = ccBlock(DB.cc);
  ccCharts(DB.cc);
}
const NATC = { per: "#B3261E", chr: "#1B7A4A", fin: "#9E9E9E" };
function ccBlock(C) {
  const nat = Object.fromEntries(C.nature.map((x) => [x.k, x])), t1 = C.pay.src.filter((s) => s.t1).reduce((t, s) => t + s.amt, 0);
  const CI = C.card_info || [], RF = C.card_refunds || [], rfSum = RF.reduce((t, r) => t + r.amt, 0), over = CI.reduce((t, c) => t + (c.bal < 0 ? -c.bal : 0), 0);
  const trips = C.trips.reduce((t, x) => t + x.amt, 0);
  return `<div id="ccBlk"></div><h2>${IC("card")} การใช้บัตรเครดิต ${esc(C.holder || "")} <small>KBANK VISA x${C.cards.map((c) => c.card).join(" / x")} · ${dTh(C.range[0])} – ${dTh(C.range[1])} · statement ${C.files} ฉบับ</small></h2>
  <div class="grid g4 kp8">${[["ยอดใช้จ่ายสุทธิ", C.total, `${fmt0(C.n)} รายการ`, ""], ["ใช้ส่วนตัว", nat.per?.amt || 0, `${((nat.per?.amt || 0) / C.total * 100).toFixed(1)}%`, "r"], ["บริจาค / ทำบุญ", nat.chr?.amt || 0, `${((nat.chr?.amt || 0) / C.total * 100).toFixed(2)}% · ${(C.chr || []).length} รายการ`, "g"],
    ["สินค้าแบรนด์เนม / เครื่องประดับ", (C.types.find((t) => t.k === "lux") || {}).amt || 0, `${(C.types.find((t) => t.k === "lux") || {}).n || 0} รายการ`, ""],
    ["ชำระค่าบัตรจากบัญชีรับบริจาค", t1, `${(t1 / C.pay.total * 100).toFixed(1)}% ของยอดชำระ`, "r"], ["เงินชำระเกินในบัตร โอนคืนเข้าบัญชีส่วนตัว", rfSum, RF.length ? `${RF.length} ครั้ง · ยังค้างในบัตรอีก ${M(over)}` : "ไม่พบ", "x"],
    ["เดินทางต่างประเทศ", trips, `${C.trips.length} ทริป`, ""], ["หลังตั้งมูลนิธิ (25 มิ.ย. 65)", C.period["หลังตั้งมูลนิธิ"]?.[0] || 0, `${fmt0(C.period["หลังตั้งมูลนิธิ"]?.[1] || 0)} รายการ`, ""]]
    .map(([l, v, s, c]) => `<div class="card kpi ${c}"><div class="l">${l}</div><div class="v">${M(v)}</div><div class="s">${fmt(v)} บาท</div><div class="s">${s}</div></div>`).join("")}</div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><div class="lab" style="margin-top:0">ตามประเภทร้านค้า</div><div class="chartbox tall"><canvas id="cCcT"></canvas></div></div>
    <div class="card"><div class="lab" style="margin-top:0">รายปี (พ.ศ.)</div><div class="chartbox tall"><canvas id="cCcY"></canvas></div></div></div>
  ${CI.length ? `<h2>${IC("card")} บัตรแต่ละใบ <small>เลขบัญชีบัตรใน statement ธนาคาร = 6 หลักแรก + 4 หลักท้ายของเลขบัตร</small></h2>
  <div class="tblwrap"><table><tr><th>เลขบัตร</th><th>บัญชีบัตร (statement ธนาคาร)</th><th>ประเภท</th><th>ช่วงรายการ</th><th class="n">ใช้จ่ายสุทธิ</th><th class="n">ชำระเข้าบัตร</th><th class="n">จากบัญชีรับบริจาค</th><th class="n">ยอดคงค้างล่าสุด</th></tr>
    ${CI.map((c) => `<tr><td><b>${esc(c.full)}</b></td><td>KBANK ${esc(c.acc)}</td><td>${esc(c.ctype)}</td><td>${dTh(c.first)} – ${dTh(c.last)} <small class="muted">(${c.stmts} ฉบับ)</small></td><td class="n">${fmt(c.amt)}</td><td class="n">${fmt(c.pay)}</td><td class="n">${c.pay_t1 ? `<b style="color:var(--red)">${fmt(c.pay_t1)}</b>` : ""}</td><td class="n">${c.bal < 0 ? `<b>${fmt(c.bal)}</b><br><small class="muted">ชำระเกิน</small>` : fmt(c.bal || 0)}</td></tr>`).join("")}</table></div>
  ${RF.length ? `<p class="muted" style="font-size:.86rem;margin:.5em 0 0">${IC("warn", 14)} ยอดเงินเกินในบัตรที่โอนคืนเข้าบัญชีเงินฝาก: ${RF.map((r) => `บัตร x${r.card} ${dTh(r.d)} <b>${fmt(r.amt)}</b> บาท → ${esc((r.name || "ไม่พบใน statement ธนาคาร").replace(/^KBNK /, "KBANK "))}${r.time ? " (" + esc(r.time) + ")" : ""}`).join(" ; ")}</p>` : ""}` : ""}
  <h2>${IC("bank")} เงินที่ใช้ชำระค่าบัตรมาจากบัญชีใด <small>จับคู่ statement ธนาคาร ยอดเท่ากัน ห่าง ≤ 3 วัน</small></h2>
  <div class="tblwrap"><table><tr><th>บัญชีต้นทาง</th><th class="n">ยอด (บาท)</th><th class="n">ครั้ง</th><th class="n">ก่อนตั้งมูลนิธิ</th><th class="n">หลังตั้งมูลนิธิ</th></tr>
    ${C.pay.src.map((s) => `<tr><td>${s.t1 ? `<b style="color:var(--red)">${esc(s.name.replace(/^KBNK /, "KBANK "))}</b> <span class="badge r">บัญชีรับบริจาค</span>` : esc(s.name.replace(/^KBNK /, "KBANK "))}</td><td class="n">${fmt(s.amt)}</td><td class="n">${fmt0(s.n)}</td><td class="n">${fmt(s.before)}</td><td class="n">${fmt(s.after)}</td></tr>`).join("")}
    ${(C.pay.bank_unmatched.by || []).map((r) => `<tr><td>${esc(r[0].replace(/^KBNK /, "KBANK "))} <small class="muted">(ไม่อยู่ใน statement บัตรชุดนี้)</small></td><td class="n">${fmt(r[1])}</td><td class="n">${fmt0(r[2])}</td><td></td><td></td></tr>`).join("")}</table></div>
  <h2>${IC("list")} ประเภทการใช้จ่าย</h2>
  <div class="tblwrap"><table><tr><th>ประเภท</th><th>ลักษณะ</th><th class="n">ยอด (บาท)</th><th class="n">ครั้ง</th><th class="n">ก่อนตั้ง</th><th class="n">หลังตั้ง</th></tr>
    ${C.types.map((t) => `<tr><td>${esc(t.label)}</td><td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${NATC[t.nat]}"></span> ${esc({ per: "ใช้ส่วนตัว", chr: "บริจาค/ทำบุญ" }[t.nat] || t.nat)}</td><td class="n">${fmt(t.amt)}</td><td class="n">${fmt0(t.n)}</td><td class="n">${fmt(t.before)}</td><td class="n">${fmt(t.after)}</td></tr>`).join("")}</table></div>
  ${accd(`${IC("users", 16)} ร้านค้ารายใหญ่ (รวมสาขา)`, `${C.merchants.length} อันดับ`, `<div class="tblwrap"><table><tr><th>#</th><th>ร้านค้า</th><th>ประเภท</th><th class="n">ยอด (บาท)</th><th class="n">ครั้ง</th></tr>${C.merchants.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.m)}</td><td>${esc(x.type)}</td><td class="n">${fmt(x.amt)}</td><td class="n">${fmt0(x.n)}</td></tr>`).join("")}</table></div>`)}
  ${accd(`${IC("route", 16)} เดินทางต่างประเทศ`, `${C.trips.length} ทริป · ${M(trips)}`, `<div class="tblwrap"><table><tr><th>#</th><th>วันแรก</th><th>วันสุดท้าย</th><th>ประเทศ</th><th class="n">ยอด (บาท)</th><th class="n">ครั้ง</th><th>รายการใหญ่สุด</th></tr>${C.trips.map((t) => `<tr><td>${t.no}</td><td>${dTh(t.start)}</td><td>${dTh(t.end)}</td><td>${esc(t.countries)}</td><td class="n">${fmt(t.amt)}</td><td class="n">${fmt0(t.n)}</td><td><small>${t.top.slice(0, 2).map(([v, d]) => `${esc(d)} ${fmt0(v)}`).join("<br>")}</small></td></tr>`).join("")}</table></div>`)}
  ${accd(`${IC("warn", 16)} รายการตั้งแต่ 50,000 บาท`, `${C.big.length} รายการ`, `<div class="tblwrap"><table><tr><th>วันที่</th><th>บัตร</th><th>ร้านค้า</th><th>เมือง/ประเทศ</th><th>ประเภท</th><th class="n">ยอด (บาท)</th></tr>${C.big.map((x) => `<tr><td>${dTh(x.d)}</td><td>x${x.card}</td><td>${esc(x.m)}</td><td>${esc(x.loc)}</td><td>${esc(x.type)}</td><td class="n">${fmt(x.amt)}</td></tr>`).join("")}</table></div>`)}
  ${accd(`${IC("check", 16)} บริจาค / ทำบุญ`, `${(C.chr || []).length} รายการ · ${fmt((C.chr || []).reduce((t, x) => t + x.amt, 0))} บาท`, `<div class="tblwrap"><table><tr><th>วันที่</th><th>ร้านค้า/องค์กร</th><th>เมือง</th><th>ประเภท</th><th class="n">ยอด (บาท)</th></tr>${(C.chr || []).map((x) => `<tr><td>${dTh(x.d)}</td><td>${esc(x.m)}</td><td>${esc(x.loc)}</td><td>${esc(x.type)}</td><td class="n">${fmt(x.amt)}</td></tr>`).join("")}</table></div>`)}
  ${accd(`${IC("list", 16)} รายการทั้งหมด`, `${fmt0(C.tx.length)} แถว`, `<div class="tblwrap tall"><table><tr><th>วันที่</th><th>บัตร</th><th>ร้านค้า</th><th>เมือง/ประเทศ</th><th>ประเภท</th><th>ประเทศ</th><th class="n">ยอด (บาท)</th></tr>${C.tx.map((r) => `<tr><td>${dTh(r[0])}</td><td>x${r[1]}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${esc(r[6])}</td><td class="n">${fmt(r[7])}</td></tr>`).join("")}</table></div>`)}
  <p class="muted" style="font-size:.82rem">จัดประเภทจากชื่อร้านค้าตาม statement บัตร (ไม่ใช่รายการสินค้าจริง) ต้องยืนยันด้วยใบเสร็จ ; รายงานฉบับเต็ม + Excel Pivot อยู่ในโฟลเดอร์ 4_รายงานนำเสนอ/8_บัตรเครดิต</p>`;
}
function ccCharts(C) {
  if (!C || !$("#cCcT")) return;
  const T = C.types.filter((t) => t.amt > 0).slice(0, 14);
  CH.ccT = new Chart($("#cCcT"), { type: "bar", data: { labels: T.map((t) => t.label.length > 30 ? t.label.slice(0, 29) + "…" : t.label), datasets: [{ label: "ล้านบาท", data: T.map((t) => t.amt / 1e6), backgroundColor: T.map((t) => NATC[t.nat]) }] },
    options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${fmt(c.raw * 1e6)} บาท (${fmt0(T[c.dataIndex].n)} ครั้ง)` } } }, scales: { y: { ticks: { font: { size: 11 } } } } } });
  const keys = C.types.slice(0, 6).map((t) => t.k + ":" + t.nat), cols = ["#00264D", "#B3261E", "#1565C0", "#8E44AD", "#16A085", "#D35400"];
  CH.ccY = new Chart($("#cCcY"), { type: "bar", data: { labels: C.years.map((y) => String(y.y + 543)), datasets: [...keys.map((k, i) => ({ label: C.types[i].label.split(" / ")[0], data: C.years.map((y) => (y.types[k] || 0) / 1e6), backgroundColor: cols[i], stack: "s" })),
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
  accRows().rows.forEach((r) => R.push({ type: "ขอข้อมูลบัญชี (STM)", ic: "bank", title: `${r.bank} ${r.acc} ${r.name}`.trim(),
    detail: [r.sheet && r.sheet.ref ? "หนังสือ " + r.sheet.ref : "", r.sheet && r.sheet.wd ? "ถอนเงิน: " + r.sheet.wd : "", r.sheet ? r.sheet.note : "", r.fz ? `อายัด ${fmt(r.fz.amt)} บาท` : ""].filter(Boolean).join(" · "),
    own: "", date: "", stx: r.st, st: r.ai >= 0 || r.cc ? "done" : /รอนำเข้า/.test(r.st) ? "doing" : /ขอแล้ว|รอ/.test(r.st) ? "wait" : "todo", go: "acct" }));
  tsCo().forEach((r) => R.push({ type: "หมายเรียกนิติบุคคล", ic: "build", title: r.name, detail: r.type, own: "", date: "", stx: "", st: "none" }));
  return R;
}
function pWork() {
  const R = workRows(), types = [...new Set(R.map((r) => r.type))], owners = [...new Set(R.map((r) => r.own).filter(Boolean))].sort();
  const q = WF.q.trim().toLowerCase();
  const pass = (r, skip) => (skip === "type" || !WF.type || r.type === WF.type) && (skip === "st" || !WF.st || r.st === WF.st) && (!WF.own || r.own === WF.own) && (!q || (r.title + r.detail + r.own + r.stx).toLowerCase().includes(q));
  const show = R.filter((r) => pass(r)).sort((a, b) => (a.st === "done") - (b.st === "done") || String(b.date).localeCompare(String(a.date)));
  const done = R.filter((r) => r.st === "done").length, pct = R.length ? Math.round(done / R.length * 100) : 0;
  const tcard = (t) => { const v = R.filter((r) => r.type === t), d = v.filter((r) => r.st === "done").length, ic = v[0].ic;
    return `<button class="tile ${WF.type === t ? "on" : ""}" data-wk="type" data-wv="${esc(t)}"><span class="ico">${IC(ic)}</span><span class="v">${d}<small>/${v.length}</small></span><span class="l">${esc(t)}</span><span class="s"><span class="bar"><i style="width:${v.length ? d / v.length * 100 : 0}%;background:var(--green)"></i></span></span></button>`; };
  const m = $("#main");
  m.innerHTML = `<h2>${IC("list")} งานและความคืบหน้า <small>${tsStamp()}</small> ${syncBtn()} <button class="btn" style="display:inline-block;padding:4px 14px;font-size:.9rem" onclick="editItem('todo')">+ เพิ่มงาน</button></h2>
  <div class="hero"><div class="l">ความคืบหน้ารวมทุกงาน</div><div class="v">${pct}% <small style="font-size:.5em">เสร็จ ${fmt0(done)} / ${fmt0(R.length)} งาน</small></div>
    <div class="split">${Object.entries(WST).map(([k, v]) => `<i style="width:${R.length ? R.filter((r) => r.st === k).length / R.length * 100 : 0}%;background:${v[2]}"></i>`).join("")}</div>
    <div class="leg">${Object.entries(WST).map(([k, v]) => `<span style="--c:${v[2]}">${v[0]} ${R.filter((r) => r.st === k).length}</span>`).join("")}</div></div>
  <div class="tiles" style="margin-top:12px">${types.map(tcard).join("")}</div>
  <div class="card fcard"><div class="fline">${fSearch("wkQ", WF.q, "ค้นหางาน / ชื่อ / รายละเอียด")}
    ${fSel('data-ws="st"', WF.st, "ทุกสถานะ", Object.entries(WST).map(([k, v]) => [k, `${v[0]} · ${R.filter((r) => pass(r, "st") && r.st === k).length}`]))}
    ${owners.length ? fSel('data-ws="own"', WF.own, "ทุกผู้รับผิดชอบ", owners.map((o) => [o, `${o} · ${R.filter((r) => r.own === o).length}`])) : ""}
    ${fClr('data-wk="clear"', WF.type || WF.st || WF.own || WF.q)}</div></div>
  <h2>${IC("list")} ตารางงาน <small>${show.length} / ${R.length} งาน · ค้างอยู่ด้านบน</small></h2>
  <div class="tblwrap tall"><table><tr><th>#</th><th>วันที่</th><th>หมวด</th><th>งาน</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th></th></tr>
    ${show.map((r, i) => `<tr${r.go ? ` class="click" data-go="${r.go}"` : ""}><td>${i + 1}</td><td>${r.date ? dTh(r.date) : ""}</td><td>${IC(r.ic, 14)} ${esc(r.type)}</td><td><b>${esc(r.title)}</b>${r.detail ? `<br><small class="muted">${esc(r.detail.length > 180 ? r.detail.slice(0, 179) + "…" : r.detail)}</small>` : ""}</td><td>${esc(r.own)}</td>
      <td><span class="badge ${WST[r.st][1]}">${WST[r.st][0]}</span>${r.stx && r.stx !== WST[r.st][0] ? `<br><small class="muted">${esc(r.stx)}</small>` : ""}</td><td>${r.sec ? `<button class="chip" onclick="editItem('${r.sec}','${r.id}')">แก้ไข</button>` : ""}</td></tr>`).join("")}</table></div>
  <p class="muted" style="font-size:.82rem">งานที่เพิ่มในเว็บ (ปุ่ม + เพิ่มงาน / แก้ไข — เก็บในเครื่องนี้ หรือ Google Sheet ถ้าตั้งค่าไว้ที่ปุ่มตั้งค่า) + แท็บชีตชุดทำคดี: สิ่งที่ดำเนินการ / หมายเรียกผู้ต้องหา / พยาน / เอกสาร-รถ / คุมบัญชี / นิติบุคคล (อ่านอย่างเดียว) · กดหัวคอลัมน์เพื่อเรียง · ส่งออก Excel ได้จากปุ่มเหนือตาราง</p>`;
  m.onclick = (e) => { const b = e.target.closest("button"); const tr = e.target.closest("tr[data-go]");
    if (tr && !b) return go(tr.dataset.go);
    if (!b || tsClick(b)) return; const k = b.dataset.wk; if (!k) return;
    if (k === "clear") WF = { type: "", st: "", own: "", q: "" }; else WF[k] = WF[k] === b.dataset.wv ? "" : b.dataset.wv; render(); };
  m.onchange = (e) => { const k = e.target.dataset.ws; if (!k) return; WF[k] = e.target.value; render(); };
  let tm; m.oninput = (e) => { if (e.target.id !== "wkQ") return; clearTimeout(tm); tm = setTimeout(() => { WF.q = e.target.value; render(); const x = $("#wkQ"); if (x) { x.focus(); x.setSelectionRange(WF.q.length, WF.q.length); } }, 300); };
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
const fSnap = () => ({ ...F, accs: new Set(F.accs), kinds: new Set(F.kinds), cpg: new Set(F.cpg), pq: new Set(F.pq), chain: [...(F.chain || [])] });
function resetF() { FHIST = []; F = { from: DB.lo, to: DB.hi, accs: new Set(), kinds: new Set(), cpg: new Set(), min: 0, q: "", gran: "auto", cps: "t", flm: "g", fln: innerWidth > 1100 ? 14 : 8, cpm: "raw", pq: new Set(), flt: true, chain: [], flc: innerWidth > 1100 ? 5 : 3, dn: false }; SHOWN = 200; }
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
    <button class="pill x" id="fClear" hidden>✕ ล้างตัวกรอง</button>
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
     <p class="muted" style="font-size:.8rem;margin:0">ยอดโอนตรง = ตาม statement (ถอนเงินสดยังเป็นถอนเงินสด) ; รวมคู่ถอน-ฝาก = รายการถอนเงินสดที่จับคู่กับการฝากได้ แสดงเป็นเงินเข้าบัญชีผู้ฝาก</p></div>
  </div>
  <div id="dnRes" class="dnres"></div>
  <details class="fnote"><summary>วิธีอ่านยอด / วิธีใช้ชาร์ต</summary><p>ยอดตาม statement ของบัญชีที่เลือก — การโอนระหว่างบัญชีที่มี statement ทั้งสองฝั่งจะปรากฏทั้งฝั่งออกและฝั่งเข้า ; เงินบริจาคเข้าบัญชีมูลนิธิแสดงเป็นยอดรวมรายเดือน</p>
   <p>ชาร์ตเส้นเงิน: กล่องที่มี ▶ (คอลัมน์เงินออก/ทอดถัดไป) = บัญชีที่มี statement — กดเพื่อคลี่ว่าเงินโอนต่อไปที่ใด กดต่อไปได้เรื่อยๆ ; กล่องอื่นกดเพื่อกรอง ; "ทอดถัดไป: ไล่ตามเวลา" = เงินที่เข้ากล่องที่กด ณ วัน-เวลาใด จะจับกับรายการเงินออกของบัญชีนั้นที่เกิดตั้งแต่เวลานั้นเป็นต้นไป เรียงตามเวลาจนครบยอดที่รับ (ส่วนที่ไม่พบรายการออกแสดงเป็นกล่อง "ยังไม่พบรายการโอนออกต่อ") เป็นการไล่ตามลำดับเวลา ไม่ใช่การระบุตัวเงิน ; "ทุกรายการในช่วง" = รวมเงินออกทั้งหมดของบัญชีนั้นในช่วงเวลาที่กรอง ; ค้นหาผู้บริจาคแล้วชาร์ตจะไล่เงินของผู้บริจาครายนั้นตามเวลา</p></details>
  <h2>${IC("flow")} เส้นเงินตามตัวกรอง <small>เงินเข้า → บัญชี → เงินออก · กดกล่องเพื่อกรอง · กล่อง ▶ กดเพื่อคลี่ทอดถัดไป</small></h2>
  <div class="fltools"><button class="chip" id="flBack" hidden title="กลับไปตัวกรองก่อนกดชาร์ต">← ย้อนกลับ</button>
    <select id="flM" title="มุมมอง"><option value="g">แสดงเป็นกลุ่ม</option><option value="d">แสดงรายบัญชี</option></select>
    <select id="flN" title="จำนวนกล่องต่อคอลัมน์">${[8, 14, 24, 32].map((n) => `<option value="${n}">${n} กล่อง</option>`).join("")}</select>
    <select id="flC" title="จำนวนคอลัมน์ที่แสดงพร้อมกัน">${[3, 4, 5, 6, 8].map((n) => `<option value="${n}">${n} คอลัมน์</option>`).join("")}</select>
    <select id="flT" title="วิธีคำนวณเมื่อกดกล่อง ▶ คลี่ทอดถัดไป"><option value="1">ทอดถัดไป: ไล่ตามเวลา</option><option value="0">ทอดถัดไป: ทุกรายการในช่วง</option></select>
    <button class="chip" id="flClr" hidden title="ยุบทอดที่คลี่ทั้งหมด">✕ ยุบทอด</button></div>
  <div class="card flowcard"><div id="flow" class="flow"></div><div id="flTip" class="fltip" hidden></div></div>
  <h2>${IC("users")} คู่โอนรายใหญ่ <small>50 อันดับ — กดแถวเพื่อค้นหา · กดหัวคอลัมน์เพื่อเรียง</small></h2>
  <div class="tblwrap tbl1" id="tCp"></div>
  <h2>${IC("list")} รายการ <small id="txLab"></small> <button class="chip" id="txReset" title="กลับไปเรียงตามวันที่-เวลา">↺ รีเซ็ตการเรียง</button><button class="chip" id="txXlsx">${IC("doc", 14)} ส่งออก Excel</button><button class="chip" id="fCsv">CSV</button></h2>
  <div class="tblwrap tbl1" id="tTx"></div>
  <p style="text-align:center"><button class="btn o" id="more">แสดงเพิ่ม</button></p>
  <h2>ตามเวลา <small id="granLab"></small> <button class="chip" id="gBtn">สลับ รายเดือน / รายปี</button></h2>
  <div class="card"><div class="chartbox"><canvas id="cTime"></canvas></div></div>
  <div class="grid g2" style="margin-top:12px">
    <div><h2>ตามกลุ่มคู่โอน <small>กดแท่งเพื่อกรอง</small></h2><div class="card"><div class="chartbox tall"><canvas id="cCpg"></canvas></div></div></div>
    <div><h2>ตามบัญชี <small>กดแท่งเพื่อกรอง</small></h2><div class="card"><div class="chartbox tall"><canvas id="cAcc"></canvas></div></div></div>
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
    else if (b.id === "flBack") { if (!FHIST.length) return; F = FHIST.pop(); $("#fFrom").value = F.from; $("#fTo").value = F.to; $("#fQ").value = F.q; $("#fMin").value = F.min || ""; }
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
    else if (t.id === "flM") F.flm = t.value; else if (t.id === "flN") F.fln = +t.value; else if (t.id === "flC") F.flc = +t.value; else if (t.id === "flT") F.flt = t.value === "1";
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
      $("#flM").value = F.flm; $("#flN").value = F.fln; $("#flC").value = F.flc; $("#flT").value = F.flt !== false ? "1" : "0"; }
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
    { const fb_ = $("#flBack"); if (fb_) { fb_.hidden = !FHIST.length; fb_.textContent = FHIST.length ? `← ย้อนกลับ (${FHIST.length})` : "← ย้อนกลับ"; } }
    drawFlow($("#flow"), pair); ONRS = () => TAB === "ana" && drawFlow($("#flow"), pair);
    // ตาราง
    const ck = { t: (v) => v[0] + v[1], i: (v) => v[0], o: (v) => v[1], n: (v) => v[2] }[F.cps] || ((v) => v[0] + v[1]);
    const top = [...byC.entries()].filter((x) => ck(x[1]) > 0).sort((x, y) => ck(y[1]) - ck(x[1])).slice(0, 50);
    $("#tCp").innerHTML = `<table><tr><th>#</th><th>คู่โอน</th><th>บัญชี</th><th>กลุ่ม</th><th class="n srt ${F.cps === "i" ? "on" : ""}" data-cs="i">เงินเข้า (บาท)</th><th class="n srt ${F.cps === "o" ? "on" : ""}" data-cs="o">เงินออก (บาท)</th><th class="n srt ${F.cps === "n" ? "on" : ""}" data-cs="n">ครั้ง</th></tr>` +
      top.map(([ci, v], i) => { const c = DB.cps[ci]; return `<tr class="click" data-q="${esc(c[0] || c[1])}"><td>${i + 1}</td><td>${esc(c[1]) || "<span class=muted>ไม่ระบุชื่อ</span>"}</td><td>${c[2]} ${c[0]}</td><td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${DB.groups[c[3]][2]}"></span> ${esc(DB.groups[c[3]][1].split(" (")[0])}</td><td class="n">${v[0] ? fmt(v[0]) : ""}</td><td class="n">${v[1] ? fmt(v[1]) : ""}</td><td class="n">${fmt0(v[2])}</td></tr>`; }).join("") + "</table>";
    $("#tCp").onclick = (e) => { const th = e.target.closest("th[data-cs]"); if (th) { F.cps = F.cps === th.dataset.cs ? "t" : th.dataset.cs; upd(true); return; } const tr = e.target.closest("tr[data-q]"); if (tr) { FHIST.push(fSnap()); F.q = tr.dataset.q; $("#fQ").value = F.q; upd(); } };
    SORTED = txSort(IDX);
    const big = SORTED.slice(0, SHOWN);
    $("#txLab").textContent = `เรียงตาม ${TXS.map(([k, d], n) => `${n + 1}.${TXC[k]} ${d > 0 ? "↑" : "↓"}`).join(" , ")} — แสดง ${fmt0(big.length)} จาก ${fmt0(IDX.length)} แถว · กดหัวคอลัมน์เพื่อเรียงเพิ่ม (กดซ้ำสลับ ↑↓ / ครั้งที่ 3 เอาออก)`;
    $("#more").hidden = big.length >= IDX.length;
    const th = (k, l, cls) => { const n = TXS.findIndex((x) => x[0] === k); return `<th class="srt ${cls || ""} ${n >= 0 ? "on" : ""}" data-ts="${k}">${l}${n >= 0 ? ` <small>${TXS[n][1] > 0 ? "▲" : "▼"}${TXS.length > 1 ? n + 1 : ""}</small>` : ""}</th>`; };
    $("#tTx").innerHTML = `<table><tr>${th("t", "วันเวลา")}${th("a", "บัญชี")}${th("k", "ประเภท")}${th("v", "ยอด (บาท)", "n")}${th("c", "คู่โอน")}${th("g", "กลุ่มคู่โอน")}</tr>` +
      big.map((i) => { const r = DB.tx[i], a = DB.accounts[r[0]], c = DB.cps[cpOf(i)], iso = min2iso(r[1]), q = txQ(i); return `<tr><td>${dTh(iso)} ${txT(i)}</td><td>${esc(a.name)} <small class="muted">${a.bank} ${a.acc}</small></td><td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${KCOL[r[2]]}"></span> ${DB.kinds[r[2]].split(" (")[0]}</td><td class="n">${fmt(r[3])}</td><td>${esc(c[1])} ${c[2]} ${c[0]}${q && F.cpm !== "raw" && pqOn(q) ? `<br><small style="color:${PKC[q]}">● คู่ถอน-ฝาก: ${esc(DB.pk[q])}${DB.txp && DB.txp[i] ? ` — ถอน ${fmt(DB.txp[i][0])} บาท ฝาก ${fmt(DB.txp[i][1])} บาท` : ""}</small>` : ""}</td><td>${esc(DB.groups[c[3]][1].split(" (")[0])}</td></tr>`; }).join("") + "</table>";
    $("#tTx").onclick = (e) => { const h = e.target.closest("th[data-ts]"); if (!h) return; const k = h.dataset.ts, n = TXS.findIndex((x) => x[0] === k);
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
      F.chain = F.chain[at] === id ? F.chain.slice(0, at) : F.chain.slice(0, at).concat([id]); tip.hidden = true; return upd(); }
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
    `<p class="muted" style="font-size:.84rem">พบ ${fmt0(DNH.length)} บัญชี รวม ${fmt(tot)} บาท${DNH.length > 100 ? " (แสดง 100 อันดับแรก)" : ""} — กดแถวเพื่อดูรายการรายครั้ง</p>
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

/* ---------- ชาร์ตเส้นเงินตามตัวกรอง (เงินเข้า → บัญชี → เงินออก) ---------- */
// ชาร์ตเส้นเงินหลายทอด (ผู้สั่งงาน 18 พ.ย. 69): คอลัมน์ 0 = เงินเข้าจาก / 1 = บัญชีตามตัวกรอง / 2 = เงินออกไป
//   กดกล่องในคอลัมน์ที่ 2 ขึ้นไปที่เป็นบัญชีมี statement -> คลี่ทอดถัดไป (เงินที่บัญชีนั้นโอนต่อ) ไล่ต่อได้เรื่อยๆ (F.chain) ; เลือกจำนวนคอลัมน์ที่เห็นพร้อมกัน (F.flc)
let ACCNO = null;
const accOfCp = (ci) => { if (!ACCNO) { ACCNO = new Map(); DB.accounts.forEach((a, i) => ACCNO.set(dg(a.acc), i)); } const k = dg(DB.cps[ci][0]); return k && ACCNO.has(k) ? ACCNO.get(k) : -1; };
let TXA = null;
const txOfAcc = (ai) => { if (!TXA) { TXA = DB.accounts.map(() => []); DB.tx.forEach((r, i) => TXA[r[0]].push(i)); } return TXA[ai] || []; };
function flowBuild(pair) {
  const det = F.flm === "d", N = F.fln, L = new Map(), R = new Map(), Mi = new Map();
  const lid = (ci) => (det ? "c" + ci : "g" + DB.cps[ci][3]), mid = (ai) => (det ? "a" + ai : "G" + DB.accounts[ai].g);
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const [key, v] of pair) { const ci = Math.floor(key / 64), ai = key % 64; if (v[0]) add(L, lid(ci), v[0]); if (v[1]) add(R, lid(ci), v[1]); add(Mi, mid(ai), v[0] + v[1]); }
  const top = (m) => new Set([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, N).map((x) => x[0]));
  const kL = top(L), kR = top(R), kM = top(Mi), cols = [new Map(), new Map(), new Map()], links = new Map();
  const nd = (c, id) => { let n = cols[c].get(id); if (!n) cols[c].set(id, (n = { id, c, in: 0, out: 0 })); return n; };
  const lk = (a, b, v, n) => { const k = a + ">" + b; let o = links.get(k); if (!o) links.set(k, (o = { a, b, v: 0, n: 0 })); o.v += v; o.n += n; };
  for (const [key, v] of pair) {
    const ci = Math.floor(key / 64), ai = key % 64, m0 = mid(ai), m = kM.has(m0) ? m0 : "O", l0 = lid(ci);
    if (v[0]) { const l = kL.has(l0) ? l0 : "o"; nd(0, l).out += v[0]; nd(1, m).in += v[0]; lk("0:" + l, "1:" + m, v[0], v[2]); }
    if (v[1]) { const r = kR.has(l0) ? l0 : "o"; nd(2, r).in += v[1]; nd(1, m).out += v[1]; lk("1:" + m, "2:" + r, v[1], v[3]); }
  }
  // ทอดถัดไปตาม F.chain
  const a0 = day2min(F.from), b0 = day2min(F.to) + 1440;
  const chain = [];
  if (F.flt !== false && F.chain.length) {
    // ไล่ตามเวลา (ผู้สั่งงาน 18 พ.ย. 69): เงินที่เข้ากล่องที่กด ณ วัน-เวลาใด จับกับรายการเงินออกของบัญชีนั้นที่เกิดตั้งแต่เวลานั้นเป็นต้นไป เรียงตามเวลา จนครบยอดที่รับ
    //   (รายการเงินออก 1 รายการใช้ได้ไม่เกินยอดของมัน ; ส่วนที่ไม่พบรายการออก = กล่อง rem ; ปลายทางที่ไม่มี statement = กล่อง nst) — เป็นการไล่ตามลำดับเวลา ไม่ใช่การระบุตัวเงิน
    const outs = new Map(), used = new Map();
    const getOuts = (ai) => { let o = outs.get(ai); if (!o) { o = txOfAcc(ai).filter((i) => !IN_K.includes(DB.tx[i][2])).sort((x, y) => DB.tx[x][1] - DB.tx[y][1] || x - y); outs.set(ai, o); used.set(ai, new Float64Array(o.length)); } return o; };
    let arr = [], nst = 0, nstN = 0;
    for (const i of filterTx()) { const r = DB.tx[i]; if (IN_K.includes(r[2])) continue; const ci = cpOf(i), d0 = lid(ci);
      if ((kR.has(d0) ? d0 : "o") !== F.chain[0]) continue;
      const dai = accOfCp(ci); if (dai < 0 || dai === r[0]) { nst += r[3]; nstN++; } else arr.push({ ai: dai, t: r[1], amt: r[3] }); }
    for (let k = 0; k < F.chain.length; k++) {
      const c = 2 + k, id = F.chain[k];
      if (!cols[c] || !cols[c].has(id) || !srcAccs(id).length || (!arr.length && nst <= 0.005)) break;
      arr.sort((x, y) => x.t - y.t);
      const out = new Map(), pieces = []; let rem = 0;
      for (const a of arr) { const o = getOuts(a.ai), U = used.get(a.ai);
        let lo = 0, hi = o.length; while (lo < hi) { const m = (lo + hi) >> 1; if (DB.tx[o[m]][1] < a.t) lo = m + 1; else hi = m; }
        let need = a.amt;
        for (let j = lo; j < o.length && need > 0.005; j++) { const i = o[j], av = DB.tx[i][3] - U[j]; if (av <= 0.005) continue;
          const take = Math.min(av, need); U[j] += take; need -= take;
          const ci = cpOf(i), d = lid(ci), e = out.get(d) || [0, 0]; e[0] += take; e[1]++; out.set(d, e); pieces.push([d, ci, DB.tx[i][1], take, a.ai]); }
        rem += need; }
      const kk = new Set([...out.entries()].sort((x, y) => y[1][0] - x[1][0]).slice(0, N).map((x) => x[0]));
      cols[c + 1] = new Map();
      const me = cols[c].get(id); me.out = 0;
      for (const [d, v] of out) { const dd = kk.has(d) ? d : "o"; nd(c + 1, dd).in += v[0]; me.out += v[0]; lk(c + ":" + id, (c + 1) + ":" + dd, v[0], v[1]); }
      if (rem > 0.005) { nd(c + 1, "rem").in += rem; lk(c + ":" + id, (c + 1) + ":rem", rem, 0); }
      if (nst > 0.005) { nd(c + 1, "nst").in += nst; lk(c + ":" + id, (c + 1) + ":nst", nst, nstN); }
      chain.push(id);
      const nx = F.chain[k + 1]; arr = []; nst = 0; nstN = 0;
      if (nx == null) break;
      for (const [d, ci, t, take, from] of pieces) { if ((kk.has(d) ? d : "o") !== nx) continue; const dai = accOfCp(ci); if (dai < 0 || dai === from) { nst += take; nstN++; } else arr.push({ ai: dai, t, amt: take }); }
    }
  } else for (let k = 0; k < F.chain.length; k++) {
    const c = 2 + k, id = F.chain[k];
    if (!cols[c] || !cols[c].has(id)) break;
    const src = srcAccs(id); if (!src.length) break;
    const out = new Map();
    for (const ai of src) for (const i of txOfAcc(ai)) { const r = DB.tx[i];
      if (r[1] < a0 || r[1] >= b0 || IN_K.includes(r[2]) || r[3] < F.min) continue;
      if (F.cpm === "pair" && !(txQ(i) && pqOn(txQ(i)))) continue;
      const d = lid(cpOf(i)); const o = out.get(d) || [0, 0]; o[0] += r[3]; o[1] += r[5] || 1; out.set(d, o); }
    if (!out.size) break;
    const kk = new Set([...out.entries()].sort((x, y) => y[1][0] - x[1][0]).slice(0, N).map((x) => x[0]));
    cols[c + 1] = new Map();
    cols[c].get(id).out = 0;
    for (const [d, v] of out) { const dd = kk.has(d) ? d : "o"; nd(c + 1, dd).in += v[0]; cols[c].get(id).out += v[0]; lk(c + ":" + id, (c + 1) + ":" + dd, v[0], v[1]); }
    chain.push(id);
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
function flowInfo(id) {
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
  const { cols: C0, links: L0, chain } = dn ? { cols: dn.cols, links: dn.links, chain: [] } : flowBuild(pair);
  if (!L0.length) { box.innerHTML = '<p class="muted" style="padding:20px">ไม่มีรายการตามตัวกรอง</p>'; return; }
  const nc = C0.length, first = dn ? 0 : Math.max(0, nc - Math.max(3, F.flc)), vis = [];
  for (let c = first; c < nc; c++) vis.push(c);
  const cols = vis.map((c) => [...C0[c].values()].map((n) => ({ ...n, v: c === vis[0] && c === 0 ? n.out : Math.max(n.in, n.out), exp: !dn && c >= 2 && n.id !== "o" && srcAccs(n.id).length > 0, sel: !dn && c >= 2 && chain[c - 2] === n.id }))
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
    const io = ci === 1 || n.sel || (dn && n.in > 0 && n.out > 0);
    const amt = io ? `เข้า ${M(n.in)} · ออก ${M(n.out)}` : M(n.v);
    const tip = `${f.lab}${f.sub ? " " + f.sub : ""} : ` + (io ? `เงินเข้า ${fmt(n.in)} / เงินออก ${fmt(n.out)} บาท` : `${fmt(n.v)} บาท`) + (n.exp ? (n.sel ? " · กดอีกครั้งเพื่อยุบ" : " · กดเพื่อไล่ทอดถัดไป") : "");
    const tx = isL ? n.x - 6 : n.x + bw + 6, an = isL ? "end" : "start", cy = n.y + n.h / 2, two = n.h >= 32;
    const mark = n.exp ? (n.sel ? " ▼" : " ▶") : "";
    svg += `<g class="fn${n.exp ? " fx" : ""}" data-n="${ci}:${n.id}" data-tip="${esc(tip)}"><rect x="${n.x}" y="${n.y.toFixed(1)}" width="${bw}" height="${n.h.toFixed(1)}" rx="3" fill="${f.col}"${n.sel ? ' stroke="#FFD403" stroke-width="3"' : ""}/>` +
      (two ? `<text x="${tx}" y="${(cy - 3).toFixed(1)}" text-anchor="${an}" class="fl1">${esc(cut(f.lab, mc))}${mark}</text><text x="${tx}" y="${(cy + 12).toFixed(1)}" text-anchor="${an}" class="fl2">${amt}${wide && f.sub && (isL || last) ? " · " + esc(cut(f.sub, 22)) : ""}</text>`
        : `<text x="${tx}" y="${(cy + 4).toFixed(1)}" text-anchor="${an}" class="fl1">${esc(cut(f.lab, Math.max(8, mc - 6)))}${mark} <tspan class="fl2">${ci === 1 ? M(n.v) : amt}</tspan></text>`) + `</g>`;
  }));
  const hdT = (ci) => (dn ? (ci === 0 ? "ผู้บริจาค" : ci === 1 ? "บัญชีรับบริจาค" : `โอนต่อ ทอด ${ci - 1}`) : ci === 0 ? "เงินเข้าจาก" : ci === 1 ? "บัญชี (statement)" : ci === 2 ? "เงินออกไป (ทอด 1)" : `ทอด ${ci - 1}${F.flt !== false ? " · ไล่ตามเวลา" : ""}`);
  const hd = vis.map((ci, j) => `<text x="${j === 0 && ci === 0 ? LW + bw : LW + j * gap}" y="14" text-anchor="${j === 0 && ci === 0 ? "end" : "start"}" class="flh">${hdT(ci)}</text>`).join("");
  const ban = dn ? `<div class="dnban" style="background:#FFF8E1;border:1px solid #F9A825;border-radius:8px;padding:8px 10px;margin:0 0 6px;font-size:.86rem"><b>ไล่เงินผู้บริจาค:</b> ${esc(dn.name)} — บริจาครวม ${fmt(dn.total)} บาท (${fmt0(dn.n)} ครั้งที่มีวันเวลา) · ไล่ตามรายการโอนออกถัดไปตามเวลาจนครบยอด${dn.rem > 0.5 ? ` · ยังไม่พบรายการโอนออกต่อ ${fmt(dn.rem)} บาท` : ""}${dn.undated > 0.5 ? ` · ยอดรวมรายย่อยไม่มีวันที่ ${fmt(dn.undated)} บาท` : ""}
      <button class="chip" data-dnoff="1" style="margin-left:6px">✕ กลับชาร์ตตามตัวกรอง</button><br><span class="muted">เป็นการไล่ตามลำดับเวลา (สันนิษฐาน) ไม่ใช่การระบุตัวเงิน · ไม่ใช้ตัวกรองช่วงเวลา/บัญชี · เปลี่ยน กลุ่ม/รายบัญชี และจำนวนกล่องได้</span></div>` : "";
  box.innerHTML = ban + (first ? `<div class="muted" style="font-size:.8rem;padding:4px 8px">◀ ซ่อน ${first} คอลัมน์แรก (เพิ่มจำนวนคอลัมน์ที่แสดงได้ที่ปุ่ม "แสดง … คอลัมน์")</div>` : "") +
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
  m.insertAdjacentHTML("afterbegin", `<div class="frow subnav" id="acSub" style="margin-bottom:10px">${ACS_T.map(([k, l, ic]) => `<button class="chip ${ACS === k ? "on" : ""}" data-acs="${k}">${IC(ic, 15)} ${l}</button>`).join("")}</div>`);
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
    const g = e.g != null ? e.g : (cpG.has(e.k) ? cpG.get(e.k) : DB.groups.findIndex((gg) => gg[0] === "oth"));
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
      <td><span class="badge ${r.ai >= 0 ? "g" : /รอนำเข้า/.test(r.st) ? "r" : /ขอแล้ว/.test(r.st) ? "y" : ""}">${esc(r.st)}</span></td><td>${r.fz ? `<span class="badge r">${IC("lock", 11)} ${fmt(r.fz.amt)}</span>` : ""}</td>
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
  <h2>${IC("users")} กลุ่มบัญชี <small>กดการ์ดเพื่อดูทั้งกลุ่ม</small>${AXF.g !== "" ? ` <button class="chip" data-axk="g" data-axv="">← ทุกกลุ่ม</button>` : ""}</h2>
  <div class="gcards">${gs.map(card).join("")}</div>
  <div class="card fcard"><div class="fline">${fSearch("axQ", AXF.q, "ค้นหาเลขบัญชี / ชื่อ / เลขหนังสือ / หมายเหตุ")}
    ${fSel('data-axs="g"', AXF.g, "ทุกกลุ่มบัญชี", gs.map((g) => [g, DB.groups[g] ? DB.groups[g][1].split(" (")[0] : "กลุ่ม " + g]))}
    ${fSel('data-axs="st"', AXF.st, "ทุกสถานะ STM", STS.map((x) => [x, `${x} · ${rows.filter((r) => r.st === x).length}`]))}
    ${fClr('data-axk="clear"', AXF.g !== "" || AXF.st || AXF.fz || AXF.q)}</div></div>
  <h2>${IC("list")} รายบัญชี <small>${shown} / ${rows.length} บัญชี · เรียงเป็นกลุ่ม · กดแถวเพื่อดูรายละเอียด</small></h2>
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
    ${k("work", "users", `${W.filter((r) => /มาพบ/.test(r.st)).length}<small>/${W.length}</small>`, "พยานมาพบแล้ว", "")}
    ${k("srch", "bag", SR.rows.reduce((t, r) => t + (r.n || 0), 0), "ของกลางที่ตรวจยึด", "รายการ")}
    ${k("ppl", "user", people().length, "บุคคลที่เกี่ยวข้อง", "")}
    ${k("trace", "flow", DB.sets.length, "ชุดไล่เส้นเงิน", "")}</div>
  ${big ? `<button class="banner" data-img="${big.id}">${thumbEl(big)}<span><b>${IC("zoom", 18)} ${esc(big.title)}</b><small>กดเพื่อเปิดภาพเต็ม — เลื่อนและซูมได้</small></span></button>` : ""}`;
}
const newsBlock = () => { const v = imgBy((i) => i.cat === "ภาพข่าว"); return v.length ? `<h2>${IC("img")} ภาพข่าว / ภาพประกอบ <small>${v.length} ภาพ</small></h2><div class="shots big">${v.map((i) => shot(i)).join("")}</div>` : ""; };
