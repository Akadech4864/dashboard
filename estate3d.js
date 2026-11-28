/* ===== แผนที่ 3 มิติ ทรัพย์สิน รุ่น 20 พ.ย. 69 =====
   ผู้ใช้สั่ง: "ทำคล้ายภาพตัวอย่าง (เมืองจำลอง low-poly + ป้ายลอย + ปุ่มรถ / + / − / บ้าน) จำลองเป็นบ้าน ของกลางอยู่ในห้อง (กระเป๋า ผ้าพันคอ ในห้องนอน)
   โฉนดในห้อง รถจอดในโรงรถ บ้านตามจำนวนจริง ที่ดินจริงตามข้อมูล มูลนิธิ — จำลองสถานที่ตรวจยึดอย่างสมจริง"
   - WebGL ด้วย three.js r128 จาก cdnjs (แหล่งเดียวกับ Chart.js) โหลดเมื่อเปิดมุมมอง 3 มิติเท่านั้น
   - ห้ามใส่ชื่อบุคคล/คดีในไฟล์นี้ (deploy_site.sh ตรวจ) — ป้ายชื่อทั้งหมดมาจาก DB ที่เข้ารหัส
   - ของกลางทุกชิ้นวางในห้องจำลองของจุดตรวจค้นที่พบจริง ; ตำแหน่งในห้อง / ห้องเอกสาร / โรงรถ = ภาพจำลองเพื่อจัดกลุ่ม (เขียนกำกับใน ⓘ)
   - ใช้ AR / ASH / ASF / a3dPop จาก app.js ; ส่งออก a3dBuild / a3dApply / a3dDim */
