"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, OrbitControls, Sparkles } from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ───────────── helpers ───────────── */
const rng = (s: number) => () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const dir = (th: number, ph: number) => V(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
const orient = (d: THREE.Vector3, roll: number) =>
  new THREE.Quaternion().setFromUnitVectors(UP, d).multiply(new THREE.Quaternion().setFromAxisAngle(UP, roll));

// μετατρέπει σε non-indexed, εφαρμόζει matrix και (προαιρετικά) βάφει με vertex color
const prep = (g: THREE.BufferGeometry, m: THREE.Matrix4, c?: THREE.Color) => {
  const x = g.index ? g.toNonIndexed() : g.clone();
  x.deleteAttribute("uv");
  x.applyMatrix4(m);
  if (c) {
    const n = x.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    x.setAttribute("color", new THREE.BufferAttribute(a, 3));
  }
  return x;
};
const merge = (a: THREE.BufferGeometry[]) => mergeGeometries(a, false)!;

/* ───────────── πέταλο: κυρτό, με βολάν στην άκρη και διαβάθμιση χρώματος ───────────── */
function petal(cup: number, curl: number, c0: THREE.Color, c1: THREE.Color, tone: number) {
  const g = new THREE.PlaneGeometry(1, 1, 6, 8);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2;
    const v = p.getY(i) + 0.5;
    const w = Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.pow(v, 0.7))));
    const z = -cup * u * u * w + Math.sin(u * 7 + v * 5) * 0.03 * v * v + curl * v * v;
    p.setXYZ(i, u * w * 0.5, v, z);
    const t = Math.min(1, THREE.MathUtils.smoothstep(v, 0, 1) * 0.85 + Math.abs(u) * 0.15 * v);
    c.copy(c0).lerp(c1, t).multiplyScalar(tone);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/* ───────────── άνθος με στρώσεις πετάλων (παιώνια / ρανούγκουλο) ───────────── */
type Opts = { layers: number; base: number; grow: number; len: number; wid: number; cup: number; open: number; c0: string; c1: string; seed: number };

function flower(o: Opts) {
  const r = rng(o.seed), parts: THREE.BufferGeometry[] = [], m = new THREE.Matrix4();
  const a = new THREE.Color(o.c0), b = new THREE.Color(o.c1);
  for (let L = 0; L < o.layers; L++) {
    const t = o.layers > 1 ? L / (o.layers - 1) : 1;
    const n = Math.round(o.base + L * o.grow);
    for (let i = 0; i < n; i++) {
      const az = (i / n) * Math.PI * 2 + L * 0.9 + r() * 0.3;
      const tilt = 0.05 + Math.pow(t, 1.2) * o.open + r() * 0.14;
      const len = o.len * (0.4 + 0.6 * t) * (0.9 + r() * 0.2);
      const wid = o.wid * (0.55 + 0.45 * t) * (0.9 + r() * 0.2);
      const rad = 0.03 + t * 0.06;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, az, (r() - 0.5) * 0.3, "YXZ"));
      m.compose(V(Math.sin(az) * rad, -t * 0.06, Math.cos(az) * rad), q, V(wid, len, wid));
      parts.push(prep(petal(o.cup * (1.2 - 0.5 * t), 0.15 + 0.5 * t, a, b, 0.75 + 0.3 * t + r() * 0.1), m));
    }
  }
  return merge(parts);
}

const PEONY = { layers: 9, base: 5, grow: 2, len: 0.5, wid: 0.5, cup: 0.55, open: 1.15 };
const RANUN = { layers: 8, base: 5, grow: 1, len: 0.24, wid: 0.22, cup: 0.7, open: 0.85 };

/* ───────────── ορτανσία: μπάλα από μικρά 4-πέταλα λουλουδάκια ───────────── */
function hydrangea(seed: number, c0: string, c1: string) {
  const r = rng(seed), m = new THREE.Matrix4(), parts: THREE.BufferGeometry[] = [];
  const fl = [1, 2, 3].map((k) => flower({ layers: 1, base: 4, grow: 0, len: 0.17, wid: 0.2, cup: 0.4, open: 1.2, c0, c1, seed: seed * 10 + k }));
  for (let i = 0; i < 95; i++) {
    const d = dir(Math.acos(1 - r() * 0.95), r() * 6.283);
    m.compose(d.clone().multiplyScalar(0.4), orient(d, r() * 6.283), V(1, 1, 1).multiplyScalar(0.75 + r() * 0.5));
    parts.push(prep(fl[i % 3], m));
  }
  return merge(parts);
}

