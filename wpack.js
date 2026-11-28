/* ชุดข้อมูลสอบปากคำ (ผู้ใช้สั่ง 25 พ.ย. 69 — เรียกผู้เกี่ยวข้องในบัญชีมาสอบปากคำ ใช้เส้นเงินประกอบ)
   ปุ่มในหน้าวิเคราะห์ -> หน้าต่างเลือก: (1) Excel ไฟล์เดียว 2 ชีต = คู่โอนรายใหญ่ / รายการย่อย (2) Word ประเด็นคำถาม + ตารางข้อเท็จจริง + ชาร์ต
   อิงตัวกรองของหน้า: ชื่อที่ค้นหา (F.q) / ทั้งกลุ่ม (F.gx) / บัญชีที่เลือก (F.accs) / กลุ่มคู่โอน (F.cpg)
   ห้ามเขียนชื่อบุคคล/คดีในไฟล์นี้ (deploy_site.sh ตรวจ) — ป้ายทั้งหมดมาจาก DB ที่เข้ารหัส */

const WPF = "TH SarabunPSK";
const WP_SEG = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("th", { granularity: "word" }) : null;
const wpZ = (s) => { s = String(s ?? ""); if (!WP_SEG || !/[฀-๿]/.test(s)) return s;   // แทรก zero-width space ระหว่างคำไทย (Word ในเครื่องผู้ใช้ไม่ตัดคำไทยเอง)
  let o = "", prev = false; for (const { segment } of WP_SEG.segment(s)) { const th = /^[฀-๿]/.test(segment); if (th && prev) o += "​"; o += segment; prev = /[฀-๿]$/.test(segment); } return o; };
const wx = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const wpD = (iso) => { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${d} ${MTH[m]} ${y + 543}`; };
const wpDT = (min) => { const iso = min2iso(min); return `${wpD(iso)} ${iso.slice(11, 16)} น.`; };
const wpB = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wpNk = (s) => String(s || "").replace(/^\s*(นางสาว|นาง|นาย|น\.ส\.|ด\.ช\.|ด\.ญ\.|ว่าที่\s*(ร\.?\s*[ตทอ]\.?|พ\.?\s*[ตทอ]\.?)\s*(หญิง)?|mrs\.?|mr\.?|miss|ms\.?)\s*/i, "").replace(/[\s.]/g, "").toLowerCase();
const wpFile = (s) => String(s || "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
const wpGl = (g) => (DB.groups[g] ? DB.groups[g][1].split(" (")[0] : "");
const wpGc = (g) => (DB.groups[g] ? DB.groups[g][2] : "#607D8B");

/* ---------- ข้อมูล ---------- */
const wpAk = (e) => e.cash ? "#" + e.name : (e.acc ? (/x/i.test(e.acc) ? e.acc.toLowerCase() + "|" + wpNk(e.name) : dg(e.acc) || e.acc) : "n:" + (wpNk(e.name) || "?"));   // คีย์บัญชี (เลขท้าย xxxx ต้องรวมชื่อด้วย กันชนกัน)
const WP_DEP = { name: "ฝากเงินสด", bank: "", acc: "", g: -1, cash: 1 }, WP_CASH = { name: "ถอนเงินสด", bank: "", acc: "", g: -1, cash: 1 };
function wpSides(i) {                                                    // [ผู้โอน, ผู้รับ] ของรายการ i
  const r = DB.tx[i], a = DB.accounts[r[0]], ci = cpOf(i), c = DB.cps[ci], inn = IN_K.includes(r[2]);
  const A = { name: a.name, bank: a.bank, acc: a.acc, g: a.g, ai: r[0], st: 1 };
  const C = { name: c[1] || "", bank: c[2] || "", acc: c[0] || "", g: c[3], ai: typeof accOfCp === "function" ? accOfCp(ci) : -1, st: 0 };
  return inn ? [C, A] : [A, C];
}
function wpSubjTest() {                                                  // ฝั่งใดคือ "ผู้ให้ถ้อยคำ / กลุ่มบัญชีที่สอบ" ตามตัวกรองของหน้า
  const q = (F.q || "").trim().toLowerCase();
  if (q) return { mode: "q", f: (e) => e.name.toLowerCase().includes(q) || (q.length >= 4 && String(e.acc).toLowerCase().includes(q)) };
  if (F.accs.size || (F.gx && F.gx.size)) return { mode: "acc", f: (e) => (e.ai >= 0 && F.accs.has(e.ai)) || !!(F.gx && F.gx.has(e.g)) };
  if (F.cpg.size) return { mode: "cpg", f: (e) => !e.st && F.cpg.has(e.g) };
  return { mode: "all", f: (e) => !!e.st };
}
function wpFilterDesc() {
  const L = [];
  L.push(F.from <= DB.lo && F.to >= DB.hi ? "ทุกช่วงเวลา" : `${wpD(F.from)} – ${wpD(F.to)}`);
  if (F.q) L.push(`ค้นหา "${F.q}"`);
  if (F.gx && F.gx.size) L.push("ทั้งกลุ่ม " + [...F.gx].map(wpGl).join(" / "));
  if (F.accs.size) L.push(F.accs.size <= 3 ? "บัญชี " + [...F.accs].map((i) => `${DB.accounts[i].bank} ${DB.accounts[i].acc} ${DB.accounts[i].name}`).join(" / ") : `บัญชีที่เลือก ${F.accs.size} บัญชี`);
  if (F.kinds.size) L.push("ประเภท " + [...F.kinds].map((k) => DB.kinds[k].split(" (")[0]).join(" / "));
  if (F.cpg.size) L.push("กลุ่มคู่โอน " + [...F.cpg].map(wpGl).join(" / "));
  if (F.min) L.push(`ยอดตั้งแต่ ${wpB(F.min)} บาท`);
  if (F.cpm !== "raw") L.push(F.cpm === "pair" ? "เฉพาะคู่ถอน-ฝากเงินสด" : "รวมคู่ถอน-ฝากเงินสด");
  return L.join(" · ");
}
function wpBuild(ctx) {
  const T = wpSubjTest(), IDX = ctx.IDX;
  const P = new Map(), subA = new Map(), inP = new Map(), outP = new Map(), byT = new Map();
  const S = { inV: 0, inN: 0, outV: 0, outN: 0, selfV: 0, selfN: 0, othV: 0, othN: 0, cashV: 0, cashN: 0, depV: 0, depN: 0, t1: Infinity, t2: -Infinity, cashL: [], depL: [], dnV: new Map() };
  const eI = new Map(), eO = new Map(), eS = new Map();
  const ti = DB.groups.findIndex((x) => x[0] === "t1");
  let tMin = Infinity, tMax = -Infinity;
  for (const i of IDX) { const r = DB.tx[i]; if (r[2] !== 4) { tMin = Math.min(tMin, r[1]); tMax = Math.max(tMax, r[1]); } }
  const span = isFinite(tMin) ? (tMax - tMin) / 525600 : 0, byYear = span > 2;
  const isCashPair = (i) => F.cpm !== "raw" && txQ(i) && pqOn(txQ(i));
  for (const i of IDX) {
    const r = DB.tx[i], [fr, to] = wpSides(i), inn = IN_K.includes(r[2]), ci = cpOf(i), n = r[5] || 1, v = typeof TXV !== "undefined" && TXV ? TXV.get(i) || 0 : r[3];   // โหมดไล่เงินผู้บริจาค = ยอดที่ไล่ได้
    const pk = (ci * 64 + r[0]) * 2 + (inn ? 1 : 0);
    let p = P.get(pk); if (!p) P.set(pk, (p = { fr, to, g: DB.cps[ci][3], v: 0, n: 0, t1: Infinity, t2: -Infinity, ks: new Set(), I: [] }));
    p.v += v; p.n += n; p.t1 = Math.min(p.t1, r[1]); p.t2 = Math.max(p.t2, r[1]); p.ks.add(r[2]); p.I.push(i);
    const fS = T.f(fr), tS = T.f(to);
    if (r[2] !== 4) { S.t1 = Math.min(S.t1, r[1]); S.t2 = Math.max(S.t2, r[1]); }
    const acct = (e, k) => { const key = dg(e.acc) || e.name; let a = subA.get(key); if (!a) subA.set(key, (a = { name: e.name, bank: e.bank, acc: e.acc, st: e.st, g: e.g, inV: 0, inN: 0, outV: 0, outN: 0 })); if (e.st && !a.st) Object.assign(a, { name: e.name, bank: e.bank, acc: e.acc, st: 1, g: e.g }); a[k + "V"] += v; a[k + "N"] += n; };
    const per = (M_, e, sub) => { const key = wpNk(e.name) || dg(e.acc) || e.acc || "?"; let o = M_.get(key);
      if (!o) M_.set(key, (o = { name: e.name, accs: new Map(), av: new Map(), sub: new Set(), g: e.g, v: 0, n: 0, t1: Infinity, t2: -Infinity, pk: new Set(), gv: {} }));
      o.v += v; o.n += n; o.t1 = Math.min(o.t1, r[1]); o.t2 = Math.max(o.t2, r[1]); o.pk.add(pk); o.accs.set(dg(e.acc) || e.acc, `${e.bank} ${e.acc}`.trim()); o.sub.add(`${sub.bank} ${sub.acc}`.trim());
      const ka = wpAk(e); let x = o.av.get(ka); if (!x) o.av.set(ka, (x = { lab: `${e.bank} ${e.acc}`.trim() || "(ไม่ระบุเลขบัญชี)", name: e.name, g: e.g, v: 0, n: 0, t1: Infinity, t2: -Infinity, pk: new Set() }));   // ยอดแยกรายบัญชีภายในรายคน
      x.v += v; x.n += n; x.t1 = Math.min(x.t1, r[1]); x.t2 = Math.max(x.t2, r[1]); x.pk.add(pk);
      o.gv[e.g] = (o.gv[e.g] || 0) + v; if (e.name.length > o.name.length) o.name = e.name; };
    const ed = (M_, a, b) => { const key = wpAk(a) + "|" + wpAk(b); let o = M_.get(key);   // เส้นเงินแยกรายบัญชี (ต้นทาง -> ปลายทาง) ทุกคู่
      if (!o) M_.set(key, (o = { a, b, v: 0, n: 0, t1: Infinity, t2: -Infinity, pk: new Set() })); o.v += v; o.n += n; o.t1 = Math.min(o.t1, r[1]); o.t2 = Math.max(o.t2, r[1]); o.pk.add(pk); };
    const tk = byYear ? +min2iso(r[1]).slice(0, 4) : min2iso(r[1]).slice(0, 7);
    const tb = (k) => { let o = byT.get(tk); if (!o) byT.set(tk, (o = [0, 0])); o[k] += v; };
    if (fS && tS) { S.selfV += v; S.selfN += n; acct(fr, "out"); acct(to, "in"); ed(eS, fr, to); }
    else if (tS) { S.inV += v; S.inN += n; acct(to, "in"); tb(0);
      if (r[2] === 1 && !isCashPair(i)) { S.depV += v; S.depN += n; S.depL.push(i); ed(eI, WP_DEP, to); }
      else { per(inP, fr, to); ed(eI, fr, to); if (fr.g === ti) S.dnV.set(`${fr.bank} ${fr.acc} ${fr.name}`, (S.dnV.get(`${fr.bank} ${fr.acc} ${fr.name}`) || 0) + v); } }
    else if (fS) { S.outV += v; S.outN += n; acct(fr, "out"); tb(1);
      if (r[2] === 3 && !isCashPair(i)) { S.cashV += v; S.cashN += n; S.cashL.push(i); ed(eO, fr, WP_CASH); } else { per(outP, to, fr); ed(eO, fr, to); } }
    else { S.othV += v; S.othN += n; }
  }
  const pairs = [...P.values()].sort((a, b) => b.v - a.v); pairs.forEach((p, j) => (p.no = j + 1));
  const noOf = new Map(); for (const [k, p] of P) noOf.set(k, p.no);
  const fin = (M_) => [...M_.values()].map((o) => ({ ...o, g: +Object.entries(o.gv).sort((a, b) => b[1] - a[1])[0][0], nos: [...o.pk].map((k) => noOf.get(k)).sort((a, b) => a - b) })).sort((a, b) => b.v - a.v);
  const nosOf = (pk) => [...pk].map((k) => noOf.get(k)).sort((a, b) => a - b);
  const finA = (M_) => [...M_.values()].map((o) => ({ ...o, nos: nosOf(o.pk) })).sort((a, b) => b.v - a.v);
  for (const M_ of [inP, outP]) for (const o of M_.values()) o.avL = [...o.av.values()].map((x) => ({ ...x, nos: nosOf(x.pk) })).sort((a, b) => b.v - a.v);
  const subj = [...subA.values()].sort((a, b) => (b.inV + b.outV) - (a.inV + a.outV));
  let label = "บัญชีตามตัวกรอง";
  if (T.mode === "q") label = ((subj[0] && subj[0].name) || F.q).split(/\s+เพื่อ\s*/)[0].trim();   // ชื่อบัญชี "… เพื่อ ด.ญ. …" -> ชื่อเจ้าของบัญชี
  else if (T.mode === "acc") { const nm = [...new Set([...F.accs].map((i) => DB.accounts[i].name))]; label = F.gx && F.gx.size && !F.accs.size ? "กลุ่ม " + [...F.gx].map(wpGl).join(" / ") : nm.slice(0, 3).join(" / ") + (nm.length > 3 ? ` และอีก ${nm.length - 3} ชื่อ` : ""); }
  else if (T.mode === "cpg") label = "กลุ่มคู่โอน " + [...F.cpg].map(wpGl).join(" / ");
  const sg = subj.length ? subj[0].g : -1;
  return { T, IDX, pairs, P, noOf, S, subj, sg, inL: fin(inP), outL: fin(outP), eI: finA(eI), eO: finA(eO), eS: finA(eS), byT: [...byT.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)), byYear, label, desc: wpFilterDesc() };
}

/* ---------- Excel 2 ชีต ---------- */
function wpXlsx(W, ctx, name) {
  const dmy = (m) => { const s = min2iso(m); return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`; };
  const H1 = ["ลำดับคู่", "ผู้โอน", "ธนาคารผู้โอน", "บัญชีผู้โอน", "ผู้รับ", "ธนาคารผู้รับ", "บัญชีผู้รับ", "กลุ่มคู่โอน", "ประเภทรายการ", "ยอดเงิน (บาท)", "ครั้ง", "วันแรก", "วันสุดท้าย"];
  const R1 = W.pairs.map((p) => [p.no, p.fr.name, p.fr.bank, p.fr.acc, p.to.name, p.to.bank, p.to.acc, wpGl(p.g), [...p.ks].map((k) => DB.kinds[k].split(" (")[0]).join(" / "), Math.round(p.v * 100) / 100, p.n, dmy(p.t1), dmy(p.t2)]);
  R1.push(["รวม", `${W.pairs.length} คู่`, "", "", "", "", "", "", "", Math.round(W.pairs.reduce((t, p) => t + p.v, 0) * 100) / 100, W.pairs.reduce((t, p) => t + p.n, 0), "", ""]);
  const rows2 = []; for (const p of W.pairs) for (const i of p.I.slice().sort((a, b) => DB.tx[a][1] - DB.tx[b][1])) rows2.push([p.no, ...ctx.txRow(i)]);
  const H3 = ["ทิศทาง", "ลำดับ", "ระดับ", "ชื่อ", "บัญชี", "กลุ่ม", "ยอดเงิน (บาท)", "ครั้ง", "วันแรก", "วันสุดท้าย", "ลำดับคู่"], R3 = [];
  [["เงินเข้า (ผู้โอน)", W.inL], ["เงินออก (ผู้รับ)", W.outL]].forEach(([dir, L]) => { L.forEach((o, k) => {
    R3.push([dir, String(k + 1), "รวมรายคน", o.name, `${o.avL.length} บัญชี`, wpGl(o.g), Math.round(o.v * 100) / 100, o.n, dmy(o.t1), dmy(o.t2), o.nos.join(", ")]);
    o.avL.forEach((x, j) => R3.push([dir, `${k + 1}.${j + 1}`, "แยกรายบัญชี", x.name, x.lab, wpGl(x.g), Math.round(x.v * 100) / 100, x.n, dmy(x.t1), dmy(x.t2), x.nos.join(", ")])); });
    R3.push([dir, "", "รวม", `${L.length} ราย`, `${L.reduce((t, o) => t + o.avL.length, 0)} บัญชี`, "", Math.round(L.reduce((t, o) => t + o.v, 0) * 100) / 100, L.reduce((t, o) => t + o.n, 0), "", "", ""]); });
  const blob = xlsxBook([
    { name: "คู่โอนรายใหญ่", rows: [H1, ...R1], widths: [9, 34, 9, 16, 34, 9, 16, 26, 18, 16, 8, 12, 12] },
    { name: "สรุปรายคน-รายบัญชี", rows: [H3, ...R3], widths: [16, 8, 13, 34, 24, 26, 16, 8, 12, 12, 40] },
    { name: "รายการย่อย", rows: [["ลำดับคู่", ...ctx.TXH], ...rows2], widths: [9, 12, 9, 34, 8, 15, 34, 8, 15, 30, 16, 26, 40] }]);
  download2(`ชุดสอบปากคำ - ${wpFile(name)} - คู่โอนและรายการย่อย.xlsx`, blob);
  toast(`ส่งออก Excel: ${fmt0(W.pairs.length)} คู่ · ${fmt0(rows2.length)} รายการ`);
}

