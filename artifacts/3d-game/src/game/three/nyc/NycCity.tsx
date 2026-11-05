import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  AVENUES, STREETS, LOTS, PARK, WORLD, SIDEWALK, PARKING_LANE, FLOOR_H, GROUND_FLOOR_H, BAY_W,
  PARKED_CARS, INTERSECTIONS, POIS, SUBWAY, CITI_BIKE_DOCK, LANES, PARK_FENCE, signalState, mulberry32,
  type Lot, type Face, type Lane,
} from './layout';
import { GeoBuilder, tintedFacadeMaterial } from './geometry';
import { asphaltTexture, sidewalkTexture, grassTexture, facadeTextures, labelAtlas } from './textures';
/* eslint-disable @typescript-eslint/no-explicit-any */
type ThreeColor = any;
type ThreeGroup = any;
type ThreeInstancedMesh = any;
type ThreeObject3D = any;


const CAR_COLORS = ['#1c1c1e', '#e8e8e6', '#8a8d91', '#2b3d5c', '#6b1e1e', '#c9c4b8', '#24402f', '#3a3a3c', '#5c6770'];

function faceGeom(lot: Lot, face: Face) {
  const hw = lot.w / 2, hd = lot.d / 2;
  switch (face) {
    case 'n': return { x0: lot.x + hw, z0: lot.z - hd, x1: lot.x - hw, z1: lot.z - hd, nx: 0, nz: -1, len: lot.w };
    case 's': return { x0: lot.x - hw, z0: lot.z + hd, x1: lot.x + hw, z1: lot.z + hd, nx: 0, nz: 1, len: lot.w };
    case 'e': return { x0: lot.x + hw, z0: lot.z + hd, x1: lot.x + hw, z1: lot.z - hd, nx: 1, nz: 0, len: lot.d };
    default: return { x0: lot.x - hw, z0: lot.z - hd, x1: lot.x - hw, z1: lot.z + hd, nx: -1, nz: 0, len: lot.d };
  }
}