/* ───────────── λεβάντα ───────────── */
function lavender() {
  const r = rng(3), m = new THREE.Matrix4(), parts: THREE.BufferGeometry[] = [], c = new THREE.Color();
  parts.push(prep(new THREE.CylinderGeometry(0.006, 0.01, 0.9, 5).translate(0, 0.45, 0), m, new THREE.Color("#5d8a68")));
  for (let i = 0; i < 40; i++) {
    const f = i / 40, az = i * 2.4;
    c.set(i % 3 ? "#8b5cf6" : "#c4b5fd").offsetHSL(0, 0, (r() - 0.5) * 0.08);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6, az, 0, "YXZ"));
    m.compose(V(Math.sin(az) * 0.03 * (1 - f * 0.6), 0.42 + f * 0.45, Math.cos(az) * 0.03 * (1 - f * 0.6)), q, V(0.026, 0.055 * (1 - f * 0.4), 0.026));
    parts.push(prep(new THREE.IcosahedronGeometry(1, 0), m, c));
  }
  return merge(parts);
}

/* ───────────── κλαδί ευκαλύπτου ───────────── */
function eucalyptus() {
  const r = rng(9), m = new THREE.Matrix4(), parts: THREE.BufferGeometry[] = [], c = new THREE.Color();
  const leaf = new THREE.CircleGeometry(1, 14).translate(0, 1, 0);
  parts.push(prep(new THREE.CylinderGeometry(0.006, 0.012, 1, 5).translate(0, 0.5, 0), m, new THREE.Color("#6f8f78")));
  for (let i = 0; i < 18; i++) {
    const h = 0.08 + (i / 18) * 0.92, az = i * 2.4 + r(), sz = 0.1 * (1.2 - h * 0.6);
    c.set("#a5cbb7").lerp(new THREE.Color("#6e9f88"), r() * 0.6);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6 + r() * 0.5, az, (r() - 0.5) * 0.6, "YXZ"));
    m.compose(V(0, h, 0), q, V(sz, sz * 1.05, 1));
    parts.push(prep(leaf, m, c));
  }
  return merge(parts);
}

/* ───────────── όλο το μπουκέτο ───────────── */
type Item = { kind: number; d: THREE.Vector3; p: THREE.Vector3; q: THREE.Quaternion; s: number; delay: number };

function build() {
  const heads = [
    flower({ ...PEONY, c0: "#c2185b", c1: "#ffc4dd", seed: 1 }), // ροζ
    flower({ ...PEONY, c0: "#86114f", c1: "#f26cb0", seed: 2 }), // φούξια
    flower({ ...PEONY, c0: "#b565e6", c1: "#fff0fa", seed: 3 }), // λιλά-λευκή
    flower({ ...PEONY, c0: "#5b21b6", c1: "#d3b4ff", seed: 4 }), // μωβ
    flower({ ...RANUN, c0: "#701a75", c1: "#f0a6ff", seed: 5 }), // ρανούγκουλο
    hydrangea(6, "#7c3aed", "#e0ccff"),
    hydrangea(7, "#db2777", "#ffd0e6"),
  ];
  const kinds = [0, 1, 2, 3, 0, 5, 1, 4, 2, 0, 6, 4, 3, 1, 5, 4, 0, 2, 4, 3];
  const C = V(0, -0.9, 0), B = V(0, -2.45, 0), R = 2;
  const r = rng(42), m = new THREE.Matrix4(), parts: THREE.BufferGeometry[] = [];

  const items: Item[] = kinds.map((kind, k) => {
    const cosT = 1 - ((k + 0.5) / kinds.length) * (1 - Math.cos(1.13));
    const d = dir(Math.acos(cosT), k * 2.39996);
    const s = (kind < 4 ? 0.85 : kind === 4 ? 1 : 1.05) * (0.9 + r() * 0.25);
    return { kind, d, p: C.clone().addScaledVector(d, R), q: orient(d, r() * 6.283), s, delay: 0.3 + k * 0.16 };
  });

  // μίσχοι
  items.forEach((it) => {
    const curve = new THREE.CatmullRomCurve3([it.p.clone().addScaledVector(it.d, -0.08), C.clone().addScaledVector(it.d, R * 0.4), C.clone().lerp(B, 0.55), B]);
    const green = new THREE.Color().setHSL(0.36 + r() * 0.04, 0.38, 0.26 + r() * 0.08);
    parts.push(prep(new THREE.TubeGeometry(curve, 24, 0.024, 6, false), new THREE.Matrix4(), green));
  });

  // πράσινα: ευκάλυπτος, λεβάντα, μεγάλα φύλλα
  const euc = eucalyptus(), lav = lavender();
  const leaf = prep(petal(0.3, 0.55, new THREE.Color("#1f5f43"), new THREE.Color("#6fbf8c"), 1), new THREE.Matrix4().makeScale(0.3, 0.75, 0.4));
  for (let i = 0; i < 36; i++) {
    const t = i % 4;
    const th = t === 2 ? 0.15 + r() * 0.75 : 0.5 + r() * 1.0;
    const d = dir(th, i * 2.39996 + 0.7);
    const s = t === 2 ? 1.8 : t === 3 ? 1.15 : 1.5;
    const off = t === 2 ? 1.4 : t === 3 ? 1.7 : 1.2;
    m.compose(C.clone().addScaledVector(d, off), orient(d, r() * 6.283), V(s, s, s));
    parts.push(prep([euc, euc, lav, leaf][t], m));
  }

  // γυψόφιλα (μικρά λευκά-ροζ κουκκιδάκια)
  const ico = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 160; i++) {
    const d = dir(Math.acos(1 - r() * (1 - Math.cos(1.3))), r() * 6.283);
    m.compose(C.clone().addScaledVector(d, 2.1 + r() * 0.45), new THREE.Quaternion(), V(1, 1, 1).multiplyScalar(0.022 + r() * 0.016));
    parts.push(prep(ico, m, new THREE.Color(r() < 0.7 ? "#fff5fb" : "#f5d0fe")));
  }

  return {
    heads,
    items,
    greens: merge(parts),
    petalMat: new THREE.MeshPhysicalMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.5, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color("#ffd1ea") }),
    greenMat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }),
  };
}

