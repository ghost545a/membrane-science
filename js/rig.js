// 2026–27 concept: a bench-scale RED trial rig. Two feed tanks, peristaltic
// pumps, cartridge filters, a 10-cell-pair stack (explodable), electrode
// rinse loop, outlet tank, and a load with a multimeter.
import { createStage, glass, T, reduceMotion, setPressed } from "./stage.js";

const el = document.getElementById("rig-stage");
const S = el && createStage(el, { position: [-2.5, 9.5, 17.5], target: [0.2, 0.4, 0], minDist: 6, maxDist: 32 });
if (S) build();

function build() {
  const { THREE, scene, camera, addLabel, labels, onTick, ground } = S;
  const tips = T.tips || {};
  const hoverables = [];
  const tag = (m, key) => { m.userData.tip = key; hoverables.push(m); return m; };

  ground.position.y = -3.2;
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });

  // ---------------- Bench ----------------
  const top = new THREE.Mesh(new THREE.BoxGeometry(16, 0.25, 7.5), std(0x3a3d44, { roughness: 0.8 }));
  top.position.y = -0.125; top.receiveShadow = true;
  scene.add(top);
  for (const x of [-7.5, 7.5]) for (const z of [-3.4, 3.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), std(0x9aa0a8, { metalness: 0.6, roughness: 0.4 }));
    leg.position.set(x, -1.75, z); leg.castShadow = true;
    scene.add(leg);
  }

  // ---------------- Tanks ----------------
  function tank(x, z, r, h, liquidColor, key) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const shell = tag(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40, 1, true), glass(THREE, { opacity: 0.25 })), key);
    shell.position.y = h / 2; shell.renderOrder = 2;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.06, 40), std(0xdfe3e8));
    base.position.y = 0.03;
    const liq = tag(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r * 0.96, h * 0.72, 40), new THREE.MeshPhysicalMaterial({ color: liquidColor, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false })), key);
    liq.position.y = h * 0.36 + 0.06; liq.renderOrder = 1;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.08, 40), std(0x2c2f35));
    lid.position.y = h;
    g.add(shell, base, liq, lid);
    scene.add(g);
    return g;
  }
  tank(-6, -1.6, 1.0, 2.6, 0xbfe6ff, "river");
  tank(-6, 1.6, 1.0, 2.6, 0x2f7fc4, "sea");
  tank(5.8, -1.9, 0.9, 1.9, 0x79b6de, "outlet");
  tank(-0.9, -2.7, 0.45, 1.0, 0xe2b25a, "rinse");

  // ---------------- Pumps ----------------
  const rotors = [];
  function pump(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const body = tag(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.9), std(0xe9eaec, { roughness: 0.35 })), "pump");
    body.position.y = 0.45; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 32), std(0x2c2f35));
    head.rotation.x = Math.PI / 2; head.position.set(0, 0.5, 0.5);
    const rotor = new THREE.Group();
    rotor.position.set(0, 0.5, 0.6);
    for (let k = 0; k < 3; k++) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12), std(0xc0c4ca, { metalness: 0.7, roughness: 0.3 }));
      roller.rotation.x = Math.PI / 2;
      const a = (k / 3) * Math.PI * 2;
      roller.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0);
      rotor.add(roller);
    }
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.16), new THREE.MeshBasicMaterial({ color: 0x46d17a }));
    screen.position.set(0.3, 0.75, 0.456);
    g.add(body, head, rotor, screen);
    scene.add(g);
    rotors.push(rotor);
  }
  pump(-3.7, -1.6);
  pump(-3.7, 1.6);

  // ---------------- Filters ----------------
  function filter(x, z) {
    const f = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.3, 24), new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.8, roughness: 0.4 })), "filter");
    f.position.set(x, 0.65, z); f.castShadow = true;
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 24), std(0x2f6fb5));
    capT.position.set(x, 1.36, z);
    scene.add(f, capT);
  }
  filter(-2.2, -1.6);
  filter(-2.2, 1.6);

  // ---------------- RED stack ----------------
  const NP = 10, SX = 1.0, SY = 1.25, SIZE = 1.8;
  const stack = new THREE.Group();
  stack.position.set(SX, SY, 0);
  scene.add(stack);
  const cemMat = new THREE.MeshStandardMaterial({ color: 0x5b8fd6, transparent: true, opacity: 0.55, roughness: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const aemMat = new THREE.MeshStandardMaterial({ color: 0xd08a2e, transparent: true, opacity: 0.55, roughness: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const spacerMat = new THREE.MeshBasicMaterial({ color: 0x9aa0a8, wireframe: true, transparent: true, opacity: 0.25 });
  const plateMat = glass(THREE, { opacity: 0.3, color: 0xe8f2ff });
  const membranes = [], spacers = [];
  const memGeo = new THREE.BoxGeometry(0.03, SIZE, SIZE);
  const spGeo = new THREE.PlaneGeometry(SIZE * 0.92, SIZE * 0.92, 8, 8);
  for (let k = 0; k < NP * 2; k++) {
    const isCEM = k % 2 === 0;
    const m = tag(new THREE.Mesh(memGeo, isCEM ? cemMat : aemMat), isCEM ? "cem" : "aem");
    m.renderOrder = 3;
    stack.add(m);
    membranes.push(m);
    if (k < NP * 2 - 1) {
      const sp = new THREE.Mesh(spGeo, spacerMat);
      sp.rotation.y = Math.PI / 2;
      stack.add(sp);
      spacers.push(sp);
    }
  }
  const plates = [], electrodes = [];
  for (const s of [-1, 1]) {
    const p = tag(new THREE.Mesh(new THREE.BoxGeometry(0.4, SIZE + 0.5, SIZE + 0.5), plateMat), "stack");
    p.renderOrder = 4; p.castShadow = true;
    stack.add(p); plates.push(p);
    const e = tag(new THREE.Mesh(new THREE.BoxGeometry(0.04, SIZE * 0.8, SIZE * 0.8), std(0x8d8f94, { metalness: 0.9, roughness: 0.25 })), "rinse");
    stack.add(e); electrodes.push(e);
  }
  const rods = [];
  for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12), std(0xb9bcc2, { metalness: 0.85, roughness: 0.3 }));
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, y * (SIZE / 2 + 0.12), z * (SIZE / 2 + 0.12));
    stack.add(rod); rods.push(rod);
  }
  // Feet so the stack sits on the bench.
  const foot = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.2), std(0x2c2f35));
  foot.position.set(SX, 0.06, 0);
  scene.add(foot);

  let gap = 0.13, gapTarget = 0.13;
  function layoutStack() {
    const n = membranes.length;
    const L = (n - 1) * gap;
    membranes.forEach((m, k) => { m.position.x = -L / 2 + k * gap; });
    spacers.forEach((s, k) => { s.position.x = -L / 2 + (k + 0.5) * gap; });
    const ex = (gap - 0.13) * 3;
    electrodes.forEach((e, k) => { e.position.x = (k ? 1 : -1) * (L / 2 + 0.16 + ex * 0.5); });
    plates.forEach((p, k) => { p.position.x = (k ? 1 : -1) * (L / 2 + 0.38 + ex); });
    rods.forEach((r) => { r.scale.y = L + 1.2 + ex * 2; });
    return L;
  }
  let stackL = layoutStack();

  // ---------------- Load + multimeter ----------------
  const meter = new THREE.Group();
  meter.position.set(4.6, 0, 1.7);
  meter.rotation.y = -0.5;
  const mBody = tag(new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 0.35), std(0xf2c230, { roughness: 0.5 })), "load");
  mBody.position.y = 0.75; mBody.castShadow = true;
  const sc = document.createElement("canvas");
  sc.width = 256; sc.height = 112;
  const sctx = sc.getContext("2d");
  const screenTex = new THREE.CanvasTexture(sc);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const mScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.35), new THREE.MeshBasicMaterial({ map: screenTex }));
  mScreen.position.set(0, 1.12, 0.18);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 24), std(0x2c2f35));
  dial.rotation.x = Math.PI / 2; dial.position.set(0, 0.6, 0.2);
  meter.add(mBody, mScreen, dial);
  scene.add(meter);
  const resistor = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16), std(0xd9b38c)), "load");
  resistor.rotation.z = Math.PI / 2;
  resistor.position.set(3.6, 0.15, 2.4);
  scene.add(resistor);

  // ---------------- Tubing + flow ----------------
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const tubes = [];
  function tube(points, color, n = 14, r = 0.06) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => V3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, r, 8), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.2, depthWrite: false }));
    scene.add(mesh);
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(r * 0.75, 8, 6), new THREE.MeshBasicMaterial({ color }), n);
    dots.frustumCulled = false;
    scene.add(dots);
    tubes.push({ curve, dots, n, off: Math.random() });
  }
  const zIn = 0.6;
  // river → pump → filter → stack (dilute compartments)
  tube([[-5.2, 0.3, -1.6], [-4.4, 0.3, -1.6], [-3.7, 0.5, -1.0], [-2.9, 0.25, -1.6], [-2.2, 1.45, -1.6], [-1.2, 1.6, -1.2], [SX - 1.1, 0.5, -zIn]], 0x58b8f0);
  // sea → pump → filter → stack (concentrate compartments)
  tube([[-5.2, 0.3, 1.6], [-4.4, 0.3, 1.6], [-3.7, 0.5, 1.0], [-2.9, 0.25, 1.6], [-2.2, 1.45, 1.6], [-1.2, 1.6, 1.2], [SX - 1.1, 0.5, zIn]], 0x1f5fa8);
  // stack outlets → outlet tank
  tube([[SX + 0.6, 2.35, -0.5], [SX + 1.6, 2.7, -1.0], [4.6, 2.2, -1.8], [5.6, 2.0, -1.9]], 0x79b6de);
  tube([[SX + 0.6, 2.35, 0.5], [SX + 2.2, 2.9, 0.0], [4.9, 2.4, -1.4], [5.9, 2.0, -1.7]], 0x79b6de);
  // electrode rinse loop
  tube([[-0.6, 0.9, -2.5], [-0.5, 1.1, -1.6], [SX - 1.6, 1.3, -0.6]], 0xe2b25a, 8, 0.045);
  tube([[SX + 1.6, 1.3, -0.6], [2.3, 1.1, -2.3], [0.6, 0.95, -3.1], [-0.6, 0.9, -2.95]], 0xe2b25a, 8, 0.045);

  // Wires: electrodes → multimeter, with electrons.
  const wires = [];
  function wire(points) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => V3(...p)));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.03, 6), std(0xc0392b)));
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd60a }), 10);
    dots.frustumCulled = false;
    scene.add(dots);
    wires.push({ curve, dots, n: 10, off: 0 });
  }
  wire([[SX - 1.5, 2.35, 0], [SX - 1.0, 3.3, 0.6], [3.2, 3.0, 1.6], [4.35, 1.6, 1.85]]);
  wire([[SX + 1.5, 2.35, 0], [SX + 2.2, 3.0, 0.8], [4.0, 2.4, 1.9], [4.75, 1.6, 1.65]]);

  // ---------------- Ions inside the stack ----------------
  const NI = 70;
  const ionGeo = new THREE.SphereGeometry(0.05, 10, 8);
  const naI = new THREE.InstancedMesh(ionGeo, new THREE.MeshBasicMaterial({ color: 0xa55fd0 }), NI);
  const clI = new THREE.InstancedMesh(ionGeo, new THREE.MeshBasicMaterial({ color: 0x2bc46a }), NI);
  naI.frustumCulled = clI.frustumCulled = false;
  stack.add(naI, clI);
  const ions = (sign) => Array.from({ length: NI }, () => ({ x: Math.random(), y: (Math.random() - 0.5) * SIZE * 0.85, z: (Math.random() - 0.5) * SIZE * 0.85, s: 0.15 + Math.random() * 0.15, sign }));
  const naList = ions(1), clList = ions(-1);

  // ---------------- Labels ----------------
  const lab = (k, x, y, z) => addLabel(T[k] || k, (v) => v.set(x, y, z));
  lab("river", -6, 3.0, -1.6); lab("sea", -6, 3.0, 1.6); lab("pump", -3.7, 1.25, -1.6);
  lab("filter", -2.2, 1.8, 1.6); lab("stack", SX, 2.9, 0); lab("rinse", -0.9, 1.35, -2.7);
  lab("load", 4.6, 1.95, 1.7); lab("outlet", 5.8, 2.3, -1.9);

  // ---------------- Controls ----------------
  const bExplode = document.getElementById("rig-explode");
  const bIons = document.getElementById("rig-ions");
  const bPumps = document.getElementById("rig-pumps");
  const bLabels = document.getElementById("rig-labels");
  bExplode.textContent = T.explode || bExplode.textContent;
  bIons.textContent = T.ions || bIons.textContent;
  bPumps.textContent = T.pumps || bPumps.textContent;
  bLabels.textContent = T.labels || bLabels.textContent;
  let exploded = false, showIons = true, pumpsOn = true, showLabels = true;
  bExplode.onclick = () => { exploded = !exploded; gapTarget = exploded ? 0.23 : 0.13; setPressed(bExplode, exploded); };
  bIons.onclick = () => { showIons = !showIons; naI.visible = clI.visible = showIons; setPressed(bIons, showIons); };
  bPumps.onclick = () => { pumpsOn = !pumpsOn; setPressed(bPumps, pumpsOn); };
  bLabels.onclick = () => { showLabels = !showLabels; labels.forEach((l) => (l.visible = showLabels)); setPressed(bLabels, showLabels); };

  // ---------------- Hover tooltips ----------------
  const tip = document.createElement("div");
  tip.className = "tip"; tip.hidden = true;
  el.appendChild(tip);
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  S.renderer.domElement.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(hoverables, false)[0];
    const key = hit && hit.object.userData.tip;
    if (!key || !tips[key]) { tip.hidden = true; return; }
    const title = key === "cem" ? "CEM" : key === "aem" ? "AEM" : T[key] || key;
    tip.innerHTML = `<b>${title}</b>${tips[key]}`;
    tip.hidden = false;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    tip.style.left = Math.min(x + 14, r.width - 270) + "px";
    tip.style.top = Math.min(y + 14, r.height - 110) + "px";
  });
  S.renderer.domElement.addEventListener("pointerleave", () => (tip.hidden = true));

  // ---------------- Animation ----------------
  const M = new THREE.Matrix4(), P = new THREE.Vector3();
  let volts = 0.78, flow = 1, lastDraw = 0;
  function drawMeter(v) {
    sctx.fillStyle = "#cfd8c8"; sctx.fillRect(0, 0, 256, 112);
    sctx.fillStyle = "#1d241b";
    sctx.font = "bold 56px ui-monospace, Consolas, monospace";
    sctx.textAlign = "right"; sctx.textBaseline = "middle";
    sctx.fillText(v.toFixed(3), 196, 62);
    sctx.font = "bold 30px ui-monospace, Consolas, monospace";
    sctx.fillText("V", 240, 66);
    sctx.font = "16px ui-monospace, Consolas, monospace";
    sctx.textAlign = "left"; sctx.fillText("DC", 12, 18);
    screenTex.needsUpdate = true;
  }
  drawMeter(volts);

  onTick((dt, now) => {
    const speed = reduceMotion ? 0.3 : 1;
    flow += ((pumpsOn ? 1 : 0) - flow) * Math.min(1, dt * 2.5);
    gap += (gapTarget - gap) * Math.min(1, dt * 5);
    stackL = layoutStack();
    rotors.forEach((r) => (r.rotation.z -= dt * 6 * flow * speed));

    for (const t of tubes) {
      t.off = (t.off + dt * 0.12 * flow * speed) % 1;
      for (let k = 0; k < t.n; k++) {
        t.curve.getPointAt((t.off + k / t.n) % 1, P);
        t.dots.setMatrixAt(k, M.makeTranslation(P.x, P.y, P.z));
      }
      t.dots.instanceMatrix.needsUpdate = true;
      t.dots.visible = flow > 0.05;
    }
    // Voltage: matched-load value with a little noise; decays when the pumps stop.
    const target = 0.78 * flow;
    volts += (target - volts) * Math.min(1, dt * 0.8);
    const shown = Math.max(0, volts + (flow > 0.1 ? (Math.random() - 0.5) * 0.006 : 0));
    if (now - lastDraw > 0.25) { drawMeter(shown); lastDraw = now; }
    const current = volts / 0.78;
    for (const w of wires) {
      w.off = (w.off + dt * 0.25 * current * speed) % 1;
      for (let k = 0; k < w.n; k++) {
        w.curve.getPointAt((w.off + k / w.n) % 1, P);
        w.dots.setMatrixAt(k, M.makeTranslation(P.x, P.y, P.z));
      }
      w.dots.instanceMatrix.needsUpdate = true;
    }
    if (showIons) {
      const half = stackL / 2;
      const move = (list, mesh) => {
        list.forEach((i, k) => {
          i.x += i.sign * dt * i.s * current * speed;
          if (i.x > 1) i.x -= 1;
          if (i.x < 0) i.x += 1;
          mesh.setMatrixAt(k, M.makeTranslation(-half + i.x * stackL, i.y, i.z));
        });
        mesh.instanceMatrix.needsUpdate = true;
      };
      move(naList, naI);
      move(clList, clI);
    }
  });
}