/* ---------- ชาร์ต (canvas -> PNG) ---------- */
function wpCanvas(w, h, sc) { const s = sc || 2, cv = document.createElement("canvas"); cv.width = w * s; cv.height = h * s; const g = cv.getContext("2d"); g.scale(s, s); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.textBaseline = "top"; return [cv, g]; }
const wpFont = (px, b) => `${b ? "bold " : ""}${px}px Tahoma, "Leelawadee UI", sans-serif`;
function wpWrap(g, text, maxW, maxL) {                                   // ตัดบรรทัดตามคำไทย/คำอังกฤษ
  const segs = WP_SEG ? [...WP_SEG.segment(String(text || ""))].map((x) => x.segment) : String(text || "").split(/(\s+)/);
  const L = []; let cur = "";
  for (const s of segs) { const t = cur + s; if (g.measureText(t).width <= maxW || !cur) cur = t; else { L.push(cur.trim()); cur = s.trimStart(); } }
  if (cur.trim()) L.push(cur.trim());
  if (!L.length) L.push("");
  if (L.length > maxL) { const k = L.slice(0, maxL); let last = k[maxL - 1]; while (last && g.measureText(last + "…").width > maxW) last = last.slice(0, -1); k[maxL - 1] = last + "…"; return k; }
  return L;
}
const wpTint = (hex, a) => { const h = String(hex || "#607D8B").replace("#", ""), n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16), r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255;
  return `rgb(${Math.round(r + (255 - r) * a)},${Math.round(gg + (255 - gg) * a)},${Math.round(b + (255 - b) * a)})`; };
function wpRound(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wpArrow(g, x1, y1, x2, y2, col, wd) {
  const mx = (x1 + x2) / 2; g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(mx, y1, mx, y2, x2 - 8, y2); g.stroke();
  g.fillStyle = col; g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 10, y2 - 5); g.lineTo(x2 - 10, y2 + 5); g.closePath(); g.fill();
}
const WP_K = 8;                                                          // กล่องต่อด้านต่อหน้า (ภาพลงหน้า A4 แนวนอนแล้วยังอ่านได้) — แสดงครบทุกราย แบ่งหลายหน้า ไม่มี "รายอื่น"
function wpHead(g, Wd, title, sub) {
  g.fillStyle = "#00264D"; g.fillRect(0, 0, Wd, 56); g.fillStyle = "#FFD403"; g.fillRect(0, 56, Wd, 4);
  g.fillStyle = "#fff"; g.font = wpFont(21, 1); g.fillText(wpWrap(g, title, Wd - 48, 1)[0], 24, 8); g.font = wpFont(14); g.fillText(wpWrap(g, sub, Wd - 48, 1)[0], 24, 35);
}
function wpFoot(g, Wd, H, note) { g.font = wpFont(13); g.fillStyle = "#607D8B"; wpWrap(g, note, Wd - 48, 2).forEach((l, k) => g.fillText(l, 24, H - 58 + k * 18)); g.fillText("จัดทำจากระบบข้อมูลคดี — ข้อมูลตาม statement ธนาคาร ให้ตรวจทานก่อนใช้อ้างอิง", 24, H - 20); }
function wpBox(g, b, x, y, w, h) {
  wpRound(g, x, y, w, h, 8); g.fillStyle = wpTint(b.c, 0.84); g.fill(); g.lineWidth = 2; g.strokeStyle = b.c; g.stroke(); g.fillStyle = b.c; g.fillRect(x, y + 6, 5, h - 12);
  g.fillStyle = "#111"; g.font = wpFont(17, 1); g.fillText(wpWrap(g, b.t, w - 24, 1)[0], x + 14, y + 5);   // ชื่อบัญชีเด่นกว่าเลขบัญชี (ผู้ใช้สั่ง 25 พ.ย. 69)
  g.font = wpFont(12); g.fillStyle = "#5B6B7F"; if (b.s) g.fillText(wpWrap(g, b.s, w - 24, 1)[0], x + 14, y + 28);
  g.font = wpFont(14, 1); g.fillStyle = "#00264D"; g.fillText(`${wpB(b.v)} บาท · ${fmt0(b.n)} ครั้ง`, x + 14, y + 45);
}
/* ชาร์ตรวมรายชื่อ (3 คอลัมน์) — ผู้โอนเข้า -> ผู้ให้ถ้อยคำ -> ผู้รับ ; ทุกราย แบ่งหน้า WP_K กล่องต่อด้าน */
function wpFlowChart(W) {
  const side = (L, cashV, cashN, cashLab) => { const a = L.map((o) => ({ t: o.name || "(ไม่ระบุชื่อ)", s: o.accs.size > 1 ? `${o.accs.size} บัญชี: ${[...o.accs.values()].join(", ")}` : [...o.accs.values()][0] || "", v: o.v, n: o.n, c: wpGc(o.g) }));
    if (cashV > 0) a.push({ t: cashLab, s: "", v: cashV, n: cashN, c: "#9E9E9E" }); return a; };
  const LA = side(W.inL, W.S.depV, W.S.depN, "ฝากเงินสด"), RA = side(W.outL, W.S.cashV, W.S.cashN, "ถอนเงินสด");
  const NP = Math.max(1, Math.ceil(LA.length / WP_K), Math.ceil(RA.length / WP_K)), out = [];
  for (let p = 0; p < NP; p++) {
    const Lb = LA.slice(p * WP_K, (p + 1) * WP_K), Rb = RA.slice(p * WP_K, (p + 1) * WP_K);
    const BW = 340, BH = 64, GAP = 12, X0 = 24, XC = 470, CW = 290, XR = 1200 - 24 - BW, TOP = 104;
    const colH = Math.max(Lb.length, Rb.length, 1) * (BH + GAP);
    const subjL = W.subj, cH = Math.max(200, 92 + subjL.length * 34 + (W.S.selfV ? 22 : 0) + 52);
    const H = TOP + Math.max(colH, cH) + 80, [cv, g] = wpCanvas(1200, H);
    wpHead(g, 1200, "แผนภาพเส้นเงิน (รวมรายชื่อ) — " + W.label + (NP > 1 ? ` · หน้า ${p + 1}/${NP}` : ""), (isFinite(W.S.t1) ? `${wpD(min2iso(W.S.t1))} – ${wpD(min2iso(W.S.t2))} · ` : "") + "ยอดตาม statement ตามตัวกรอง");
    g.fillStyle = "#00264D"; g.font = wpFont(15, 1);
    const sL = Lb.reduce((t, b) => t + b.v, 0), sR = Rb.reduce((t, b) => t + b.v, 0);
    g.fillText(Lb.length ? `เงินเข้า ราย ${p * WP_K + 1}–${p * WP_K + Lb.length} จาก ${LA.length} (${wpB(sL)} บาท)` : `เงินเข้า ${LA.length} ราย (แสดงครบในหน้าก่อน)`, X0, TOP - 32);
    g.textAlign = "right"; g.fillText(Rb.length ? `เงินออก ราย ${p * WP_K + 1}–${p * WP_K + Rb.length} จาก ${RA.length} (${wpB(sR)} บาท)` : `เงินออก ${RA.length} ราย (แสดงครบในหน้าก่อน)`, XR + BW, TOP - 32); g.textAlign = "left";
    const cY = TOP + Math.max(0, (Math.max(colH, cH) - cH) / 2), cc = W.sg >= 0 ? wpGc(W.sg) : "#00264D";
    const yOf = (k, nB) => TOP + Math.max(0, (Math.max(colH, cH) - nB * (BH + GAP)) / 2) + k * (BH + GAP);
    Lb.forEach((b, k) => { const y = yOf(k, Lb.length); wpBox(g, b, X0, y, BW, BH); wpArrow(g, X0 + BW, y + BH / 2, XC, cY + 30 + (cH - 60) * (Lb.length > 1 ? k / (Lb.length - 1) : 0.5), b.c, 2); });
    Rb.forEach((b, k) => { const y = yOf(k, Rb.length); wpBox(g, b, XR, y, BW, BH); wpArrow(g, XC + CW, cY + 30 + (cH - 60) * (Rb.length > 1 ? k / (Rb.length - 1) : 0.5), XR, y + BH / 2, cc, 2); });
    wpRound(g, XC, cY, CW, cH, 12); g.fillStyle = wpTint(cc, 0.9); g.fill(); g.lineWidth = 3; g.strokeStyle = cc; g.stroke();
    g.fillStyle = cc; wpRound(g, XC, cY, CW, 52, 12); g.fill(); g.fillRect(XC, cY + 30, CW, 22);
    g.fillStyle = typeof inkOn === "function" ? inkOn(cc) : "#fff"; g.font = wpFont(15, 1); wpWrap(g, W.label, CW - 20, 2).forEach((l, j) => g.fillText(l, XC + 10, cY + 6 + j * 20));
    let y = cY + 62; g.fillStyle = "#1a1a1a";
    subjL.forEach((a) => { g.font = wpFont(14, 1); g.fillText(wpWrap(g, a.name || "(ไม่ระบุชื่อ)", CW - 20, 1)[0], XC + 10, y); g.font = wpFont(11.5); g.fillStyle = "#5B6B7F"; g.fillText(wpWrap(g, `${a.bank} ${a.acc}`.trim() || "(ไม่ระบุเลขบัญชี)", CW - 20, 1)[0], XC + 10, y + 17); g.fillStyle = "#1a1a1a"; y += 34; });
    if (W.S.selfV) { g.font = wpFont(12); g.fillStyle = "#6A1B9A"; g.fillText(wpWrap(g, `โอนระหว่างบัญชีของตนเอง ${wpB(W.S.selfV)} บาท`, CW - 20, 1)[0], XC + 10, y); y += 22; }
    g.font = wpFont(13, 1); g.fillStyle = "#1565C0"; g.fillText(`รับเข้า ${wpB(W.S.inV)} บาท`, XC + 10, cY + cH - 46); g.fillStyle = "#B3261E"; g.fillText(`โอนออก ${wpB(W.S.outV)} บาท`, XC + 10, cY + cH - 26);
    wpFoot(g, 1200, H, "สีกล่อง = กลุ่มบุคคลตามชาร์ตสรุป · สีเส้น = สีกล่องต้นทาง · กล่องละ 1 ราย (รวมบัญชีของชื่อเดียวกัน) แสดงครบทุกราย แบ่งหน้าละไม่เกิน " + WP_K + " รายต่อด้าน · เส้นเงินแยกรายบัญชีดูแผนภาพแยกรายบัญชี");
    out.push(cv);
  }
  return out;
}
/* ชาร์ตแยกรายบัญชี (2 คอลัมน์ ต้นทาง -> ปลายทาง) — 1 กล่อง = 1 บัญชี แม้ชื่อเดียวกัน ; ทุกเส้นมีป้ายยอด ; แบ่งหน้าเมื่อเกิน WP_K บัญชีต่อด้าน
   E: [{a, b, v, n}] ; a/b = {name, bank, acc, g, cash} ; ยอดในกล่อง = ยอดรวมของบัญชีนั้นทั้งชุด */