/* ───────────── components ───────────── */
function Head({ it, geo, mat }: { it: Item; geo: THREE.BufferGeometry; mat: THREE.Material }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = THREE.MathUtils.clamp((clock.elapsedTime - it.delay) / 1.8, 0, 1);
    const x = t - 1;
    const e = 1 + 2.70158 * x ** 3 + 1.70158 * x ** 2; // easeOutBack: ανθίζει με μικρό "ξεπέταγμα"
    ref.current.scale.setScalar(Math.max(e, 0.0001) * it.s);
  });
  return (
    <group ref={ref} position={it.p} quaternion={it.q} scale={0.0001}>
      <mesh geometry={geo} material={mat} />
    </group>
  );
}

function Wrap() {
  const geo = useMemo(() => {
    const cyl = new THREE.CylinderGeometry(1.55, 0.2, 2.1, 72, 20, true);
    const p = cyl.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), w = (y + 1.05) / 2.1;
      const k = 1 + w * (0.07 * Math.sin(a * 6) + 0.035 * Math.sin(a * 11 + 1));
      p.setXYZ(i, x * k, y, z * k);
    }
    cyl.computeVertexNormals();
    return cyl;
  }, []);
  const rb = <meshPhysicalMaterial color="#e11d74" roughness={0.3} sheen={1} sheenColor="#ff9ccf" clearcoat={0.6} />;
  return (
    <group position={[0, -1.5, 0]}>
      <mesh geometry={geo}>
        <meshPhysicalMaterial color="#f1e4ff" roughness={0.7} sheen={1} sheenColor="#ffffff" />
      </mesh>
      <mesh geometry={geo} scale={0.985}>
        <meshStandardMaterial color="#ff8fc4" side={THREE.BackSide} roughness={0.8} />
      </mesh>
      <group position={[0, -0.5, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 2.6]}>
          <torusGeometry args={[0.585, 0.045, 14, 72]} />
          {rb}
        </mesh>
        <group position={[0, 0, 0.62]}>
          <mesh position={[-0.2, 0.02, 0]} rotation={[0, 0, 0.35]} scale={[1.5, 1, 0.6]}>
            <torusGeometry args={[0.15, 0.04, 12, 32]} />
            {rb}
          </mesh>
          <mesh position={[0.2, 0.02, 0]} rotation={[0, 0, -0.35]} scale={[1.5, 1, 0.6]}>
            <torusGeometry args={[0.15, 0.04, 12, 32]} />
            {rb}
          </mesh>
          <mesh>
            <sphereGeometry args={[0.07, 16, 16]} />
            {rb}
          </mesh>
          <mesh position={[-0.07, -0.27, 0]} rotation={[0, 0, 0.22]}>
            <boxGeometry args={[0.09, 0.5, 0.015]} />
            {rb}
          </mesh>
          <mesh position={[0.07, -0.27, 0]} rotation={[0, 0, -0.22]}>
            <boxGeometry args={[0.09, 0.5, 0.015]} />
            {rb}
          </mesh>
        </group>
      </group>
    </group>
  );
}