function useCityGeometry() {
  return useMemo(() => {
    const tex = facadeTextures();
    const styles = ['tenement', 'brownstone', 'prewar', 'modern'] as const;
    const facade: Record<string, GeoBuilder> = { tenement: new GeoBuilder(), brownstone: new GeoBuilder(), prewar: new GeoBuilder(), modern: new GeoBuilder() };
    const shops = new GeoBuilder();
    const solid = new GeoBuilder();
    const signs: { key: string; text: string; bg: string; fg: string }[] = [];
    const signQuads: { key: string; lot: Lot; face: Face }[] = [];

    for (const lot of LOTS) {
      const top = GROUND_FLOOR_H + (lot.floors - 1) * FLOOR_H;
      const b = facade[lot.style];
      for (const face of ['n', 's', 'e', 'w'] as Face[]) {
        const f = faceGeom(lot, face);
        const bays = Math.max(1, Math.round(f.len / BAY_W));
        const isShop = lot.shopFaces.includes(face);
        if (isShop) {
          shops.wall(f.x0, f.z0, f.x1, f.z1, 0, GROUND_FLOOR_H, f.nx, f.nz, '#ffffff', 0, bays, 0, 1);
          solid.box((f.x0 + f.x1) / 2 + f.nx * 0.06, GROUND_FLOOR_H + 0.35, (f.z0 + f.z1) / 2 + f.nz * 0.06, f.nz ? f.len : 0.12, 0.7, f.nz ? 0.12 : f.len, lot.shopColor ?? '#333');
          if (lot.awning) {
            const cx = (f.x0 + f.x1) / 2 + f.nx * 0.8, cz = (f.z0 + f.z1) / 2 + f.nz * 0.8;
            solid.box(cx, GROUND_FLOOR_H - 0.45, cz, f.nz ? f.len * 0.9 : 1.5, 0.12, f.nz ? 1.5 : f.len * 0.9, lot.awning);
          }
          if (lot.shopName && face === lot.front) {
            const key = `${lot.shopName}|${lot.shopColor}`;
            signs.push({ key, text: lot.shopName, bg: lot.shopColor ?? '#333', fg: '#fff7e6' });
            signQuads.push({ key, lot, face });
          }
        } else {
          b.wall(f.x0, f.z0, f.x1, f.z1, 0, GROUND_FLOOR_H, f.nx, f.nz, lot.color, 0, bays, 0, 1);
        }
        b.wall(f.x0, f.z0, f.x1, f.z1, GROUND_FLOOR_H, top, f.nx, f.nz, lot.color, 0, bays, 0, lot.floors - 1);
        // fire escape on the street face
        if (lot.fireEscape && face === lot.front && lot.floors > 2) {
          const cx = (f.x0 + f.x1) / 2 + f.nx * 0.6, cz = (f.z0 + f.z1) / 2 + f.nz * 0.6;
          const span = Math.min(f.len * 0.6, 6);
          for (let fl = 1; fl < lot.floors; fl++) {
            const y = GROUND_FLOOR_H + (fl - 1) * FLOOR_H + 0.05;
            solid.box(cx, y, cz, f.nz ? span : 1.1, 0.08, f.nz ? 1.1 : span, '#1e1f20');
            solid.box(cx + f.nx * 0.5, y + 0.5, cz + f.nz * 0.5, f.nz ? span : 0.05, 0.05, f.nz ? 0.05 : span, '#1e1f20');
          }
        }
      }
      // roof + cornice
      solid.box(lot.x, top + 0.05, lot.z, lot.w, 0.1, lot.d, '#4a4846');
      solid.box(lot.x, top + 0.35, lot.z, lot.w + 0.3, 0.5, lot.d + 0.3, lot.trim);
      if (lot.waterTower) {
        const wx = lot.x + lot.w * 0.15, wz = lot.z + lot.d * 0.1;
        for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) solid.box(wx + dx, top + 1.2, wz + dz, 0.12, 2.2, 0.12, '#2a2622');
        solid.cylinder(wx, top + 3.3, wz, 1.4, 2.4, '#7b5a3e', 10);
        solid.cone(wx, top + 4.5, wz, 1.5, 1.1, '#3e3a35', 10);
      }
    }

    // --- ground: roads, sidewalks, markings ---
    const road = new GeoBuilder();
    const walk = new GeoBuilder();
    const marks = new GeoBuilder();
    for (const a of AVENUES) {
      road.flat(a.x - a.width / 2, WORLD.minZ, a.x + a.width / 2, WORLD.maxZ, 0, '#ffffff', 16);
      for (const s of [-1, 1]) walk.flat(s < 0 ? a.x - a.width / 2 - SIDEWALK : a.x + a.width / 2, WORLD.minZ, s < 0 ? a.x - a.width / 2 : a.x + a.width / 2 + SIDEWALK, WORLD.maxZ, 0.15, '#ffffff', 4);
      const travel = a.width / 2 - PARKING_LANE;
      for (const s of [-1, 1]) marks.flat(a.x + s * travel - 0.06, WORLD.minZ, a.x + s * travel + 0.06, WORLD.maxZ, 0.02, '#e6e3da');
      if (a.flow === 'two-way') {
        marks.flat(a.x - 0.2, WORLD.minZ, a.x - 0.08, WORLD.maxZ, 0.02, '#e3b43a');
        marks.flat(a.x + 0.08, WORLD.minZ, a.x + 0.2, WORLD.maxZ, 0.02, '#e3b43a');
      } else {
        for (let z = WORLD.minZ; z < WORLD.maxZ; z += 6) marks.flat(a.x - 0.07, z, a.x + 0.07, z + 3, 0.02, '#e6e3da');
      }
    }
    for (const s of STREETS) {
      road.flat(s.from, s.z - s.width / 2, s.to, s.z + s.width / 2, 0.005, '#ffffff', 16);
      walk.flat(s.from, s.z - s.width / 2 - SIDEWALK, s.to, s.z - s.width / 2, 0.15, '#ffffff', 4);
      walk.flat(s.from, s.z + s.width / 2, s.to, s.z + s.width / 2 + SIDEWALK, 0.15, '#ffffff', 4);
    }
    // crosswalks
    for (const it of INTERSECTIONS) {
      const a = it.avenue;
      for (const sz of [-1, 1]) {
        const z = it.z + sz * (5.5 + 1.2);
        for (let x = a.x - a.width / 2 + 0.4; x < a.x + a.width / 2 - 0.4; x += 1.1) marks.flat(x, z - 1, x + 0.6, z + 1, 0.025, '#f2f0ea');
      }
      for (const sx of [-1, 1]) {
        const x = a.x + sx * (a.width / 2 + 1.2);
        for (let z = it.z - 5.1; z < it.z + 5.1; z += 1.1) marks.flat(x - 1, z, x + 1, z + 0.6, 0.025, '#f2f0ea');
      }
      // signal poles
      for (const [sx, sz] of [[-1, -1], [1, 1]]) {
        const px = a.x + sx * (a.width / 2 + 0.5), pz = it.z + sz * (5.5 + 0.5);
        solid.cylinder(px, 2.2, pz, 0.08, 4.4, '#2d3a30', 6);
        solid.box(px, 4.1, pz, 0.45, 1.2, 0.45, '#2d3a30');
      }
    }
    // park
    const park = new GeoBuilder();
    park.flat(PARK.minX - SIDEWALK, PARK.minZ - SIDEWALK, PARK.maxX + SIDEWALK, PARK.maxZ + SIDEWALK, 0.15, '#ffffff', 6);
    walk.flat(PARK.minX - SIDEWALK, PARK.minZ - SIDEWALK, PARK.maxX + SIDEWALK, PARK.minZ, 0.16, '#ffffff', 4);
    walk.flat(PARK.minX - SIDEWALK, PARK.maxZ, PARK.maxX + SIDEWALK, PARK.maxZ + SIDEWALK, 0.16, '#ffffff', 4);
    walk.flat(PARK.minX - SIDEWALK, PARK.minZ, PARK.minX, PARK.maxZ, 0.16, '#ffffff', 4);
    walk.flat(PARK.maxX, PARK.minZ, PARK.maxX + SIDEWALK, PARK.maxZ, 0.16, '#ffffff', 4);
    const midX = (PARK.minX + PARK.maxX) / 2, midZ = (PARK.minZ + PARK.maxZ) / 2;
    walk.flat(midX - 1.6, PARK.minZ, midX + 1.6, PARK.maxZ, 0.17, '#d2ccbe', 4);
    walk.flat(PARK.minX, midZ - 1.6, PARK.maxX, midZ + 1.6, 0.17, '#d2ccbe', 4);
    for (const f of PARK_FENCE) solid.box(f.x, 0.6, f.z, Math.max(f.w, 0.06), 1.0, Math.max(f.d, 0.06), '#1d2420');
    // trees (park + street)
    const rand = mulberry32(99);
    const trees: [number, number, number][] = [];
    for (let i = 0; i < 70; i++) {
      const x = PARK.minX + 2 + rand() * (PARK.maxX - PARK.minX - 4);
      const z = PARK.minZ + 2 + rand() * (PARK.maxZ - PARK.minZ - 4);
      if (Math.abs(x - midX) < 3 || Math.abs(z - midZ) < 3) continue;
      trees.push([x, z, 0.9 + rand() * 0.6]);
    }
    for (const s of STREETS) {
      for (let x = s.from + 10; x < s.to - 10; x += 9 + rand() * 6) {
        if (AVENUES.some((a) => Math.abs(a.x - x) < a.width / 2 + 6)) continue;
        if (rand() < 0.45) trees.push([x, s.z + (rand() < 0.5 ? -1 : 1) * (s.width / 2 + 0.9), 0.7 + rand() * 0.3]);
      }
    }
    const foliage = new GeoBuilder();
    for (const [x, z, k] of trees) {
      solid.cylinder(x, 1.4 * k, z, 0.14 * k, 2.8 * k, '#4a3a2c', 5);
      const g = 0.7 + rand() * 0.3;
      foliage.box(x, 3.6 * k, z, 2.6 * k, 2.2 * k, 2.6 * k, [0.25 * g, 0.42 * g, 0.2 * g], rand() * 1.5);
      foliage.box(x, 4.6 * k, z, 1.7 * k, 1.4 * k, 1.7 * k, [0.3 * g, 0.48 * g, 0.24 * g], rand() * 1.5);
    }
    // subway entrance (green globes, railings)
    solid.box(SUBWAY.x, 0.55, SUBWAY.z, SUBWAY.w, 0.9, SUBWAY.d, '#2b5a34');
    solid.box(SUBWAY.x, 0.2, SUBWAY.z, SUBWAY.w - 0.3, 0.4, SUBWAY.d - 0.3, '#1a1a1a');
    for (const dz of [-1, 1]) {
      solid.cylinder(SUBWAY.x + 0.9, 1.4, SUBWAY.z + (dz * SUBWAY.d) / 2, 0.05, 2.4, '#2b5a34', 6);
      solid.box(SUBWAY.x + 0.9, 2.7, SUBWAY.z + (dz * SUBWAY.d) / 2, 0.4, 0.4, 0.4, '#58c36a');
    }
    // Citi Bike dock
    for (let i = 0; i < CITI_BIKE_DOCK.count; i++) {
      const x = CITI_BIKE_DOCK.x + (i - CITI_BIKE_DOCK.count / 2) * 0.9;
      solid.box(x, 0.45, CITI_BIKE_DOCK.z, 0.08, 0.9, 1.7, '#1f62b8');
      solid.box(x, 0.65, CITI_BIKE_DOCK.z + 0.3, 0.06, 0.1, 1.5, '#2a6ad1');
    }
    // fire hydrants & trash cans near corners
    for (const it of INTERSECTIONS) {
      const x = it.avenue.x + it.avenue.width / 2 + 1.5, z = it.z + 5.5 + 1.8;
      solid.cylinder(x, 0.45, z, 0.18, 0.7, '#b22a22', 6);
      solid.cylinder(x - 3, 0.6, z + 0.6, 0.32, 1, '#2f5a3a', 8);
    }
    // parked cars
    const cars = new GeoBuilder();
    for (const c of PARKED_CARS) addCar(cars, c.x, c.z, c.yaw, c.kind, c.color);

    // shop signs atlas
    const atlas = labelAtlas([
      ...signs,
      ...STREETS.map((s) => ({ key: `st:${s.sign}`, text: s.sign, bg: '#1c6b3c', fg: '#ffffff' })),
      ...AVENUES.map((a) => ({ key: `av:${a.sign}`, text: a.sign, bg: '#1c6b3c', fg: '#ffffff' })),
    ], 256, 40);
    const signGeo = new GeoBuilder();
    for (const { key, lot, face } of signQuads) {
      const f = faceGeom(lot, face);
      const r = atlas.rect(key);
      const inset = 0.15;
      const ox = f.nx * inset, oz = f.nz * inset;
      const lx = (f.x1 - f.x0), lz = (f.z1 - f.z0);
      const pad = 0.08;
      signGeo.wall(f.x0 + lx * pad + ox, f.z0 + lz * pad + oz, f.x1 - lx * pad + ox, f.z1 - lz * pad + oz, GROUND_FLOOR_H + 0.05, GROUND_FLOOR_H + 0.65, f.nx, f.nz, '#ffffff', r.u0, r.u1, r.v0, r.v1);
    }
    // street signs at intersections
    for (const it of INTERSECTIONS) {
      const px = it.avenue.x + it.avenue.width / 2 + 0.5, pz = it.z + 5.5 + 0.5;
      const sr = atlas.rect(`st:${it.street.sign}`), ar = atlas.rect(`av:${it.avenue.sign}`);
      for (const n of [1, -1]) {
        signGeo.wall(px - 0.9 * n, pz + 0.04 * n, px + 0.9 * n, pz + 0.04 * n, 3.0, 3.3, 0, n, '#ffffff', sr.u0, sr.u1, sr.v0, sr.v1);
        signGeo.wall(px + 0.04 * n, pz + 0.9 * n, px + 0.04 * n, pz - 0.9 * n, 3.35, 3.65, n, 0, '#ffffff', ar.u0, ar.u1, ar.v0, ar.v1);
      }
    }

    const asphalt = asphaltTexture();
    const sidewalk = sidewalkTexture();
    const grass = grassTexture();
    const out = {
      facades: styles.map((st) => ({ geo: facade[st].build(), mat: tintedFacadeMaterial(tex[st]) })),
      shops: { geo: shops.build(), mat: new THREE.MeshStandardMaterial({ map: tex.storefront, roughness: 0.5, metalness: 0.1, emissive: '#3a2f1c', emissiveIntensity: 0.25 }) },
      solid: { geo: solid.build(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }) },
      foliage: { geo: foliage.build(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }) },
      cars: { geo: cars.build(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.35 }) },
      road: { geo: road.build(), mat: new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 }) },
      walk: { geo: walk.build(), mat: new THREE.MeshStandardMaterial({ map: sidewalk, vertexColors: true, roughness: 0.95 }) },
      park: { geo: park.build(), mat: new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }) },
      marks: { geo: marks.build(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }) },
      signs: { geo: signGeo.build(), mat: new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.6, emissive: '#ffffff', emissiveMap: atlas.texture, emissiveIntensity: 0.15, side: THREE.DoubleSide }) },
    };
    return out;
  }, []);
}