function wpBipCharts(E, o) {
  if (!E.length) return [];
  const nd = (e) => ({ k: wpAk(e), t: e.cash ? e.name : e.name || "(ไม่ระบุชื่อ)", s: e.cash ? "" : (`${e.bank} ${e.acc}`.trim() || "(ไม่ระบุเลขบัญชี)"), c: e.cash ? "#9E9E9E" : (e.col || wpGc(e.g)), v: 0, n: 0 });
  const NA = new Map(), NB = new Map();
  for (const e of E) { const ka = wpAk(e.a), kb = wpAk(e.b); if (!NA.has(ka)) NA.set(ka, nd(e.a)); if (!NB.has(kb)) NB.set(kb, nd(e.b)); const A = NA.get(ka), B = NB.get(kb); A.v += e.v; A.n += e.n; B.v += e.v; B.n += e.n; }
  const ord = [...NA.values()].sort((x, y) => y.v - x.v), oi = new Map(ord.map((x, k) => [x.k, k]));
  const ES = E.map((e) => ({ v: e.v, n: e.n, A: NA.get(wpAk(e.a)), B: NB.get(wpAk(e.b)) })).sort((x, y) => oi.get(x.A.k) - oi.get(y.A.k) || y.v - x.v);
  const pages = []; let cur = null;
  for (const e of ES) { if (!cur || (!cur.A.has(e.A.k) && cur.A.size >= WP_K) || (!cur.B.has(e.B.k) && cur.B.size >= WP_K)) pages.push((cur = { A: new Map(), B: new Map(), E: [] }));
    cur.A.set(e.A.k, e.A); cur.B.set(e.B.k, e.B); cur.E.push(e); }
  const totV = E.reduce((t, e) => t + e.v, 0), totN = E.reduce((t, e) => t + e.n, 0), out = [];
  pages.forEach((P, pi) => out.push(() => {                            // วาดทีละภาพเมื่อเรียก (ภาพจำนวนมากไม่ค้างในหน่วยความจำ)
    const A = [...P.A.values()], ai = new Map(A.map((x, k) => [x.k, k]));
    const bc = new Map(); for (const e of P.E) { const z = bc.get(e.B.k) || [0, 0]; z[0] += ai.get(e.A.k); z[1]++; bc.set(e.B.k, z); }
    const bm = (x) => bc.get(x.k)[0] / bc.get(x.k)[1];
    const B = [...P.B.values()].sort((x, y) => bm(x) - bm(y) || y.v - x.v), bi = new Map(B.map((x, k) => [x.k, k]));
    const eA = new Map(), eB = new Map(); for (const e of P.E) { if (!eA.has(e.A.k)) eA.set(e.A.k, []); eA.get(e.A.k).push(e); if (!eB.has(e.B.k)) eB.set(e.B.k, []); eB.get(e.B.k).push(e); }
    const PH = 20, hOf = (m) => Math.max(66, 52 + m * PH), GAP = 12, BW = 350, X0 = 24, XR = 1200 - 24 - BW, TOP = 126;
    const hA = A.map((x) => hOf(eA.get(x.k).length)), hB = B.map((x) => hOf(eB.get(x.k).length));
    const cA = hA.reduce((t, h) => t + h + GAP, 0), cB = hB.reduce((t, h) => t + h + GAP, 0), CH = Math.max(cA, cB);
    const H = TOP + CH + 84, [cv, g] = wpCanvas(1200, H, 1.35), pV = P.E.reduce((t, e) => t + e.v, 0), pN = P.E.reduce((t, e) => t + e.n, 0);
    wpHead(g, 1200, `${o.title}${pages.length > 1 ? ` · หน้า ${pi + 1}/${pages.length}` : ""}`, o.sub || "");
    g.font = wpFont(14); g.fillStyle = "#37474F";
    g.fillText(`หน้านี้ ${fmt0(P.E.length)} เส้น ${wpB(pV)} บาท (${fmt0(pN)} ครั้ง) · ทั้งชุด ${fmt0(E.length)} เส้น ${wpB(totV)} บาท (${fmt0(totN)} ครั้ง)`, 24, 68);
    g.fillStyle = "#00264D"; g.font = wpFont(15, 1); g.fillText(o.lt, X0, TOP - 30); g.textAlign = "right"; g.fillText(o.rt, XR + BW, TOP - 30); g.textAlign = "left";
    const yA = [], yB = []; let y = TOP + (CH - cA) / 2; A.forEach((x, k) => { yA.push(y); y += hA[k] + GAP; }); y = TOP + (CH - cB) / 2; B.forEach((x, k) => { yB.push(y); y += hB[k] + GAP; });
    const pA = new Map(), pB = new Map();
    A.forEach((x, k) => eA.get(x.k).slice().sort((p, q) => bi.get(p.B.k) - bi.get(q.B.k)).forEach((e, j) => pA.set(e, yA[k] + 62 + j * PH)));
    B.forEach((x, k) => eB.get(x.k).slice().sort((p, q) => ai.get(p.A.k) - ai.get(q.A.k)).forEach((e, j) => pB.set(e, yB[k] + 62 + j * PH)));
    A.forEach((x, k) => wpBox(g, x, X0, yA[k], BW, hA[k])); B.forEach((x, k) => wpBox(g, x, XR, yB[k], BW, hB[k]));
    for (const e of P.E) wpArrow(g, X0 + BW, pA.get(e), XR, pB.get(e), e.A.c, 1.8);
    g.font = wpFont(12, 1); g.textBaseline = "middle";
    for (const e of P.E) { const t = `${wpB(e.v)} (${fmt0(e.n)})`, w = g.measureText(t).width, x = X0 + BW + 8, yy = pA.get(e) - 9;
      g.fillStyle = "rgba(255,255,255,.92)"; g.fillRect(x - 2, yy - 7, w + 4, 14); g.fillStyle = e.A.c; g.fillText(t, x, yy); }
    g.textBaseline = "top";
    wpFoot(g, 1200, H, "1 กล่อง = 1 บัญชี (ชื่อเดียวกันแต่คนละบัญชีแยกกล่อง) · ยอดในกล่อง = ยอดรวมของบัญชีนั้นทั้งชุด · ป้ายบนเส้น = ยอดของคู่บัญชีนั้น (จำนวนครั้ง) · สีเส้น = สีกล่องต้นทาง · แสดงครบทุกเส้น แบ่งหน้าละไม่เกิน " + WP_K + " บัญชีต่อด้าน");
    return cv;
  }));
  return out;
}
function wpTimeChart(W) {                                               // เงินเข้า / ออกของผู้ให้ถ้อยคำ รายปีหรือรายเดือน
  const D = W.byT; if (!D.length) return null;
  const H = 440, [cv, g] = wpCanvas(1200, H), L = 90, R = 1176, T = 80, B = H - 70, mx = Math.max(1, ...D.map((d) => Math.max(d[1][0], d[1][1])));
  g.fillStyle = "#00264D"; g.font = wpFont(18, 1); g.fillText(`เงินเข้า – ออก ${W.byYear ? "รายปี" : "รายเดือน"} — ${wpWrap(g, W.label, 700, 1)[0]}`, 24, 18);
  g.font = wpFont(13); g.fillStyle = "#1565C0"; g.fillRect(860, 26, 14, 14); g.fillStyle = "#1a1a1a"; g.fillText("เงินเข้า (โอนให้)", 880, 25);
  g.fillStyle = "#B3261E"; g.fillRect(1010, 26, 14, 14); g.fillStyle = "#1a1a1a"; g.fillText("เงินออก (โอนไป)", 1030, 25);
  const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }, top = nice(mx), unit = top >= 1e6 ? 1e6 : 1e3, ul = unit === 1e6 ? "ล้านบาท" : "พันบาท";
  g.strokeStyle = "#CFD8DC"; g.lineWidth = 1; g.font = wpFont(12); g.fillStyle = "#455A64"; g.textAlign = "right";
  for (let k = 0; k <= 5; k++) { const v = top * k / 5, y = B - (B - T) * k / 5; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.fillText((v / unit).toLocaleString("en-US", { maximumFractionDigits: 2 }), L - 8, y - 7); }
  g.save(); g.translate(22, (T + B) / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.fillText(ul, 0, 0); g.restore();
  const cw = (R - L) / D.length, bw = Math.min(40, cw * 0.36), lab = D.length <= 24;
  D.forEach(([k, v], j) => { const x = L + cw * j + cw / 2;
    [[v[0], "#1565C0", -bw - 2], [v[1], "#B3261E", 2]].forEach(([val, col, dx]) => { const h = (B - T) * val / top; g.fillStyle = col; g.fillRect(x + dx, B - h, bw, h);
      if (lab && val / unit >= 0.05) { g.fillStyle = "#1a1a1a"; g.font = wpFont(11); g.textAlign = "center"; g.fillText((val / unit).toLocaleString("en-US", { maximumFractionDigits: 1 }), x + dx + bw / 2, B - h - 15); } });
    if (D.length <= 36 || j % Math.ceil(D.length / 36) === 0) { g.fillStyle = "#1a1a1a"; g.font = wpFont(12); g.textAlign = "center"; g.fillText(W.byYear ? String(k + 543) : `${MTH[+k.slice(5, 7)]} ${String(+k.slice(0, 4) + 543).slice(2)}`, x, B + 8); } });
  g.textAlign = "left"; g.font = wpFont(12); g.fillStyle = "#607D8B"; g.fillText(`หน่วย: ${ul} · ไม่รวมโอนระหว่างบัญชีของตนเอง`, 24, H - 26);
  return cv;
}
async function wpImgs(list) {                                          // list: canvas หรือฟังก์ชันวาด -> [{png, w, h}] ทีละภาพ แล้วคืนหน่วยความจำ
  const out = []; let k = 0;
  for (const x of list) { const cv = typeof x === "function" ? x() : x; out.push({ png: await wpPng(cv), w: cv.width, h: cv.height }); cv.width = cv.height = 0;
    if (++k % 10 === 0) { toast(`กำลังวาดชาร์ต ${k}/${list.length}…`); await new Promise((r) => setTimeout(r, 0)); } }
  return out;
}
const wpPng = (cv) => new Promise((res) => cv.toBlob((b) => b.arrayBuffer().then((a) => res(new Uint8Array(a))), "image/png"));