(() => {
  const URL3 = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  let E = null, lastCat = "";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function need3(ok, bad) {
    if (window.THREE) return ok();
    let s = document.getElementById("three-js");
    if (s && s.dataset.err) { s.remove(); s = null; }
    if (!s) { s = document.createElement("script"); s.id = "three-js"; s.src = URL3; s.integrity = "sha512-dLxUelApnYxpLt6K2iomGngnHO83iUvZytA3YjDUCjT0HDOHKXnVYdf3hU4JjM8uEhxf9nD1/ey98U3t2vZ0qQ=="; s.crossOrigin = "anonymous"; s.referrerPolicy = "no-referrer"; s.async = true; document.head.appendChild(s); }
    s.addEventListener("load", () => (window.THREE ? ok() : bad()), { once: true });
    s.addEventListener("error", () => { s.dataset.err = "1"; bad(); }, { once: true });
  }
  /* ---------- ข้อมูล ---------- */
  const ownL = () => (DB.own || []).map((x) => x[1]);
  const ownCol = (o) => { const i = ownL().indexOf(o); return i === 0 ? SCOL.pan : i === 1 ? SCOL.ath : "#8D6E63"; };
  const areaM2 = (s) => { const g = (rx) => +((String(s).match(rx) || [])[1] || 0); return g(/([\d.]+)\s*ไร่/) * 1600 + g(/([\d.]+)\s*งาน/) * 400 + g(/([\d.]+)\s*ตร\.ว\./) * 4 + g(/([\d.]+)\s*ตร\.ม\./); };
  const locOf = (n) => String(n).replace(/\s*\(เลขที่.*$/, "").trim();
  const deedOf = (n) => (String(n).match(/เลขที่\s*([^)]+)\)/) || [])[1] || "";
  const shortLoc = (n) => { const l = locOf(n); let m = l.match(/^((?:หมู่บ้าน|อาคารชุด)\S*(?:\s(?!แขวง|เขต|ต\.|อ\.|จ\.)\S+)*)/); if (m) return m[1];
    m = l.match(/(เขต\S+|อ\.\S+)(?:\s+(กรุงเทพมหานคร|จ\.\S+))?/); return m ? m[1] + (m[2] ? " " + m[2].replace("กรุงเทพมหานคร", "กทม.") : "") : l.slice(0, 28); };
  const cluLab = (l) => l.replace(/\s*จ\.\S+$/, "");
  const nOf = (s, w) => +((String(s).match(new RegExp("(\\d+)\\s*" + w)) || [])[1] || 1);
  const siteShort = (s) => { const m = String(s || "").match(/^(.*?”)/); return (m ? m[1] : String(s || "").split(" ถ.")[0]).replace(/[“”]/g, ""); };
  const LOOKC = [[/ดำ/, "#26262C"], [/แคนวาส|Monogram/i, "#7A4E2D"], [/เงิน/, "#C9CDD3"], [/แดง/, "#B3261E"], [/เทา/, "#8C939B"], [/เบจ|น้ำตาลอ่อน/, "#CDAE84"],
    [/น้ำตาล(?!อ่อน)/, "#6B4226"], [/ฟ้า|เดนิม/, "#6F93BF"], [/ส้ม/, "#E07B39"], [/ขาว/, "#F2F2F2"], [/ทอง/, "#D4A72C"]];
  const colsOf = (t) => { const a = []; LOOKC.forEach(([rx, c]) => { const m = String(t || "").search(rx); if (m >= 0) a.push([m, c]); }); a.sort((x, y) => x[0] - y[0]); const u = [...new Set(a.map((x) => x[1]))]; return u.length ? u : ["#7A4E2D"]; };
  const fmtM = (v) => (v ? M(v) : "ไม่ระบุมูลค่า");

  let BT = 0;
  window.a3dBuild = function () {
    if (E) E.kill();
    const tok = ++BT; lastCat = "";
    const own = ownL(), host = $("#asTop"); if (!host) return;
    const leg = own.map((o) => `<span><i style="background:${ownCol(o)}"></i>${esc(o)}</span>`).join("") +
      `<span><i style="background:#E53935"></i>ของกลาง / อายัดแล้ว</span><span><i style="background:#F2C200"></i>อยู่ระหว่างดำเนินการ / เสนออายัด</span>`;
    host.innerHTML = `<div class="a3d e3" id="a3d"><div class="e3-stage" id="e3s"><div class="e3-load" id="e3w">${IC("cube", 22)} กำลังสร้างแผนที่ 3 มิติ…</div><div class="e3-lab" id="e3l"></div>
      <div class="e3-ctl"><button class="e3b car" data-e3="car" title="โรงรถ" aria-label="โรงรถ">${IC("car", 22)}</button><button class="e3b" data-e3="in" title="ซูมเข้า" aria-label="ซูมเข้า">+</button><button class="e3b" data-e3="out" title="ซูมออก" aria-label="ซูมออก">−</button><button class="e3b" data-e3="home" title="ภาพรวม" aria-label="ภาพรวม">${IC("home", 20)}</button></div></div>
      <div class="e3-zones" id="e3z"></div>
      <div class="a3d-leg">${leg}${infoI("ภาพจำลอง: ของกลางทุกชิ้นวางในห้องจำลองของจุดตรวจค้นที่พบจริงตามรายงานผลการตรวจค้น แต่ตำแหน่งในห้อง ห้องเอกสารสิทธิ์ และการจอดรถในโรงรถ เป็นการจัดวางเพื่อการนำเสนอ ไม่ใช่ตำแหน่งที่พบจริง · บ้าน / ห้องชุด ตามจำนวนในโฉนด แบบอาคารตามจำนวนชั้นที่ระบุ · ขนาดแปลงที่ดินตามเนื้อที่ในโฉนด (ย่อส่วน) · ขนาดก้อนเงินตามยอดอายัด · ลาก = หมุน · 2 นิ้ว = ซูม / เลื่อน · แตะสิ่งของ = รายละเอียด")}</div>
      <div class="a3d-pop" id="a3p" hidden></div></div>`;
    const box = $("#a3d");
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-e3],[data-e3z],[data-e3go]"); if (!b) return; e.stopPropagation(); if (!E) return;
      if (b.dataset.e3z) return E.fly(b.dataset.e3z);
      if (b.dataset.e3go) return E.alt(+b.dataset.e3go);
      const k = b.dataset.e3; if (k === "car") E.fly("gar"); else if (k === "home") E.fly("all"); else E.zoom(k === "in" ? 0.7 : 1.45);
    });
    const fail = (m) => { const w = $("#e3w"); if (w) w.innerHTML = `<div style="text-align:center">${IC("warn", 22)}<br>${esc(m)}<br><button class="chip" data-av2="card" style="margin-top:8px">${IC("grid", 14)} ดูแบบการ์ด</button></div>`; };
    const fonts = document.fonts && document.fonts.load ? Promise.race([Promise.all([document.fonts.load("700 20px Sarabun"), document.fonts.load("500 16px Sarabun")]), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    need3(() => fonts.then(() => { if (tok !== BT || !$("#e3s") || $("#e3s .e3-cv")) return; try { E = scene3(box); window.a3dDim(); } catch (err) { console.error(err); fail("สร้างแผนที่ 3 มิติไม่ได้ในเบราว์เซอร์นี้"); } }),
      () => fail("โหลดไลบรารี 3 มิติไม่ได้ (ต้องต่ออินเทอร์เน็ต)"));
  };
  window.a3dApply = function () { if (E) E.size(); };
  window.a3dDim = function () { if (E) E.dim(); };

  /* ---------- ฉาก ---------- */
  function scene3(host) {
    const T = THREE, st = $("#e3s"), lb = $("#e3l");
    let alive = true, need = true, raf = 0, seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pickOf = (a) => a[Math.floor(rnd() * a.length) % a.length];
    const R = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); R.setClearColor(0x000000, 0);
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
    const cv = R.domElement; cv.className = "e3-cv"; st.prepend(cv);
    const S = new T.Scene(), cam = new T.PerspectiveCamera(38, 1, 0.5, 4000);
    S.add(new T.HemisphereLight(0xffffff, 0xd2c9ad, 0.78));
    const sun = new T.DirectionalLight(0xfff3df, 0.7); sun.position.set(110, 230, 150); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -175, right: 175, top: 175, bottom: -175, near: 20, far: 800 }); sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.35; S.add(sun);
    const TEX = [], MC = new Map();
    const mat = (c, o) => { const k = c + (o ? JSON.stringify(o) : ""); if (!MC.has(k)) MC.set(k, new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}))); return MC.get(k); };
    const G = { box: new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), cyl: new T.CylinderGeometry(0.5, 0.5, 1, 14), cyl8: new T.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0),
      cone4: new T.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), ico: new T.IcosahedronGeometry(0.5, 0), tor: new T.TorusGeometry(0.5, 0.09, 6, 14, Math.PI),
      ring: new T.TorusGeometry(0.5, 0.13, 6, 16), sph: new T.SphereGeometry(0.5, 8, 6) };
    { const sh = new T.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 1); sh.lineTo(-0.5, 0); G.gable = new T.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5); }
    const GS = new Set(Object.values(G));
    const add = (par, g, c, x, y, z, sx, sy, sz, o) => { const m = new T.Mesh(typeof g === "string" ? G[g] : g, typeof c === "string" ? mat(c, o && o.mo) : c); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      if (o) { if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; } m.castShadow = !(o && o.ns); m.receiveShadow = true; par.add(m); return m; };
    const bx = (par, x, y, z, w, h, d, c, o) => add(par, "box", c, x, y, z, w, h, d, o);
    const tex = (c, rep) => { const t = new T.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; } t.anisotropy = Math.min(4, R.capabilities.getMaxAnisotropy()); TEX.push(t); return t; };
    const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
    /* ผนังอาคาร: พิกัด UV เป็นหน่วยโลก (1 ช่อง = 1 ห้อง x 1 ชั้น) จึงรวม mesh ได้ */
    const FAC = {};
    function facMat(k) {
      if (FAC[k]) return FAC[k];
      const K = { condo: ["#F3F5F7", "#3D7CC0", "#D9DFE6", 1], house: ["#F7EFDD", "#5A8FC8", "#E6DAC2", 0], office: ["#FFFFFF", "#3F86CC", "#DCE3EB", 1], bank: ["#EEE6D3", "#4A6A86", "#D6CBB4", 0], tower2: ["#E9EEF3", "#2F6FAF", "#CBD4DE", 1] }[k];
      const [c, g] = canvas(64, 64); g.fillStyle = K[0]; g.fillRect(0, 0, 64, 64); g.fillStyle = K[2]; g.fillRect(0, 55, 64, 9);
      const [x0, w0] = K[3] ? [8, 48] : [16, 32]; g.fillStyle = K[1]; g.fillRect(x0, 14, w0, 32); g.fillStyle = "rgba(255,255,255,.32)"; g.fillRect(x0, 14, w0, 9);
      g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 2; g.strokeRect(x0, 14, w0, 32); g.beginPath(); g.moveTo(32, 14); g.lineTo(32, 46); g.stroke();
      return (FAC[k] = new T.MeshLambertMaterial({ map: tex(c, 1) }));
    }
    function fbox(w, h, d, bay, fl) {
      const g = new T.BoxGeometry(w, h, d).translate(0, h / 2, 0), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
      const bx_ = w / Math.max(1, Math.round(w / bay)), bz_ = d / Math.max(1, Math.round(d / bay));
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, 0.02, 0.02); else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, (z + d / 2) / bz_, y / fl); else uv.setXY(i, (x + w / 2) / bx_, y / fl); }
      uv.needsUpdate = true; return g;
    }
    const fac = (par, k, x, z, w, h, d, bay, fl, ry) => { const m = new T.Mesh(fbox(w, h, d, bay || 3.6, fl || 3.2), facMat(k)); m.position.set(x, 0, z); if (ry) m.rotation.y = ry; m.castShadow = m.receiveShadow = true; par.add(m); return m; };
    const signMat = (txt, bg, fg, w, h) => { const [c, g] = canvas(w || 512, h || 128); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
      let fs = Math.round(c.height * 0.56); g.font = `700 ${fs}px Sarabun, sans-serif`; while (g.measureText(txt).width > c.width * 0.9 && fs > 10) { fs -= 2; g.font = `700 ${fs}px Sarabun, sans-serif`; }
      g.fillText(txt, c.width / 2, c.height * 0.54); return new T.MeshLambertMaterial({ map: tex(c) }); };
    const sign = (par, txt, x, y, z, w, h, bg, fg, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), signMat(txt, bg || "#00264D", fg || "#FFD403", 512, Math.round(512 * h / w))); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = false; par.add(m); return m; };

    /* รวม mesh ตามวัสดุ (ลด draw call) */
    function bake(g) {
      g.updateMatrixWorld(true); const by = new Map();
      g.traverse((o) => { if (!o.isMesh) return; const k = o.material.uuid + (o.castShadow ? "s" : "n"); if (!by.has(k)) by.set(k, { m: o.material, cs: o.castShadow, a: [] }); by.get(k).a.push(o); });
      const out = [];
      by.forEach(({ m, cs, a }) => {
        let n = 0; const parts = a.map((o) => { const g2 = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g2.applyMatrix4(o.matrixWorld); n += g2.attributes.position.count; return g2; });
        const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let i = 0;
        parts.forEach((g2) => { P.set(g2.attributes.position.array, i * 3); N.set(g2.attributes.normal.array, i * 3); if (g2.attributes.uv) U.set(g2.attributes.uv.array, i * 2); i += g2.attributes.position.count; g2.dispose(); });
        const bg = new T.BufferGeometry(); bg.setAttribute("position", new T.BufferAttribute(P, 3)); bg.setAttribute("normal", new T.BufferAttribute(N, 3)); bg.setAttribute("uv", new T.BufferAttribute(U, 2)); bg.computeBoundingSphere();
        const mm = new T.Mesh(bg, m); mm.castShadow = cs; mm.receiveShadow = true; out.push(mm);
      });
      a_dispose(g); return out;
    }
    function a_dispose(g) { g.traverse((o) => { if (o.isMesh && !GS.has(o.geometry)) o.geometry.dispose(); }); }
    const STAT = new T.Group();
    const PICK = [], REP = new Map();                                     // ai -> [group ของแต่ละตำแหน่ง]
    const DIM = new T.MeshLambertMaterial({ color: 0xc3cfdd, transparent: true, opacity: 0.22 });
    function item(ai, build, keep) {
      const g = new T.Group(); build(g); const ms = keep ? (() => { const a = []; g.children.slice().forEach((c) => { a.push(c); }); return a; })() : bake(g);
      const grp = new T.Group(); ms.forEach((m) => { if (keep) g.remove(m); m.userData.ai = ai; m.userData.m0 = m.material; PICK.push(m); grp.add(m); });
      S.add(grp); const L = REP.get(ai) || []; grp.userData.rep = L.length; ms.forEach((m) => (m.userData.rep = L.length)); L.push(grp); REP.set(ai, L); return grp;
    }
    /* ---------- ป้ายลอย ---------- */
    const LBL = [];
    function label(p, t, sub, o) {
      o = o || {}; const el = document.createElement("div"); el.className = "e3t l" + (o.lvl || 0);
      el.innerHTML = `<div class="p">${o.ic ? `<i>${IC(o.ic, o.lvl ? 13 : 15)}</i>` : ""}<span><b>${esc(t)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span></div>`;
      el.style.setProperty("--c", o.c || "#00264D"); lb.appendChild(el);
      const L = { el, p: new T.Vector3(p[0], p[1], p[2]), lvl: o.lvl || 0, w: 0, h: 0, on: false };
      if (o.z || o.ai != null) { el.classList.add("tap"); el.addEventListener("click", (e) => { e.stopPropagation(); if (o.z) fly(o.z); else pick(o.ai, 0); }); }
      LBL.push(L); return L;
    }
    /* ---------- กล้อง ---------- */
    const C = { tx: 0, ty: 0, tz: 0, r: 300, th: 0.62, ph: 0.9 }; let TW = null, vth = 0, vph = 0, BND = [-120, 120, -150, 100];
    const ZONES = {}, ZORD = [];
    function camUpd() { const s = Math.sin(C.ph); cam.position.set(C.tx + C.r * s * Math.sin(C.th), C.ty + C.r * Math.cos(C.ph), C.tz + C.r * s * Math.cos(C.th)); cam.lookAt(C.tx, C.ty, C.tz); }
    function fly(z, ms) {
      const to = typeof z === "string" ? ZONES[z] : z; if (!to) return;
      const dth = ((((to.th - C.th) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      TW = { t0: performance.now(), ms: ms || 950, a: { ...C }, b: { tx: to.t[0], ty: to.t[1], tz: to.t[2], r: to.r, th: C.th + dth, ph: to.ph } }; vth = vph = 0; need = true;
      if (typeof z === "string") $$("#e3z button").forEach((b) => b.classList.toggle("on", b.dataset.e3z === z));
    }
    function fitR(hw, hd) { const a = cam.aspect || 1, tv = Math.tan(cam.fov * Math.PI / 360), th = tv * a; return Math.max(hw / th, hd / tv); }
    /* ---------- องค์ประกอบ ---------- */
    const WALL = "#F6F3EC", CAP = "#CDBFA8", WOOD = "#D8BC92", DWOOD = "#7B5B43";
    const AV = [];                                                       // พื้นที่ห้ามวางต้นไม้ (ห้องจำลอง / โรงรถ / ห้องนิรภัย)
    function tree(x, z, s) { if (AV.some(([a, b, c, d]) => x > a && x < c && z > b && z < d)) return; s = s || 1; bx(STAT, x, 0, z, 0.35 * s, 1.7 * s, 0.35 * s, "#8B5A2B"); add(STAT, "ico", pickOf(["#4CBB5E", "#3FA552", "#5CC56B", "#46B058"]), x, 1.7 * s + 1.2 * s, z, 3 * s, 2.8 * s, 3 * s); }
    function palm(x, z) { bx(STAT, x, 0, z, 0.3, 4.2, 0.3, "#9C7A54"); for (let i = 0; i < 5; i++) add(STAT, "box", "#4DAE5B", x, 4.1, z, 2.6, 0.12, 0.5, { ry: i * Math.PI / 5, rz: -0.25 }); }
    function pad(cx, cz, w, d, inner) { bx(STAT, cx, 0, cz, w, 0.32, d, "#E7E3DA", { ns: 1 }); bx(STAT, cx, 0.32, cz, w - 3, 0.06, d - 3, inner || "#A9D08A", { ns: 1 }); }
    function flag(par, x, y, z, col) { bx(par, x, y, z, 0.12, 3.2, 0.12, "#B0B7BF"); bx(par, x + 0.55, y + 2.3, z, 1.0, 0.7, 0.06, col); }
    const stCol = (s) => (s === "seized" || s === "frozen" ? "#E53935" : s === "doing" || s === "prop" ? "#F2C200" : "");
    function tower(par, x, z, w, d, fl, k, o) {
      o = o || {}; const h = fl * 3.2; bx(par, x, 0, z, w + 2.4, 0.5, d + 2.4, "#CBD3DC"); fac(par, k || "condo", x, z, w, h, d);
      bx(par, x, h, z, w + 0.6, 0.6, d + 0.6, "#D6DCE3"); bx(par, x + w * 0.18, h + 0.6, z - d * 0.12, w * 0.32, 2.4, d * 0.32, "#C3CCD6");
      for (let f = 1; f < fl; f++) bx(par, x, f * 3.2 - 0.15, z + d / 2 + 0.55, w * 0.9, 0.2, 1.1, "#E6EAEE", { ns: 1 });
      bx(par, x, 3.0, z + d / 2 + 1.8, Math.min(8, w * 0.5), 0.3, 3.4, o.acc || "#E8563A");
      if (o.hl != null) bx(par, x + w * 0.22, o.hl * 3.2 + 0.5, z + d / 2 + 0.02, w * 0.34, 2.3, 0.16, "#FFD54F", { mo: { emissive: 0x6a4b00 }, ns: 1 });
      return h;
    }
    function tape(par, x0, z0, x1, z1, y) {
      const L = Math.hypot(x1 - x0, z1 - z0), g = new T.BoxGeometry(L, 0.16, 0.03).translate(0, 0.08, 0), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L / 0.9);
      if (!FAC.tape) { const [c, x] = canvas(64, 16); x.fillStyle = "#FFD600"; x.fillRect(0, 0, 64, 16); x.fillStyle = "#1A1A1A"; for (let i = -16; i < 64; i += 16) { x.beginPath(); x.moveTo(i, 16); x.lineTo(i + 8, 16); x.lineTo(i + 16, 0); x.lineTo(i + 8, 0); x.fill(); } FAC.tape = new T.MeshLambertMaterial({ map: tex(c, 1) }); }
      const m = new T.Mesh(g, FAC.tape); m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); par.add(m);
    }
    function car(par, type, col, x, z, ry) {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; par.add(g);
      const L = { sedan: 4.7, suv: 4.9, van: 4.95, pickup: 5.3, truck: 6.4 }[type] || 4.7, W = type === "truck" ? 2.05 : 1.86, GL = "#2B3D52";
      if (type === "truck") { bx(g, 2.2, 0.55, 0, 1.9, 1.75, W, col); bx(g, 2.95, 1.35, 0, 0.42, 0.75, W * 0.84, GL); bx(g, -0.95, 0.65, 0, 4.4, 2.3, W + 0.1, "#F1F3F5"); bx(g, -0.95, 0.5, 0, 4.4, 0.16, W, "#555B62"); }
      else if (type === "van") { bx(g, 0, 0.32, 0, L, 1.05, W, col); bx(g, -0.15, 1.37, 0, L * 0.86, 0.62, W * 0.9, GL); bx(g, -0.2, 1.97, 0, L * 0.82, 0.1, W * 0.86, col); bx(g, L / 2 - 0.3, 0.9, 0, 0.5, 0.5, W * 0.92, "#9AA3AD"); }
      else if (type === "pickup") { bx(g, 0, 0.42, 0, L, 0.82, W, col); bx(g, 0.75, 1.24, 0, 2.15, 0.66, W * 0.88, GL); bx(g, 0.75, 1.88, 0, 1.95, 0.08, W * 0.84, col); bx(g, -1.45, 1.2, 0, 2.2, 0.04, W * 0.84, "#3A3F45", { ns: 1 }); }
      else if (type === "suv") { bx(g, 0, 0.38, 0, L, 0.9, W, col); bx(g, -0.3, 1.28, 0, 3.2, 0.72, W * 0.88, GL); bx(g, -0.3, 1.98, 0, 3.0, 0.08, W * 0.85, col); }
      else { bx(g, 0, 0.3, 0, L, 0.74, W, col); bx(g, -0.2, 1.04, 0, 2.5, 0.6, W * 0.86, GL); bx(g, -0.2, 1.62, 0, 2.25, 0.07, W * 0.82, col); }
      [[L * 0.31, 1], [-L * 0.31, 1], [L * 0.31, -1], [-L * 0.31, -1]].forEach(([wx, s]) => add(g, "cyl", "#1C1C20", wx, 0.37, s * (W / 2 - 0.08), 0.74, 0.3, 0.74, { rx: Math.PI / 2 }));
      [-1, 1].forEach((s) => { bx(g, L / 2 - 0.02, 0.62, s * W * 0.32, 0.06, 0.16, 0.38, "#FFF5C2", { ns: 1 }); bx(g, -L / 2 + 0.02, 0.66, s * W * 0.34, 0.06, 0.15, 0.32, "#C62828", { ns: 1 }); });
      return g;
    }
    const carType = (n) => (/ALPHARD|VELLFIRE/i.test(n) ? "van" : /บรรทุก/.test(n) ? "truck" : /HIRUX|HILUX|REVO|RANGER|TIGER|VIGO|D-?MAX/i.test(n) ? "pickup" : /X5|X3|GLE|GLC|SUV|FORTUNER/i.test(n) ? "suv" : "sedan");
    const CARC = ["#F4F4F2", "#1F1F24", "#B7BDC4", "#5C636B", "#F4F4F2", "#8E1F1F", "#1E3A66", "#E9E4D8", "#1F1F24"];

    /* ---------- จัดผัง ---------- */
    const rows = AR.slice(), mine = (r) => r.mine;
    const houses = rows.filter((r) => r.cat === "house"), lands = rows.filter((r) => r.cat === "land"), cars = rows.filter((r) => r.cat === "car");
    const seized = rows.filter((r) => r.st === "seized"), docs = rows.filter((r) => ["ins", "fund", "oth"].includes(r.cat)), cash = rows.filter((r) => r.cat === "cash"), cards = rows.filter((r) => r.cat === "card");
    const sites = [...new Set(seized.map((r) => +((r.own.match(/(\d+)/) || [])[1] || 0)))].filter(Boolean).sort();
    const BW = 60, BD = 48, X3 = [-72, 0, 72], ZF = 60, ZM = 0;
    /* ที่ดิน: จัดกลุ่มตามตำบล-อำเภอ แล้วจัดเรียงแบบชั้นวาง */
    const side = (m2) => 1.8 + 0.058 * Math.sqrt(m2 || 400);
    const CLU = []; lands.forEach((r) => { const k = locOf(r.name); let c = CLU.find((x) => x.k === k); if (!c) CLU.push((c = { k, a: [] })); c.a.push(r); });
    CLU.forEach((c) => { c.a.sort((x, y) => areaM2(y.sub) - areaM2(x.sub)); const maxW = Math.max(14, Math.sqrt(c.a.reduce((t, r) => t + (side(areaM2(r.sub)) + 0.9) ** 2, 0)) * 1.25);
      let x = 0, z = 0, rowH = 0, W = 0; c.a.forEach((r) => { const s = side(areaM2(r.sub)); if (x > 0 && x + s > maxW) { x = 0; z += rowH + 0.9; rowH = 0; } r._p = [x + s / 2, z + s / 2, s]; x += s + 0.9; rowH = Math.max(rowH, s); W = Math.max(W, x); });
      c.w = W + 3.2; c.d = z + rowH + 5.4; });
    CLU.sort((a, b) => b.d - a.d);
    const LW = BW * 2 + 12; let lx = 0, lz = 0, lrow = 0, LD = 0; CLU.forEach((c) => { if (lx > 0 && lx + c.w > LW - 4) { lx = 0; lz += lrow + 2; lrow = 0; } c.x = lx; c.z = lz; lx += c.w + 2; lrow = Math.max(lrow, c.d); LD = Math.max(LD, lz + lrow); });
    const landD = Math.max(BD, LD + 6), ZB = -30 - 6 - landD / 2, landCX = 36;
    const minZ = Math.min(-84, ZB - landD / 2) - 10, maxZ = 90, minX = -110, maxX = 110;
    BND = [minX + 8, maxX - 8, minZ + 8, maxZ - 8];
    /* ฐาน + ถนน */
    { const w = maxX - minX, d = maxZ - minZ, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      bx(STAT, cx, -7, cz, w + 8, 6.4, d + 8, "#8B6A48", { ns: 1 }); bx(STAT, cx, -0.6, cz, w + 8, 0.6, d + 8, "#9CC97A", { ns: 1 }); bx(STAT, cx, 0, cz, w - 4, 0.04, d - 4, "#646B74", { ns: 1 });
      const dash = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 6), dx = (x1 - x0) / L, dz = (z1 - z0) / L; for (let i = 0; i < n; i++) { const t = i * 6 + 1.5; bx(STAT, x0 + dx * (t + 1.5), 0.05, z0 + dz * (t + 1.5), Math.abs(dx) * 3 + 0.25, 0.03, Math.abs(dz) * 3 + 0.25, "#F2F2F2", { ns: 1 }); } };
      dash(minX + 4, 30, maxX - 4, 30); dash(minX + 4, -30, maxX - 4, -30); dash(-36, minZ + 4, -36, maxZ - 4); dash(36, 30, 36, maxZ - 4); dash(minX + 4, maxZ - 3, maxX - 4, maxZ - 3); }
    const blocks = [[X3[0], ZF, BW, BD, "#E2E5E9"], [X3[1], ZF, BW, BD, "#E2E5E9"], [X3[2], ZF, BW, BD, "#E3E0D7"], [X3[0], ZM, BW, BD, "#A9D08A"], [36, ZM, BW * 2 + 12, BD, "#A9D08A"], [X3[0], ZB, BW, landD, "#E1E4E8"], [landCX, ZB, LW, landD, "#B7D48F"]];
    blocks.forEach(([x, z, w, d, c]) => pad(x, z, w, d, c));

    /* ===== 1) จุดตรวจค้น (ห้องจำลอง + แถบกั้นตำรวจ) ===== */
    const SR = (DB.search && DB.search.rows) || [], SN = (DB.search && DB.search.sites) || {};
    sites.slice(0, 2).forEach((no, si) => {
      const cx = X3[si], cz = ZF, rs = seized.filter((r) => r.own === "ของกลาง จุดที่ " + no), nm = siteShort(SN[no]) || "จุดตรวจค้นที่ " + no;
      const fl = 14, tx = cx - 14, tz = cz - 12, th = tower(STAT, tx, tz, 22, 14, fl, si ? "tower2" : "condo", { hl: 5, acc: si ? "#2E6DB4" : "#E8563A" });
      sign(STAT, nm, tx, 4.6, tz + 7.02 + 2.4, 12, 1.6, "#FFFFFF", "#13263D");
      const K = 1.55, ox = cx + 11, oz = cz + 9, oy = 0.95, RW = 7.6, RD = 5.8;
      bx(STAT, ox, 0.3, oz, RW * K + 1.6, oy - 0.3, RD * K + 1.6, "#D5D9DE");
      const rb = (par, x, y, z, w, h, d, c, o) => bx(par, ox + x * K, oy + y * K, oz + z * K, w * K, h * K, d * K, c, o);
      rb(STAT, 0, -0.02, 0, RW, 0.04, RD, "#E9DDC7", { ns: 1 }); rb(STAT, 0.8, 0.02, 0.6, 3.6, 0.02, 2.6, si ? "#9FB3C8" : "#C9A9A0", { ns: 1 });
      rb(STAT, 0, 0, -RD / 2 - 0.08, RW + 0.32, 2.4, 0.16, WALL); rb(STAT, -RW / 2 - 0.08, 0, 0.0, 0.16, 2.4, RD, WALL); rb(STAT, 0, 2.4, -RD / 2 - 0.08, RW + 0.32, 0.06, 0.18, CAP); rb(STAT, -RW / 2 - 0.08, 2.4, 0, 0.18, 0.06, RD, CAP);
      /* เตียง (ผนังหลังขวา) + ตู้เสื้อผ้าเปิดหน้า (ผนังหลังซ้าย หันหน้าเข้ากล้อง) + โต๊ะเครื่องแป้ง (ผนังซ้าย) */
      rb(STAT, 2.35, 1.45, -RD / 2 + 0.02, 1.4, 0.9, 0.03, "#BFDDF0", { ns: 1 });
      rb(STAT, 2.35, 0, -1.65, 2.1, 0.32, 2.3, DWOOD); rb(STAT, 2.35, 0.32, -1.65, 2.0, 0.26, 2.2, "#F6F4EF"); rb(STAT, 2.35, 0, -2.84, 2.2, 1.1, 0.12, "#5D4433");
      rb(STAT, 1.85, 0.58, -2.5, 0.8, 0.12, 0.42, "#FFFFFF"); rb(STAT, 2.85, 0.58, -2.5, 0.8, 0.12, 0.42, "#FFFFFF"); rb(STAT, 2.35, 0.58, -0.95, 2.02, 0.04, 0.8, "#8FA9C9", { ns: 1 });
      rb(STAT, 3.6, 0, -2.5, 0.38, 0.5, 0.45, DWOOD); rb(STAT, 3.6, 0.5, -2.5, 0.1, 0.32, 0.1, "#E0C068");
      const WZ = -RD / 2 + 0.36, WC = -1.35, WW = 4.54;
      rb(STAT, WC, 0, -RD / 2 + 0.04, WW, 2.3, 0.05, "#F3E9DA"); [WC - WW / 2, WC + WW / 2].forEach((x) => rb(STAT, x, 0, WZ, 0.06, 2.3, 0.66, "#A07A58"));
      [0, 0.56, 1.12, 1.68].forEach((y) => rb(STAT, WC, y, WZ, WW, 0.05, 0.66, "#B8916C", { ns: 1 })); rb(STAT, WC, 2.3, WZ, WW + 0.06, 0.05, 0.7, "#A07A58");
      rb(STAT, -3.45, 0, 1.0, 0.6, 0.78, 1.7, "#EADBC8"); rb(STAT, -RW / 2 + 0.02, 0.9, 1.0, 0.03, 1.0, 1.0, "#CFE6F5", { ns: 1 }); rb(STAT, -2.75, 0, 1.0, 0.42, 0.45, 0.42, "#C9A9A0");
      /* แถบกั้นตำรวจรอบห้อง */
      const tx0 = ox - (RW * K) / 2 - 0.6, tx1 = ox + (RW * K) / 2 + 0.6, tz0 = oz - (RD * K) / 2 - 0.6, tz1 = oz + (RD * K) / 2 + 0.6;
      [[tx0, tz0], [tx1, tz0], [tx1, tz1], [tx0, tz1]].forEach(([x, z]) => bx(STAT, x, oy, z, 0.14, 1.25, 0.14, "#E0E0E0"));
      tape(STAT, tx0, tz1, tx1, tz1, oy + 1.0); tape(STAT, tx1, tz0, tx1, tz1, oy + 1.0); tape(STAT, tx0, tz0, tx0, tz1, oy + 1.0);
      AV.push([tx0 - 1, tz0 - 1, tx1 + 1, tz1 + 1]);
      /* ช่องวางของ */
      const bagS = []; [0.05, 0.61, 1.17, 1.73].forEach((y) => [-3.3, -2.68, -2.06, -1.44, -0.82, -0.2, 0.42].forEach((x) => bagS.push([x, y, WZ + 0.05]))); [-3.0, -2.3, -1.6, -0.9].forEach((x) => bagS.push([x, 0, -1.7]));
      const bedS = []; [-1.95, -1.45, -0.95].forEach((z) => [1.6, 2.1, 2.6, 3.1].forEach((x) => bedS.push([x, 0.6, z]))); [0.2, 0.8, 1.4].forEach((x) => bedS.push([x, 0.06, 1.6]));
      const dresS = [[-3.45, 0.78, 0.55], [-3.45, 0.78, 1.3], [-3.45, 0.78, 1.7]];
      let bi = 0, di = 0, ei = 0;
      rs.forEach((r) => {
        const cs = colsOf(r.sub), c1 = cs[0], c2 = cs[1] || "#C9A35A", u = r.u || 1;
        if (r.cat === "bag") for (let j = 0; j < u; j++) { const s = bagS[bi++ % bagS.length]; item(r.i, (g) => {
          const shp = /ดัฟเฟิล|Keepall/i.test(r.name + r.sub) ? "duf" : /กระบอก|Papillon/i.test(r.name + r.sub) ? "cyl" : /สลิง|คาดอก/.test(r.name + r.sub) ? "sl" : "tote";
          const [x, y, z] = s, X = ox + x * K, Y = oy + y * K, Z = oz + z * K, k = K * (r.val ? 1.1 : 0.95), col = r.val ? c1 : "#9AA1A8", hc = c2 === col ? "#3B2A1E" : c2;
          if (shp === "duf") { add(g, "cyl", col, X, Y + 0.17 * k, Z, 0.34 * k, 0.56 * k, 0.34 * k, { rz: Math.PI / 2 }); add(g, "tor", hc, X, Y + 0.33 * k, Z, 0.26 * k, 0.26 * k, 0.26 * k); }
          else if (shp === "cyl") { add(g, "cyl", col, X, Y + 0.13 * k, Z, 0.26 * k, 0.38 * k, 0.26 * k, { rz: Math.PI / 2 }); add(g, "tor", hc, X, Y + 0.25 * k, Z, 0.22 * k, 0.22 * k, 0.22 * k); }
          else if (shp === "sl") { bx(g, X, Y, Z, 0.32 * k, 0.2 * k, 0.09 * k, col); add(g, "tor", "#2A2A2A", X, Y + 0.2 * k, Z, 0.3 * k, 0.36 * k, 0.3 * k); }
          else { bx(g, X, Y, Z, 0.42 * k, 0.32 * k, 0.16 * k, col); bx(g, X, Y + 0.12 * k, Z + 0.081 * k, 0.12 * k, 0.12 * k, 0.005 * k, c2, { ns: 1 }); add(g, "tor", hc, X, Y + 0.32 * k, Z, 0.2 * k, 0.22 * k, 0.2 * k); }
        }); }
        else if (r.cat === "scarf" || (r.cat === "lux" && /เสื้อ/.test(r.name))) for (let j = 0; j < u; j++) { const s = bedS[di++ % bedS.length]; item(r.i, (g) => {
          const [x, y, z] = s, X = ox + x * K, Y = oy + y * K, Z = oz + z * K;
          if (r.cat === "scarf") { bx(g, X, Y, Z, 0.42 * K, 0.035 * K, 0.42 * K, c1); bx(g, X, Y + 0.035 * K, Z, 0.26 * K, 0.008 * K, 0.26 * K, c2, { ns: 1 }); }
          else { const sc = r.sub && !/ไม่ปรากฏ/.test(r.sub) ? c1 : "#6B4226"; bx(g, X, Y, Z, 0.42 * K, 0.06 * K, 0.5 * K, sc); bx(g, X, Y + 0.06 * K, Z - 0.2 * K, 0.18 * K, 0.03 * K, 0.08 * K, "#C9A35A", { ns: 1 }); }
        }); }
        else { const s = dresS[ei++ % dresS.length]; item(r.i, (g) => {
          const [x, y, z] = s, X = ox + x * K, Y = oy + y * K, Z = oz + z * K, nr = Math.min(24, nOf(r.sub, "วง")), ne = Math.min(8, nOf(r.sub, "คู่")), nn = Math.min(24, nOf(r.sub, "เส้น"));
          if (/เครื่องประดับ/.test(r.name)) { const q = new T.Group(); q.position.set(X, Y, Z); q.rotation.y = Math.PI / 2; g.add(q);
            bx(q, 0, 0, 0, 0.62 * K, 0.06 * K, 0.4 * K, "#1F2D6B"); bx(q, 0, 0.06 * K, -0.21 * K, 0.62 * K, 0.3 * K, 0.03 * K, "#283A86");
            const gold = mat("#E2B23A", { emissive: 0x3a2800 });
            for (let i = 0; i < nr; i++) add(q, "ring", gold, -0.26 * K + (i % 8) * 0.075 * K, 0.075 * K, -0.12 * K + Math.floor(i / 8) * 0.07 * K, 0.05 * K, 0.05 * K, 0.05 * K, { rx: Math.PI / 2, ns: 1 });
            for (let i = 0; i < ne * 2; i++) add(q, "sph", "#F3F6FA", -0.26 * K + (i % 8) * 0.075 * K, 0.08 * K, 0.1 * K + Math.floor(i / 8) * 0.05 * K, 0.025 * K, 0.025 * K, 0.025 * K, { ns: 1 });
            for (let i = 0; i < Math.ceil(nn / 4); i++) add(q, "ring", gold, -0.14 * K + i * 0.04 * K, 0.07 * K, 0.03 * K, 0.26 * K, 0.26 * K, 0.06 * K, { rx: Math.PI / 2, ns: 1 }); }
          else bx(g, X, Y, Z, 0.3 * K, 0.2 * K, 0.3 * K, c1);
        }); }
      });
      const cnt = {}; SR.filter((x) => +x.site === no).forEach((x) => (cnt[x.item] = (cnt[x.item] || 0) + (x.n || 1)));
      const UN = { "กระเป๋า": "ใบ", "ผ้าพันคอ": "ผืน", "เสื้อ": "ตัว", "เครื่องประดับ": "รายการ" };
      const tot = rs.reduce((t, r) => t + (r.val || 0), 0), cntS = Object.entries(cnt).map(([k, v]) => `${k} ${v}${UN[k] ? " " + UN[k] : ""}`).join(" · ");
      const gl = (t, p, c, f) => { const r = rs.find(f); if (r) label(p, t, "", { lvl: 2, c, ai: r.i }); };
      if (cnt["กระเป๋า"]) gl(`กระเป๋า ${cnt["กระเป๋า"]} ใบ`, [ox + WC * K, oy + 2.45 * K, oz + WZ * K], "#C2185B", (r) => r.cat === "bag");
      const bedT = [cnt["ผ้าพันคอ"] ? `ผ้าพันคอ ${cnt["ผ้าพันคอ"]} ผืน` : "", cnt["เสื้อ"] ? `เสื้อ ${cnt["เสื้อ"]} ตัว` : ""].filter(Boolean).join(" · ");
      if (bedT) gl(bedT, [ox + 2.35 * K, oy + 1.0 * K, oz - 1.3 * K], "#7B3FB8", (r) => r.cat === "scarf" || /เสื้อ/.test(r.name));
      if (cnt["เครื่องประดับ"]) gl(`เครื่องประดับ ${cnt["เครื่องประดับ"]} รายการ`, [ox - 3.45 * K, oy + 1.25 * K, oz + 1.0 * K], "#D4407A", (r) => /เครื่องประดับ/.test(r.name));
      label([tx, th + 4, tz], `จุดตรวจค้นที่ ${no}`, nm, { ic: "search", c: "#E53935", z: "s" + no });
      label([ox, oy + 2.9 * K, oz - (RD * K) / 2], "ห้องที่ตรวจค้น (ภาพจำลอง)", cntS, { ic: "bag", c: "#E53935", lvl: 1, z: "s" + no });
      ZONES["s" + no] = { lab: `จุดตรวจค้น ${no}`, ic: "search", c: "#E53935", t: [ox - 0.5, oy + 0.6, oz - 2.0], r: 26, th: 0.3, ph: 0.9, sub: `${cntS} · ประเมิน ${M(tot)}` };
    });

    /* ===== 2) บ้านจำลอง: ห้องเอกสารสิทธิ์ (โฉนด) + ห้องเอกสารการเงิน / ตู้เซฟ ===== */
    { const cx = X3[0], cz = ZM - 11, W = 30, D = 18, H = 2.6, y0 = 0.38;
      bx(STAT, cx, 0.32, cz, W + 1.2, 0.3, D + 1.2, "#CFC6B6"); bx(STAT, cx, 0.62, cz, W, 0.06, D, WOOD, { ns: 1 });
      const wl = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0); bx(STAT, (x0 + x1) / 2, y0 + 0.3, (z0 + z1) / 2, x0 === x1 ? 0.3 : L + 0.3, H, z0 === z1 ? 0.3 : L + 0.3, WALL); bx(STAT, (x0 + x1) / 2, y0 + 0.3 + H, (z0 + z1) / 2, x0 === x1 ? 0.34 : L + 0.34, 0.08, z0 === z1 ? 0.34 : L + 0.34, CAP, { ns: 1 }); };
      const X0 = cx - W / 2, X1 = cx + W / 2, Z0 = cz - D / 2, Z1 = cz + D / 2, XS = cx + 3;
      AV.push([X0 - 1, Z0 - 1, X1 + 1, Z1 + 1]); wl(X0, Z0, X1, Z0); wl(X0, Z0, X0, Z1); wl(X1, Z0, X1, cz - 1); wl(XS, Z0, XS, cz - 3); wl(XS, cz + 0.5, XS, Z1 - 4); wl(XS, cz, X1 - 4, cz);
      bx(STAT, cx - 6, 0.68, cz + 1, 10, 0.02, 9, "#B8C7D9", { ns: 1 });
      /* โฉนด (atlas เดียว) บนโต๊ะแยกเจ้าของ */
      const own = ownL(), deeds = houses.concat(lands).filter((r) => r.mine), byO = own.map((o) => deeds.filter((r) => r.own === o)).filter((a) => a.length).slice(0, 2);
      const N = deeds.length, cols = 8, rws = Math.max(1, Math.ceil(N / cols)), th_ = Math.min(180, Math.floor(1024 / rws)), tw = Math.min(124, Math.floor(th_ * 0.72));
      const [ac, g] = canvas(1024, 1024); g.fillStyle = "#EDE5D2"; g.fillRect(0, 0, 1024, 1024); const UV = new Map();
      deeds.forEach((r, i) => {
        const x = (i % cols) * 128 + (128 - tw) / 2, y = Math.floor(i / cols) * th_, condo = /ห้องชุด/.test(r.sub);
        g.fillStyle = "#FBF4E1"; g.fillRect(x, y + 2, tw, th_ - 4); g.strokeStyle = "#A8392B"; g.lineWidth = 3; g.strokeRect(x + 5, y + 7, tw - 10, th_ - 14); g.lineWidth = 1; g.strokeRect(x + 9, y + 11, tw - 18, th_ - 22);
        g.fillStyle = "#C9A227"; g.beginPath(); g.arc(x + tw / 2, y + th_ * 0.17, th_ * 0.055, 0, 7); g.fill(); g.textAlign = "center"; g.textBaseline = "alphabetic";
        g.fillStyle = "#7A1F14"; g.font = `700 ${Math.round(th_ * 0.08)}px Sarabun, sans-serif`; g.fillText(condo ? "หนังสือกรรมสิทธิ์ห้องชุด" : "โฉนดที่ดิน", x + tw / 2, y + th_ * 0.33, tw - 16);
        g.fillStyle = "#1A1A1A"; g.font = `700 ${Math.round(th_ * 0.1)}px Sarabun, sans-serif`; g.fillText("เลขที่ " + (deedOf(r.name) || "-"), x + tw / 2, y + th_ * 0.47, tw - 16);
        g.fillStyle = "#3A3A3A"; g.font = `500 ${Math.round(th_ * 0.062)}px Sarabun, sans-serif`;
        const words = locOf(r.name).split(/\s+/), lines = []; let ln = ""; words.forEach((w) => { const t2 = ln ? ln + " " + w : w; if (g.measureText(t2).width > tw - 22 && ln) { lines.push(ln); ln = w; } else ln = t2; }); if (ln) lines.push(ln);
        lines.slice(0, 3).forEach((l, k) => g.fillText(l, x + tw / 2, y + th_ * (0.58 + k * 0.075), tw - 18));
        g.fillStyle = "#555"; g.fillText((r.sub.split(" · ")[0] || ""), x + tw / 2, y + th_ * 0.83, tw - 18);
        g.fillStyle = ownCol(r.own); g.fillRect(x + 9, y + th_ - 24, tw - 18, 11);
        UV.set(r.i, [x / 1024, 1 - (y + th_) / 1024, (x + tw) / 1024, 1 - y / 1024]);
      });
      const DM = new T.MeshLambertMaterial({ map: tex(ac) });
      byO.forEach((list, k) => {
        const tc = list.length > 12 ? 6 : 4, tr = Math.ceil(list.length / tc), DW = 1.05, DH = 1.45, tW = tc * (DW + 0.18) + 0.5, tD = tr * (DH + 0.18) + 0.5;
        const tx = X0 + 1.6 + tW / 2 + (k ? W * 0 : 0), tz = k ? Z1 - 1.2 - tD / 2 : Z0 + 1.4 + tD / 2, ty = y0 + 0.3 + 0.82;
        bx(STAT, tx, ty - 0.08, tz, tW, 0.08, tD, DWOOD); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bx(STAT, tx + a * (tW / 2 - 0.15), y0 + 0.3, tz + b * (tD / 2 - 0.15), 0.12, 0.74, 0.12, "#5D4433"));
        bx(STAT, tx, ty - 0.02, tz, tW - 0.2, 0.02, tD - 0.2, ownCol(list[0].own), { ns: 1 });
        list.forEach((r, i) => { const uv = UV.get(r.i), x = tx - tW / 2 + 0.34 + (i % tc) * (DW + 0.18) + DW / 2, z = tz - tD / 2 + 0.34 + Math.floor(i / tc) * (DH + 0.18) + DH / 2;
          item(r.i, (gg) => { const pg = new T.PlaneGeometry(DW, DH).rotateX(-Math.PI / 2), a = pg.attributes.uv; a.setXY(0, uv[0], uv[3]); a.setXY(1, uv[2], uv[3]); a.setXY(2, uv[0], uv[1]); a.setXY(3, uv[2], uv[1]);
            const m = new T.Mesh(pg, DM); m.position.set(x, ty + 0.012, z); m.castShadow = false; m.receiveShadow = true; gg.add(m); }); });
        label([tx, ty + 0.6, tz - tD / 2], `โฉนด ${list.length} ฉบับ`, list[0].own, { ic: "doc", c: ownCol(list[0].own), lvl: 2 });
      });
      bx(STAT, X0 + 0.6, y0 + 0.3, cz + 0.5, 0.7, 1.4, 2.2, "#8E99A4"); bx(STAT, X0 + 0.6, y0 + 0.3, cz + 3, 0.7, 1.4, 2.2, "#8E99A4");
      /* ห้องเอกสารการเงิน: ชั้นแฟ้มประกัน / กองทุน / สลาก + ตู้ปืน */
      const sx0 = XS + 0.7, sz0 = Z0 + 0.55, SW = X1 - XS - 1.4, scx = (XS + X1) / 2 - 0.35, fy = y0 + 0.3; let sx = sx0;
      bx(STAT, scx, fy, sz0, SW, 2.9, 0.1, "#8A6A4E"); [-1, 1].forEach((s) => bx(STAT, scx + s * SW / 2, fy, sz0 + 0.3, 0.08, 2.9, 0.6, "#8A6A4E")); [0, 0.95, 1.9, 2.85].forEach((y) => bx(STAT, scx, fy + y, sz0 + 0.3, SW, 0.06, 0.6, "#A8845F"));
      docs.filter((r) => !/ปืน/.test(r.name)).forEach((r) => {
        const n = Math.min(24, nOf(r.name, r.cat === "ins" ? "กรมธรรม์" : "กองทุน")), col = ACM[r.cat][3];
        item(r.i, (g) => { for (let i = 0; i < n; i++) { const lvl = Math.floor(i / 12), x = sx + (i % 12) * 0.18; bx(g, x, fy + 0.06 + lvl * 0.95, sz0 + 0.35, 0.15, 0.8, 0.46, i % 2 ? col : new T.Color(col).offsetHSL(0, 0, 0.08).getStyle()); } bx(g, sx + Math.min(12, n) * 0.09, fy + 1.96, sz0 + 0.35, 0.34, 0.08, 0.4, ownCol(r.own), { ns: 1 }); });
        label([sx + 0.9, y0 + 3.4, sz0 + 0.6], r.name, r.own, { lvl: 2, c: col, ai: r.i });
        sx += Math.min(12, n) * 0.18 + 0.5; if (sx > X1 - 1.5) sx = sx0;
      });
      const guns = docs.filter((r) => /ปืน/.test(r.name));
      guns.forEach((r, k) => { const gx = X1 - 1.0, gz = cz - 5.6 + k * 2.6, n = Math.min(10, nOf(r.name, "กระบอก"));
        bx(STAT, gx, y0 + 0.3, gz, 0.9, 2.1, 2.2, "#4B5560"); item(r.i, (g) => { for (let i = 0; i < n; i++) bx(g, gx - 0.12, y0 + 0.55, gz - 0.85 + i * (1.7 / Math.max(1, n - 1)), 0.08, 1.35, 0.1, "#2A2E33"); bx(g, gx - 0.46, y0 + 0.3, gz, 0.04, 2.0, 2.0, mat("#BFE3F5", { transparent: true, opacity: 0.3 }), { ns: 1 }); });
        label([gx, y0 + 2.8, gz], r.name, r.own, { lvl: 2, c: "#4B5560", ai: r.i }); });
      /* ห้องนั่งเล่น (ตกแต่ง) */
      bx(STAT, cx + 9, y0 + 0.3, Z1 - 1.0, 5, 0.75, 1.1, "#7E8C9A"); bx(STAT, cx + 9, y0 + 0.3, Z1 - 3.4, 2.4, 0.42, 1.2, DWOOD); bx(STAT, cx + 9, y0 + 0.32, Z1 - 3.4, 6.5, 0.02, 4.2, "#D9C9B0", { ns: 1 });
      label([cx - 6, y0 + 3.6, Z0], "ห้องเอกสารสิทธิ์ (ภาพจำลอง)", `โฉนด / หนังสือกรรมสิทธิ์ ${deeds.length} ฉบับ`, { ic: "doc", c: "#1E6FD9", lvl: 1, z: "doc" });
      label([cx + 9, y0 + 3.6, Z0], "เอกสารการเงิน / ตู้เซฟ", docs.map((r) => r.name.replace(/\s*\d+\s*(กรมธรรม์|กองทุน|กระบอก)/, "")).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(" · "), { ic: "shield", c: "#5E4FC4", lvl: 1, z: "doc" });
      label([cx, y0 + 6, cz], "บ้านจำลอง", "ห้องเอกสารสิทธิ์ · เอกสารการเงิน", { ic: "home", c: "#1E6FD9", z: "doc" });
      ZONES.doc = { lab: "บ้านจำลอง · ห้องเอกสาร", ic: "doc", c: "#1E6FD9", t: [cx, 1, cz], r: 44, th: 0.35, ph: 0.82, sub: `โฉนด ${deeds.length} ฉบับ` };
      tree(X0 - 2.6, Z1 + 2, 1); tree(X1 + 2.4, Z0 - 0.5, 0.9);
    }

    /* ===== 3) โรงรถ ===== */
    { const units = []; const own = ownL(); cars.slice().sort((a, b) => (own.indexOf(a.own) + 9) % 9 - (own.indexOf(b.own) + 9) % 9 || (b.val || 0) - (a.val || 0)).forEach((r) => { for (let j = 0; j < (r.u || 1); j++) units.push([r, j]); });
      if (units.length) {
        const cx = X3[0], cz = ZM + 13, BWy = 3.3, nb = Math.ceil(units.length / 2), GW = nb * BWy + 2, GD = 18;
        bx(STAT, cx, 0.36, cz, GW, 0.08, GD, "#B9C0C8", { ns: 1 });
        for (let i = 0; i <= nb; i++) { const x = cx - (nb * BWy) / 2 + i * BWy; bx(STAT, x, 0.44, cz - 5.2, 0.14, 0.02, 5.8, "#F5F5F5", { ns: 1 }); bx(STAT, x, 0.44, cz + 5.2, 0.14, 0.02, 5.8, "#F5F5F5", { ns: 1 });
          if (i % 2 === 0) { bx(STAT, x, 0.44, cz - 8.4, 0.3, 3.4, 0.3, "#8C96A1"); bx(STAT, x, 0.44, cz + 8.4, 0.3, 3.4, 0.3, "#8C96A1"); } }
        for (let s = -1; s <= 1; s += 2) bx(STAT, cx, 3.84, cz + s * 8.4, GW, 0.22, 0.4, "#8C96A1"); AV.push([cx - GW / 2 - 1.5, cz - GD / 2 - 1.5, cx + GW / 2 + 1.5, cz + GD / 2 + 1.5]);
        bx(STAT, cx, 0.44, cz - GD / 2 + 0.2, GW, 1.2, 0.3, "#C9CED4"); sign(STAT, "โรงรถ", cx - GW / 2 + 3, 1.25, cz - GD / 2 + 0.36, 4, 0.8);
        const grp = {};
        units.forEach(([r, j], i) => { const row = i < nb ? 0 : 1, k = row ? i - nb : i, x = cx - (nb * BWy) / 2 + BWy / 2 + k * BWy, z = cz + (row ? 5.0 : -5.0), oc = ownCol(r.own);
          bx(STAT, x, 0.44, cz + (row ? 7.9 : -7.9), BWy - 0.3, 0.02, 0.5, oc, { ns: 1 });
          const t = carType(r.name), col = CARC[(r.i * 3 + j) % CARC.length];
          item(r.i, (g) => car(g, t, col, x, z, row ? Math.PI / 2 : -Math.PI / 2).position.y = 0.44);
          (grp[r.own] = grp[r.own] || { n: 0, v: 0, x0: x, x1: x, z, seen: new Set() }); const G2 = grp[r.own]; G2.n++; G2.x0 = Math.min(G2.x0, x); G2.x1 = Math.max(G2.x1, x); if (!G2.seen.has(r.i)) { G2.seen.add(r.i); G2.v += r.val || 0; }
          if (j === 0) label([x, 2.8, z], r.name.replace(/^รถยนต์\s*/, "").replace(/\s*\d+\s*คัน$/, "") + ((r.u || 1) > 1 ? ` ×${r.u}` : ""), "", { lvl: 2, c: oc, ai: r.i });
        });
        Object.entries(grp).forEach(([o, G2]) => label([(G2.x0 + G2.x1) / 2, 4.6, G2.z], `${o} · ${G2.n} คัน`, M(G2.v), { ic: "car", c: ownCol(o), lvl: 1, z: "gar" }));
        label([cx, 6.5, cz], "โรงรถ (ภาพจำลอง)", `รถยนต์ ${units.length} คัน · ${M(cars.reduce((t, r) => t + (r.val || 0), 0))}`, { ic: "car", c: "#4A6274", z: "gar" });
        ZONES.gar = { lab: "โรงรถ", ic: "car", c: "#4A6274", t: [cx, 1, cz], r: Math.max(34, GW * 1.05), th: 0.12, ph: 0.72, sub: `${units.length} คัน` };
      }
    }

    /* ===== 4) บ้าน / ห้องชุด ตามโฉนด ===== */
    if (houses.length) {
      const own = ownL(), hs = houses.slice().sort((a, b) => (own.indexOf(a.own) + 9) % 9 - (own.indexOf(b.own) + 9) % 9 || (b.val || 0) - (a.val || 0));
      const X0 = -30 + 2, LWt = (BW * 2 + 12 - 4) / hs.length;
      hs.forEach((r, i) => {
        const cx = X0 + LWt * (i + 0.5), cz = ZM - 4, condo = /ห้องชุด/.test(r.sub), fl = /สามชั้น/.test(r.sub) ? 3 : /สองชั้น/.test(r.sub) ? 2 : /ชั้นเดียว/.test(r.sub) ? 1 : 2, big = areaM2(r.sub) >= 16000;
        bx(STAT, cx, 0.38, ZM + 2, LWt - 1.6, 0.05, BD - 6, big ? "#B5D96B" : "#9DCB7A", { ns: 1 }); bx(STAT, cx + LWt * 0.28, 0.43, ZM + 12, 3.2, 0.03, 20, "#C9CDD2", { ns: 1 });
        for (let t = -LWt / 2 + 1.2; t < LWt / 2 - 1; t += 1.4) if (Math.abs(t - LWt * 0.28) > 2) bx(STAT, cx + t, 0.38, ZM + BD / 2 - 3.6, 0.12, 1.0, 0.12, "#FFFFFF", { ns: 1 });
        bx(STAT, cx, 1.3, ZM + BD / 2 - 3.6, LWt - 2, 0.08, 0.1, "#FFFFFF", { ns: 1 });
        let top;
        item(r.i, (g) => {
          if (condo) { top = tower(g, cx, cz - 2, Math.min(13, LWt - 4), 11, 8, "tower2", { hl: 4, acc: "#1E6FD9" }); }
          else { const w = Math.min(fl === 1 ? 12 : 11, LWt - 8), d = fl === 1 ? 9 : 11, h = fl * 3.2, hx = cx - 1.2; fac(g, "house", hx, cz, w, h, d, 3.4, 3.2);
            if (fl >= 3) { bx(g, hx, h, cz, w + 0.5, 0.7, d + 0.5, "#5B6B7C"); bx(g, hx - w * 0.2, h + 0.7, cz - d * 0.2, w * 0.45, 2.4, d * 0.45, "#F2EADA"); add(g, "cone4", "#5B6B7C", hx - w * 0.2, h + 3.1, cz - d * 0.2, w * 0.55, 1.4, d * 0.55); top = h + 4.5; }
            else { add(g, "cone4", fl === 1 ? "#B5543A" : "#4E5D6C", hx, h, cz, w * 1.16, fl === 1 ? 3.0 : 3.6, d * 1.16); top = h + 3.8; }
            bx(g, hx - w * 0.18, 0, cz + d / 2 + 0.01, 1.5, 2.4, 0.12, "#6D4C41"); bx(g, hx + w / 2 + 1.7, 2.7, cz + d / 2 - 2.6, 3.8, 0.18, 5.6, "#8F9AA6");
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bx(g, hx + w / 2 + 1.7 + a * 1.7, 0, cz + d / 2 - 2.6 + b * 2.6, 0.16, 2.7, 0.16, "#7D8894")); }
          const sc = stCol(r.st); if (sc) flag(g, cx - LWt / 2 + 1.4, 0.4, ZM + BD / 2 - 5, sc);
        });
        if (big) { palm(cx - LWt / 2 + 2, ZM + 8); palm(cx + LWt / 2 - 2, ZM - 14); } else tree(cx - LWt * 0.3, ZM + 9, 0.9);
        label([cx, top + 1, cz], shortLoc(r.name), `${condo ? "ห้องชุด" : `บ้าน ${fl} ชั้น`}${r.val ? " · " + M(r.val) : ""}`, { ic: "home", c: ownCol(r.own), lvl: 1, ai: r.i });
      });
      label([36, 30, ZM - 4], `บ้าน / ห้องชุด ${houses.length} แห่ง`, M(houses.reduce((t, r) => t + (r.val || 0), 0)), { ic: "home", c: "#1E6FD9", z: "hou" });
      ZONES.hou = { lab: `บ้าน / ห้องชุด ${houses.length}`, ic: "home", c: "#1E6FD9", t: [36, 4, ZM], r: 0, th: 0.25, ph: 0.92, fit: [70, 30], port: { th: 1.22, fit: [30, 66] } };
    }

    /* ===== 5) ที่ดินตามโฉนด ===== */
    if (CLU.length) {
      const x0 = landCX - LW / 2 + 3, z0 = ZB - landD / 2 + 3, FIELD = ["#B5D96B", "#9CCB66", "#C8DD84", "#A6C76A", "#C9B48A"];
      CLU.forEach((c) => {
        const cx0 = x0 + c.x, cz0 = z0 + c.z; bx(STAT, cx0 + c.w / 2, 0.38, cz0 + c.d / 2, c.w, 0.04, c.d, "#DCCDAE", { ns: 1 });
        c.a.forEach((r) => { const [px, pz, s] = r._p, X = cx0 + 1.6 + px, Z = cz0 + 4 + pz, oc = ownCol(r.own), fc = pickOf(FIELD), a2 = areaM2(r.sub);
          item(r.i, (g) => { bx(g, X, 0.42, Z, s, 0.16, s, fc, { ns: 1 });
            if (a2 >= 8000) for (let t = -s / 2 + 0.6; t < s / 2 - 0.3; t += Math.max(0.7, s / 14)) bx(g, X + t, 0.58, Z, 0.16, 0.06, s - 0.6, new T.Color(fc).offsetHSL(0, 0, -0.1).getStyle(), { ns: 1 });
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { bx(g, X + a * (s / 2 - 0.15), 0.42, Z + b * (s / 2 - 0.15), 0.22, 0.55, 0.22, "#F4F4F4"); bx(g, X + a * (s / 2 - 0.15), 0.97, Z + b * (s / 2 - 0.15), 0.24, 0.1, 0.24, "#D32F2F", { ns: 1 }); });
            bx(g, X - s / 2 + 0.6, 0.42, Z + s / 2 - 0.4, 0.1, 1.3, 0.1, "#8D6E63"); bx(g, X - s / 2 + 0.6, 1.4, Z + s / 2 - 0.36, 1.0, 0.55, 0.06, oc);
            const sc = stCol(r.st); if (sc) flag(g, X + s / 2 - 0.5, 0.42, Z - s / 2 + 0.5, sc); });
          if (a2 >= 30000) { tree(X - s * 0.25, Z - s * 0.2, 0.9); tree(X + s * 0.2, Z + s * 0.15, 1.0); }
        });
        const tot = c.a.reduce((t, r) => t + (r.val || 0), 0), ar = c.a.reduce((t, r) => t + areaM2(r.sub), 0) / 1600;
        label([cx0 + c.w / 2, 2.6, cz0 + 1.6], cluLab(c.k), `${c.a.length} แปลง · ${ar >= 1 ? ar.toFixed(ar >= 10 ? 0 : 1) + " ไร่" : Math.round(ar * 400) + " ตร.ว."}${tot ? " · " + M(tot) : ""}`, { ic: "land", c: ownCol(c.a[0].own), lvl: 1, z: { t: [cx0 + c.w / 2, 0, cz0 + c.d / 2], r: Math.max(22, Math.max(c.w, c.d) * 1.6), th: 0.3, ph: 0.85 } });
      });
      label([landCX, 16, ZB], `ที่ดิน ${lands.length} แปลง`, M(lands.reduce((t, r) => t + (r.val || 0), 0)), { ic: "land", c: "#2E8B57", z: "lnd" });
      ZONES.lnd = { lab: `ที่ดิน ${lands.length} แปลง`, ic: "land", c: "#2E8B57", t: [landCX, 0, ZB], r: 0, th: 0.2, ph: 0.8, fit: [LW / 2 + 4, landD / 2 + 4], port: { th: 1.3, fit: [landD / 2 + 4, LW / 2 + 2] } };
    }

    /* ===== 6) มูลนิธิ ===== */
    { const cx = X3[0], cz = ZB, fc = (DB.groups.find((g) => g[0] === "t1") || [0, 0, "#1565C0"])[2], fr = cash.filter((r) => !mine(r));
      fac(STAT, "office", cx - 8, cz - 9, 30, 9.6, 13); bx(STAT, cx - 8, 9.6, cz - 9, 30.6, 0.7, 13.6, fc); bx(STAT, cx - 8, 0, cz - 2.2, 8, 3.4, 0.6, "#FFFFFF"); bx(STAT, cx - 8, 3.4, cz - 1.0, 9, 0.35, 3.2, fc);
      sign(STAT, "มูลนิธิ", cx - 8, 7.6, cz - 2.44, 9, 1.5, "#FFFFFF", fc);
      const sx = cx + 16, sz = cz - 6; bx(STAT, sx, 0.38, sz, 11, 0.8, 11, "#E0D6C4"); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bx(STAT, sx + a * 3.6, 1.18, sz + b * 3.6, 0.6, 3.6, 0.6, "#C62828"));
      bx(STAT, sx, 1.18, sz, 6.2, 3.4, 6.2, "#F4E3C8"); add(STAT, "cone4", "#D84315", sx, 4.6, sz, 10.5, 2.2, 10.5); bx(STAT, sx, 6.7, sz, 4.6, 1.8, 4.6, "#C62828"); add(STAT, "cone4", "#D84315", sx, 8.4, sz, 7, 2.0, 7); add(STAT, "sph", mat("#E2B23A", { emissive: 0x3a2800 }), sx, 10.6, sz, 0.8, 0.8, 0.8);
      bx(STAT, cx, 0.38, cz + 17, 16, 0.6, 1.2, "#FFFFFF"); [-7.4, 7.4].forEach((d) => bx(STAT, cx + d, 0.38, cz + 17, 1.0, 5.2, 1.0, "#E9E4D8")); bx(STAT, cx, 5.2, cz + 17, 17, 1.4, 1.2, fc); sign(STAT, "มูลนิธิ", cx, 5.9, cz + 17.62, 12, 1.2, fc, "#FFFFFF");
      bx(STAT, cx + 20, 0.38, cz + 12, 0.18, 9, 0.18, "#D0D5DB"); bx(STAT, cx + 20.9, 7.6, cz + 12, 1.8, 1.1, 0.06, fc);
      fr.forEach((r, k) => { const s = 1.1 * Math.cbrt((r.val || 0) / 1e6) + 0.4, x = cx - 8 + (k - (fr.length - 1) / 2) * (s + 2), z = cz + 5;
        item(r.i, (g) => money(g, x, 0.4, z, s)); label([x, s + 1.5, z], "เงินบัญชีมูลนิธิที่อายัด", M(r.val), { lvl: 1, c: "#E53935", ai: r.i }); });
      label([cx - 8, 13, cz - 9], "มูลนิธิ", "อาคารมูลนิธิ · ศาลเจ้า", { ic: "bank", c: fc, z: "fnd" });
      ZONES.fnd = { lab: "มูลนิธิ", ic: "bank", c: fc, t: [cx, 2, cz], r: 70, th: 0.4, ph: 0.9 };
      tree(cx - 26, cz + 14, 1.1); tree(cx + 24, cz - 18, 1.0); tree(cx - 25, cz - 18, 1.0);
    }
    function money(g, x, y, z, s) {
      if (!FAC.money) { const [c, q] = canvas(64, 64); for (let i = 0; i < 16; i++) { q.fillStyle = i % 2 ? "#E9E2C6" : "#9FC79A"; q.fillRect(0, i * 4, 64, 4); } q.fillStyle = "#C9A227"; q.fillRect(26, 0, 12, 64); FAC.money = new T.MeshLambertMaterial({ map: tex(c) }); }
      const m = new T.Mesh(G.box, FAC.money); m.position.set(x, y, z); m.scale.set(s, s * 0.8, s); m.castShadow = m.receiveShadow = true; g.add(m);
      bx(g, x, y + s * 0.8, z, s * 0.5, 0.04, s * 1.02, "#E53935", { ns: 1 });
    }

    /* ===== 7) ธนาคาร: เงินในบัญชีที่อายัด + เงินชำระเกินในบัตร ===== */
    { const cx = X3[2], cz = ZF, fr = cash.filter(mine);
      if (fr.length || cards.length) {
        fac(STAT, "bank", cx, cz - 12, 34, 9.6, 13); bx(STAT, cx, 9.6, cz - 12, 34.6, 0.9, 13.6, "#D9CFB8"); bx(STAT, cx, 0.38, cz - 4.2, 20, 0.6, 3.6, "#E9E2D2");
        for (let i = 0; i < 6; i++) add(STAT, "cyl8", "#F4EFE4", cx - 7.5 + i * 3, 0.98, cz - 4.6, 0.9, 7.2, 0.9); bx(STAT, cx, 8.2, cz - 4.6, 19, 0.6, 2.6, "#EDE6D6");
        add(STAT, "gable", "#E5DCC7", cx, 8.8, cz - 4.6, 19, 2.4, 2.6, { ry: Math.PI / 2 }); sign(STAT, "ธนาคาร", cx, 9.6, cz - 3.28, 7, 1.2, "#00264D", "#FFD403");
        const vx = cx, vz = cz + 9, VW = 28, VD = 13; bx(STAT, vx, 0.38, vz, VW, 0.3, VD, "#C7CDD3"); AV.push([vx - VW / 2 - 4, vz - VD / 2 - 1, vx + VW / 2 + 1, vz + VD / 2 + 1]);
        bx(STAT, vx, 0.68, vz - VD / 2 + 0.4, VW, 2.4, 0.8, "#8994A0"); bx(STAT, vx - VW / 2 + 0.4, 0.68, vz, 0.8, 2.4, VD, "#8994A0"); bx(STAT, vx + VW / 2 - 0.4, 0.68, vz, 0.8, 2.4, VD, "#8994A0");
        add(STAT, "cyl", "#AEB7C1", vx - VW / 2 - 1.4, 2.6, vz + VD / 2 - 2.6, 3.8, 0.6, 3.8, { rz: Math.PI / 2, ry: 0.6 }); add(STAT, "cyl", "#7D8792", vx - VW / 2 - 1.36, 2.6, vz + VD / 2 - 2.6, 1.1, 0.7, 1.1, { rz: Math.PI / 2, ry: 0.6 });
        const all = fr.length + cards.length; let k = 0;
        fr.forEach((r) => { const s = 1.1 * Math.cbrt((r.val || 0) / 1e6) + 0.45, x = vx - VW / 2 + 3 + (k++ + 0.5) * ((VW - 6) / all), z = vz + 0.5;
          item(r.i, (g) => money(g, x, 0.68, z, s)); label([x, s + 1.6, z], r.own, M(r.val), { lvl: 1, c: r.own === "อื่น ๆ" ? "#8D6E63" : ownCol(r.own), ai: r.i }); });
        cards.forEach((r) => { const x = vx - VW / 2 + 3 + (k++ + 0.5) * ((VW - 6) / all), z = vz + 0.5;
          if (!FAC.card) { const [c, q] = canvas(256, 160); const gr = q.createLinearGradient(0, 0, 256, 160); gr.addColorStop(0, "#E8710A"); gr.addColorStop(1, "#FFC46B"); q.fillStyle = gr; q.fillRect(0, 0, 256, 160);
            q.fillStyle = "#D9B44A"; q.fillRect(24, 52, 40, 30); q.fillStyle = "#FFFFFF"; q.font = "700 22px Sarabun, sans-serif"; q.fillText("•••• " + (r.name.match(/(\d{4})\s*$/) || ["", ""])[1], 24, 120); q.font = "700 18px Sarabun, sans-serif"; q.fillText("CREDIT", 24, 34); FAC.card = new T.MeshLambertMaterial({ map: tex(c) }); }
          item(r.i, (g) => { bx(g, x, 0.68, z, 0.5, 1.2, 0.5, "#5F6B76"); const m = new T.Mesh(new T.BoxGeometry(3.2, 2.0, 0.08), [mat("#E8710A"), mat("#E8710A"), mat("#E8710A"), mat("#E8710A"), FAC.card, mat("#E8710A")]); m.position.set(x, 2.9, z); m.rotation.x = -0.25; m.castShadow = true; g.add(m); }, true);
          label([x, 4.6, z], "เงินชำระเกินในบัตรเครดิต", `${M(r.val)} · ${AST[r.st][0]}`, { lvl: 1, c: "#E8710A", ai: r.i }); });
        label([cx, 13, cz - 12], "เงินในบัญชีที่อายัด", M(fr.reduce((t, r) => t + (r.val || 0), 0)) + (cards.length ? " · บัตรเครดิต" : ""), { ic: "lock", c: "#0E9384", z: "bnk" });
        ZONES.bnk = { lab: "เงินที่อายัด", ic: "lock", c: "#0E9384", t: [vx, 1, vz - 2], r: 40, th: 0.3, ph: 0.9 };
      }
    }
    /* ภาพรวม */
    ZONES.all = { lab: "ภาพรวม", ic: "cube", c: "#00264D", t: [0, 0, (minZ + maxZ) / 2 + 6], r: 0, th: 0.62, ph: 0.88, fit: [(maxX - minX) / 2, (maxZ - minZ) / 2] };
    const ZL = ["all", "s" + sites[0], "s" + sites[1], "doc", "gar", "hou", "lnd", "fnd", "bnk"].filter((k) => ZONES[k]);
    $("#e3z").innerHTML = ZL.map((k) => `<button data-e3z="${k}" class="${k === "all" ? "on" : ""}" style="--c:${ZONES[k].c}">${IC(ZONES[k].ic, 15)}<span>${esc(ZONES[k].lab)}</span></button>`).join("");
    blocks.forEach(([x, z, w, d]) => { for (let t = -w / 2 + 4; t <= w / 2 - 4; t += 11 + rnd() * 3) { if (rnd() < 0.6) tree(x + t, z + d / 2 - 1.2, 0.8 + rnd() * 0.3); if (rnd() < 0.35) tree(x + t, z - d / 2 + 1.2, 0.8 + rnd() * 0.3); } });
    /* bake ฉากคงที่ */
    bake(STAT).forEach((m) => S.add(m));
    const W0 = $("#e3w"); if (W0) W0.remove();

    /* ---------- ขนาด / วาด ---------- */
    function size() { const w = st.clientWidth || 1, h = st.clientHeight || 1; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      const port = cam.aspect < 0.95, pf = port ? Math.min(1.45, 1 / cam.aspect) : 1;
      Object.values(ZONES).forEach((z) => { if (z.th0 == null) { z.th0 = z.th; z.r0 = z.r; } const q = port && z.port ? z.port : null; z.th = q ? q.th : z.th0;
        const f = q ? q.fit : z.fit; z.r = f ? fitR(f[0], f[1]) * (q ? 0.9 : 1.02) : z.r0 * pf; }); LBL.forEach((L) => (L.w = 0)); need = true; }
    const RO = window.ResizeObserver ? new ResizeObserver(size) : null; if (RO) RO.observe(st); else addEventListener("resize", size);
    size(); const Z0 = ZONES.all; Object.assign(C, { tx: Z0.t[0], ty: Z0.t[1], tz: Z0.t[2], r: Z0.r * 1.25, th: Z0.th - 0.5, ph: Z0.ph - 0.2 }); fly("all", 1400);
    R.shadowMap.needsUpdate = true;
    const v3 = new T.Vector3(), tg = new T.Vector3();
    function updLabels() {
      const w = st.clientWidth, h = st.clientHeight, taken = []; tg.set(C.tx, C.ty, C.tz);
      const vis = LBL.map((L) => { v3.copy(L.p).project(cam); let ok = v3.z < 1 && v3.x > -1.15 && v3.x < 1.15 && v3.y > -1.1 && v3.y < 1.25;
        if (L.lvl === 1) ok = ok && C.r < 270; if (L.lvl === 2) ok = ok && C.r < 62 && L.p.distanceTo(tg) < Math.max(26, C.r * 0.95); if (L.lvl === 0) ok = ok && C.r > 26;
        return { L, x: ((v3.x + 1) / 2) * w, y: ((1 - v3.y) / 2) * h, d: L.p.distanceTo(cam.position), ok }; });
      vis.sort((a, b) => a.L.lvl - b.L.lvl || a.d - b.d);
      for (const o of vis) { const L = o.L;
        if (!o.ok) { if (L.on) { L.el.style.display = "none"; L.on = false; } continue; }
        if (!L.w) { L.el.style.display = "block"; L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; L.el.style.display = L.on ? "block" : "none"; }
        const r = [o.x - L.w / 2 - 2, o.y - L.h - 2, o.x + L.w / 2 + 2, o.y - (L.lvl === 2 ? 0 : 14)];
        if (taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1])) { if (L.on) { L.el.style.display = "none"; L.on = false; } continue; }
        taken.push(r); if (!L.on) { L.el.style.display = "block"; L.on = true; } L.el.style.transform = `translate(${o.x.toFixed(1)}px,${o.y.toFixed(1)}px) translate(-50%,-100%)`; }
    }
    function loop(t) {
      if (!alive) return; raf = requestAnimationFrame(loop); if (!cv.isConnected) return kill();
      if (TW) { const k = Math.min(1, (t - TW.t0) / TW.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; for (const q of ["tx", "ty", "tz", "r", "th", "ph"]) C[q] = TW.a[q] + (TW.b[q] - TW.a[q]) * e; if (k >= 1) TW = null; need = true; }
      else if (!PT.size && (Math.abs(vth) > 1e-4 || Math.abs(vph) > 1e-4)) { C.th += vth; C.ph = clamp(C.ph + vph, 0.15, 1.38); vth *= 0.9; vph *= 0.85; need = true; }
      if (need) { need = false; camUpd(); R.render(S, cam); updLabels(); }
    }
    raf = requestAnimationFrame(loop);
    /* ---------- สัมผัส / เมาส์ ---------- */
    const PT = new Map(); let g0 = null, moved = 0, tDown = 0;
    const gest = () => { const a = [...PT.values()]; return a.length < 2 ? null : { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }; };
    function pan(dx, dy) { const wpp = (2 * C.r * Math.tan((cam.fov * Math.PI) / 360)) / (st.clientHeight || 1), f = Math.max(0.3, Math.cos(C.ph)), s = Math.sin(C.th), c = Math.cos(C.th);
      C.tx = clamp(C.tx + (-dx * c - (dy * s) / f) * wpp, BND[0], BND[1]); C.tz = clamp(C.tz + (dx * s - (dy * c) / f) * wpp, BND[2], BND[3]); }
    cv.addEventListener("pointerdown", (e) => { try { cv.setPointerCapture(e.pointerId); } catch (_) { } PT.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button }); TW = null; vth = vph = 0; if (PT.size === 1) { moved = 0; tDown = performance.now(); } g0 = gest(); });
    cv.addEventListener("pointermove", (e) => { const p = PT.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (PT.size === 1) { if (p.b === 2 || e.shiftKey) pan(dx, dy); else { vth = -dx * 0.0065; vph = -dy * 0.0045; C.th += vth; C.ph = clamp(C.ph + vph, 0.15, 1.38); } }
      else if (PT.size === 2) { const g = gest(); if (g0 && g) { C.r = clamp((C.r * g0.d) / g.d, 6, 1200); pan(g.x - g0.x, g.y - g0.y); } g0 = g; }
      need = true; });
    const up = (e) => { if (!PT.has(e.pointerId)) return; PT.delete(e.pointerId); g0 = gest(); if (!PT.size) { if (moved < 8 && performance.now() - tDown < 600) tap(e); else host._noclick = Date.now(); } };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", (e) => { e.preventDefault(); C.r = clamp(C.r * Math.exp(e.deltaY * 0.0012), 6, 1200); TW = null; need = true; }, { passive: false });
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    const RC = new T.Raycaster(), ndc = new T.Vector2();
    let ring = null;
    function tap(e) { const b = cv.getBoundingClientRect(); ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); RC.setFromCamera(ndc, cam);
      const hit = RC.intersectObjects(PICK, false).find((h) => h.object.material !== DIM) || RC.intersectObjects(PICK, false)[0]; if (hit) pick(hit.object.userData.ai, hit.object.userData.rep); else { const p = $("#a3p"); if (p) p.hidden = true; if (ring) ring.visible = false; need = true; } }
    function pick(ai, rep) {
      const r = AR[ai], L = REP.get(ai); if (!r || !L) return; const gi = rep != null && L[rep] ? rep : 0, grp = L[gi];
      a3dPop(r); const p = $("#a3p"); if (p && L.length > 1) p.insertAdjacentHTML("beforeend", `<button class="chip" data-e3go="${ai}" data-rep="${gi}" style="margin:6px 0 0 6px">${IC("route", 14)} ${gi ? "ดูตำแหน่งในแผนที่" : "ดูในห้องเอกสาร"}</button>`);
      const bb = new T.Box3().setFromObject(grp), c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3());
      if (!ring) { const rg = new T.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2); ring = new T.Mesh(rg, mat("#FFD403", { emissive: 0x806a00 })); ring.castShadow = false; S.add(ring); }
      const rr = Math.max(sz.x, sz.z) * 0.62 + 0.35; ring.scale.set(rr, 1, rr); ring.position.set(c.x, bb.min.y + 0.06, c.z); ring.visible = true;
      fly({ t: [c.x, c.y, c.z], r: clamp(sz.length() * 4, 9, 80), th: C.th, ph: Math.min(C.ph, 1.05) }, 750);
    }
    function alt(ai) { const L = REP.get(ai); if (!L || L.length < 2) return; const btn = $("#a3p [data-e3go]"), cur = btn ? +btn.dataset.rep : 0; pick(ai, (cur + 1) % L.length); }
    function dim() {
      const ids = new Set(ASH.map((r) => r.i)), any = ASH.length !== AR.length;
      PICK.forEach((m) => { const want = any && !ids.has(m.userData.ai) ? DIM : m.userData.m0; if (m.material !== want) m.material = want; }); need = true;
      const cat = ASF.cats.size === 1 ? [...ASF.cats][0] : "", CZ = { house: "hou", land: "lnd", car: "gar", bag: "s" + sites[0], scarf: "s" + sites[0], lux: "s" + (sites[1] || sites[0]), cash: "bnk", card: "bnk", ins: "doc", fund: "doc", oth: "doc" };
      if (cat !== lastCat) { lastCat = cat; if (cat && ZONES[CZ[cat]]) fly(CZ[cat]); }
    }
    function zoom(f) { TW = null; const r0 = C.r; TW = { t0: performance.now(), ms: 380, a: { ...C }, b: { ...C, r: clamp(r0 * f, 6, 1200) } }; need = true; }
    function kill() {
      if (!alive) return; alive = false; cancelAnimationFrame(raf); if (RO) RO.disconnect(); else removeEventListener("resize", size);
      S.traverse((o) => { if (o.isMesh && !GS.has(o.geometry)) o.geometry.dispose(); }); GS.forEach((g) => g.dispose());
      MC.forEach((m) => m.dispose()); Object.values(FAC).forEach((m) => m.dispose && m.dispose()); TEX.forEach((t) => t.dispose()); DIM.dispose();
      R.dispose(); if (R.forceContextLoss) R.forceContextLoss(); if (E && E.kill === kill) E = null;
    }
    return { kill, size, dim, fly, zoom, alt };
  }
})();