export function addCar(g: GeoBuilder, x: number, z: number, yaw: number, kind: number, colorSeed: number, colorOverride?: string) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx: number, ly: number, lz: number, w: number, h: number, d: number, col: string) =>
    g.box(x + lx * c + lz * s, ly, z - lx * s + lz * c, w, h, d, col, yaw);
  if (kind === 1) {
    // MTA-style bus is handled by traffic; parked kind 1 = box truck
    at(0, 1.5, 0.6, 2.2, 2.6, 4.2, '#e9e6de');
    at(0, 0.9, -2, 2.1, 1.4, 1.6, '#c9c6be');
    at(0, 1.35, -2.75, 1.8, 0.6, 0.05, '#28323a');
  } else if (kind === 2) {
    // NYC yellow cab
    at(0, 0.62, 0, 1.85, 0.7, 4.6, '#f2b705');
    at(0, 1.2, 0.15, 1.6, 0.55, 2.3, '#f2b705');
    at(0, 1.2, 0.15, 1.62, 0.42, 2.0, '#26313a');
    at(0, 1.58, 0.15, 0.7, 0.2, 0.25, '#f5f2e8');
  } else if (kind === 3) {
    // SUV
    at(0, 0.8, 0, 1.95, 0.95, 4.7, colorOverride ?? CAR_COLORS[colorSeed % CAR_COLORS.length]);
    at(0, 1.55, 0.25, 1.85, 0.6, 3.2, '#26313a');
  } else {
    at(0, 0.6, 0, 1.8, 0.65, 4.4, colorOverride ?? CAR_COLORS[colorSeed % CAR_COLORS.length]);
    at(0, 1.15, 0.2, 1.55, 0.5, 2.2, '#26313a');
  }
  for (const wx of [-0.9, 0.9]) for (const wz of [-1.4, 1.4]) at(wx, 0.33, wz, 0.25, 0.62, 0.62, '#151515');
  at(-0.6, 0.65, -2.2, 0.35, 0.18, 0.05, '#f3eedc');
  at(0.6, 0.65, -2.2, 0.35, 0.18, 0.05, '#f3eedc');
  at(-0.6, 0.7, 2.2, 0.35, 0.16, 0.05, '#a3161a');
  at(0.6, 0.7, 2.2, 0.35, 0.16, 0.05, '#a3161a');
}