/* ---------- Word (.docx) ---------- */
function wR(t, o = {}) {                                                 // ข้อความ 1 ช่วง (ภาษาไทย ไม่มีเส้นแดง)
  const sz = o.sz || 30, pr = `<w:rPr><w:rFonts w:ascii="${WPF}" w:hAnsi="${WPF}" w:cs="${WPF}" w:eastAsia="${WPF}"/>${o.b ? "<w:b/><w:bCs/>" : ""}${o.i ? "<w:i/><w:iCs/>" : ""}<w:noProof/>${o.color ? `<w:color w:val="${o.color}"/>` : ""}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="th-TH" w:eastAsia="th-TH" w:bidi="th-TH"/></w:rPr>`;
  return String(t ?? "").split("\n").map((s, k) => `<w:r>${pr}${k ? "<w:br/>" : ""}<w:t xml:space="preserve">${wx(wpZ(s))}</w:t></w:r>`).join("");
}
function wP(runs, o = {}) {
  return `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ""}${o.keep ? "<w:keepNext/>" : ""}${o.pb ? "<w:pageBreakBefore/>" : ""}${o.line ? `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="${o.line}"/></w:pBdr>` : ""}${o.shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>` : ""}<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 60}"/>${o.ind ? `<w:ind w:left="${o.ind}"/>` : ""}${o.align ? `<w:jc w:val="${o.align}"/>` : ""}</w:pPr>${typeof runs === "string" && !runs.startsWith("<w:r") ? wR(runs, o.style === "Heading1" ? { b: 1, sz: 36, color: "00264D" } : o) : runs}</w:p>`;
}
function wT(widths, rows, o = {}) {                                     // rows: [{h, cells:[{t | runs, b, fill, color, align, span}]}]
  const sum = widths.reduce((a, b) => a + b, 0), bd = (k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="9EAAB5"/>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${sum}" w:type="dxa"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(bd).join("")}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="20" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="20" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>` +
    rows.map((r) => { let ci = 0; return `<w:tr><w:trPr>${r.split ? "" : "<w:cantSplit/>"}${r.h ? "<w:tblHeader/>" : ""}</w:trPr>${r.cells.map((c) => { const sp = c.span || 1, w = widths.slice(ci, ci + sp).reduce((a, b) => a + b, 0); ci += sp;
      const fill = c.fill || (r.h ? "00264D" : r.fill), sz = c.sz || o.sz || 26, col = c.color || (r.h ? "FFFFFF" : undefined);
      const paras = c.runs ? c.runs : String(c.t ?? "").split("\n\n").map((s) => wP(wR(s, { sz, b: c.b || r.h || r.b, color: col }), { after: 0, align: c.align || (r.h ? "center" : undefined) })).join("");
      return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${sp > 1 ? `<w:gridSpan w:val="${sp}"/>` : ""}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ""}<w:vAlign w:val="${r.h ? "center" : "top"}"/></w:tcPr>${paras || "<w:p/>"}</w:tc>`; }).join("")}</w:tr>`; }).join("") + "</w:tbl>" + wP("", { after: 80 });
}
function wImg(rid, id, cx, cy) {
  return `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="ภาพ ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}
function wpDocx(body, imgs, footer) {                                    // imgs: [Uint8Array png] (rIdImg1..)
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:footerReference w:type="default" r:id="rIdFt"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="450" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const fld = (c) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${c} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  const ft = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${wR(footer + " · หน้า ", { sz: 22, color: "607D8B" })}${fld("PAGE")}${wR(" / ", { sz: 22, color: "607D8B" })}${fld("NUMPAGES")}</w:p></w:ftr>`;
  const rp = `<w:rPr><w:rFonts w:ascii="${WPF}" w:hAnsi="${WPF}" w:cs="${WPF}" w:eastAsia="${WPF}"/><w:sz w:val="30"/><w:szCs w:val="30"/><w:lang w:val="th-TH" w:eastAsia="th-TH" w:bidi="th-TH"/></w:rPr>`;
  const hs = (id, nm, lv, sz) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${nm}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/><w:outlineLvl w:val="${lv}"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="00264D"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`;
  const sty = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault>${rp}</w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${hs("Heading1", "heading 1", 0, 36)}${hs("Heading2", "heading 2", 1, 32)}<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${imgs.map((_, k) => `<Relationship Id="rIdImg${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${k + 1}.png"/>`).join("")}</Relationships>`;
  return zipStore([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ["word/document.xml", doc], ["word/styles.xml", sty], ["word/footer1.xml", ft], ["word/_rels/document.xml.rels", rels],
    ...imgs.map((u, k) => [`word/media/image${k + 1}.png`, u])], "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}

/* ---------- ประเด็นคำถาม (ครบทุกราย ไม่คัดเฉพาะยอดใหญ่ — ผู้ใช้สั่ง 25 พ.ย. 69 "เอกสารในสำนวนต้องครบถ้วน") ---------- */
function wpQuestions(W, name) {
  const Q = [], rng = (a, b) => (a === b ? wpD(min2iso(a)) : `${wpD(min2iso(a))} ถึง ${wpD(min2iso(b))}`), ref = (nos) => (nos.length ? `อ้างอิง: ลำดับคู่ที่ ${nos.join(", ")} ในไฟล์ Excel` : "");
  const ti = DB.groups.findIndex((x) => x[0] === "t1");
  const accL = (o) => o.avL.map((x) => `${x.lab} ${wpB(x.v)} บาท (${fmt0(x.n)} ครั้ง)`).join("\n");
  const grps = [...new Set([...W.inL, ...W.outL].map((o) => o.g))].filter((g) => g !== ti && DB.groups[g] && !/^(oth|sus|shop|cash)$/.test(DB.groups[g][0])).map(wpGl).filter(Boolean);
  Q.push({ f: `ผู้ให้ถ้อยคำ: ${name}${grps.length ? `\n\nพบการรับ-โอนเงินกับบุคคลในกลุ่ม: ${grps.join(" / ")}` : ""}`,
    q: "ขอให้ท่านเล่าประวัติโดยย่อ อาชีพ รายได้ต่อเดือน และความเกี่ยวข้องกับมูลนิธิ ผู้บริหารมูลนิธิ และบุคคลในกลุ่มที่ปรากฏ ว่ารู้จักกันอย่างไร ตั้งแต่เมื่อใด" });
  if (W.subj.length) Q.push({ f: W.subj.map((a) => `${a.bank} ${a.acc} ${a.name}${a.st ? " (มี statement)" : ""}\n\nรับเข้า ${wpB(a.inV)} บาท (${fmt0(a.inN)} ครั้ง) · โอนออก ${wpB(a.outV)} บาท (${fmt0(a.outN)} ครั้ง)`).join("\n\n"),
    q: "บัญชีดังกล่าวเป็นของท่านหรือไม่ เปิดบัญชีเมื่อใด เพื่อวัตถุประสงค์ใด ผู้ใดเป็นผู้ถือสมุดบัญชี บัตร ATM และใช้แอปพลิเคชันธนาคาร มีบุคคลอื่นใช้บัญชีแทนหรือสั่งให้ท่านทำธุรกรรมหรือไม่" });
  if (W.S.dnV.size) { const tot = [...W.S.dnV.values()].reduce((a, b) => a + b, 0), D = W.inL.filter((o) => o.g === ti);
    Q.push({ f: `ได้รับเงินจากบัญชีรับบริจาคของมูลนิธิ รวม ${wpB(tot)} บาท\n\n` + [...W.S.dnV.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${k} ${wpB(v)} บาท`).join("\n") + (D.length ? `\n\nช่วงวันที่ ${rng(Math.min(...D.map((o) => o.t1)), Math.max(...D.map((o) => o.t2)))}\n\n${ref(D.flatMap((o) => o.nos).sort((a, b) => a - b))}` : ""),
      q: "เงินที่ได้รับจากบัญชีรับบริจาคดังกล่าวเป็นเงินค่าอะไร ผู้ใดเป็นผู้สั่งจ่ายหรือติดต่อให้โอน มีสัญญา ใบเสนอราคา ใบเสร็จ ใบส่งของ หรือหลักฐานการทำงานหรือไม่ และเมื่อได้รับเงินแล้วท่านนำไปใช้ทำอะไรต่อ" }); }
  const outK = new Set(W.outL.map((o) => wpNk(o.name) || o.name));
  W.inL.filter((o) => o.g !== ti).forEach((o) => Q.push({ f: `ระหว่างวันที่ ${rng(o.t1, o.t2)} บัญชีของท่าน (${[...o.sub].join(", ")}) ได้รับโอนจาก ${o.name || "(ไม่ระบุชื่อ)"}\n\n${accL(o)}\n\nรวม ${fmt0(o.n)} ครั้ง ${wpB(o.v)} บาท · กลุ่ม ${wpGl(o.g)}\n\n${ref(o.nos)}`,
    q: `${o.name || "ผู้โอน"} เป็นใคร เกี่ยวข้องกับท่านอย่างไร เงินที่ได้รับเป็นค่าอะไร เหตุใดจึงโอนให้ท่าน${o.n > 1 ? " และเหตุใดจึงโอนหลายครั้ง" : ""} มีเอกสารหลักฐานประกอบหรือไม่` }));
  W.outL.forEach((o) => Q.push({ f: `ระหว่างวันที่ ${rng(o.t1, o.t2)} บัญชีของท่าน (${[...o.sub].join(", ")}) โอนเงินให้ ${o.name || "(ไม่ระบุชื่อ)"}\n\n${accL(o)}\n\nรวม ${fmt0(o.n)} ครั้ง ${wpB(o.v)} บาท · กลุ่ม ${wpGl(o.g)}\n\n${ref(o.nos)}`,
    q: `ท่านโอนเงินให้ ${o.name || "ผู้รับ"} เพื่อการใด ผู้รับเป็นใคร เงินที่โอนเป็นเงินของท่านเองหรือของผู้ใด ผู้ใดเป็นผู้สั่งให้โอน และผู้รับนำเงินไปใช้ทำอะไร (ถ้าทราบ)` }));
  const both = W.inL.filter((o) => outK.has(wpNk(o.name) || o.name)).map((o) => ({ o, x: W.outL.find((y) => (wpNk(y.name) || y.name) === (wpNk(o.name) || o.name)) }));
  both.forEach(({ o, x }) => Q.push({ f: `มีทั้งรับเงินจากและโอนเงินให้ ${o.name}\n\nรับเข้า ${wpB(o.v)} บาท (${fmt0(o.n)} ครั้ง) ช่วง ${rng(o.t1, o.t2)}\n\nโอนออก ${wpB(x.v)} บาท (${fmt0(x.n)} ครั้ง) ช่วง ${rng(x.t1, x.t2)}\n\n${ref([...o.nos, ...x.nos].sort((a, b) => a - b))}`,
    q: `เหตุใดจึงมีการรับและโอนเงินกลับไปมากับ ${o.name} เงินที่โอนกลับเป็นการคืนเงิน แบ่งเงิน หรือชำระหนี้หรือไม่ มีการตกลงกันไว้อย่างไร` }));
  const amt = (i) => (typeof TXV !== "undefined" && TXV ? TXV.get(i) || 0 : DB.tx[i][3]);
  if (W.S.cashN) Q.push({ f: `ถอนเงินสดจากบัญชีของท่าน ${fmt0(W.S.cashN)} ครั้ง รวม ${wpB(W.S.cashV)} บาท ทุกรายการ:\n` + W.S.cashL.slice().sort((a, b) => DB.tx[a][1] - DB.tx[b][1]).map((i) => `• ${wpDT(DB.tx[i][1])} ${wpB(amt(i))} บาท (${DB.accounts[DB.tx[i][0]].bank} ${DB.accounts[DB.tx[i][0]].acc})${txCh(i) ? " " + txCh(i) : ""}`).join("\n"),
    q: "ท่านถอนเงินสดไปเพื่อการใด ถอนด้วยตนเองหรือผู้อื่นถอนแทน นำเงินสดไปมอบให้ผู้ใด ที่ใด มีหลักฐานการรับเงินหรือไม่" });
  if (W.S.depN) Q.push({ f: `ฝากเงินสดเข้าบัญชีของท่าน ${fmt0(W.S.depN)} ครั้ง รวม ${wpB(W.S.depV)} บาท ทุกรายการ:\n` + W.S.depL.slice().sort((a, b) => DB.tx[a][1] - DB.tx[b][1]).map((i) => `• ${wpDT(DB.tx[i][1])} ${wpB(amt(i))} บาท (${DB.accounts[DB.tx[i][0]].bank} ${DB.accounts[DB.tx[i][0]].acc})${txCh(i) ? " " + txCh(i) : ""}`).join("\n"),
    q: "เงินสดที่นำฝากได้มาจากที่ใด ผู้ใดเป็นผู้นำฝาก และเป็นเงินค่าอะไร" });
  if (W.S.selfN) Q.push({ f: `โอนเงินระหว่างบัญชีของท่านเอง ${fmt0(W.S.selfN)} ครั้ง รวม ${wpB(W.S.selfV)} บาท\n\n` + W.eS.map((e) => `• ${e.a.bank} ${e.a.acc} → ${e.b.bank} ${e.b.acc} ${wpB(e.v)} บาท (${fmt0(e.n)} ครั้ง)`).join("\n"),
    q: "เหตุใดจึงโอนเงินระหว่างบัญชีของตนเอง แต่ละบัญชีใช้สำหรับวัตถุประสงค์ใด" });
  Q.push({ f: "", q: "ท่านมีเอกสารหรือพยานหลักฐานใดจะนำมาแสดงเพิ่มเติม และมีอะไรจะให้การเพิ่มเติมอีกหรือไม่" });
  return Q;
}
const wpRng = (a, b) => `${wpD(min2iso(a))}${b !== a ? " – " + wpD(min2iso(b)) : ""}`;
/* ตารางสรุปรายคน + แยกรายบัญชีในตารางเดียวกัน (ผู้ใช้สั่ง 25 พ.ย. 69) — แถวรวมของคน ตามด้วยแถวบัญชีแต่ละบัญชี ; ครบทุกราย */
function wpPerTab(L, who) {
  const tot = L.reduce((t, o) => [t[0] + o.v, t[1] + o.n], [0, 0]), nAcc = L.reduce((t, o) => t + o.avL.length, 0), R = [];
  L.forEach((o, k) => { const multi = o.avL.length > 1;
    R.push({ fill: multi ? "E8EEF4" : undefined, cells: [{ t: String(k + 1), align: "center", b: 1 }, { t: (o.name || "(ไม่ระบุชื่อ)") + (multi ? `\n\nรวม ${o.avL.length} บัญชี` : ""), b: 1 }, { t: multi ? "" : o.avL[0].lab }, { t: wpGl(o.g) },
      { t: wpB(o.v), align: "right", b: 1 }, { t: fmt0(o.n), align: "right", b: 1 }, { t: `${wpRng(o.t1, o.t2)}\n\nคู่ที่ ${o.nos.join(", ")}`, sz: 22 }] });
    if (multi) o.avL.forEach((x, j) => R.push({ cells: [{ t: `${k + 1}.${j + 1}`, align: "center", sz: 22 }, { t: x.name !== o.name ? x.name : "", sz: 24, color: "455A64" }, { t: x.lab, sz: 24 }, { t: x.g !== o.g ? wpGl(x.g) : "", sz: 22 },
      { t: wpB(x.v), align: "right", sz: 24 }, { t: fmt0(x.n), align: "right", sz: 24 }, { t: `${wpRng(x.t1, x.t2)}\n\nคู่ที่ ${x.nos.join(", ")}`, sz: 22 }] })); });
  return wT([800, 3500, 3200, 2200, 1900, 1100, 2100], [{ h: 1, cells: [{ t: "#" }, { t: who }, { t: "บัญชี" }, { t: "กลุ่ม" }, { t: "ยอดเงิน (บาท)" }, { t: "ครั้ง" }, { t: "ช่วงวันที่ / ลำดับคู่" }] }, ...R,
    { b: 1, fill: "FFF4C2", cells: [{ t: "" }, { t: `รวม ${fmt0(L.length)} ราย`, b: 1 }, { t: `${fmt0(nAcc)} บัญชี`, b: 1 }, { t: "" }, { t: wpB(tot[0]), align: "right", b: 1 }, { t: fmt0(tot[1]), align: "right", b: 1 }, { t: "" }] }], { sz: 26 });
}
function wpEdgeTab(E, lt, rt) {                                        // เส้นเงินแยกรายบัญชี ทุกคู่
  const tot = E.reduce((t, e) => [t[0] + e.v, t[1] + e.n], [0, 0]), lab = (e) => (e.cash ? e.name : `${e.bank} ${e.acc}`.trim() + "\n" + e.name);
  return wT([800, 4000, 4000, 2000, 1100, 2900], [{ h: 1, cells: [{ t: "#" }, { t: lt }, { t: rt }, { t: "ยอดเงิน (บาท)" }, { t: "ครั้ง" }, { t: "ช่วงวันที่ / ลำดับคู่" }] },
    ...E.map((e, k) => ({ cells: [{ t: String(k + 1), align: "center" }, { t: lab(e.a), sz: 24 }, { t: lab(e.b), sz: 24 }, { t: wpB(e.v), align: "right", b: 1 }, { t: fmt0(e.n), align: "right" }, { t: `${wpRng(e.t1, e.t2)}\n\nคู่ที่ ${e.nos.join(", ")}`, sz: 22 }] })),
    { b: 1, fill: "FFF4C2", cells: [{ t: "" }, { t: `รวม ${fmt0(E.length)} คู่บัญชี`, span: 2 }, { t: wpB(tot[0]), align: "right" }, { t: fmt0(tot[1]), align: "right" }, { t: "" }] }], { sz: 26 });
}
async function wpWord(W, name, opt = {}) {
  const NT = W.IDX.length;
  if (NT > 20000 && !confirm(`ตัวกรองนี้มี ${fmt0(NT)} รายการ — เอกสาร Word จะใส่ครบทุกรายการ อาจใช้เวลาสร้างหลายนาทีและไฟล์ใหญ่ ต้องการสร้างต่อหรือไม่`)) return;
  toast("กำลังสร้างเอกสาร…");
  const sub = (isFinite(W.S.t1) ? `${wpD(min2iso(W.S.t1))} – ${wpD(min2iso(W.S.t2))} · ` : "") + "ยอดตาม statement ตามตัวกรอง";
  const C1 = wpFlowChart(W);
  const noAcc = opt.acc === false, CI = noAcc ? [] : wpBipCharts(W.eI, { title: "เงินเข้า แยกรายบัญชี — " + W.label, sub, lt: "บัญชีผู้โอน", rt: "บัญชีของผู้ให้ถ้อยคำ" });
  const CO = noAcc ? [] : wpBipCharts(W.eO, { title: "เงินออก แยกรายบัญชี — " + W.label, sub, lt: "บัญชีของผู้ให้ถ้อยคำ", rt: "บัญชีผู้รับ" });
  const CS = noAcc ? [] : wpBipCharts(W.eS, { title: "โอนระหว่างบัญชีของตนเอง แยกรายบัญชี — " + W.label, sub, lt: "บัญชีต้นทาง", rt: "บัญชีปลายทาง" });
  const CT = wpTimeChart(W), IM = await wpImgs([...C1, ...CI, ...CO, ...CS, ...(CT ? [CT] : [])]), imgs = IM.map((x) => x.png);
  const EMW = 9300000, EMH = 5500000, fit = (m) => { let cx = EMW, cy = Math.round(EMW * m.h / m.w); if (cy > EMH) { cx = Math.round(cx * EMH / cy); cy = EMH; } return [cx, cy]; };
  let ii = 0; const img = (_, first) => { ii++; const [cx, cy] = fit(IM[ii - 1]); return (first ? "" : wP("", { pb: 1, after: 0 })) + wImg(`rIdImg${ii}`, ii, cx, cy); };
  const S = W.S, B = [];
  B.push(wP(wR("ชุดข้อมูลประกอบการสอบปากคำ", { b: 1, sz: 40, color: "FFFFFF" }), { shd: "00264D", after: 0 }));
  B.push(wP(wR(name, { b: 1, sz: 34, color: "00264D" }), { shd: "FFD403", after: 120 }));
  B.push(wT([3000, 11800], [
    { cells: [{ t: "ผู้ให้ถ้อยคำ / กลุ่มบัญชี", b: 1, fill: "E8EEF4" }, { t: name }] },
    { cells: [{ t: "ขอบเขตข้อมูล (ตัวกรอง)", b: 1, fill: "E8EEF4" }, { t: W.desc }] },
    { cells: [{ t: "ช่วงวันที่ที่พบรายการ", b: 1, fill: "E8EEF4" }, { t: isFinite(S.t1) ? `${wpD(min2iso(S.t1))} ถึง ${wpD(min2iso(S.t2))}` : "-" }] },
    { cells: [{ t: "จัดทำเมื่อ", b: 1, fill: "E8EEF4" }, { t: `${wpD(isoNow().slice(0, 10))} จากข้อมูล statement ณ ${wpD(DB.made || "")}` }] },
    { cells: [{ t: "ความครบถ้วน", b: 1, fill: "E8EEF4" }, { t: `เอกสารนี้แสดงครบทุกราย ทุกบัญชี และทุกรายการตามตัวกรอง (${fmt0(NT)} รายการ ${fmt0(W.pairs.length)} คู่โอน) ไม่ได้คัดเฉพาะยอดใหญ่ — "ลำดับคู่" ตรงกับคอลัมน์ลำดับคู่ในไฟล์ Excel ชุดเดียวกัน` }] }], { sz: 28 }));
  B.push(wP("1. ภาพรวมการรับ-โอนเงิน", { style: "Heading1" }));
  B.push(wT([5200, 2400, 3200, 4000], [
    { h: 1, cells: [{ t: "รายการ" }, { t: "ครั้ง" }, { t: "ยอดเงิน (บาท)" }, { t: "หมายเหตุ" }] },
    { cells: [{ t: "รับเงินเข้าบัญชีของผู้ให้ถ้อยคำ" }, { t: fmt0(S.inN), align: "right" }, { t: wpB(S.inV), align: "right", b: 1 }, { t: `จาก ${fmt0(W.inL.length)} ราย${S.depN ? " + ฝากเงินสด" : ""}` }] },
    { cells: [{ t: "โอนเงินออกจากบัญชีของผู้ให้ถ้อยคำ" }, { t: fmt0(S.outN), align: "right" }, { t: wpB(S.outV), align: "right", b: 1 }, { t: `ให้ ${fmt0(W.outL.length)} ราย${S.cashN ? " + ถอนเงินสด" : ""}` }] },
    ...(S.depN ? [{ cells: [{ t: "  ในจำนวนนี้ ฝากเงินสด" }, { t: fmt0(S.depN), align: "right" }, { t: wpB(S.depV), align: "right" }, { t: "" }] }] : []),
    ...(S.cashN ? [{ cells: [{ t: "  ในจำนวนนี้ ถอนเงินสด" }, { t: fmt0(S.cashN), align: "right" }, { t: wpB(S.cashV), align: "right" }, { t: "" }] }] : []),
    ...(S.selfN ? [{ cells: [{ t: "โอนระหว่างบัญชีของตนเอง" }, { t: fmt0(S.selfN), align: "right" }, { t: wpB(S.selfV), align: "right" }, { t: "ไม่นับในยอดรับ/โอนข้างต้น" }] }] : []),
    ...(S.othN ? [{ cells: [{ t: "รายการอื่นตามตัวกรอง (ไม่เกี่ยวกับบัญชีของผู้ให้ถ้อยคำ)" }, { t: fmt0(S.othN), align: "right" }, { t: wpB(S.othV), align: "right" }, { t: "อยู่ในข้อ 7 และไฟล์ Excel" }] }] : [])], { sz: 28 }));
  if (W.subj.length) { B.push(wP("บัญชีของผู้ให้ถ้อยคำที่พบในรายการ", { b: 1, keep: 1, color: "00264D" }));
    B.push(wT([1500, 2300, 5000, 1500, 2300, 2200], [{ h: 1, cells: [{ t: "ธนาคาร" }, { t: "เลขบัญชี" }, { t: "ชื่อบัญชี" }, { t: "statement" }, { t: "รับเข้า (บาท)" }, { t: "โอนออก (บาท)" }] },
      ...W.subj.map((a) => ({ cells: [{ t: a.bank || "-" }, { t: a.acc || "(ไม่ระบุ)" }, { t: a.name }, { t: a.st ? "มี" : "ยังไม่มี", align: "center" }, { t: `${wpB(a.inV)}\n${fmt0(a.inN)} ครั้ง`, align: "right" }, { t: `${wpB(a.outV)}\n${fmt0(a.outN)} ครั้ง`, align: "right" }] })),
      { b: 1, fill: "FFF4C2", cells: [{ t: `รวม ${fmt0(W.subj.length)} บัญชี`, span: 4 }, { t: wpB(W.subj.reduce((t, a) => t + a.inV, 0)), align: "right" }, { t: wpB(W.subj.reduce((t, a) => t + a.outV, 0)), align: "right" }] }], { sz: 26 })); }
  B.push(wP("2. แผนภาพเส้นเงิน", { style: "Heading1", pb: 1 }));
  B.push(wP(wR(`2.1 รวมรายชื่อ (${C1.length} ภาพ) — กล่องละ 1 ราย รวมบัญชีของชื่อเดียวกัน แสดงครบทุกราย`, { b: 1, color: "00264D" })));
  C1.forEach((cv, k) => B.push(img(cv, k === 0)));
  if (CI.length) { B.push(wP(wR(`2.2 เงินเข้า แยกรายบัญชี (${CI.length} ภาพ) — 1 กล่อง = 1 บัญชี แม้ชื่อเดียวกัน ทุกเส้นมียอดกำกับ`, { b: 1, color: "00264D" }), { pb: 1 })); CI.forEach((cv, k) => B.push(img(cv, k === 0))); }
  if (CO.length) { B.push(wP(wR(`2.3 เงินออก แยกรายบัญชี (${CO.length} ภาพ)`, { b: 1, color: "00264D" }), { pb: 1 })); CO.forEach((cv, k) => B.push(img(cv, k === 0))); }
  if (CS.length) { B.push(wP(wR(`2.4 โอนระหว่างบัญชีของตนเอง (${CS.length} ภาพ)`, { b: 1, color: "00264D" }), { pb: 1 })); CS.forEach((cv, k) => B.push(img(cv, k === 0))); }
  if (CT) { B.push(wP(wR("2.5 เงินเข้า – ออก ตามช่วงเวลา", { b: 1, color: "00264D" }), { pb: 1 })); B.push(img(CT, true)); }
  B.push(wP("3. ผู้โอนเงินให้ — ยอดรวมรายคนและแยกรายบัญชี", { style: "Heading1", pb: 1 }));
  B.push(W.inL.length ? wpPerTab(W.inL, "ผู้โอน") : wP("ไม่พบรายการ"));
  if (S.depN) B.push(wP(wR(`ฝากเงินสดเข้าบัญชีของผู้ให้ถ้อยคำ ${fmt0(S.depN)} ครั้ง ${wpB(S.depV)} บาท (ไม่ทราบผู้ฝาก — รายการอยู่ในข้อ 5 และข้อ 7)`, { sz: 26 })));
  B.push(wP("4. ผู้รับเงินจากบัญชีของผู้ให้ถ้อยคำ — ยอดรวมรายคนและแยกรายบัญชี", { style: "Heading1" }));
  B.push(W.outL.length ? wpPerTab(W.outL, "ผู้รับ") : wP("ไม่พบรายการ"));
  if (S.cashN) B.push(wP(wR(`ถอนเงินสดจากบัญชีของผู้ให้ถ้อยคำ ${fmt0(S.cashN)} ครั้ง ${wpB(S.cashV)} บาท (รายการอยู่ในข้อ 6 และข้อ 7)`, { sz: 26 })));
  B.push(wP("5. เส้นเงินเข้า แยกรายบัญชี (ทุกคู่บัญชี)", { style: "Heading1", pb: 1 }));
  B.push(W.eI.length ? wpEdgeTab(W.eI, "บัญชีผู้โอน", "บัญชีของผู้ให้ถ้อยคำ") : wP("ไม่พบรายการ"));
  B.push(wP("6. เส้นเงินออก แยกรายบัญชี (ทุกคู่บัญชี)", { style: "Heading1" }));
  B.push(W.eO.length ? wpEdgeTab(W.eO, "บัญชีของผู้ให้ถ้อยคำ", "บัญชีผู้รับ") : wP("ไม่พบรายการ"));
  if (W.eS.length) { B.push(wP("โอนระหว่างบัญชีของตนเอง", { b: 1, keep: 1, color: "00264D" })); B.push(wpEdgeTab(W.eS, "บัญชีต้นทาง", "บัญชีปลายทาง")); }
  const amt = (i) => (typeof TXV !== "undefined" && TXV ? TXV.get(i) || 0 : DB.tx[i][3]);
  const AL = W.IDX.slice().sort((a, b) => DB.tx[a][1] - DB.tx[b][1]);
  B.push(wP(`7. รายการทั้งหมด ${fmt0(AL.length)} รายการ (เรียงตามเวลา)`, { style: "Heading1", pb: 1 }));
  B.push(wT([700, 2200, 4000, 4000, 2100, 1800], [{ h: 1, cells: [{ t: "#" }, { t: "วันเวลา / คู่ที่" }, { t: "ผู้โอน" }, { t: "ผู้รับ" }, { t: "ช่องทาง" }, { t: "ยอดเงิน (บาท)" }] },
    ...AL.map((i, k) => { const [fr, to] = wpSides(i), pk = (cpOf(i) * 64 + DB.tx[i][0]) * 2 + (IN_K.includes(DB.tx[i][2]) ? 1 : 0), r = DB.tx[i];
      return { cells: [{ t: String(k + 1), align: "center", sz: 22 }, { t: `${r[2] === 4 ? wpD(min2iso(r[1])).replace(/^\d+ /, "") + " (ทั้งเดือน)" : wpDT(r[1])}\n\nคู่ที่ ${W.noOf.get(pk) || "-"}`, sz: 22 }, { t: `${fr.name}\n${fr.bank} ${fr.acc}`, sz: 24 }, { t: `${to.name}\n${to.bank} ${to.acc}`, sz: 24 },
        { t: txCh(i) || DB.kinds[r[2]].split(" (")[0], sz: 22 }, { t: wpB(amt(i)) + ((r[5] || 1) > 1 ? `\n${fmt0(r[5])} ครั้ง` : ""), align: "right", b: 1 }] }; }),
    { b: 1, fill: "FFF4C2", cells: [{ t: "" }, { t: `รวม ${fmt0(AL.length)} รายการ`, span: 4 }, { t: wpB(AL.reduce((t, i) => t + amt(i), 0)), align: "right" }] }], { sz: 24 }));
  B.push(wP("8. ประเด็นคำถามในการสอบปากคำ", { style: "Heading1", pb: 1 }));
  B.push(wP(wR("ร่างคำถามจัดทำจากข้อเท็จจริงใน statement ครบทุกรายที่ปรากฏ เพื่อประกอบการสอบปากคำ — ให้พนักงานสอบสวนตรวจทาน ปรับถ้อยคำ และเพิ่มประเด็นตามสถานะของผู้ให้ถ้อยคำ (พยาน / ผู้ต้องหา) ก่อนใช้", { sz: 26, i: 1, color: "455A64" }), { after: 100 }));
  const Q = wpQuestions(W, name);
  B.push(wT([700, 5500, 4800, 3800], [{ h: 1, cells: [{ t: "ข้อ" }, { t: "ข้อเท็จจริงจากการตรวจสอบ" }, { t: "ประเด็นคำถาม" }, { t: "บันทึกคำตอบ" }] },
    ...Q.map((q, k) => ({ split: 1, cells: [{ t: String(k + 1), align: "center", b: 1 }, { t: q.f || "-", sz: 24 }, { t: q.q, b: 1 }, { t: "\n\n\n" }] }))], { sz: 26 }));
  B.push(wP(wR("หมายเหตุ: ยอดเงินตาม statement ธนาคารของบัญชีที่มีข้อมูล (บัญชีที่ยังไม่มี statement เห็นเฉพาะรายการที่ทำกับบัญชีที่มี statement) · การรวมรายคนใช้ชื่อบัญชีที่ตัดคำนำหน้า และแสดงยอดแยกรายบัญชีในตารางเดียวกัน · ตัวเลขทุกรายการตรวจสอบได้ในไฟล์ Excel ชุดเดียวกัน", { sz: 24, color: "607D8B" }), { before: 120 }));
  const blob = wpDocx(B.join(""), imgs, `ชุดข้อมูลประกอบการสอบปากคำ — ${name}`);
  download2(`ชุดสอบปากคำ - ${wpFile(name)} - ประเด็นคำถาม.docx`, blob);
  toast(`สร้างเอกสาร: ${fmt0(AL.length)} รายการ · ${Q.length} ประเด็นคำถาม · ภาพ ${imgs.length} ภาพ`);
  return blob;
}

