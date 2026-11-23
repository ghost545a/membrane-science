// The 2025–26 experiment as a 3D two-compartment diffusion cell.
// 0–10 s replays the measured 180 min; 10–20 s is a hypothetical Fickian
// run to equilibrium with the measured D. Cl⁻ crosses; Na⁺ (the co-ion) is
// mostly turned back. Idealised to show the project's goal: only 1 Na⁺ is
// drawn crossing per 5 Cl⁻ (in the real cell they cross in equal numbers).
import { createStage, glass, T, reduceMotion } from "./stage.js";

// Two copies: the full experiment in section 3, and a looping "ambient" one
// in the hero (no controls, slow auto-rotate, no wheel zoom).
function mount(el, ambient) {
  if (!el) return;
  const S = createStage(el, ambient
    ? { position: [1.9, 4.8, 13.2], target: [0, 2.1, 0], minDist: 8, maxDist: 24, zoom: false, autoRotate: true }
    : { position: [1.8, 6.0, 16.5], target: [0, 2.0, 0], minDist: 6, maxDist: 26 });
  if (S) build(S, el, ambient);
}

// ---------------- Measured data (poster table) ----------------
const DATA = [ // t (min), receiver µS/cm, receiver mmol/L, feed µS/cm
  [0, 0, 0, 9880], [30, 26, 0.265, 9880], [60, 26, 0.265, 9710], [90, 40.5, 0.413, 9710],
  [120, 42.6, 0.435, 9700], [150, 58, 0.592, 9700], [180, 60, 0.612, 9690],
];
const LAMBDA = 98;                    // S·cm²/mol, Kohlrausch, NaCl ≈20 °C
const D = 2.4e-11, A = 5.31e-4, DELTA = 75e-6, V = 300e-6; // SI
const K = 2 * D * A / (DELTA * V);    // 1/s, equal volumes → ΔC decays as e^(−Kt)
const CR0 = 0.612, CF0 = 9690 / LAMBDA;
const CTOT = CR0 + CF0, CEQ = CTOT / 2;
const PHASE = 10, END = 20, DAYS_B = 60;

function interp(tMin, col) {
  for (let i = 1; i < DATA.length; i++) {
    if (tMin <= DATA[i][0]) {
      const a = DATA[i - 1], b = DATA[i], f = (tMin - a[0]) / (b[0] - a[0]);
      return a[col] + (b[col] - a[col]) * f;
    }
  }
  return DATA[DATA.length - 1][col];
}
function stateAt(t) {
  if (t <= PHASE) {
    const m = (t / PHASE) * 180;
    const cr = interp(m, 2), cf = interp(m, 3) / LAMBDA;
    return { hypo: false, label: `${Math.round(m)} ${T.min || "min"}`, x: m, cr, cf, condR: interp(m, 1), condF: interp(m, 3) };
  }
  const days = ((t - PHASE) / (END - PHASE)) * DAYS_B;
  const cr = CEQ - (CEQ - CR0) * Math.exp(-K * days * 86400);
  const cf = CTOT - cr;
  return { hypo: true, label: `${days.toFixed(1)} ${T.days || "days"}`, x: days, cr, cf, condR: cr * LAMBDA, condF: cf * LAMBDA };
}
// Spheres shown in the receiver: magnified at low concentration, exact at equilibrium.
const N = 240;
const NA_PER_CL = 1 / 5; // idealised: Na⁺ drawn crossing per Cl⁻
const shownFrac = (cr) => (50 * (1 - Math.exp(-cr / 2.5))) / 100;

mount(document.getElementById("hero-stage"), true);
mount(document.getElementById("cell-stage"), false);