/** Ambient traffic: cars, cabs and MTA buses that obey signals and queue. */
function Traffic() {
  const mesh = useRef<ThreeInstancedMesh | null>(null);
  const busMesh = useRef<ThreeInstancedMesh | null>(null);
  const cabMesh = useRef<ThreeInstancedMesh | null>(null);
  const agents = useMemo(() => {
    const rand = mulberry32(404);
    const list: { lane: Lane; t: number; speed: number; kind: 0 | 1 | 2; color: ThreeColor }[] = [];
    for (const lane of LANES) {
      const n = lane.avenue ? 7 : 3;
      for (let i = 0; i < n; i++) {
        const r = rand();
        const kind: 0 | 1 | 2 = lane.bus && i === 0 ? 1 : r < 0.3 ? 2 : 0;
        list.push({ lane, t: lane.start + ((lane.end - lane.start) * (i + rand() * 0.6)) / n, speed: 0, kind, color: new THREE.Color(CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]) });
      }
    }
    return list;
  }, []);
  const geos = useMemo(() => {
    const car = new GeoBuilder(); addCar(car, 0, 0, 0, 0, 0, '#ffffff');
    const cab = new GeoBuilder(); addCar(cab, 0, 0, 0, 2, 0);
    const bus = new GeoBuilder();
    bus.box(0, 1.7, 0, 2.55, 2.9, 12, '#ffffff');
    bus.box(0, 2.05, 0, 2.6, 1.0, 11.4, '#26313a');
    bus.box(0, 0.8, 0, 2.6, 0.35, 12.02, '#2a63b0');
    for (const wz of [-4, 4]) for (const wx of [-1.1, 1.1]) bus.box(wx, 0.5, wz, 0.3, 1, 1, '#151515');
    return { car: car.build(), cab: cab.build(), bus: bus.build() };
  }, []);
  const mats = useMemo(() => ({
    car: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.35 }),
    bus: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }),
  }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const counts = useMemo(() => ({
    car: agents.filter((a) => a.kind === 0).length,
    cab: agents.filter((a) => a.kind === 2).length,
    bus: agents.filter((a) => a.kind === 1).length,
  }), [agents]);

  useEffect(() => {
    let i = 0;
    for (const a of agents) if (a.kind === 0) mesh.current?.setColorAt(i++, a.color);
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [agents]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const sig = signalState(state.clock.elapsedTime);
    const byLane = new Map<Lane, typeof agents>();
    for (const a of agents) {
      const l = byLane.get(a.lane) ?? []; l.push(a); byLane.set(a.lane, l);
    }
    for (const [lane, list] of byLane) {
      list.sort((p, q) => (p.t - q.t) * lane.dir);
      const go = lane.axis === 'z' ? sig.ns : sig.ew;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        const len = a.kind === 1 ? 12 : 4.6;
        const max = a.kind === 1 ? 7 : 10;
        let limit = Infinity;
        const ahead = list[i + 1];
        if (ahead) limit = Math.abs(ahead.t - a.t) - (ahead.kind === 1 ? 6 : 2.3) - len / 2 - 2;
        if (go !== 'green') {
          for (const c of lane.crossings) {
            const stopAt = c.at - lane.dir * (c.half + 2.6);
            const dist = (stopAt - a.t) * lane.dir;
            if (dist > -0.5 && dist < limit) limit = dist - len / 2 + 2;
          }
        }
        const target = limit < 1 ? 0 : Math.min(max, limit * 1.2);
        a.speed += (target - a.speed) * Math.min(1, dt * 2.2);
        if (a.speed < 0.05) a.speed = 0;
        a.t += a.speed * lane.dir * dt;
        if (lane.dir > 0 && a.t > lane.end) a.t = lane.start;
        if (lane.dir < 0 && a.t < lane.start) a.t = lane.end;
      }
    }
    let ci = 0, bi = 0, ki = 0;
    for (const a of agents) {
      const L = a.lane;
      const x = L.axis === 'z' ? L.fixed : a.t;
      const z = L.axis === 'z' ? a.t : L.fixed;
      const yaw = L.axis === 'z' ? (L.dir < 0 ? 0 : Math.PI) : L.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      if (a.kind === 0) mesh.current?.setMatrixAt(ci++, dummy.matrix);
      else if (a.kind === 1) busMesh.current?.setMatrixAt(bi++, dummy.matrix);
      else cabMesh.current?.setMatrixAt(ki++, dummy.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    if (busMesh.current) busMesh.current.instanceMatrix.needsUpdate = true;
    if (cabMesh.current) cabMesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[geos.car, mats.car, Math.max(1, counts.car)]} frustumCulled={false} />
      <instancedMesh ref={cabMesh} args={[geos.cab, mats.car, Math.max(1, counts.cab)]} frustumCulled={false} />
      <instancedMesh ref={busMesh} args={[geos.bus, mats.bus, Math.max(1, counts.bus)]} frustumCulled={false} />
    </>
  );
}