/* ---------- หน้าต่างเลือก ---------- */
function wpOpen(ctx) {
  if (!ctx.IDX.length) return toast("ไม่มีรายการตามตัวกรอง");
  const W = wpBuild(ctx), nCh = [W.eI, W.eO, W.eS].reduce((t, E) => t + wpBipCharts(E, { title: "", lt: "", rt: "" }).length, 0);
  openModal(`<h3>${IC("doc", 18)} ชุดข้อมูลสอบปากคำ</h3>
    <p class="muted" style="margin:0;font-size:.86rem">${esc(W.desc)}</p>
    <label>ผู้ให้ถ้อยคำ / กลุ่มบัญชี (ใช้เป็นชื่อเอกสาร)</label><input id="wpName" value="${esc(W.label)}">
    <div class="wpstat"><span><b>${fmt0(W.IDX.length)}</b> รายการ</span><span><b>${fmt0(W.pairs.length)}</b> คู่โอน</span><span>บัญชีของผู้ให้ถ้อยคำ <b>${fmt0(W.subj.length)}</b></span><span>รับเข้า <b>${M(W.S.inV)}</b></span><span>โอนออก <b>${M(W.S.outV)}</b></span></div>
    ${W.T.mode === "all" ? `<p class="muted" style="font-size:.82rem;margin:4px 0 0">ยังไม่ได้ค้นหาชื่อหรือเลือกบัญชี/กลุ่ม — ระบบจะถือบัญชีที่มี statement ทั้งหมดเป็นฝั่งผู้ให้ถ้อยคำ</p>` : ""}
    <div class="wpgo">
      <button class="wpopt" id="wpX">${IC("xls", 22)}<b>Excel ไฟล์เดียว 3 ชีต</b><small>คู่โอนทุกคู่ · สรุปรายคน-รายบัญชี · รายการย่อยทุกรายการ (มีลำดับคู่เชื่อมกัน)</small></button>
      <button class="wpopt" id="wpW">${IC("doc", 22)}<b>ประเด็นคำถาม (Word)</b><small>ครบทุกรายการ ไม่คัดยอด · ชาร์ตรวมรายชื่อ + ชาร์ตแยกรายบัญชี (ทุกเส้น) · ตารางรายคนพร้อมแยกรายบัญชี · ร่างคำถาม + ช่องบันทึกคำตอบ</small></button>
    </div>
    <label class="wpchk"><input type="checkbox" id="wpA"${nCh <= 60 ? " checked" : ""}> ใส่ชาร์ตแยกรายบัญชีครบทุกเส้นใน Word — ${fmt0(nCh)} ภาพ${nCh > 20 ? ` (ไฟล์ราว ${fmt0(Math.ceil(nCh * 0.35))} MB${nCh > 60 ? " — จำนวนภาพมาก ระบบจึงไม่ติ๊กไว้ก่อน ; ตารางและไฟล์ Excel ยังครบทุกรายการ" : ""})` : ""}</label>
    <div class="modal-foot"><button class="btn o" id="wpBoth">ส่งออกทั้ง 2 ไฟล์</button><button class="btn" id="wpC">ปิด</button></div>`);
  const nm = () => $("#wpName").value.trim() || W.label;
  $("#wpC").onclick = closeModal;
  $("#wpX").onclick = () => wpXlsx(W, ctx, nm());
  const wop = () => ({ acc: $("#wpA").checked });
  $("#wpW").onclick = () => wpWord(W, nm(), wop());
  $("#wpBoth").onclick = async () => { const n = nm(); wpXlsx(W, ctx, n); await new Promise((r) => setTimeout(r, 400)); await wpWord(W, n, wop()); };
}

