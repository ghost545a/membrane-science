// Shared setup for the two three.js scenes: renderer sized to its stage,
// orbit controls, HTML labels pinned to 3D points, and a render loop that
// only runs while the stage is on screen.
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

export const T = window.I18N || {};
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dark = matchMedia("(prefers-color-scheme: dark)");

export function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) { return false; }
}

export function createStage(el, { fov = 35, position = [0, 4, 12], target = [0, 0, 0], minDist = 4, maxDist = 30, zoom = true, autoRotate = false } = {}) {
  const hint = el.querySelector(".stage-hint");
  if (hint) hint.textContent = T.hint || "";
  if (!webglOK()) {
    const f = document.createElement("div");
    f.className = "fallback";
    f.textContent = T.noWebGL || "WebGL is not available.";
    el.appendChild(f);
    return null;
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  el.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  camera.position.set(...position);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = minDist;
  controls.maxDistance = maxDist;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.enablePan = false;
  controls.enableZoom = zoom;
  controls.autoRotate = autoRotate && !reduceMotion;
  controls.autoRotateSpeed = 0.5;
  const baseOffset = camera.position.clone().sub(controls.target);

  // Soft studio light: sky/ground fill plus one key light with shadows.
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8b8c0, 1.4);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(5, 10, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -12; key.shadow.camera.right = 12;
  key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
  key.shadow.bias = -0.0005;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe3ff, 0.8);
  rim.position.set(-6, 4, -6);
  scene.add(rim);

  // Labels
  const layer = el.querySelector(".labels");
  const labels = [];
  const v = new THREE.Vector3();
  function addLabel(text, getPos, cls = "") {
    const d = document.createElement("div");
    d.className = "label3d " + cls;
    d.textContent = text;
    layer.appendChild(d);
    const l = { el: d, getPos, visible: true };
    labels.push(l);
    return l;
  }

  let w = 0, h = 0;
  function resize() {
    const r = el.getBoundingClientRect();
    if (r.width === w && r.height === h) return;
    w = r.width; h = r.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Narrow stages (phones): pull the camera back so the whole scene stays in frame.
    const k = Math.min(Math.max(Math.pow((16 / 9) / camera.aspect, 0.7), 1), 2.2);
    camera.position.copy(controls.target).addScaledVector(baseOffset, k);
    controls.maxDistance = Math.max(maxDist, baseOffset.length() * k * 1.15);
  }
  new ResizeObserver(resize).observe(el);
  resize();

  function placeLabels() {
    for (const l of labels) {
      l.getPos(v);
      v.project(camera);
      const show = l.visible && v.z < 1;
      l.el.style.display = show ? "" : "none";
      if (show) l.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    }
  }

  // Run only while visible.
  let onScreen = false, raf = 0, last = performance.now();
  const ticks = [];
  function loop(now) {
    raf = 0;
    if (!onScreen) return;
    // wall-clock step for timelines; never negative (the first frame after the
    // stage scrolls into view can carry a timestamp slightly before `last`)
    const raw = Math.min(Math.max((now - last) / 1000, 0), 0.5);
    const dt = Math.min(raw, 0.05);                 // capped step for motion
    last = now;
    for (const f of ticks) f(dt, now / 1000, raw);
    controls.update();
    renderer.render(scene, camera);
    placeLabels();
    raf = requestAnimationFrame(loop);
  }
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }, { rootMargin: "100px" }).observe(el);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const applyTheme = () => { ground.material.opacity = dark.matches ? 0.5 : 0.18; hemi.groundColor.set(dark.matches ? 0x303036 : 0xb8b8c0); };
  dark.addEventListener("change", applyTheme);
  applyTheme();

  return { THREE, renderer, scene, camera, controls, addLabel, labels, onTick: (f) => ticks.push(f), ground, el, isDark: () => dark.matches };
}

// Materials used by both scenes.
export function glass(THREE, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transmission: 0.0, transparent: true, opacity: 0.14,
    roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    side: THREE.DoubleSide, depthWrite: false, ...opts,
  });
}

export function setPressed(btn, on) { btn.setAttribute("aria-pressed", on ? "true" : "false"); }