/** Lit signal heads showing the live phase. */
function Signals() {
  const ref = useRef<ThreeInstancedMesh | null>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(0.3, 0.3, 0.3), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []);
  const heads = useMemo(() => INTERSECTIONS.flatMap((it) => [[-1, -1], [1, 1]].map(([sx, sz]) => ({ x: it.avenue.x + sx * (it.avenue.width / 2 + 0.5), z: it.z + sz * 6 }))), []);
  const colors = useMemo(() => ({ green: new THREE.Color('#3bd16f'), yellow: new THREE.Color('#ffc928'), red: new THREE.Color('#ff3b30') }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    heads.forEach((h, i) => { dummy.position.set(h.x, 4.1, h.z); dummy.updateMatrix(); ref.current?.setMatrixAt(i, dummy.matrix); });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [heads, dummy]);
  useFrame((state) => {
    const s = signalState(state.clock.elapsedTime).ns;
    heads.forEach((_, i) => ref.current?.setColorAt(i, colors[s]));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, heads.length]} />;
}

/** Floating markers over interactive businesses. */
function PoiMarkers() {
  const group = useRef<ThreeGroup | null>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((c: ThreeObject3D, i: number) => { c.position.y = 3.2 + Math.sin(clock.elapsedTime * 2 + i) * 0.15; c.rotation.y = clock.elapsedTime; });
  });
  return (
    <group>
      {POIS.map((p) => (
        <group key={p.id} position={[p.x, 0, p.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
            <ringGeometry args={[1.1, 1.35, 24]} />
            <meshBasicMaterial color={p.color} transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
      <group ref={group}>
        {POIS.map((p) => (
          <mesh key={p.id} position={[p.x, 3.2, p.z]}>
            <octahedronGeometry args={[0.35, 0]} />
            <meshBasicMaterial color={p.color} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function NycCity() {
  const g = useCityGeometry();
  const parts = [g.road, g.walk, g.park, g.marks, g.shops, g.solid, g.foliage, g.cars, g.signs, ...g.facades];
  return (
    <group>
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WORLD.maxX - WORLD.minX + 200, WORLD.maxZ - WORLD.minZ + 200]} />
        <meshStandardMaterial color="#3d3f41" />
      </mesh>
      {parts.map((p, i) => <mesh key={i} geometry={p.geo} material={p.mat} castShadow={p !== g.road && p !== g.walk && p !== g.park && p !== g.marks && p !== g.signs} receiveShadow />)}
      <Traffic />
      <Signals />
      <PoiMarkers />
    </group>
  );
}