/* ---------- รายงานผู้บริจาค (ผู้ใช้สั่ง 25 พ.ย. 69) ----------
   ปุ่มบนป้ายเหลืองโหมดไล่เงินผู้บริจาค -> (1) Word สำหรับพนักงานสอบสวน: ข้อมูลผู้บริจาค / รายการบริจาค / ภาพรวมเส้นเงิน (ภาพชาร์ตบนจอ) / สรุปตามทอด / ปลายสาย / รายการโอนเป็นทอด — ไม่มีประเด็นคำถาม
   (2) Excel สำหรับชุดสืบสวน: รายการโอนเป็นทอดครบทุกรายการ + รายการบริจาค + สรุปตามทอด ; ใช้ผลไล่ชุดเดียวกับชาร์ต (DNT) */
const wpDd = (d) => (d >= 0 ? wpD(new Date(Date.UTC(2015, 0, 1) + d * 864e5).toISOString()) : "");
const WP_MODE = { full: "รับเข้าแล้วโอนออกถัดไป (ยอดเต็มรายการ)", pro: "ตามสัดส่วน", fifo: "เข้าก่อนออกก่อน (ตัดเท่ายอดบริจาค)" };
const WP_MODE_NOTE = {
  full: "แสดงรายการโอนออกจริงที่เกิดถัดจากเวลาที่เงินเข้าบัญชี ใช้ยอดเต็มของรายการ (อาจมากกว่ายอดบริจาค เพราะมีเงินอื่นปนอยู่ในบัญชี) แล้วไล่ต่อด้วยยอดเต็มนั้น",
  pro: "เงินบริจาคปนกับยอดคงเหลือในบัญชี ทุกรายการโอนออกหลังจากนั้นพาเงินบริจาคออกไปตามสัดส่วน ยอดที่แสดงคือส่วนของเงินบริจาค",
  fifo: "จับรายการโอนออกถัดไปตามเวลาจนครบยอดบริจาค (ไม่คำนึงถึงเงินอื่นในบัญชี)" };