function build(S, el, ambient) {
  const { THREE, scene, addLabel, onTick } = S;

  // ---------------- Glassware ----------------
  const BX = 3.3;               // bottle centre offset
  const R = 1.6, ARM_Y = 1.25, ARM_R = 0.42;
  const prof = [
    [0.0, 0], [R - 0.25, 0], [R, 0.25], [R, 3.0], [R - 0.15, 3.35], [0.95, 3.85], [0.72, 4.05], [0.72, 4.65],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glassMat = glass(THREE);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xc8262b, roughness: 0.45 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, metalness: 0.85, roughness: 0.28 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.7 });
  const feedLiquid = new THREE.MeshPhysicalMaterial({ color: 0xe6edf2, transparent: true, opacity: 0.22, roughness: 0.15, depthWrite: false });
  const recvLiquid = new THREE.MeshPhysicalMaterial({ color: 0x8ccbf2, transparent: true, opacity: 0.26, roughness: 0.15, depthWrite: false });

  const bottles = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.position.x = side * BX;
    scene.add(g);
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), glassMat);
    body.renderOrder = 2;
    g.add(body);
    // liquid up to 3.0 (≈300 mL in the model's scale)
    const lprof = [[0, 0.06], [R - 0.3, 0.06], [R - 0.06, 0.28], [R - 0.06, 2.95], [0, 2.95]].map(([x, y]) => new THREE.Vector2(x, y));
    const liquid = new THREE.Mesh(new THREE.LatheGeometry(lprof, 64), side < 0 ? feedLiquid : recvLiquid);
    liquid.renderOrder = 1;
    g.add(liquid);
    // main cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.62, 40), capMat);
    cap.position.y = 4.88; cap.castShadow = true;
    g.add(cap);
    const capRing = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 40), capMat);
    capRing.position.y = 4.6;
    g.add(capRing);
    // side sample port, angled outward
    const port = new THREE.Group();
    port.position.set(side * 1.15, 3.35, 0);
    port.rotation.z = -side * 0.75;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.0, 24, 1, true), glassMat);
    tube.position.y = 0.4;
    port.add(tube);
    const pcap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.38, 24), capMat);
    pcap.position.y = 1.05; pcap.castShadow = true;
    port.add(pcap);
    g.add(port);
    // horizontal arm to the clamp
    const armLen = BX - R - 0.14 + 0.15;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(ARM_R, ARM_R, armLen, 32, 1, true), glassMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-side * (R - 0.15 + armLen / 2), ARM_Y, 0);
    g.add(arm);
    const armLiquid = new THREE.Mesh(new THREE.CylinderGeometry(ARM_R - 0.05, ARM_R - 0.05, armLen, 24), side < 0 ? feedLiquid : recvLiquid);
    armLiquid.rotation.z = Math.PI / 2;
    armLiquid.position.copy(arm.position);
    g.add(armLiquid);
    // flange at the membrane end
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.14, 40), glassMat);
    flange.rotation.z = Math.PI / 2;
    flange.position.set(-side * (BX - 0.2), ARM_Y, 0);
    g.add(flange);
    // stirrer bar
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.75, 6, 12), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.3 }));
    bar.rotation.z = Math.PI / 2;
    const barPivot = new THREE.Group();
    barPivot.position.y = 0.17;
    barPivot.add(bar);
    g.add(barPivot);
    bottles.push({ g, barPivot, port });
  }

  // ---------------- Membrane + clamp ----------------
  const membraneMat = new THREE.MeshStandardMaterial({ color: 0xb8742a, roughness: 0.6, emissive: 0x000000 });
  const membrane = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.05, 48), membraneMat);
  membrane.rotation.z = Math.PI / 2;
  membrane.position.set(0, ARM_Y, 0);
  scene.add(membrane);
  for (const s of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 12, 40), rubber);
    o.rotation.y = Math.PI / 2;
    o.position.set(s * 0.08, ARM_Y, 0);
    scene.add(o);
  }
  const clamp = new THREE.Group();
  clamp.position.set(0, ARM_Y, 0);
  for (const s of [-1, 1]) {
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.3, 1.7), metal);
    jaw.position.set(s * 0.36, 0.25, 0);
    jaw.castShadow = true;
    clamp.add(jaw);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 1.7), metal);
  bridge.position.y = 1.42;
  clamp.add(bridge);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 12), metal);
  screw.rotation.z = Math.PI / 2;
  screw.position.set(0, 1.15, 0);
  clamp.add(screw);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 16), metal);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(-0.62, 1.15, 0);
  clamp.add(knob);
  scene.add(clamp);
  // the jaws need a hole for the arm to look right: hide the jaw centre with a ring of glass flange already drawn

  // ---------------- Labels ----------------
  // The hero copy shows no labels at all; the full one in section 3 does.
  if (!ambient) addLabel(T.feed || "Feed", (v) => v.set(-BX, 5.45, 0));
  if (!ambient) addLabel(T.receiver || "Receiver", (v) => v.set(BX, 5.45, 0));
  if (!ambient) addLabel(T.membrane || "Membrane", (v) => v.set(0, ARM_Y + 1.75, 0));
  if (!ambient) {
    addLabel(T.port || "Sample port", (v) => bottles[1].port.localToWorld(v.set(0, 1.35, 0)), "small");
    addLabel(T.stirrer || "Stirrer", (v) => v.set(-BX + 0.9, 0.35, 1.2), "small");
  }

  // ---------------- Ions ----------------
  const sphere = new THREE.SphereGeometry(0.075, 14, 10);
  const clMesh = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: 0x22b45f, roughness: 0.35, emissive: 0x0a3a1c }), N);
  const naMesh = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: 0x9b4fc4, roughness: 0.35, emissive: 0x2a0c3a }), N);
  clMesh.frustumCulled = naMesh.frustumCulled = false;
  scene.add(clMesh, naMesh);

  const rnd = (a, b) => a + Math.random() * (b - a);
  function randomIn(side, p) {
    const r = 1.28 * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
    p.set(side * BX + Math.cos(a) * r, rnd(0.4, 2.8), Math.sin(a) * r);
    return p;
  }
  function makeIons() {
    return Array.from({ length: N }, () => ({ p: randomIn(-1, new THREE.Vector3()), v: new THREE.Vector3(), side: -1, mode: 0, path: null, seg: 0, f: 0 }));
  }
  const cl = makeIons(), na = makeIons();

  // Paths through the arms and the membrane.
  const MX = 0.0, armIn = BX - R + 0.1;
  function pathAcross(from, toSide) {
    const s = -toSide; // origin side
    const dest = randomIn(toSide, new THREE.Vector3());
    const yz = () => new THREE.Vector3(0, ARM_Y + rnd(-0.22, 0.22), rnd(-0.22, 0.22));
    const a = yz(); a.x = s * armIn;
    const b = yz(); b.x = s * 0.06;
    const c = yz(); c.x = -s * 0.06;
    const d = yz(); d.x = -s * armIn;
    return [from.clone(), a, b, c, d, dest];
  }
  function pathBounce(from) {
    const a = new THREE.Vector3(-armIn, ARM_Y + rnd(-0.22, 0.22), rnd(-0.22, 0.22));
    const b = new THREE.Vector3(-0.1, a.y + rnd(-0.1, 0.1), a.z);
    const c = new THREE.Vector3(-0.55, a.y + rnd(-0.25, 0.25), a.z + rnd(-0.2, 0.2));
    return [from.clone(), a, b, c, a.clone().setX(-armIn - 0.1), randomIn(-1, new THREE.Vector3())];
  }

  // Flash rings where Na⁺ is turned back.
  const flashes = [];
  const flashGeo = new THREE.RingGeometry(0.06, 0.13, 24);
  function flash(at) {
    const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xc07ae6, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.position.copy(at); m.position.x = -0.04;
    m.rotation.y = Math.PI / 2;
    scene.add(m);
    flashes.push({ m, life: 0 });
  }
  let membraneGlow = 0;

  // ---------------- Timeline + UI ----------------
  const $ = (id) => (ambient ? null : document.getElementById(id));
  const playBtn = $("cell-play");
  const replayBtn = $("cell-replay");
  const scrub = $("cell-scrub");
  const out = $("cell-time");
  const phaseTag = el.querySelector(".phase-tag");
  const chartK = $("cell-chart-k");

  let t = 0, playing = false, started = false, hold = 0;
  const setPlay = (p) => { playing = p; if (playBtn) playBtn.textContent = p ? (T.pause || "Pause") : (T.play || "Play"); };
  if (!ambient) {
    document.querySelectorAll("#project [data-k]").forEach((n) => { n.textContent = T[n.dataset.k] || n.textContent; });
    replayBtn.textContent = T.replay || "Replay";
    playBtn.addEventListener("click", () => { started = true; if (t >= END) restart(); setPlay(!playing); });
    replayBtn.addEventListener("click", () => { started = true; restart(); setPlay(true); });
    scrub.addEventListener("input", () => { started = true; t = (scrub.value / 1000) * END; sync(true); });
  }
  setPlay(false);
  function restart() {
    t = 0;
    for (const i of cl) { i.side = -1; i.mode = 0; randomIn(-1, i.p); }
    for (const i of na) { i.side = -1; i.mode = 0; randomIn(-1, i.p); }
  }
  // Autoplay once the experiment scrolls into view.
  new IntersectionObserver(([e], o) => {
    if (e.isIntersecting && !started) { started = true; o.disconnect(); if (!reduceMotion) setPlay(true); }
  }, { threshold: ambient ? 0.2 : 0.5 }).observe(el);

  // ---------------- Readouts + chart ----------------
  const r = ambient ? {} : { cond: document.getElementById("r-cond"), conc: document.getElementById("r-conc"), s: document.getElementById("r-s"), eta: document.getElementById("r-eta"), feed: document.getElementById("r-feed") };
  const fmtCond = (x) => (x >= 1000 ? `${(x / 1000).toFixed(2)} <small>mS/cm</small>` : `${x.toFixed(1)} <small>µS/cm</small>`);
  const fmtConc = (x) => (x >= 10 ? `${x.toFixed(1)}` : `${x.toFixed(3)}`) + " <small>mmol/L</small>";
  const canvas = $("cell-chart");
  const ctx = canvas && canvas.getContext("2d");
  let lastHypo = null;

  function drawChart(st) {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue("--text-2").trim(), line = cs.getPropertyValue("--hairline").trim();
    const clc = cs.getPropertyValue("--cl").trim(), warn = cs.getPropertyValue("--warn").trim();
    const L = 40, Rr = 10, Tp = 8, B = 24, pw = w - L - Rr, ph = h - Tp - B;
    const xmax = st.hypo ? DAYS_B : 180, ymax = st.hypo ? 50 : 0.7;
    const X = (x) => L + (x / xmax) * pw, Y = (y) => Tp + ph - (y / ymax) * ph;
    ctx.font = "11px -apple-system, Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = ink; ctx.strokeStyle = line; ctx.lineWidth = 1;
    const yt = st.hypo ? [0, 10, 20, 30, 40, 50] : [0, 0.2, 0.4, 0.6];
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const y of yt) { ctx.beginPath(); ctx.moveTo(L, Y(y)); ctx.lineTo(L + pw, Y(y)); ctx.stroke(); ctx.fillText(String(y), L - 6, Y(y)); }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    const xt = st.hypo ? [0, 10, 20, 30, 40, 50, 60] : [0, 30, 60, 90, 120, 150, 180];
    for (const x of xt) ctx.fillText(String(x), X(x), Tp + ph + 6);
    ctx.lineWidth = 2.2; ctx.strokeStyle = st.hypo ? warn : clc;
    if (st.hypo) ctx.setLineDash([5, 4]);
    ctx.beginPath();
    const n = 80;
    for (let i = 0; i <= n; i++) {
      const x = (st.x * i) / n;
      const y = st.hypo ? CEQ - (CEQ - CR0) * Math.exp(-K * x * 86400) : interp(x, 2);
      i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y));
    }
    ctx.stroke(); ctx.setLineDash([]);
    if (!st.hypo) {
      ctx.fillStyle = clc;
      for (const d of DATA) if (d[0] <= st.x + 0.01) { ctx.beginPath(); ctx.arc(X(d[0]), Y(d[2]), 3.5, 0, 7); ctx.fill(); }
    } else {
      ctx.strokeStyle = ink; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, Y(CEQ)); ctx.lineTo(L + pw, Y(CEQ)); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function updateHud() {
    const st = stateAt(t);
    if (ambient) {
      if (phaseTag && st.hypo !== lastHypo) {
        lastHypo = st.hypo;
        phaseTag.textContent = st.hypo ? T.phaseB || "Hypothetical" : T.phaseA || "Real data";
        phaseTag.classList.toggle("hypo", st.hypo);
      }
      return st;
    }
    out.textContent = st.label;
    scrub.value = String(Math.round((t / END) * 1000));
    r.cond.innerHTML = fmtCond(st.condR);
    r.conc.innerHTML = fmtConc(st.cr);
    r.s.innerHTML = st.cr > 0 ? `${((1 - st.cr / st.cf) * 100).toFixed(2)} <small>%</small>` : "–";
    r.eta.innerHTML = `${((st.cr / st.cf) * 100).toFixed(2)} <small>%</small>`;
    r.feed.innerHTML = fmtCond(st.condF);
    if (st.hypo !== lastHypo) {
      lastHypo = st.hypo;
      phaseTag.textContent = st.hypo ? T.phaseB || "Hypothetical" : T.phaseA || "Real data";
      phaseTag.classList.toggle("hypo", st.hypo);
      chartK.textContent = st.hypo ? T.chartB || "" : T.chartA || "";
    }
    drawChart(st);
    return st;
  }

  // Keep the number of ions in (or heading to) the receiver equal to the target.
  // Na⁺ is limited to NA_PER_CL of the Cl⁻ count: an idealised picture of the
  // goal (a strongly co-ion-excluding membrane), explained on the page.
  function fill(list, target, instant) {
    let have = list.filter((i) => i.side === 1 || i.mode === 1).length;
    if (have > target) {
      for (const i of list) {
        if (have <= target) break;
        if (i.side === 1 || i.mode === 1) { i.side = -1; i.mode = 0; i.onSeg = null; randomIn(-1, i.p); have--; }
      }
    }
    if (have < target) {
      const gap = target - have;
      const pool = list.filter((i) => i.side === -1 && i.mode === 0);
      for (let k = 0; k < gap && k < pool.length; k++) {
        const i = pool[k];
        if (instant || gap > 25) { i.side = 1; i.mode = 0; randomIn(1, i.p); }
        else { i.mode = 1; i.path = pathAcross(i.p, 1); i.seg = 0; i.f = 0; }
      }
    }
  }
  function sync(instant) {
    const target = Math.round(shownFrac(stateAt(t).cr) * N);
    if (instant) for (const i of na) if (i.mode === 2) { i.mode = 0; i.onSeg = null; randomIn(-1, i.p); }
    fill(cl, target, instant);
    fill(na, Math.round(target * NA_PER_CL), instant);
    updateHud();
  }

  // ---------------- Motion ----------------
  const tmp = new THREE.Vector3(), M = new THREE.Matrix4();
  function followPath(i, dt, speed) {
    let left = speed * dt;
    while (left > 0 && i.seg < i.path.length - 1) {
      const a = i.path[i.seg], b = i.path[i.seg + 1];
      const len = a.distanceTo(b) || 1e-6;
      const step = Math.min(left, (1 - i.f) * len);
      i.f += step / len; left -= step;
      i.p.lerpVectors(a, b, i.f);
      if (i.f >= 1 - 1e-6) { i.seg++; i.f = 0; if (i.onSeg) i.onSeg(i.seg); }
    }
    return i.seg >= i.path.length - 1;
  }
  function wander(i, dt, swirl) {
    const cx = i.side * BX;
    i.v.x += rnd(-1, 1) * dt * 3; i.v.y += rnd(-1, 1) * dt * 3; i.v.z += rnd(-1, 1) * dt * 3;
    i.v.multiplyScalar(0.96);
    // stirring: tangential drift around the bottle axis
    const dx = i.p.x - cx, dz = i.p.z;
    i.p.x += (i.v.x - dz * swirl) * dt;
    i.p.z += (i.v.z + dx * swirl) * dt;
    i.p.y += i.v.y * dt;
    const rr = Math.hypot(i.p.x - cx, i.p.z);
    if (rr > 1.3) { const k = 1.3 / rr; i.p.x = cx + (i.p.x - cx) * k; i.p.z *= k; i.v.x *= -0.5; i.v.z *= -0.5; }
    if (i.p.y < 0.38) { i.p.y = 0.38; i.v.y = Math.abs(i.v.y); }
    if (i.p.y > 2.85) { i.p.y = 2.85; i.v.y = -Math.abs(i.v.y); }
  }

  let probeClock = 0;
  onTick((dt, _now, raw) => {
    const running = playing && t < END;
    if (running) {
      t = Math.min(END, t + raw);
      if (t >= END && !ambient) setPlay(false);
      sync(false);
    }
    // The hero copy loops: hold the equilibrium for a moment, then start again.
    if (ambient && playing && t >= END) {
      hold += raw;
      if (hold > 2.5) { hold = 0; restart(); sync(true); }
    }
    const swirl = reduceMotion ? 0.15 : 0.6;
    for (const b of bottles) b.barPivot.rotation.y += dt * (reduceMotion ? 1 : 9);

    // Send a few Na⁺ to the membrane to be turned back.
    probeClock -= dt;
    if (running && probeClock <= 0) {
      probeClock = 0.22;
      const i = na[(Math.random() * N) | 0];
      if (i.mode === 0 && i.side === -1) {
        i.mode = 2; i.path = pathBounce(i.p); i.seg = 0; i.f = 0;
        i.onSeg = (s) => { if (s === 2) flash(i.p); };
      }
    }
    for (const i of cl) {
      if (i.mode === 1) {
        if (followPath(i, dt, 3.2)) { i.mode = 0; i.side = 1; }
        else if (i.seg === 2) membraneGlow = 1;
      } else wander(i, dt, swirl);
    }
    for (const i of na) {
      if (i.mode === 2) { if (followPath(i, dt, 3.2)) { i.mode = 0; i.onSeg = null; } }
      else if (i.mode === 1) { if (followPath(i, dt, 2.6)) { i.mode = 0; i.side = 1; } }
      else wander(i, dt, swirl);
    }
    cl.forEach((i, k) => clMesh.setMatrixAt(k, M.makeTranslation(i.p.x, i.p.y, i.p.z)));
    na.forEach((i, k) => naMesh.setMatrixAt(k, M.makeTranslation(i.p.x, i.p.y, i.p.z)));
    clMesh.instanceMatrix.needsUpdate = naMesh.instanceMatrix.needsUpdate = true;

    for (let k = flashes.length - 1; k >= 0; k--) {
      const f = flashes[k];
      f.life += dt;
      f.m.scale.setScalar(1 + f.life * 4);
      f.m.material.opacity = Math.max(0, 0.9 - f.life * 2.2);
      if (f.life > 0.45) { scene.remove(f.m); f.m.material.dispose(); flashes.splice(k, 1); }
    }
    membraneGlow = Math.max(0, membraneGlow - dt * 3);
    membraneMat.emissive.setRGB(0.12 * membraneGlow, 0.35 * membraneGlow, 0.15 * membraneGlow);
  });

  sync(true);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", updateHud);
  window.addEventListener("resize", updateHud);
}
