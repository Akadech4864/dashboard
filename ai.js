"use strict";
/* ---------- ผู้ช่วย AI : ถามข้อมูลในเว็บแอพ ----------
   - เรียก Claude Messages API จากเบราว์เซอร์โดยตรง ด้วย API key ที่ผู้ใช้ใส่เอง (เก็บใน localStorage ของเครื่องนี้เท่านั้น ไม่อยู่ในไฟล์เว็บ / ไม่ถูกส่งไปที่อื่น)
   - เครื่องมือ (tools) ทำงานในเบราว์เซอร์กับข้อมูลที่ถอดรหัสแล้ว : ตัวเลขทุกตัวคำนวณด้วยโค้ด โมเดลไม่ได้คิดเลขเอง
   - สิ่งที่ถูกส่งออกไปยังผู้ให้บริการ AI = คำถาม + ผลลัพธ์ของเครื่องมือที่โมเดลเรียก (ไม่ได้ส่งฐานข้อมูลทั้งก้อน) */
(() => {
  const AI_URL = "https://api.anthropic.com/v1/messages";
  const AI_VERSION = "2026-10-21";
  const MODELS = [["claude-opus-5-5", "Claude Opus 5.5 (แนะนำ)"], ["claude-sonnet-5-5", "Claude Sonnet 5.5 (เร็ว / ประหยัดกว่า)"], ["claude-haiku-5-5", "Claude Haiku 5.5 (เร็วที่สุด)"]];
  const MAX_TURNS = 10, MAX_RESULT = 60000;
  const conf = () => LS.get("cib_ai") || {};
  Object.assign(ICP, {
    chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
    send: '<path d="M4 12l16-8-6 16-3-6z"/><path d="M11 14l9-10"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
  });

  /* ---------- เครื่องมือ: ทำงานกับข้อมูลในหน้าเว็บ ---------- */
  const KIND = { transfer_in: 0, cash_deposit: 1, transfer_out: 2, cash_withdraw: 3, donation: 4 };
  const KNAME = ["transfer_in", "cash_deposit", "transfer_out", "cash_withdraw", "donation"];
  const r2 = (x) => Math.round(x * 100) / 100;
  const isoOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  const gLab = (i) => DB.groups[i][1].split(" (")[0];
  const gFind = (s) => { s = String(s || "").trim().toLowerCase(); if (!s) return null; const out = new Set(); DB.groups.forEach((g, i) => { if (g[0].toLowerCase() === s || g[1].toLowerCase().includes(s)) out.add(i); }); return out; };
  const accFind = (list, group) => {
    let set = null;
    if (Array.isArray(list) && list.length) { set = new Set(); for (const q of list) { const d = String(q).replace(/\D/g, ""), t = String(q).trim().toLowerCase(); DB.accounts.forEach((a, i) => { if ((d.length >= 4 && a.acc.includes(d)) || (t && a.name.toLowerCase().includes(t))) set.add(i); }); } }
    const gs = gFind(group);
    if (gs) { const s2 = new Set(); DB.accounts.forEach((a, i) => { if (gs.has(a.g) && (!set || set.has(i))) s2.add(i); }); set = s2; }
    return set;
  };
  const accLab = (i) => { const a = DB.accounts[i]; return `${a.bank} ${a.acc} ${a.name}`; };
  let ACC_STAT = null;
  const accStat = () => { if (ACC_STAT) return ACC_STAT; const S = DB.accounts.map(() => [0, 0, 0, 0]); for (const r of DB.tx) { const s = S[r[0]]; if (IN_K.includes(r[2])) s[0] += r[3]; else s[1] += r[3]; if (r[2] === 3) s[2] += r[3]; s[3] += r[5] || 1; } return (ACC_STAT = S); };

  const TOOL_FN = {
    get_overview() {
      const o = DB.over || {};
      return { case: DB.case, data_from: DB.lo, data_to: DB.hi, foundation_cutoff_date: DB.cut, statement_accounts: DB.accounts.length, transaction_rows: DB.tx.length,
        donations_into_donation_accounts: { amount: r2(o.donor_in || 0), count: o.donor_n },
        outflow_from_donation_accounts: r2(o.t1_out || 0),
        outflow_from_donation_accounts_by_recipient_group: (o.hop1 || []).map((r) => ({ group: r[0], amount: r2(r[1]), count: r[2] })),
        yearly_donation_accounts: (o.yearly || []).map((r) => ({ year_be: r[0], part: r[1] || "", money_in: r2(r[2]), money_out: r2(r[4]) })),
        cash_matching: DB.cash, trace_sets: (DB.sets || []).map((s) => ({ name: s.name, kind: s.kind, total: s.total, count: s.n, note: s.note })) };
    },
    list_accounts(a) {
      const S = accStat(), set = accFind(null, a.group);
      return DB.accounts.map((x, i) => ({ i, bank: x.bank, account: x.acc, name: x.name, group: gLab(x.g), first: x.first, last: x.last, money_in: r2(S[i][0]), money_out: r2(S[i][1]), cash_withdraw: r2(S[i][2]), rows: S[i][3] })).filter((x) => !set || set.has(x.i)).map(({ i, ...x }) => x);
    },
    query_transactions(a) {
      const lo = isoOk(a.date_from) ? day2min(a.date_from) : -Infinity, hi = isoOk(a.date_to) ? day2min(a.date_to) + 1440 : Infinity;
      const accs = accFind(a.accounts, a.account_group), cg = gFind(a.counterparty_group);
      const kinds = Array.isArray(a.kinds) && a.kinds.length ? new Set(a.kinds.map((k) => KIND[k]).filter((k) => k != null)) : null;
      const q = String(a.counterparty || "").trim().toLowerCase(), qd = q.replace(/\D/g, "");
      const min = +a.min_amount || 0, max = +a.max_amount || Infinity, gb = a.group_by || "counterparty", lim = Math.min(Math.max(+a.limit || 20, 1), 60);
      if ((Array.isArray(a.accounts) && a.accounts.length || a.account_group) && accs && !accs.size) return { error: "ไม่พบบัญชีที่มี statement ตรงกับเงื่อนไข accounts / account_group — ใช้ list_accounts ดูรายการบัญชี" };
      const tot = { money_in: 0, money_out: 0, count_in: 0, count_out: 0 }, G = new Map(), top = [];
      for (let i = 0; i < DB.tx.length; i++) {
        const r = DB.tx[i];
        if (r[1] < lo || r[1] >= hi || r[3] < min || r[3] > max) continue;
        if (accs && !accs.has(r[0])) continue;
        if (kinds && !kinds.has(r[2])) continue;
        const c = DB.cps[r[4]];
        if (cg && !cg.has(c[3])) continue;
        if (q && !(c[1].toLowerCase().includes(q) || (qd.length >= 4 && c[0].includes(qd)))) continue;
        const inn = IN_K.includes(r[2]), n = r[5] || 1;
        if (inn) { tot.money_in += r[3]; tot.count_in += n; } else { tot.money_out += r[3]; tot.count_out += n; }
        if (gb === "none") { top.push(i); continue; }
        const iso = min2iso(r[1]);
        const key = gb === "counterparty" ? "c" + r[4] : gb === "counterparty_group" ? "g" + c[3] : gb === "account" ? "a" + r[0] : gb === "month" ? iso.slice(0, 7) : gb === "year" ? iso.slice(0, 4) : gb === "kind" ? "k" + r[2] : "all";
        let o = G.get(key); if (!o) G.set(key, (o = [0, 0, 0]));
        o[inn ? 0 : 1] += r[3]; o[2] += n;
      }
      const res = { filters: { date_from: isoOk(a.date_from) ? a.date_from : DB.lo, date_to: isoOk(a.date_to) ? a.date_to : DB.hi, accounts: accs ? [...accs].map(accLab) : "ทุกบัญชีที่มี statement", kinds: kinds ? [...kinds].map((k) => KNAME[k]) : "ทุกประเภท", counterparty: q || null, counterparty_group: cg ? [...cg].map(gLab) : null, min_amount: min || null },
        totals: { money_in: r2(tot.money_in), money_out: r2(tot.money_out), count_in: tot.count_in, count_out: tot.count_out }, group_by: gb };
      if (gb === "none") {
        top.sort((x, y) => DB.tx[y][3] - DB.tx[x][3]);
        res.matched_rows = top.length;
        res.rows = top.slice(0, lim).map((i) => { const r = DB.tx[i], c = DB.cps[r[4]], iso = min2iso(r[1]); return { datetime: r[2] === 4 ? iso.slice(0, 7) + " (ยอดรวมทั้งเดือน)" : iso.slice(0, 16).replace("T", " "), account: accLab(r[0]), kind: KNAME[r[2]], amount: r2(r[3]), counterparty: `${c[1]} ${c[2]} ${c[0]}`.trim(), counterparty_group: gLab(c[3]) }; });
        res.note = `แสดง ${res.rows.length} รายการยอดสูงสุด จากที่ตรงเงื่อนไข ${top.length} แถว`;
        return res;
      }
      const sk = { total: (v) => v[0] + v[1], in: (v) => v[0], out: (v) => v[1], count: (v) => v[2] }[a.sort_by] || ((v) => v[0] + v[1]);
      const lab = (k) => { const t = k[0], n = +k.slice(1);
        if (gb === "counterparty") { const c = DB.cps[n]; return { counterparty: c[1] || "(ไม่ระบุ)", bank: c[2], account: c[0], group: gLab(c[3]) }; }
        if (gb === "counterparty_group") return { counterparty_group: gLab(n) };
        if (gb === "account") return { account: accLab(n), group: gLab(DB.accounts[n].g) };
        if (gb === "kind") return { kind: KNAME[n] };
        return { period: k }; };
      let ent = [...G.entries()];
      ent = (gb === "month" || gb === "year") ? ent.sort((x, y) => (x[0] < y[0] ? -1 : 1)) : ent.sort((x, y) => sk(y[1]) - sk(x[1]));
      res.groups_total = ent.length;
      const cap = (gb === "month" || gb === "year") ? 200 : lim;
      res.rows = ent.slice(0, cap).map(([k, v]) => ({ ...lab(k), money_in: r2(v[0]), money_out: r2(v[1]), count: v[2] }));
      if (ent.length > cap) res.note = `แสดง ${cap} จาก ${ent.length} กลุ่ม (เรียงตาม ${a.sort_by || "total"})`;
      return res;
    },
    get_people(a) {
      const q = String(a.name || "").trim().toLowerCase(), cats = DB.pcats || [], cq = String(a.category || "").trim().toLowerCase();
      const acc = tsAcc(), have = new Set(DB.accounts.map((x) => dg(x.acc)));
      const P = people().filter((p) => (!q || (p.name + " " + p.eng + " " + p.note).toLowerCase().includes(q)) && (!cq || p.cat === cq || ((cats.find((c) => c[0] === p.cat) || [])[1] || "").toLowerCase().includes(cq)));
      const full = P.length <= 12;
      return { total: P.length, categories: cats.map((c) => ({ code: c[0], label: c[1], count: people().filter((p) => p.cat === c[0]).length })).filter((c) => c.count),
        people: P.slice(0, 60).map((p) => { const o = { name: p.name, category: (cats.find((c) => c[0] === p.cat) || [0, p.cat])[1], note: p.note || undefined, accounts: p.accs.length };
          if (full) { const f = pplFlow(p); o.name_en = p.eng || undefined; o.links = p.links && p.links.length ? p.links : undefined;
            o.accounts = p.accs.map((x) => ({ bank: x.bank, account: x.acc, statement: have.has(dg(x.acc)) ? "มี statement ในระบบ" : ((acc.find((r) => dg(r.acc) === dg(x.acc)) || {}).data || "ยังไม่ขอ") }));
            if (f) { o.received_from_statement_accounts = { amount: r2(f.rin), count: f.n1 }; o.paid_into_statement_accounts = { amount: r2(f.rout), count: f.n2 }; } }
          return o; }) };
    },
    get_assets() {
      const S = tsSum(), FZ = tsFrz();
      return { source: "ชีตชุดทำคดี (ข้อมูลของชุดสืบ ไม่ได้เทียบกับ statement)", fetched: TEAM().fetched,
        categories: S.map((s) => ({ category: s.name, owners: s.own.map((o, k) => ({ owner: o, total: s.tot[k], items: s.items.filter((x) => x[2] === k).map((x) => ({ item: x[0], amount: x[1] || null })) })) })),
        frozen_bank_accounts: { total: r2(FZ.secs.flatMap((s) => s.rows).reduce((t, r) => t + r.amt, 0)), sections: FZ.secs.map((s) => ({ section: s.title, accounts: s.rows.length, total: r2(s.rows.reduce((t, r) => t + r.amt, 0)), rows: s.rows.map((r) => ({ bank: r.bank, account: r.acc, name: r.name, amount: r.amt })) })) },
        land_parcels: tsLand().map((r) => ({ owner: r.own, location: r.loc, area: r.area, building: r.bld, bought: r.date, price: r.price || null, mortgage: /จำนอง/.test(r.mort) || undefined })) };
    },
    get_progress() {
      const T = progTasks(), W = tsWit(), A = tsAcc();
      return { source: "ชีตชุดทำคดี", fetched: TEAM().fetched,
        tasks: T.map((t) => ({ no: t.no, date: t.date, title: t.title, owner: t.owner || undefined, result: t.due || "ยังไม่ระบุผล", problem: t.prob || undefined })),
        suspect_summons: tsSus().map((r) => ({ name: r.name, issue: r.issue, date: r.date, time: r.time, status: r.st })),
        witness_summons: W.map((s) => ({ section: s.title, total: s.rows.length, came: s.rows.filter((r) => /มาพบ/.test(r.st)).length, rows: s.rows.map((r) => ({ name: r.name, date: r.date, status: r.st, officer: r.off || undefined, note: r.note || undefined })) })),
        document_summons_count: tsAnu().length,
        statement_requests: { total: A.length, received: A.filter((r) => /ได้แล้ว/.test(r.data)).length, requested_waiting: A.filter((r) => /ขอแล้ว/.test(r.data)).length, rows: A.map((r) => ({ bank: r.bank, account: r.acc, name: r.name, status: r.data, letter: r.ref || undefined })) } };
    },
    get_case_content(a) {
      const want = Array.isArray(a.sections) && a.sections.length ? a.sections : Object.keys(SEC), out = {};
      for (const k of want) if (C[k]) out[k] = C[k].map((it) => ({ title: it.title, detail: it.detail, date: it.date || undefined, who: it.extra1 || undefined, evidence: it.extra2 || undefined, status: it.status || undefined }));
      return { sections_meaning: Object.fromEntries(Object.entries(SEC).map(([k, v]) => [k, v.label])), ...out };
    },
    get_seizure() {
      const S = DB.search || { rows: [], sites: {} };
      return { date: S.made, sites: S.sites, total_items: S.rows.reduce((t, r) => t + (r.n || 0), 0), note: "ราคาเป็นช่วงประเมินเบื้องต้นจากภาพถ่าย ไม่ใช่ราคาประเมินทางการ",
        items: S.rows.map((r) => ({ site: r.site, item: r.item, count: r.n, model_guess: r.model, confidence: r.conf, used_price_low: r.used_lo, used_price_high: r.used_hi })), report: (S.report || "").slice(0, 6000) };
    },
  };
  const P = (o) => ({ type: "object", properties: o, additionalProperties: false });
  const TOOLS = [
    { name: "get_overview", description: "ภาพรวมคดี: ช่วงข้อมูล ยอดเงินบริจาคเข้าบัญชีรับบริจาค ยอดเงินออกจากบัญชีรับบริจาคแยกตามกลุ่มผู้รับ ตารางรายปี สถิติจับคู่ถอน-ฝากเงินสด และรายชื่อชุดไล่เส้นเงิน เรียกก่อนเมื่อคำถามกว้างหรือยังไม่รู้ว่าข้อมูลมีอะไร", input_schema: P({}) },
    { name: "list_accounts", description: "รายชื่อบัญชีที่มี statement ในระบบ (ธนาคาร เลขบัญชี ชื่อ กลุ่ม ช่วงวันที่ ยอดเข้า ยอดออก ยอดถอนเงินสด) ใช้หาเลขบัญชีหรือกลุ่มก่อนเรียก query_transactions", input_schema: P({ group: { type: "string", description: "รหัสหรือชื่อกลุ่มบัญชี (ไม่ใส่ = ทุกกลุ่ม)" } }) },
    { name: "query_transactions", description: "ค้นและรวมยอดรายการเดินบัญชีจาก statement ตามตัวกรอง แล้วจัดกลุ่มผลลัพธ์ ใช้กับทุกคำถามที่ต้องการตัวเลขเงินเข้า เงินออก ถอนเงินสด ฝากเงินสด ผู้รับเงิน ผู้โอนเงิน หรือแนวโน้มตามเวลา ผลลัพธ์มียอดรวม (totals) ของทุกรายการที่ตรงตัวกรองเสมอ และรายการแยกตาม group_by หมายเหตุ: money_in / money_out เป็นมุมมองของบัญชีที่มี statement (เงินออก = บัญชีนั้นจ่ายให้คู่โอน)",
      input_schema: P({
        date_from: { type: "string", description: "วันที่เริ่ม ค.ศ. รูปแบบ YYYY-MM-DD" }, date_to: { type: "string", description: "วันที่สิ้นสุด ค.ศ. รูปแบบ YYYY-MM-DD (รวมวันนั้น)" },
        accounts: { type: "array", items: { type: "string" }, description: "เลขบัญชี (อย่างน้อย 4 หลัก) หรือบางส่วนของชื่อบัญชีที่มี statement" },
        account_group: { type: "string", description: "รหัสหรือชื่อกลุ่มของบัญชีที่มี statement เช่น t1 = บัญชีรับบริจาค" },
        kinds: { type: "array", items: { type: "string", enum: KNAME }, description: "ประเภทรายการ: transfer_in โอนเข้า / cash_deposit ฝากเงินสด / transfer_out โอนออก-จ่าย / cash_withdraw ถอนเงินสด / donation เงินบริจาคเข้า (ยอดรวมรายเดือน)" },
        counterparty: { type: "string", description: "บางส่วนของชื่อคู่โอน หรือเลขบัญชีคู่โอน" }, counterparty_group: { type: "string", description: "รหัสหรือชื่อกลุ่มของคู่โอน" },
        min_amount: { type: "number", description: "ยอดขั้นต่ำต่อรายการ (บาท)" }, max_amount: { type: "number", description: "ยอดสูงสุดต่อรายการ (บาท)" },
        group_by: { type: "string", enum: ["counterparty", "counterparty_group", "account", "month", "year", "kind", "none"], description: "วิธีจัดกลุ่มผลลัพธ์ ; none = คืนรายการเดี่ยวยอดสูงสุด" },
        sort_by: { type: "string", enum: ["total", "in", "out", "count"], description: "เรียงกลุ่มตาม ยอดรวม / เงินเข้า / เงินออก / จำนวนครั้ง" }, limit: { type: "integer", description: "จำนวนแถวสูงสุด (ค่าเริ่มต้น 20 สูงสุด 60)" } }) },
    { name: "get_people", description: "บุคคลและนิติบุคคลที่เกี่ยวข้อง พร้อมประเภท (เช่น กรรมการ ผู้ขายที่ดิน ช่าง/ผู้รับเหมา) หมายเหตุ บัญชี สถานะ statement และยอดรับ/โอนกับบัญชีที่มี statement ถ้าผลลัพธ์ไม่เกิน 12 รายจะให้รายละเอียดเต็ม", input_schema: P({ name: { type: "string", description: "บางส่วนของชื่อ" }, category: { type: "string", description: "รหัสหรือชื่อประเภทบุคคล" } }) },
    { name: "get_assets", description: "ทรัพย์สินที่ตรวจพบและเงินในบัญชีที่อายัด ตามชีตชุดทำคดี: ที่ดิน รถยนต์ ประกัน กองทุน สลาก แยกผู้ถือครอง รายแปลงที่ดิน และรายบัญชีที่อายัด", input_schema: P({}) },
    { name: "get_progress", description: "ความคืบหน้าการทำคดีตามชีตชุดทำคดี: งานที่ดำเนินการ หมายเรียกผู้ต้องหา หมายเรียกพยาน และสถานะการขอ statement รายบัญชี", input_schema: P({}) },
    { name: "get_case_content", description: "เนื้อหาคดีที่บันทึกในเว็บแอพ: เนื้อเรื่อง รายละเอียดคดี ลำดับเหตุการณ์ ผู้ต้องหาและข้อหา ข้อต่อสู้ที่ต้องพิสูจน์ งานที่ทำแล้ว และงานที่ต้องทำต่อ", input_schema: P({ sections: { type: "array", items: { type: "string", enum: ["story", "case", "events", "charges", "defences", "done", "todo"] }, description: "หมวดที่ต้องการ (ไม่ใส่ = ทุกหมวด)" } }) },
    { name: "get_seizure", description: "ผลการตรวจค้นและของกลางที่ตรวจยึด: จุดตรวจค้น รายการของกลาง จำนวน ช่วงราคาประเมินเบื้องต้น และรายงานผลการตรวจค้น", input_schema: P({}) },
  ];
  function runTool(name, input) {
    const fn = TOOL_FN[name];
    if (!fn) return { content: JSON.stringify({ error: "ไม่มีเครื่องมือนี้" }), is_error: true };
    try {
      let s = JSON.stringify(fn(input && typeof input === "object" ? input : {}));
      if (s.length > MAX_RESULT) s = JSON.stringify({ error: `ผลลัพธ์ยาวเกินไป (${s.length} ตัวอักษร) — ให้กรองให้แคบลง หรือลด limit` });
      return { content: s };
    } catch (e) { return { content: JSON.stringify({ error: String(e && e.message || e) }), is_error: true }; }
  }
  const systemPrompt = () => [{ type: "text", cache_control: { type: "ephemeral" }, text:
`คุณเป็นผู้ช่วยวิเคราะห์ข้อมูลคดีสำหรับชุดสืบสวน ผู้ใช้เป็นพนักงานสืบสวนที่ต้องการคำตอบจากข้อมูลในเว็บแอพนี้เพื่อใช้ทำงานและรายงานผู้บังคับบัญชา ข้อมูลทั้งหมดเข้าถึงได้ผ่านเครื่องมือเท่านั้น

หลักการตอบ
- ตอบเป็นภาษาไทย กระชับ ตรงคำถาม ขึ้นต้นด้วยคำตอบ แล้วตามด้วยรายละเอียดเท่าที่จำเป็น
- ตัวเลขทุกตัวต้องมาจากผลของเครื่องมือในบทสนทนานี้ เพราะผู้ใช้อาจนำไปอ้างในสำนวน ถ้าต้องรวมหรือเปรียบเทียบ ให้เรียกเครื่องมือด้วยตัวกรองที่ตรงกับคำถาม แทนการบวกเลขเอง
- ทุกครั้งที่ให้ตัวเลข บอกเงื่อนไขที่ใช้สั้นๆ (ช่วงวันที่ บัญชีหรือกลุ่ม ประเภทรายการ) เพื่อให้ผู้ใช้ตรวจซ้ำในหน้า "วิเคราะห์" ได้
- ถ้าระบบไม่มีข้อมูลที่ถาม ให้บอกตรงๆ ว่าไม่มี และบอกว่าข้อมูลใกล้เคียงที่มีคืออะไร
- รายงานตามที่ข้อมูลระบุ ไม่สรุปความผิด เจตนา หรือบทบาทของบุคคลเกินกว่าที่ข้อมูลเขียนไว้ ชื่อกลุ่มเช่น "ต้องสงสัย" เป็นการจัดกลุ่มเพื่อการสืบสวน ไม่ใช่ข้อยุติ
- จำนวนเงินเขียนเป็นบาทมีจุลภาค ยอดตั้งแต่หนึ่งล้านขึ้นไปบอกเป็นล้านบาทกำกับด้วย วันที่เขียนแบบไทย (พ.ศ.)
- ใช้ข้อความธรรมดาและรายการสั้นๆ ไม่ใช้ตาราง

ข้อควรรู้เกี่ยวกับข้อมูล
- ยอดมาจาก statement ของบัญชีที่มีในระบบ การโอนระหว่างบัญชีที่มี statement ทั้งสองฝั่งจะปรากฏทั้งฝั่งออกและฝั่งเข้า จึงไม่ควรนำยอดเข้าของทุกบัญชีมารวมกันเป็น "เงินทั้งหมด"
- เงินบริจาคเข้าบัญชีรับบริจาคเก็บเป็นยอดรวมรายเดือน (ประเภท donation) ไม่มีรายผู้บริจาค
- ข้อมูลทรัพย์สิน การอายัด หมายเรียก และความคืบหน้า มาจากชีตของชุดทำคดี ไม่ได้เทียบกับ statement
- วันที่ในตัวกรองใช้ ค.ศ. รูปแบบ YYYY-MM-DD (พ.ศ. ลบ 543)

ข้อมูลอ้างอิง
คดี: ${DB.case || ""}
ช่วงข้อมูล statement: ${DB.lo} ถึง ${DB.hi} ; วันแบ่งช่วงก่อน/หลังตั้งมูลนิธิ: ${DB.cut} (ก่อน = ถึงวันก่อนหน้า)
กลุ่ม (รหัส = ชื่อ): ${DB.groups.map((g) => `${g[0]} = ${g[1]}`).join(" ; ")}
บัญชีที่มี statement:
${DB.accounts.map((a) => `- ${a.bank} ${a.acc} ${a.name} [${DB.groups[a.g][0]}] ${a.first} ถึง ${a.last}`).join("\n")}` }];

  /* ---------- เรียก API ---------- */
  let MSGS = [], BUSY = false, ABORT = null;
  async function callApi() {
    const c = conf(), model = c.model || MODELS[0][0];
    const headers = { "content-type": "application/json", "x-api-key": c.key, "anthropic-version": AI_VERSION, "anthropic-dangerous-direct-browser-access": "true" };
    const body = { model, max_tokens: 16000, system: systemPrompt(), tools: TOOLS, messages: MSGS, output_config: { effort: "medium" } };
    if (model !== "claude-haiku-5-5") { headers["anthropic-beta"] = "server-side-fallback-2026-07-01"; body.fallbacks = "default"; }   // ถ้าโมเดลหลักปฏิเสธด้วยเหตุผลด้านนโยบาย ให้ระบบส่งต่อโมเดลสำรองในคำขอเดียวกัน
    ABORT = new AbortController();
    let res;
    try { res = await fetch(AI_URL, { method: "POST", headers, body: JSON.stringify(body), signal: ABORT.signal }); }
    catch (e) { throw new Error(e.name === "AbortError" ? "ยกเลิกแล้ว" : "เชื่อมต่อผู้ให้บริการ AI ไม่ได้ (เครือข่าย หรือเบราว์เซอร์บล็อกคำขอ)"); }
    if (!res.ok) {
      let m = ""; try { m = ((await res.json()).error || {}).message || ""; } catch (e) { }
      const t = res.status === 401 ? "API key ไม่ถูกต้อง หรือถูกยกเลิก" : res.status === 403 ? "API key ไม่มีสิทธิ์ใช้งานส่วนนี้" : res.status === 404 ? "ไม่พบโมเดลที่เลือก" : res.status === 429 ? "ใช้งานถี่เกินโควตา ลองใหม่อีกครั้งในอีกสักครู่" : res.status >= 500 ? "ระบบของผู้ให้บริการ AI ขัดข้องชั่วคราว" : "คำขอไม่ถูกต้อง";
      throw new Error(`${t} (HTTP ${res.status})${m ? " — " + m.slice(0, 200) : ""}`);
    }
    return res.json();
  }
  async function ask(text) {
    if (BUSY) return;
    const base = MSGS.length;
    NOTES = NOTES.filter((n) => n.at <= base && n.at > 0);   // ล้างข้อความแจ้งข้อผิดพลาดที่ค้างท้ายบทสนทนา
    BUSY = true; MSGS.push({ role: "user", content: text }); draw();
    try {
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const r = await callApi();
        MSGS.push({ role: "assistant", content: r.content });           // เก็บทุก block ตามที่ได้รับ (รวม thinking / tool_use) ส่งกลับไม่แก้ไข
        if (r.stop_reason === "refusal") { note("ผู้ช่วยปฏิเสธคำถามนี้ตามนโยบายความปลอดภัยของผู้ให้บริการ ลองถามใหม่ด้วยถ้อยคำอื่น"); break; }
        if (r.stop_reason === "max_tokens") { note("คำตอบยาวเกินกำหนดจึงถูกตัด ลองถามให้แคบลง"); break; }
        if (r.stop_reason !== "tool_use") break;
        const uses = r.content.filter((b) => b.type === "tool_use");
        draw(uses.map((u) => TOOLS.find((t) => t.name === u.name) ? u.name : "?"));
        MSGS.push({ role: "user", content: uses.map((u) => ({ type: "tool_result", tool_use_id: u.id, ...runTool(u.name, u.input) })) });   // ผลของทุกเครื่องมือในข้อความเดียว
        if (turn === MAX_TURNS - 1) note("ค้นข้อมูลหลายรอบเกินกำหนด ลองถามให้เจาะจงขึ้น");
      }
    } catch (e) {
      MSGS.length = base; LAST_Q = text;          // ถอยกลับก่อนคำถามนี้ (ไม่ให้ประวัติค้างกลางรอบเครื่องมือ) แล้วคืนคำถามลงช่องพิมพ์
      NOTES = NOTES.filter((n) => n.at <= base);
      NOTES.push({ at: base, t: e.message || String(e), err: true });
    }
    BUSY = false; ABORT = null; draw();
  }

  /* ---------- หน้าจอ ---------- */
  let NOTES = [], LAST_Q = "";
  const note = (t) => NOTES.push({ at: MSGS.length, t });
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^\s*[-•]\s+(.*)$/gm, '<span class="ai-li">$1</span>').replace(/^#{1,4}\s*(.*)$/gm, "<b>$1</b>").replace(/<\/span>\n+/g, "</span>").replace(/\n/g, "<br>");
  const SUG = ["สรุปภาพรวมเงินเข้า-ออกของบัญชีรับบริจาค", "ผู้รับเงินจากบัญชีรับบริจาคมากที่สุด 10 อันดับ หลังตั้งมูลนิธิ", "ถอนเงินสดรวมเท่าไร แยกรายปี", "สถานะการขอ statement ตอนนี้", "ทรัพย์สินที่ตรวจพบมีอะไรบ้าง"];
  function draw(tools) {
    const box = $("#aiMsgs"); if (!box) return;
    const c = conf(), out = [];
    if (!c.key) {
      box.innerHTML = `<div class="ai-set"><b>${IC("key", 18)} ตั้งค่าก่อนใช้งาน</b>
        <p>ใส่ API key ของ Claude (Anthropic) ที่ออกจาก Console ของท่านเอง — key จะเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่อยู่ในไฟล์ของเว็บ</p>
        <label>API key</label><input id="aiKey" type="password" autocomplete="off" placeholder="sk-ant-…">
        <label>โมเดล</label><select id="aiModel">${MODELS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
        <button class="btn" id="aiSave">บันทึก</button>
        <p class="muted">คำถามและผลการค้นข้อมูลที่ผู้ช่วยเรียกดู (เช่น ชื่อบุคคล เลขบัญชี ยอดเงิน) จะถูกส่งไปประมวลผลที่ผู้ให้บริการ AI ผ่าน key นี้ และมีค่าใช้จ่ายตามการใช้งานของ key</p></div>`;
      $("#aiForm").hidden = true; return;
    }
    $("#aiForm").hidden = false;
    if (!MSGS.length) out.push(`<div class="ai-hi">${IC("chat", 26)}<b>ถามข้อมูลในคดีนี้ได้เลย</b><div>${SUG.map((s) => `<button class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`);
    const nt = (n) => out.push(`<div class="ai-n">${IC("warn", 14)} ${esc(n.t)}</div>`);
    NOTES.filter((n) => n.at === 0).forEach(nt);
    MSGS.forEach((m, i) => {
      if (m.role === "user" && typeof m.content === "string") out.push(`<div class="ai-m u">${esc(m.content).replace(/\n/g, "<br>")}</div>`);
      else if (m.role === "assistant") { const t = m.content.filter((b) => b.type === "text" && b.text.trim()).map((b) => b.text).join("\n\n"), u = m.content.filter((b) => b.type === "tool_use");
        if (t) out.push(`<div class="ai-m a">${md(t)}</div>`);
        if (u.length) out.push(`<div class="ai-t">${IC("search", 13)} ค้นข้อมูล: ${u.map((x) => esc(x.name)).join(", ")}</div>`); }
      NOTES.filter((n) => n.at === i + 1).forEach(nt);
    });
    if (BUSY) out.push(`<div class="ai-t run">${IC("sync", 13)} ${tools ? "กำลังค้นข้อมูล…" : "กำลังคิด…"} <button class="chip" id="aiStop">หยุด</button></div>`);
    box.innerHTML = out.join(""); box.scrollTop = box.scrollHeight;
    $("#aiSend").disabled = BUSY;
    if (LAST_Q && !BUSY) { $("#aiIn").value = LAST_Q; LAST_Q = ""; }
  }
  function mount() {
    if ($("#aiFab")) return;
    const d = document.createElement("div");
    d.innerHTML = `<button id="aiFab" class="ai-fab" title="ผู้ช่วย AI">${IC("chat", 26)}</button>
      <section id="aiPanel" class="ai-panel" hidden>
        <header><b>${IC("chat", 18)} ผู้ช่วย AI</b><span id="aiModelLab" class="muted"></span><button id="aiCfg" title="ตั้งค่า API key">${IC("key", 17)}</button><button id="aiNew" title="เริ่มบทสนทนาใหม่">${IC("trash", 17)}</button><button id="aiClose" title="ปิด">${IC("x", 18)}</button></header>
        <div id="aiMsgs" class="ai-msgs"></div>
        <form id="aiForm" class="ai-form"><textarea id="aiIn" rows="1" placeholder="พิมพ์คำถาม เช่น เงินออกจากบัญชีรับบริจาคปี 2568 ไปที่ใครมากที่สุด"></textarea><button id="aiSend" class="btn" title="ส่ง">${IC("send", 18)}</button></form>
        <div class="ai-foot">คำตอบจาก AI ต้องตรวจทานกับหน้า "วิเคราะห์" ก่อนนำไปอ้างอิง</div>
      </section>`;
    $("#app").appendChild(d);
    const lab = () => ($("#aiModelLab").textContent = conf().key ? ((MODELS.find((m) => m[0] === (conf().model || MODELS[0][0])) || [0, ""])[1].split(" (")[0]) : "");
    $("#aiFab").onclick = () => { $("#aiPanel").hidden = false; $("#aiFab").hidden = true; lab(); draw(); const i = $("#aiIn"); if (i && conf().key) i.focus(); };
    $("#aiClose").onclick = () => { $("#aiPanel").hidden = true; $("#aiFab").hidden = false; };
    $("#aiNew").onclick = () => { if (BUSY) return; MSGS = []; NOTES = []; draw(); };
    $("#aiCfg").onclick = () => { if (BUSY) return; const c = conf(); if (c.key && !confirm("ลบ API key ที่บันทึกไว้ในเครื่องนี้ แล้วตั้งค่าใหม่?")) return; LS.set("cib_ai", { model: c.model }); lab(); draw(); };
    $("#aiForm").onsubmit = (e) => { e.preventDefault(); const t = $("#aiIn").value.trim(); if (!t || BUSY) return; $("#aiIn").value = ""; $("#aiIn").style.height = ""; ask(t); };
    $("#aiIn").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#aiForm").requestSubmit(); } };
    $("#aiIn").oninput = (e) => { e.target.style.height = ""; e.target.style.height = Math.min(140, e.target.scrollHeight) + "px"; };
    $("#aiMsgs").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "aiSave") { const k = $("#aiKey").value.trim(); if (!k) return toast("ยังไม่ได้ใส่ API key"); LS.set("cib_ai", { key: k, model: $("#aiModel").value }); lab(); draw(); $("#aiIn").focus(); }
      else if (b.dataset.sug) ask(b.dataset.sug);
      else if (b.id === "aiStop" && ABORT) ABORT.abort();
    };
  }
  window.aiMount = mount;
  window.__aiTest = { TOOL_FN, TOOLS, runTool };      // สำหรับทดสอบเครื่องมือจากคอนโซล
})();
