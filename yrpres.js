/* ---------- โหมดนำเสนอ "สรุปรายปี 3 บัญชีรับบริจาค" (ผู้ใช้สั่ง 28 พ.ย. 69 — ผู้บังคับบัญชานำสไลด์นี้ไปนำเสนอ) ----------
   เนื้อหาชุดเดียวกับสไลด์ build_yearly_deck.js ; ตัวเลข = DB.over.yearly / yearly_acc / yearly_meta (yearly_t1.json)
   ชื่อบัญชีเต็มตาม statement มาจาก DB.accounts (ไม่ใช้เลขย่อ 3 ตัว) ; ห้ามเขียนชื่อบุคคล/คดีในไฟล์นี้ (ไฟล์สาธารณะ)
   เปิด: ปุ่ม ▶ ที่หัวตารางสรุปรายปีหน้าภาพรวม ; เลื่อน: ลูกศร / Space / PageUp-Down / ปัดจอ ; ปิด: Esc / ✕ */
(() => {
  const PAL = ["#1A237E", "#1565C0", "#00ACC1"], PALT = ["#1A237E", "#1565C0", "#00838F"], NAVY = "#00264D", YEL = "#FFD403", RED = "#C62828", AMB = "#F9A825";
  const TMN = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const dFull = (iso) => { const [y, m, d] = String(iso || "").slice(0, 10).split("-").map(Number); return y ? `${d} ${TMN[m]} ${y + 543}` : ""; };
  const m2 = (v) => ((v || 0) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const n0 = (v) => Math.round(v || 0).toLocaleString("en-US");
  const b2 = (v) => (v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kfmt = (acc) => { const d = String(acc).replace(/\D/g, ""); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 9)}-${d.slice(9)}` : String(acc); };
  // แถว yearly = [พ.ศ., ช่วง, เข้า, ครั้งเข้า, ออก, ครั้งออก, คงเหลือ]
  const isY = (r) => !!r[0], kOf = (r) => `${r[0]}|${r[1] || ""}`, catOf = (r) => (r[1] && r[0] ? `${r[0]} (${/ก่อน/.test(r[1]) ? "ก่อน" : "หลัง"})` : String(r[0]));
  const totOf = (rows, re) => rows.find((r) => !r[0] && re.test(r[1] || "")) || [0, "", 0, 0, 0, 0, 0];
  let S = null, CHS = [], IDX = 0, x0 = null;

  function model() {
    const o = DB.over || {}, meta = o.yearly_meta || {}, YA = o.yearly_acc || {};
    const ord = meta.order || [], keys = Object.keys(YA).sort((a, b) => (ord.indexOf(a) < 0 ? 99 : ord.indexOf(a)) - (ord.indexOf(b) < 0 ? 99 : ord.indexOf(b)));
    const accs = keys.map((k, i) => {
      const a = DB.accounts.find((x) => String(x.acc).replace(/\D/g, "") === k) || {};
      return { k, name: a.name || k, bank: a.bank || "KBANK", no: kfmt(a.acc || k), c: PAL[i % 3], ct: PALT[i % 3], rows: YA[k] || [], rng: (meta.range || {})[k] };
    });
    const all = o.yearly || [], yrs = all.filter(isY), KEYS = yrs.map(kOf), CATS = yrs.map(catOf);
    const ser = (rows, f) => { const m = new Map(rows.filter(isY).map((r) => [kOf(r), r])); return KEYS.map((k) => (m.has(k) ? f(m.get(k)) : 0)); };
    const rngAll = (meta.range || {}).all || [DB.lo, DB.hi];
    const nsrc = meta.n_src || {};
    const srcTot = (key, re) => { const r = (nsrc[key] || []).find((x) => !x[0] && re.test(x[1] || "")); return r ? r[2] : null; };
    return { accs, all, yrs, CATS, ser, rngAll, meta, srcTot };
  }

  const head = (t, sub) => `<div class="yp-h"><div class="yp-ht"><b>${esc(t)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div><img src="logo.jpg" alt="CIB" class="yp-logo"></div>`;
  const accL = (a, big) => `<div class="yp-acc" style="--c:${a.c}"><b style="color:${a.ct};font-size:${big || 1.05}em">${esc(a.name)}</b><small>${esc(a.bank)} ${esc(a.no)}</small></div>`;
  const chartBox = (id, h) => `<div class="yp-cb" style="height:${h || "100%"}"><canvas id="${id}"></canvas></div>`;
  const CF = () => ({ maintainAspectRatio: false, animation: false, plugins: { legend: { position: "top", labels: { font: { size: 13 }, boxWidth: 14 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${typeof c.raw === "number" ? c.raw.toLocaleString("en-US", { maximumFractionDigits: 2 }) : c.raw}` } } },
    scales: { x: { ticks: { font: { size: 12 }, maxRotation: 50, minRotation: 0 } }, y: { ticks: { font: { size: 12 } }, title: { display: true, text: "ล้านบาท" } } } });
  const mk = (id, cfg) => { const el = document.getElementById(id); if (el) CHS.push(new Chart(el, cfg)); };

  function slides() {
    const D = model(), { accs, all, yrs, CATS, ser, rngAll, meta } = D, out = [], add = (h, d) => out.push({ html: h, draw: d || null });
    const tAll = totOf(all, /ทุก/), bef = totOf(all, /ก่อน/), aft = totOf(all, /หลัง/);
    const tA = (a, re) => totOf(a.rows, re || /ทุก/);
    const main = accs.reduce((p, a) => (tA(a)[2] > tA(p)[2] ? a : p), accs[0]);
    const LAST = dFull(rngAll[1]), FIRST = dFull(rngAll[0]);
    // 1 ชื่อเรื่อง
    add(() => `<div class="yp-title"><img src="logo.jpg" alt="CIB" class="yp-tlogo"><i class="yp-ybar"></i><h1>สรุปเงินเข้า – ออก 3 บัญชีรับบริจาค รายปี</h1>
      <ul>${accs.map((a) => `<li><b>${esc(a.name)}</b> <span>${esc(a.bank)} ${esc(a.no)}</span></li>`).join("")}</ul>
      <p>ข้อมูลตั้งแต่ ${FIRST} – ${LAST} ; ปี 2565 แยกก่อน / หลังตั้งมูลนิธิ (25 มิ.ย. 2565)</p></div>`);
    // 2 ภาพรวม
    add(() => `${head("ภาพรวม: เงินเข้าเกือบหนึ่งพันล้าน แต่ออกไปเกือบหมด")}<div class="yp-b"><div class="yp-cards">${accs.map((a) => { const t = tA(a), ys = a.rows.filter(isY), ns = D.srcTot(a.k, /ทุก/);
      return `<div class="yp-card" style="--c:${a.c}">${accL(a)}<div class="yp-l">เงินเข้า</div><div class="yp-big" style="color:${a.ct}">${m2(t[2])} ล้าน</div>
        <div>${n0(t[3])} ครั้ง${ns != null ? ` · ${n0(ns)} บัญชีผู้โอน` : ""}</div><div class="yp-out">เงินออก ${m2(t[4])} ล้าน <small>(${n0(t[5])} ครั้ง)</small></div>
        <div><b>คงเหลือ ${m2(t[6])} ล้าน</b></div><div class="yp-mut">ข้อมูล พ.ศ. ${ys.length ? `${ys[0][0]} – ${ys[ys.length - 1][0]}` : "-"}</div></div>`; }).join("")}</div>
      <div class="yp-strip">${[["เงินเข้ารวม 3 บัญชี", m2(tAll[2]) + " ล้าน"], ["เงินออกรวม", m2(tAll[4]) + " ล้าน"], ["คงเหลือรวม", m2(tAll[6]) + " ล้าน"], ["จำนวนครั้งเข้า", n0(tAll[3]) + " ครั้ง"]].map(([l, v]) => `<div><small>${l}</small><b>${v}</b></div>`).join("")}</div>
      <p class="yp-note">ยอดรวม 3 บัญชีนับเงินโอนระหว่าง 3 บัญชีด้วย ${b2(meta.intra)} บาท</p></div>`);
    // 3 เงินเข้ารายปี
    add(() => { const pk = main.rows.filter(isY).reduce((p, r) => (r[2] > p[2] ? r : p), main.rows.filter(isY)[0] || [0, "", 0]);
      const r0 = accs[2] && accs[2].rng;
      return `${head("เงินเข้ารายปีพุ่งขึ้นหลังตั้งมูลนิธิ")}<div class="yp-b yp-2"><div class="yp-chart">${chartBox("ypC3")}</div><div class="yp-side"><b class="yp-st">ข้อสังเกต</b><ul>
        <li>บัญชี <b>${esc(main.name)}</b> รับสูงสุดปี ${catOf(pk)}: ${m2(pk[2])} ล้าน</li>
        <li>ก่อนตั้งมูลนิธิ (7 ปีเศษ) รับรวมเพียง ${m2(bef[2])} ล้าน</li><li>หลังตั้งมูลนิธิ (4 ปีเศษ) รับ ${m2(aft[2])} ล้าน</li>
        ${accs[0] ? `<li>บัญชี <b>${esc(accs[0].name)}</b> เริ่มมีรายการหลังตั้งมูลนิธิ</li>` : ""}${accs[2] && r0 ? `<li>บัญชี <b>${esc(accs[2].name)}</b> มี statement ตั้งแต่ ${dFull(r0[0])}</li>` : ""}</ul></div></div>`; },
      () => mk("ypC3", { type: "line", data: { labels: CATS, datasets: accs.map((a) => ({ label: a.name, data: ser(a.rows, (r) => r[2] / 1e6), borderColor: a.c, backgroundColor: a.c, borderWidth: 3, pointRadius: 4, tension: 0.15 })) }, options: CF() }));
    // 4 รวม 3 บัญชี เข้า / ออก / คงเหลือ
    add(() => `${head("รวม 3 บัญชี: เงินเข้าเกือบเท่าเงินออกทุกปี คงเหลือไม่มาก")}<div class="yp-b"><div class="yp-chart">${chartBox("ypC4")}</div></div>`,
      () => { const o = CF(); o.scales.y2 = { position: "right", grid: { drawOnChartArea: false }, ticks: { font: { size: 12 } }, title: { display: true, text: "คงเหลือ (ล้านบาท)" } }; o.scales.y.title.text = "เงินเข้า / ออก (ล้านบาท)";
        mk("ypC4", { type: "bar", data: { labels: CATS, datasets: [{ label: "เงินเข้า (ล้านบาท)", data: yrs.map((r) => r[2] / 1e6), backgroundColor: PAL[1] }, { label: "เงินออก (ล้านบาท)", data: yrs.map((r) => r[4] / 1e6), backgroundColor: RED },
          { type: "line", label: "คงเหลือสิ้นงวด (ล้านบาท)", data: yrs.map((r) => r[6] / 1e6), borderColor: AMB, backgroundColor: AMB, borderWidth: 3, pointRadius: 4, yAxisID: "y2" }] }, options: o }); });
    // 5 ก่อน vs หลัง
    add(() => { const dt = (s) => Date.parse(String(s).slice(0, 10) + "T00:00:00Z"), yb = (dt("2022-06-25") - dt(rngAll[0])) / (365.25 * 864e5), ya = (dt(rngAll[1]) - dt("2022-06-25")) / (365.25 * 864e5);
      const avb = bef[2] / yb, ava = aft[2] / ya, card = (t, lab, rng, yrs_, av, col, key) => { const ns = D.srcTot("all", key); return `<div class="yp-card" style="--c:${col}"><b class="yp-ph" style="color:${col}">${lab}</b><div class="yp-mut">${rng} (${yrs_.toFixed(1)} ปี)</div>
        <div class="yp-l">เงินเข้า</div><div class="yp-big" style="color:${col}">${m2(t[2])} ล้าน</div><div>${n0(t[3])} ครั้ง${ns != null ? ` · ${n0(ns)} บัญชีผู้โอน` : ""}</div><div class="yp-out">เงินออก ${m2(t[4])} ล้าน</div><div><b>เฉลี่ยรับปีละ ${m2(av)} ล้าน</b></div></div>`; };
      return `${head("ก่อน vs หลังตั้งมูลนิธิ: เงินเข้าเพิ่มขึ้นหลายสิบเท่า")}<div class="yp-b yp-2e"><div><div class="yp-cards two">${card(bef, "ก่อนตั้งมูลนิธิ", `${FIRST} – 24 มิ.ย. 2565`, yb, avb, "#6B7280", /ก่อน/)}${card(aft, "หลังตั้งมูลนิธิ", `25 มิ.ย. 2565 – ${LAST}`, ya, ava, NAVY, /หลัง/)}</div>
        <div class="yp-strip one"><div><b class="yp-x">${(ava / avb).toFixed(0)} เท่า</b><small>เงินเข้าเฉลี่ยต่อปี หลังตั้งมูลนิธิ เทียบกับก่อนตั้ง</small></div></div></div><div class="yp-chart">${chartBox("ypC5")}</div></div>`; },
      () => { const o = CF(); o.plugins.title = { display: true, text: "รวม 3 บัญชี (ล้านบาท)", font: { size: 14 } };
        mk("ypC5", { type: "bar", data: { labels: ["เงินเข้า", "เงินออก"], datasets: [{ label: "ก่อนตั้งมูลนิธิ", data: [bef[2] / 1e6, bef[4] / 1e6], backgroundColor: "#9CA3AF" }, { label: "หลังตั้งมูลนิธิ", data: [aft[2] / 1e6, aft[4] / 1e6], backgroundColor: NAVY }] }, options: o }); });
    // 6 สัดส่วนรายบัญชี
    add(() => { const sIn = accs.reduce((s, a) => s + tA(a)[2], 0) || 1, sOut = accs.reduce((s, a) => s + tA(a)[4], 0) || 1;
      return `${head(`บัญชี ${main.name} เป็นช่องทางหลักรับเงินบริจาค`)}<div class="yp-b yp-3"><div class="yp-chart">${chartBox("ypC6a")}</div><div class="yp-chart">${chartBox("ypC6b")}</div>
        <div class="yp-side">${accs.map((a) => { const t = tA(a); return `${accL(a, 0.95)}<div>เข้า ${m2(t[2])} ล้าน (${(t[2] / sIn * 100).toFixed(1)}%)</div><div>ออก ${m2(t[4])} ล้าน (${(t[4] / sOut * 100).toFixed(1)}%)</div><div class="yp-gap"></div>`; }).join("")}</div></div>`; },
      () => [["ypC6a", 2, "สัดส่วนเงินเข้า"], ["ypC6b", 4, "สัดส่วนเงินออก"]].forEach(([id, f, lab]) => mk(id, { type: "doughnut", data: { labels: accs.map((a) => a.name), datasets: [{ data: accs.map((a) => tA(a)[f] / 1e6), backgroundColor: accs.map((a) => a.c) }] },
        options: { maintainAspectRatio: false, animation: false, cutout: "55%", plugins: { title: { display: true, text: lab + " (ล้านบาท)", font: { size: 14 } }, legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw.toLocaleString("en-US", { maximumFractionDigits: 2 })} ล้าน` } } } } })));
    // 7-9 รายบัญชี
    accs.forEach((a, i) => {
      const id = "ypCa" + i;
      add(() => { const ys = a.rows.filter(isY), t = tA(a), pk = ys.reduce((p, r) => (r[2] > p[2] ? r : p), ys[0] || [0, "", 0]), ns = D.srcTot(a.k, /ทุก/);
        const extra = i === 2 && meta.opening_197 ? `<div class="yp-warn">statement เริ่ม ${a.rng ? dFull(a.rng[0]) : ""} ยอดยกมา ${m2(meta.opening_197)} ล้าน (ต้องขอข้อมูลช่วงก่อนหน้า)</div>` : `<div class="yp-mut">ข้อมูล ${a.rng ? `${dFull(a.rng[0])} – ${dFull(a.rng[1])}` : ""}</div>`;
        return `${head(`บัญชี ${a.name}`, `${a.bank} ${a.no} · รายปี`)}<div class="yp-b yp-2"><div class="yp-chart">${chartBox(id)}</div><div class="yp-side" style="--c:${a.c}">${accL(a)}
          <div class="yp-l">เงินเข้ารวม</div><div class="yp-big" style="color:${a.ct}">${m2(t[2])} ล้าน</div><div>${n0(t[3])} ครั้ง${ns != null ? ` · ${n0(ns)} บัญชีผู้โอน` : ""}</div>
          <div class="yp-out">เงินออก ${m2(t[4])} ล้าน <small>(${n0(t[5])} ครั้ง)</small></div><div><b>คงเหลือ ${m2(t[6])} ล้าน</b></div><div>รับสูงสุดปี ${catOf(pk)}: ${m2(pk[2])} ล้าน</div>${extra}</div></div>`; },
        () => { const ys = a.rows.filter(isY), o = CF(); o.scales.y2 = { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "คงเหลือ (ล้านบาท)" } }; o.scales.y.title.text = "เข้า / ออก (ล้านบาท)";
          mk(id, { type: "bar", data: { labels: ys.map(catOf), datasets: [{ label: "เงินเข้า", data: ys.map((r) => r[2] / 1e6), backgroundColor: a.c }, { label: "เงินออก", data: ys.map((r) => r[4] / 1e6), backgroundColor: RED },
            { type: "line", label: "คงเหลือสิ้นงวด", data: ys.map((r) => r[6] / 1e6), borderColor: AMB, backgroundColor: AMB, borderWidth: 3, pointRadius: 4, yAxisID: "y2" }] }, options: o }); });
    });
    // 10 ตารางรวม
    add(() => { const tr = (r, cls) => `<tr class="${cls || ""}"><td>${r[0] ? catOf(r) : esc(/ก่อน/.test(r[1]) ? "รวมก่อนตั้งมูลนิธิ" : /หลัง/.test(r[1]) ? "รวมหลังตั้งมูลนิธิ" : "รวมทุกช่วง")}</td><td>${n0(r[3])}</td><td>${b2(r[2])}</td><td>${n0(r[5])}</td><td>${b2(r[4])}</td><td class="${r[2] - r[4] < 0 ? "neg" : ""}">${b2(r[2] - r[4])}</td><td>${b2(r[6])}</td></tr>`;
      return `${head("ตารางสรุปรายปี รวม 3 บัญชี")}<div class="yp-b"><table class="yp-t"><tr><th>ปี (พ.ศ.)</th><th>ครั้งเข้า</th><th>ยอดเงินเข้า</th><th>ครั้งออก</th><th>ยอดเงินออก</th><th>สุทธิ (เข้า-ออก)</th><th>คงเหลือสิ้นงวด</th></tr>
        ${yrs.map((r) => tr(r, r[1] ? "p65" : "")).join("")}${tr(tAll, "tot")}${tr(bef, "sub")}${tr(aft, "sub")}</table></div>`; });
    // 11 หมายเหตุข้อมูล
    add(() => `${head("ข้อควรทราบเกี่ยวกับข้อมูล")}<div class="yp-b"><ol class="yp-notes">
      <li><b>แบ่งช่วงที่ 25 มิ.ย. 2565</b><span>ตัดตามเส้นเงิน (ข่าวระบุจดทะเบียน 30 มี.ค. 2565 / ราชกิจจาฯ 2 มิ.ย. 2565) ; ปี 2565 จึงแสดง 2 แถว</span></li>
      <li><b>ยอดรวม 3 บัญชีนับเงินโอนระหว่างกัน</b><span>รวมอยู่ในยอดเข้า ${m2(meta.intra)} ล้านบาท ถ้าต้องการเฉพาะเงินจากภายนอกให้หักออก</span></li>
      ${accs[2] ? `<li class="w"><b>บัญชี ${esc(accs[2].name)} ข้อมูลยังไม่ครบ</b><span>statement เริ่ม ${accs[2].rng ? dFull(accs[2].rng[0]) : ""} มียอดยกมา ${m2(meta.opening_197)} ล้านบาท ต้องขอ statement ช่วงก่อนหน้า</span></li>` : ""}
      <li><b>จำนวนบัญชีผู้โอน</b><span>นับเลขบัญชีต้นทางไม่ซ้ำ ไม่นับฝากเงินสดและรายการที่ไม่ระบุบัญชี</span></li></ol></div>`);
    return out;
  }

  function show(i) {
    CHS.forEach((c) => c.destroy()); CHS = [];
    IDX = Math.max(0, Math.min(S.length - 1, i));
    const host = document.getElementById("ypStage"); if (!host) return;
    host.innerHTML = `<div class="yp-slide">${S[IDX].html()}<div class="yp-foot">ข้อมูลจาก statement 3 บัญชีรับบริจาค<span>${IDX + 1} / ${S.length}</span></div></div>`;
    if (S[IDX].draw) S[IDX].draw();
  }
  function close() {
    CHS.forEach((c) => c.destroy()); CHS = [];
    const o = document.getElementById("yrp"); if (o) o.remove();
    document.removeEventListener("keydown", key, true); document.body.classList.remove("yp-on");
    try { document.fullscreenElement && document.exitFullscreen(); } catch (e) { }
  }
  function key(e) {
    if (!document.getElementById("yrp")) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); show(IDX + 1); }
    else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); show(IDX - 1); }
    else if (e.key === "Home") { e.preventDefault(); show(0); } else if (e.key === "End") { e.preventDefault(); show(S.length - 1); }
  }
  window.yrPresent = function (start) {
    if (!DB || !DB.over || !(DB.over.yearly || []).length) return;
    S = slides();
    const o = document.createElement("div"); o.id = "yrp"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "นำเสนอสรุปรายปี 3 บัญชีรับบริจาค");
    o.innerHTML = `<div id="ypStage"></div><div class="yp-nav"><button data-yp="-1" aria-label="ก่อนหน้า" title="ก่อนหน้า">${IC("back", 22)}</button><button data-yp="1" aria-label="ถัดไป" title="ถัดไป">${IC("next", 22)}</button><button data-yp="x" aria-label="ปิดโหมดนำเสนอ" title="ปิด (Esc)">${IC("x", 20)}</button></div>`;
    document.body.appendChild(o); document.body.classList.add("yp-on");
    o.addEventListener("click", (e) => { const b = e.target.closest("[data-yp]"); if (!b) return; if (b.dataset.yp === "x") close(); else show(IDX + +b.dataset.yp); });
    o.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    o.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) show(IDX + (dx < 0 ? 1 : -1)); });
    document.addEventListener("keydown", key, true);
    try { o.requestFullscreen && o.requestFullscreen().catch(() => { }); } catch (e) { }
    document.addEventListener("fullscreenchange", function fc() { if (!document.fullscreenElement) { document.removeEventListener("fullscreenchange", fc); if (document.getElementById("yrp")) close(); } });
    show(start || 0);
  };
})();