function wpSvgPng(svg) {
  return new Promise((res) => {
    if (!svg) return res(null);
    let css = ""; for (const ss of document.styleSheets) { try { for (const r of ss.cssRules) if (/\.(fl|fn|flh)/.test(r.selectorText || "")) css += r.cssText; } catch (e) { } }
    const c = svg.cloneNode(true); c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    c.insertAdjacentHTML("afterbegin", `<style>text{font-family:Tahoma,"Leelawadee UI",sans-serif}${css}</style><rect width="100%" height="100%" fill="#fff"/>`);
    const w = +svg.getAttribute("width"), h = +svg.getAttribute("height"), im = new Image();
    im.onload = () => { const cv = document.createElement("canvas"); cv.width = w * 2; cv.height = h * 2; const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.scale(2, 2); g.drawImage(im, 0, 0); res(cv); };
    im.onerror = () => res(null);
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(c));
  });
}
function wpDonorData() {
  const D = DN, T = DNT; if (!D || !T) return null;
  const ids = new Set(T.ids || []), accs = [...ids].map((i) => D.d[i]);
  const xs = D.x.filter((x) => ids.has(x[0])).sort((a, b) => dnFL(a)[0] - dnFL(b)[0] || String(a[3]).localeCompare(String(b[3])));
  const by = D.t1.map(() => [0, 0]); let f = Infinity, l = -1, tot = 0, cnt = 0;
  for (const x of xs) { by[x[1]][0] += x[4]; by[x[1]][1] += x[5]; tot += x[4]; cnt += x[5]; const [a, b] = dnFL(x); if (a >= 0) { f = Math.min(f, a); l = Math.max(l, b); } }
  const tOf = (p) => (p.i >= 0 ? DB.tx[p.i][1] : p.t || 0);
  const P = (T.P || []).slice().sort((a, b) => a.hop - b.hop || tOf(a) - tOf(b));
  const rows = P.map((p) => { const a = DB.accounts[p.from] || {}, c = p.i >= 0 ? DB.cps[cpOf(p.i)] : null;
    return { hop: p.hop, i: p.i, t: p.i >= 0 ? DB.tx[p.i][1] : null, fn: a.name || "", fb: a.bank || "", fa: a.acc || "", tn: c ? c[1] || "" : "", tb: c ? c[2] || "" : "", ta: c ? c[0] || "" : "",
      g: c ? c[3] : -1, ch: p.i >= 0 ? txCh(p.i) : "", amt: p.amt, full: p.full || 0, end: p.end || "โอนต่อ (ไล่ทอดถัดไป)" }; });
  const H = new Map();
  for (const r of rows) { let h = H.get(r.hop); if (!h) H.set(r.hop, (h = { hop: r.hop, n: 0, v: 0, to: new Map(), g: new Map() })); h.n++; h.v += r.amt;
    const k = r.tn || r.end; h.to.set(k, (h.to.get(k) || 0) + r.amt); if (r.g >= 0) h.g.set(r.g, (h.g.get(r.g) || 0) + r.amt); }
  const E = new Map();
  for (const r of rows) { if (r.end.startsWith("โอนต่อ")) continue; const who = r.tn || (r.i < 0 ? `${r.fn} (${r.fb} ${r.fa})` : r.ta), k = r.end + "|" + who;
    let e = E.get(k); if (!e) E.set(k, (e = { end: r.end, to: who, acc: r.i < 0 ? "" : `${r.tb} ${r.ta}`.trim(), g: r.g, v: 0, n: 0 })); e.v += r.amt; e.n++; }
  const ET = new Map(); for (const e of E.values()) ET.set(e.end, (ET.get(e.end) || 0) + e.v);
  return { T, D, accs, xs, by, f, l, tot, cnt, rows, hops: [...H.values()], ends: [...E.values()].sort((a, b) => b.v - a.v), endT: [...ET.entries()].sort((a, b) => b[1] - a[1]), name: T.name || (accs[0] && accs[0][2]) || "ผู้บริจาค" };
}
function wpDonorXlsx(R) {
  const dmy = (m) => { const s = min2iso(m); return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`; };
  const S1 = [["ทอด", "วันที่", "เวลา", "ผู้โอน", "ธนาคารผู้โอน", "บัญชีผู้โอน", "ผู้รับ", "ธนาคารผู้รับ", "บัญชีผู้รับ", "ช่องทาง", R.T.mode === "full" ? "ยอดเงิน (บาท)" : "ยอดที่ไล่ได้ (บาท)", "ยอดเต็มรายการ (บาท)", "กลุ่มผู้รับ", "ปลายทาง"],
    ...R.rows.map((r) => [r.hop, r.t != null ? dmy(r.t) : "", r.i >= 0 ? txT(r.i) : "", r.fn, r.fb, r.fa, r.tn, r.tb, r.ta, r.ch, Math.round(r.amt * 100) / 100, r.full ? Math.round(r.full * 100) / 100 : "", r.g >= 0 ? wpGl(r.g) : "", r.end])];
  const S2 = [["วันที่ / ช่วงวันที่", "เวลา", "ผู้บริจาค", "ธนาคาร", "บัญชีผู้บริจาค", "เข้าบัญชีรับบริจาค", "ประเภทรายการ", "ยอดเงิน (บาท)", "ครั้ง"],
    ...R.xs.map((x) => { const d = R.D.d[x[0]], [a, b] = dnFL(x); return [a === b ? wpDd(a) : `${wpDd(a)} – ${wpDd(b)}`, x[3] || "", d[2], d[1], d[0], R.D.t1[x[1]], R.D.kinds[x[6]] || "", x[4], x[5]]; })];
  const S3 = [["ทอด", "รายการ", "ยอดรวม (บาท)", "ผู้รับ (ทุกราย)", "กลุ่มที่รับ (ทุกกลุ่ม)"],
    ...R.hops.map((h) => [h.hop, h.n, Math.round(h.v * 100) / 100, [...h.to.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${wpB(v)}`).join(" / "), [...h.g.entries()].sort((a, b) => b[1] - a[1]).map(([g, v]) => `${wpGl(g)} ${wpB(v)}`).join(" / ")])];
  download2(`รายงานผู้บริจาค - ${wpFile(R.name)} - รายการโอนเป็นทอด.xlsx`, xlsxBook([
    { name: "โอนเป็นทอด", rows: S1, widths: [6, 12, 9, 32, 9, 16, 32, 9, 16, 28, 16, 16, 24, 30] },
    { name: "รายการบริจาค", rows: S2, widths: [24, 9, 30, 9, 16, 44, 22, 14, 7] },
    { name: "สรุปตามทอด", rows: S3, widths: [6, 9, 16, 80, 50] }]));
  toast(`ส่งออก Excel: ${fmt0(R.rows.length)} รายการโอน`);
}
function wpDonorCharts(R) {
  const T = R.T;
  // ชาร์ตครบทุกเส้น แยกรายบัญชี (ผู้ใช้สั่ง 25 พ.ย. 69 — ภาพบนจอรวมกล่อง/ตัดตามจำนวนกล่อง จึงไม่ใช้ในเอกสารสำนวน)
  const t1acc = (k) => { const a = DB.accounts.find((x) => x.g === DB.groups.findIndex((y) => y[0] === "t1") && R.D.t1[k] && R.D.t1[k].includes(x.acc)); return a ? { name: a.name, bank: a.bank, acc: a.acc, g: a.g } : { name: R.D.t1[k], bank: "", acc: "", g: DB.groups.findIndex((y) => y[0] === "t1") }; };
  const E0 = new Map(); for (const x of R.xs) { const d = R.D.d[x[0]], a = { name: d[2], bank: d[1], acc: d[0], g: -1, col: "#C9A400" }, b = t1acc(x[1]), key = wpAk(a) + "|" + wpAk(b);
    let e = E0.get(key); if (!e) E0.set(key, (e = { a, b, v: 0, n: 0 })); e.v += x[4]; e.n += x[5]; }
  const endE = (r) => ({ name: r.end, bank: "", acc: "", g: -1, cash: 1 });
  const HE = new Map(); for (const r of R.rows) { const fa = DB.accounts.find((x) => x.acc === r.fa && x.bank === r.fb), a = { name: r.fn, bank: r.fb, acc: r.fa, g: fa ? fa.g : -1 };
    const b = r.i >= 0 ? { name: r.tn || "(ไม่ระบุชื่อ)", bank: r.tb, acc: r.ta, g: r.g } : endE(r), key = r.hop + "#" + wpAk(a) + "|" + wpAk(b);
    let e = HE.get(key); if (!e) HE.set(key, (e = { hop: r.hop, a, b, v: 0, n: 0 })); e.v += r.amt; e.n++; }
  const dsub = `ไล่แบบ${WP_MODE[T.mode] || ""} · ตามลำดับเวลา (ข้อสันนิษฐาน) ไม่ใช่การระบุตัวเงิน`;
  const CH = [{ cap: "การบริจาค: บัญชีผู้บริจาค → บัญชีรับบริจาค", cv: wpBipCharts([...E0.values()], { title: "การบริจาค — " + R.name, sub: dsub, lt: "บัญชีผู้บริจาค", rt: "บัญชีรับบริจาค" }) }];
  [...new Set([...HE.values()].map((e) => e.hop))].sort((a, b) => a - b).forEach((h) => CH.push({ cap: `ทอดที่ ${h}`, cv: wpBipCharts([...HE.values()].filter((e) => e.hop === h), { title: `ทอดที่ ${h} — ${R.name}`, sub: dsub, lt: "บัญชีผู้โอน", rt: "บัญชีผู้รับ / ปลายทาง" }) }));
  return CH;
}
async function wpDonorWord(R, opt = {}) {
  toast("กำลังสร้างรายงาน…");
  const T = R.T, B = [], CH = opt.acc === false ? [] : wpDonorCharts(R), IM = await wpImgs(CH.flatMap((c) => c.cv)), imgs = IM.map((x) => x.png);
  const t1L = R.by.map((v, k) => (v[0] ? `${R.D.t1[k]} ${wpB(v[0])} บาท (${fmt0(v[1])} ครั้ง)` : "")).filter(Boolean);
  B.push(wP(wR("รายงานเส้นทางเงินบริจาค (สำหรับพนักงานสอบสวน)", { b: 1, sz: 40, color: "FFFFFF" }), { shd: "00264D", after: 0 }));
  B.push(wP(wR(R.name, { b: 1, sz: 34, color: "00264D" }), { shd: "FFD403", after: 120 }));
  B.push(wP("1. ข้อมูลผู้บริจาค", { style: "Heading1" }));
  B.push(wT([3200, 11600], [
    { cells: [{ t: "ผู้บริจาค", b: 1, fill: "E8EEF4" }, { t: R.name }] },
    { cells: [{ t: "บัญชีผู้บริจาค", b: 1, fill: "E8EEF4" }, { t: R.accs.map((d) => `${d[1]} ${d[0]} ${d[2]}`).join("\n") }] },
    { cells: [{ t: "ยอดบริจาครวม", b: 1, fill: "E8EEF4" }, { t: `${wpB(R.tot)} บาท (${fmt0(R.cnt)} ครั้ง)`, b: 1 }] },
    { cells: [{ t: "ช่วงวันที่บริจาค", b: 1, fill: "E8EEF4" }, { t: isFinite(R.f) ? (R.f === R.l ? wpDd(R.f) : `${wpDd(R.f)} ถึง ${wpDd(R.l)}`) : "-" }] },
    { cells: [{ t: "บัญชีรับบริจาคที่รับเงิน", b: 1, fill: "E8EEF4" }, { t: t1L.join("\n") || "-" }] },
    { cells: [{ t: "จัดทำเมื่อ", b: 1, fill: "E8EEF4" }, { t: `${wpD(isoNow().slice(0, 10))} จากข้อมูล statement ณ ${wpD(DB.made || "")}` }] }], { sz: 28 }));
  B.push(wP("รายการบริจาค", { b: 1, keep: 1, color: "00264D" }));
  B.push(wT([3000, 1300, 6200, 2600, 2400, 1100], [{ h: 1, cells: [{ t: "วันที่" }, { t: "เวลา" }, { t: "เข้าบัญชีรับบริจาค" }, { t: "ประเภทรายการ" }, { t: "ยอดเงิน (บาท)" }, { t: "ครั้ง" }] },
    ...R.xs.map((x) => { const [a, b] = dnFL(x); return { cells: [{ t: a === b ? wpDd(a) : `${wpDd(a)} – ${wpDd(b)}` }, { t: x[3] || "-" }, { t: R.D.t1[x[1]] }, { t: R.D.kinds[x[6]] || "" }, { t: wpB(x[4]), align: "right" }, { t: fmt0(x[5]), align: "right" }] }; }),
    { b: 1, fill: "FFF4C2", cells: [{ t: "รวม", span: 4 }, { t: wpB(R.tot), align: "right" }, { t: fmt0(R.cnt), align: "right" }] }], { sz: 26 }));
  const maxH = R.hops.reduce((m, h) => Math.max(m, h.hop), 0), gTop = new Map();
  for (const r of R.rows) if (r.g >= 0) gTop.set(r.g, (gTop.get(r.g) || 0) + r.amt);
  const gl = [...gTop.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => wpGl(g));
  const nTx = R.rows.filter((r) => r.i >= 0).length;
  B.push(wP("2. ภาพรวมเส้นเงิน", { style: "Heading1", pb: 1 }));
  B.push(wP(wR(`${R.name} บริจาคเงินรวม ${wpB(R.tot)} บาท จำนวน ${fmt0(R.cnt)} ครั้ง${isFinite(R.f) ? ` ระหว่างวันที่ ${wpDd(R.f)}${R.l !== R.f ? " ถึง " + wpDd(R.l) : ""}` : ""} เข้าบัญชีรับบริจาค ${R.by.map((v, k) => (v[0] ? R.D.t1[k] : "")).filter(Boolean).join(" และ ")} — จากการไล่เส้นเงินตาม statement แบบ${WP_MODE[T.mode] || ""} พบการโอนต่อ ${fmt0(maxH)} ทอด รวม ${fmt0(nTx)} รายการ${gl.length ? ` ผ่านกลุ่ม ${gl.join(" / ")}` : ""} ; ปลายสาย: ${R.endT.map(([k, v]) => `${k} ${wpB(v)} บาท`).join(" · ") || "-"}${T.undated > 0.5 ? ` · ยอดรวมรายย่อยที่ไม่มีวันเวลา (ไล่ต่อไม่ได้) ${wpB(T.undated)} บาท` : ""}`, { sz: 30 }), { after: 100 }));
  B.push(wP(wR(`วิธีไล่: ${WP_MODE_NOTE[T.mode] || ""} — เป็นการไล่ตามลำดับเวลา (ข้อสันนิษฐาน) ไม่ใช่การระบุว่าเป็นเงินก้อนเดียวกัน ต้องตรวจทานกับ statement ก่อนอ้างอิง`, { sz: 24, i: 1, color: "455A64" }), { after: 80 }));
  { let ii = 0; CH.forEach((c) => { if (!c.cv.length) return; B.push(wP(wR(`${c.cap} (${c.cv.length} ภาพ) — 1 กล่อง = 1 บัญชี ทุกเส้นมียอดกำกับ`, { b: 1, color: "00264D" }), { pb: ii > 0 }));
    c.cv.forEach((_, k) => { ii++; const m = IM[ii - 1]; let cx = 9300000, cy = Math.round(9300000 * m.h / m.w); if (cy > 5300000) { cx = Math.round(cx * 5300000 / cy); cy = 5300000; }
      if (k) B.push(wP("", { pb: 1, after: 0 })); B.push(wImg(`rIdImg${ii}`, ii, cx, cy)); }); }); }
  B.push(wP("3. สรุปการโอนตามทอด", { style: "Heading1", pb: 1 }));
  B.push(wT([900, 1300, 2600, 6500, 3500], [{ h: 1, cells: [{ t: "ทอด" }, { t: "รายการ" }, { t: T.mode === "full" ? "ยอดรวม (บาท)" : "ยอดที่ไล่ได้ (บาท)" }, { t: "ผู้รับ (ทุกราย)" }, { t: "กลุ่มที่รับ (ทุกกลุ่ม)" }] },
    ...R.hops.map((h) => ({ split: 1, cells: [{ t: String(h.hop), align: "center", b: 1 }, { t: fmt0(h.n), align: "right" }, { t: wpB(h.v), align: "right", b: 1 },
      { t: [...h.to.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${wpB(v)}`).join("\n"), sz: 22 }, { t: [...h.g.entries()].sort((a, b) => b[1] - a[1]).map(([g, v]) => `${wpGl(g)} ${wpB(v)}`).join("\n"), sz: 22 }] }))], { sz: 26 }));
  let sec = 4;
  if (R.ends.length) { B.push(wP(`${sec++}. ปลายสาย — เงินไปจบที่ใด`, { style: "Heading1" }));
    const top = R.ends, rest = [];
    B.push(wT([3600, 5600, 2800, 1800, 1000], [{ h: 1, cells: [{ t: "ปลายทาง" }, { t: "ผู้รับ / บัญชี" }, { t: "กลุ่ม" }, { t: "ยอด (บาท)" }, { t: "ครั้ง" }] },
      ...top.map((e) => ({ cells: [{ t: e.end }, { t: `${e.to}${e.acc ? "\n" + e.acc : ""}`, sz: 24 }, { t: e.g >= 0 ? wpGl(e.g) : "-" }, { t: wpB(e.v), align: "right", b: 1 }, { t: fmt0(e.n), align: "right" }] })),
      ...(rest.length ? [{ fill: "F3F6F9", cells: [{ t: `ปลายทางอื่น ${fmt0(rest.length)} ราย`, span: 3 }, { t: wpB(rest.reduce((t, e) => t + e.v, 0)), align: "right" }, { t: fmt0(rest.reduce((t, e) => t + e.n, 0)), align: "right" }] }] : [])], { sz: 26 })); }
  B.push(wP(`${sec}. รายการโอนเป็นทอด (สำหรับชุดสืบสวน)`, { style: "Heading1", pb: 1 }));
  const show = R.rows;   // ครบทุกรายการ (รวมแถวปลายทางที่ไม่มีรายการโอน เช่น ค้างในบัญชี)
  B.push(wT([700, 2300, 3700, 3700, 2000, 2400], [{ h: 1, cells: [{ t: "ทอด" }, { t: "วันเวลา" }, { t: "ผู้โอน" }, { t: "ผู้รับ" }, { t: "ช่องทาง / ปลายทาง" }, { t: T.mode === "full" ? "ยอดเงิน (บาท)" : "ยอดที่ไล่ได้ / ยอดเต็ม" }] },
    ...show.map((r) => ({ cells: [{ t: String(r.hop), align: "center" }, { t: r.t != null ? wpDT(r.t) : "-", sz: 24 }, { t: `${r.fn}\n${r.fb} ${r.fa}`, sz: 24 }, { t: `${r.tn || "(ไม่ระบุชื่อ)"}\n${r.tb} ${r.ta}`, sz: 24 },
      { t: `${r.ch || "-"}${r.end.startsWith("โอนต่อ") ? "" : "\n" + r.end}`, sz: 22 },
      { t: T.mode === "full" || Math.abs(r.amt - r.full) < 0.01 ? wpB(r.amt) : `${wpB(r.amt)}\nจาก ${wpB(r.full)}`, align: "right", b: 1 }] }))], { sz: 26 }));
  B.push(wP(wR("หมายเหตุ: ข้อมูลจาก statement ธนาคารของบัญชีที่มีข้อมูล ; บัญชีที่ยังไม่มี statement ไล่ต่อไม่ได้ (แสดงเป็นปลายทาง \"ปลายทางไม่มี statement\") ; ผู้บริจาคที่มีแต่ยอดรวมหลายครั้งโดยไม่มีวันเวลา ไล่ต่อไม่ได้ ; รายงานนี้เป็นข้อมูลประกอบการพิจารณา ให้พนักงานสอบสวนตรวจทานก่อนใช้อ้างอิง", { sz: 24, color: "607D8B" }), { before: 120 }));
  const blob = wpDocx(B.join(""), imgs, `รายงานเส้นทางเงินบริจาค — ${R.name}`);
  download2(`รายงานผู้บริจาค - ${wpFile(R.name)} - เส้นทางเงินบริจาค.docx`, blob);
  toast("สร้างรายงานผู้บริจาคแล้ว");
  return blob;
}
function wpDonorOpen() {
  const R = wpDonorData(); if (!R) return toast("ยังไม่มีผลไล่เงินผู้บริจาค");
  const nTx = R.rows.filter((r) => r.i >= 0).length, mh = R.hops.reduce((m, h) => Math.max(m, h.hop), 0), nCh = wpDonorCharts(R).reduce((t, c) => t + c.cv.length, 0);
  openModal(`<h3>${IC("doc", 18)} รายงานผู้บริจาค</h3>
    <p class="muted" style="margin:0;font-size:.86rem">${esc(R.name)} · บริจาค ${wpB(R.tot)} บาท (${fmt0(R.cnt)} ครั้ง) · ไล่แบบ${esc(WP_MODE[R.T.mode] || "")} · ${fmt0(nTx)} รายการโอน ${fmt0(mh)} ทอด</p>
    <div class="wpgo">
      <button class="wpopt" id="wdW">${IC("doc", 22)}<b>รายงานสำหรับพนักงานสอบสวน (Word)</b><small>ครบทุกรายการ ไม่คัดยอด · ข้อมูลผู้บริจาค · รายการบริจาค · ชาร์ตแยกรายบัญชีทุกทอด · สรุปตามทอด · ปลายสาย · รายการโอนเป็นทอด</small></button>
      <button class="wpopt" id="wdX">${IC("xls", 22)}<b>รายการโอนเป็นทอด (Excel)</b><small>สำหรับชุดสืบสวน: ทุกรายการแยกทอด · รายการบริจาค · สรุปตามทอด</small></button>
    </div>
    <label class="wpchk"><input type="checkbox" id="wdA"${nCh <= 60 ? " checked" : ""}> ใส่ชาร์ตแยกรายบัญชีครบทุกเส้นใน Word — ${fmt0(nCh)} ภาพ${nCh > 20 ? ` (ไฟล์ราว ${fmt0(Math.ceil(nCh * 0.35))} MB${nCh > 60 ? " — จำนวนภาพมาก ระบบจึงไม่ติ๊กไว้ก่อน ; ตารางและไฟล์ Excel ยังครบทุกรายการ" : ""})` : ""}</label>
    <div class="modal-foot"><button class="btn o" id="wdB">ส่งออกทั้ง 2 ไฟล์</button><button class="btn" id="wdC">ปิด</button></div>`);
  $("#wdC").onclick = closeModal;
  const dop = () => ({ acc: $("#wdA").checked });
  $("#wdW").onclick = () => wpDonorWord(R, dop());
  $("#wdX").onclick = () => wpDonorXlsx(R);
  $("#wdB").onclick = async () => { wpDonorXlsx(R); await new Promise((r) => setTimeout(r, 400)); await wpDonorWord(R, dop()); };
}