// πέταλα που πέφτουν αργά γύρω από το μπουκέτο
function Petals({ n = 70 }: { n?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const o = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => {
    const w = new THREE.Color("#ffffff");
    const g = petal(0.35, 0.4, w, w, 1);
    g.scale(0.2, 0.2, 0.2);
    return g;
  }, []);
  const P = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: n }, () => ({ x: (r() - 0.5) * 8, z: (r() - 0.5) * 6 - 0.5, sp: 0.25 + r() * 0.35, o: r() * 9, ph: r() * 6.28, sc: 0.6 + r() * 0.8, sx: 0.5 + r() * 1.5 }));
  }, [n]);
  useEffect(() => {
    const pal = ["#ff8cc6", "#ffc2e0", "#c084fc", "#f0abfc", "#fff1f8"].map((c) => new THREE.Color(c));
    P.forEach((_, i) => ref.current.setColorAt(i, pal[i % pal.length]));
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [P]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    P.forEach((p, i) => {
      o.position.set(p.x + Math.sin(t * 0.6 + p.ph) * 0.6, 4 - ((t * p.sp + p.o) % 9), p.z + Math.cos(t * 0.5 + p.ph) * 0.5);
      o.rotation.set(t * p.sx + p.ph, t * 0.7 * p.sx, t * 0.5 + p.ph);
      o.scale.setScalar(p.sc);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, n]} frustumCulled={false}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.5} />
    </instancedMesh>
  );
}

// απόσταση κάμερας: το μπουκέτο χωράει πάντα στο πλάτος της οθόνης (iPhone portrait / landscape)
function Rig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.fov = 40;
    const fit = 5 / 2 / (Math.tan(THREE.MathUtils.degToRad(c.fov / 2)) * (size.width / size.height));
    c.position.setLength(Math.max(9.5, fit));
    c.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, size.width]);
  return null;
}

export default function Bouquet() {
  const d = useMemo(build, []);
  const touch = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);
  return (
    <Canvas camera={{ position: [0, 0.8, 9], fov: 40 }} dpr={[1, touch ? 1.75 : 2]} gl={{ powerPreference: "high-performance" }}>
      <Rig />
      <ambientLight intensity={0.6} color="#ffd9f0" />
      <directionalLight position={[4, 6, 5]} intensity={2.4} color="#fff1f7" />
      <pointLight position={[-5, 2, -3]} intensity={90} color="#a855f7" />
      <pointLight position={[4, -1, 3]} intensity={40} color="#ff7ab8" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} color="#ffd0e8" position={[0, 5, 4]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={2} color="#b78bff" position={[-6, 1, -2]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="ring" intensity={1.5} color="#ffffff" position={[5, 2, 1]} scale={4} />
      </Environment>

      <Float speed={1.4} rotationIntensity={0.12} floatIntensity={0.35}>
        <group position={[0, 0.6, 0]}>
          {d.items.map((it, i) => (
            <Head key={i} it={it} geo={d.heads[it.kind]} mat={d.petalMat} />
          ))}
          <mesh geometry={d.greens} material={d.greenMat} />
          <Wrap />
        </group>
      </Float>

      <Petals n={touch ? 40 : 70} />
      <Sparkles count={touch ? 40 : 70} scale={[9, 7, 6]} size={4} speed={0.4} color="#ffc2e6" />
      <Sparkles count={touch ? 24 : 40} scale={[8, 6, 5]} size={3} speed={0.3} color="#c9a4ff" />
      {!touch && <ContactShadows position={[0, -2.7, 0]} opacity={0.4} scale={10} blur={2.6} far={4} color="#2a0645" />}
      <OrbitControls enablePan={false} enableDamping autoRotate autoRotateSpeed={0.9} minDistance={5} maxDistance={24} minPolarAngle={0.6} maxPolarAngle={1.8} />
    </Canvas>
  );
}