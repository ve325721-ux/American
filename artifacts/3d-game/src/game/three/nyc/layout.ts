/**
 * East Village / Alphabet City, Manhattan — world layout.
 *
 * World axes: +x = grid east (toward the East River), -z = grid north (uptown).
 * Manhattan's street grid is rotated ~29° from true north; conversion to real
 * latitude/longitude lives in `worldToLatLng`.
 *
 * Avenue and street names, one-way directions and the position of Tompkins
 * Square Park (Avenue A–B, E 7th–E 10th St) follow the real neighborhood.
 * Distances are compressed (≈3.2 m per unit east–west, ≈2 m north–south)
 * so the area stays walkable in a game session.
 */

export type Flow = 'north' | 'south' | 'two-way' | 'east' | 'west';

export interface Avenue {
  name: string;
  sign: string;
  x: number;
  width: number;
  flow: 'north' | 'south' | 'two-way';
  bus?: string;
}

export interface Street {
  name: string;
  sign: string;
  z: number;
  width: number;
  flow: 'east' | 'west';
  from: number;
  to: number;
  traffic: boolean;
}

export const SIDEWALK = 4;
export const PARKING_LANE = 2.4;
export const FLOOR_H = 3.1;
export const GROUND_FLOOR_H = 3.7;
export const BAY_W = 3;

export const WORLD = { minX: -300, maxX: 175, minZ: -235, maxZ: 235 };
export const PLAY = { minX: -205, maxX: 128, minZ: -168, maxZ: 168 };
/** Distance between numbered cross streets. */
export const ST = 40;

export const AVENUES: Avenue[] = [
  { name: '3rd Avenue', sign: '3 Av', x: -180, width: 20, flow: 'north', bus: 'M101' },
  { name: '2nd Avenue', sign: '2 Av', x: -120, width: 18, flow: 'south', bus: 'M15' },
  { name: '1st Avenue', sign: '1 Av', x: -60, width: 18, flow: 'north', bus: 'M15' },
  { name: 'Avenue A', sign: 'Av A', x: 0, width: 14, flow: 'two-way' },
  { name: 'Avenue B', sign: 'Av B', x: 60, width: 14, flow: 'two-way' },
  { name: 'Avenue C', sign: 'Loisaida Av', x: 120, width: 14, flow: 'two-way' },
];

const W = WORLD;
// Manhattan convention: even-numbered streets run east, odd-numbered west.
export const STREETS: Street[] = [
  { name: 'E 12th St', sign: 'E 12 St', z: -4 * ST, width: 11, flow: 'east', from: W.minX, to: W.maxX, traffic: true },
  { name: 'E 11th St', sign: 'E 11 St', z: -3 * ST, width: 11, flow: 'west', from: W.minX, to: W.maxX, traffic: true },
  { name: 'E 10th St', sign: 'E 10 St', z: -2 * ST, width: 11, flow: 'east', from: W.minX, to: W.maxX, traffic: true },
  { name: 'E 9th St', sign: 'E 9 St', z: -ST, width: 11, flow: 'west', from: W.minX, to: 0, traffic: false },
  { name: 'E 9th St', sign: 'E 9 St', z: -ST, width: 11, flow: 'west', from: 60, to: W.maxX, traffic: false },
  { name: 'St Marks Pl', sign: 'St Marks Pl', z: 0, width: 11, flow: 'east', from: W.minX, to: 0, traffic: false },
  { name: 'E 8th St', sign: 'E 8 St', z: 0, width: 11, flow: 'east', from: 60, to: W.maxX, traffic: false },
  { name: 'E 7th St', sign: 'E 7 St', z: ST, width: 11, flow: 'west', from: W.minX, to: W.maxX, traffic: true },
  { name: 'E 6th St', sign: 'E 6 St', z: 2 * ST, width: 11, flow: 'east', from: W.minX, to: W.maxX, traffic: true },
  { name: 'E 5th St', sign: 'E 5 St', z: 3 * ST, width: 11, flow: 'west', from: W.minX, to: W.maxX, traffic: true },
  { name: 'E 4th St', sign: 'E 4 St', z: 4 * ST, width: 11, flow: 'east', from: W.minX, to: W.maxX, traffic: true },
];

/** Tompkins Square Park — between Avenue A and Avenue B, E 7th to E 10th St. */
export const PARK = {
  name: 'Tompkins Square Park',
  minX: 0 + 7 + SIDEWALK,
  maxX: 60 - 7 - SIDEWALK,
  minZ: -2 * ST + 5.5 + SIDEWALK,
  maxZ: ST - 5.5 - SIDEWALK,
};

export interface Box { x: number; z: number; w: number; d: number }

export type Face = 'n' | 's' | 'e' | 'w';
export type BuildingStyle = 'tenement' | 'brownstone' | 'prewar' | 'modern';

export interface Lot {
  id: number;
  x: number;
  z: number;
  w: number;
  d: number;
  floors: number;
  style: BuildingStyle;
  color: string;
  trim: string;
  /** faces with a ground-floor storefront */
  shopFaces: Face[];
  front: Face;
  shopName?: string;
  shopColor?: string;
  awning?: string;
  waterTower: boolean;
  fireEscape: boolean;
  poi?: string;
}

export type PoiId =
  | 'apartment'
  | 'furniture-shop'
  | 'dealership'
  | 'deli'
  | 'laundromat'
  | 'subway'
  | 'pizza'
  | 'job-barista'
  | 'job-courier'
  | 'job-photo-assistant';

export interface Poi {
  id: PoiId;
  name: string;
  prompt: string;
  x: number;
  z: number;
  radius: number;
  mapTag: string;
  color: string;
}

// ---------- helpers ----------

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rand: () => number, list: T[]): T => list[Math.floor(rand() * list.length) % list.length];

export function avenueAt(x: number) {
  return AVENUES.find((a) => Math.abs(a.x - x) < 0.01);
}

export function streetsAtZ(z: number) {
  return STREETS.filter((s) => Math.abs(s.z - z) < 0.01);
}

export function streetCovers(z: number, x: number) {
  return STREETS.some((s) => Math.abs(s.z - z) < 0.01 && x >= s.from - 0.01 && x <= s.to + 0.01);
}

export function inPark(x: number, z: number, pad = 0) {
  return x > PARK.minX - pad && x < PARK.maxX + pad && z > PARK.minZ - pad && z < PARK.maxZ + pad;
}

// ---------- businesses ----------

const SHOP_NAMES: [string, string][] = [
  ['DELI & GROCERY', '#c8312b'],
  ['PIZZA', '#b2302a'],
  ['NAIL SALON', '#c5578a'],
  ['BAGELS', '#c27c2c'],
  ['WINE & LIQUOR', '#6b2a48'],
  ['PHARMACY', '#2c6fb5'],
  ['TATTOO', '#1d1d1f'],
  ['RAMEN', '#9b2b25'],
  ['BARBER SHOP', '#1f4e8a'],
  ['CELL PHONES', '#3462a8'],
  ['THAI KITCHEN', '#2e7d4f'],
  ['TACOS', '#d1702a'],
  ['BAR', '#3c2a25'],
  ['HARDWARE', '#c63c1f'],
  ['VINTAGE', '#7a4f9c'],
  ['BOOKS', '#30574a'],
  ['HALAL GRILL', '#1c7a46'],
  ['DUMPLINGS', '#b23a2e'],
  ['COFFEE', '#4a3426'],
  ['DRY CLEANERS', '#2f6f9b'],
  ['UKRAINIAN DINER', '#335fa6'],
  ['RECORDS', '#222222'],
  ['SUSHI', '#2a2a2a'],
  ['FLOWERS', '#3f8a4c'],
];

const BRICK = ['#8c3b2b', '#7a3426', '#9a4a33', '#6e3b2e', '#a3583b', '#8a5a44', '#b4886a', '#c6a27d', '#7b6a5e', '#a89a88', '#5f4d44', '#9b6e55'];
const STONE = ['#6b4a3a', '#7a5642', '#5d4236', '#86644c'];
const PREWAR = ['#b9a58a', '#c3b49c', '#9e8d78', '#a8664c', '#d0c4ae'];
const MODERN = ['#c9cfd2', '#aab4ba', '#d8d4cc', '#8e9aa2'];
const TRIM = ['#ece6da', '#2c2c2e', '#4d3b30', '#d9cfbd', '#6a6f72'];
const AWNINGS = ['#1f5f3a', '#7f1f1f', '#1d3a6b', '#2b2b2b', '#b0802a', '#6b2e5a', '#2f6d6d'];

// ---------- block + lot generation ----------

interface Bound { v: number; half: number }

function xBounds(): Bound[] {
  return [{ v: WORLD.minX, half: -1 }, ...AVENUES.map((a) => ({ v: a.x, half: a.width / 2 })), { v: WORLD.maxX, half: -1 }];
}

function zBounds(): Bound[] {
  const zs = Array.from(new Set(STREETS.map((s) => s.z))).sort((a, b) => a - b);
  return [{ v: WORLD.minZ, half: -1 }, ...zs.map((z) => ({ v: z, half: 5.5 })), { v: WORLD.maxZ, half: -1 }];
}

export interface Block {
  minX: number; maxX: number; minZ: number; maxZ: number;
  roadN: boolean; roadS: boolean; roadE: boolean; roadW: boolean;
}

function buildBlocks(): Block[] {
  const xs = xBounds();
  const zs = zBounds();
  const blocks: Block[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const a = xs[i]; const b = xs[i + 1];
      const c = zs[j]; const d = zs[j + 1];
      const midX = (a.v + b.v) / 2;
      // A street boundary only counts as a road if a street segment actually runs there.
      const roadN = c.half > 0 && streetCovers(c.v, midX);
      const roadS = d.half > 0 && streetCovers(d.v, midX);
      const roadW = a.half > 0;
      const roadE = b.half > 0;
      const minX = a.v + (a.half > 0 ? a.half + SIDEWALK : 0);
      const maxX = b.v - (b.half > 0 ? b.half + SIDEWALK : 0);
      // When there is no street (park side), the block continues; skip park cells entirely.
      const minZ = c.v + (c.half > 0 ? c.half + SIDEWALK : 0);
      const maxZ = d.v - (d.half > 0 ? d.half + SIDEWALK : 0);
      if (inPark(midX, (c.v + d.v) / 2)) continue;
      blocks.push({ minX, maxX, minZ, maxZ, roadN, roadS, roadE, roadW });
    }
  }
  return blocks;
}

export const BLOCKS = buildBlocks();

/** Hand-placed landmark businesses (lot is chosen by nearest frontage point). */
interface LandmarkSpec {
  poi?: PoiId;
  x: number;
  z: number;
  face: Face;
  name: string;
  color: string;
  style?: BuildingStyle;
  floors?: number;
  shop: boolean;
}

const NORTH_SIDE = (streetZ: number) => streetZ - 5.5 - SIDEWALK; // building line facing south
const SOUTH_SIDE = (streetZ: number) => streetZ + 5.5 + SIDEWALK; // building line facing north

const LANDMARKS: LandmarkSpec[] = [
  { poi: 'apartment', x: -30, z: NORTH_SIDE(ST), face: 's', name: '', color: '#8c3b2b', style: 'tenement', floors: 5, shop: false },
  { poi: 'laundromat', x: -44, z: NORTH_SIDE(ST), face: 's', name: 'SUDS LAUNDROMAT', color: '#2f74b5', shop: true },
  { poi: 'deli', x: -14, z: NORTH_SIDE(ST), face: 's', name: '7TH ST DELI & GROCERY', color: '#c8312b', shop: true },
  { poi: 'furniture-shop', x: -36, z: SOUTH_SIDE(ST), face: 'n', name: 'BOWERY HOME FURNISHINGS', color: '#7a5a2c', shop: true },
  { poi: 'pizza', x: -82, z: NORTH_SIDE(0), face: 's', name: 'ST MARKS PIZZA', color: '#b2302a', shop: true },
  { poi: 'job-barista', x: -14, z: NORTH_SIDE(0), face: 's', name: 'TOMPKINS COFFEE CO', color: '#4a3426', shop: true },
  { poi: 'job-courier', x: -100, z: SOUTH_SIDE(0), face: 'n', name: 'RAPID COURIER DISPATCH', color: '#d1702a', shop: true },
  { poi: 'job-photo-assistant', x: -92, z: SOUTH_SIDE(-ST), face: 'n', name: 'NINTH ST PHOTO STUDIO', color: '#222222', shop: true },
  { poi: 'dealership', x: -46, z: NORTH_SIDE(2 * ST), face: 's', name: 'EAST SIDE MOTORS', color: '#1d3a6b', shop: true, style: 'modern', floors: 2 },
];

function generateLots(): { lots: Lot[]; landmarkLots: Map<PoiId, Lot> } {
  const rand = mulberry32(1609);
  const lots: Lot[] = [];
  let id = 0;
  const nearPlay = (x: number, z: number) => x > PLAY.minX - 40 && x < PLAY.maxX + 40 && z > PLAY.minZ - 40 && z < PLAY.maxZ + 40;

  const makeLot = (x: number, z: number, w: number, d: number, front: Face, onAvenue: boolean, cornerFaces: Face[]): Lot => {
    const r = rand();
    let style: BuildingStyle;
    if (onAvenue) style = r < 0.58 ? 'tenement' : r < 0.86 ? 'prewar' : 'modern';
    else style = r < 0.55 ? 'tenement' : r < 0.9 ? 'brownstone' : 'modern';
    const floors = style === 'tenement' ? 4 + Math.floor(rand() * 3)
      : style === 'brownstone' ? 3 + Math.floor(rand() * 2)
        : style === 'prewar' ? 7 + Math.floor(rand() * 6)
          : 5 + Math.floor(rand() * 6);
    const color = style === 'brownstone' ? pick(rand, STONE)
      : style === 'prewar' ? pick(rand, PREWAR)
        : style === 'modern' ? pick(rand, MODERN)
          : pick(rand, BRICK);
    const hasShop = style !== 'brownstone' && (onAvenue ? rand() < 0.9 : rand() < 0.32);
    const [shopName, shopColor] = pick(rand, SHOP_NAMES);
    return {
      id: id++,
      x, z, w, d, floors, style, color,
      trim: pick(rand, TRIM),
      shopFaces: hasShop ? Array.from(new Set([front, ...cornerFaces])) : [],
      front,
      shopName: hasShop ? shopName : undefined,
      shopColor: hasShop ? shopColor : undefined,
      awning: hasShop && rand() < 0.65 ? pick(rand, AWNINGS) : undefined,
      waterTower: (style === 'prewar' || (style === 'tenement' && floors >= 5)) && rand() < 0.45,
      fireEscape: style === 'tenement' || (style === 'prewar' && rand() < 0.3),
    };
  };

  for (const b of BLOCKS) {
    const bw = b.maxX - b.minX;
    const bd = b.maxZ - b.minZ;
    if (bw < 4 || bd < 4) continue;
    const rowDepth = Math.min(14, bd / 2);
    const colDepth = Math.min(16, bw / 2);
    // North & south rows (facing streets), spanning full block width.
    const rows: { face: Face; z: number }[] = [];
    if (b.roadN) rows.push({ face: 'n', z: b.minZ + rowDepth / 2 });
    if (b.roadS) rows.push({ face: 's', z: b.maxZ - rowDepth / 2 });
    for (const row of rows) {
      let x = b.minX;
      while (x < b.maxX - 2) {
        const atWestCorner = x === b.minX && b.roadW;
        let w = (2 + Math.floor(rand() * 3)) * BAY_W;
        if (atWestCorner) w = Math.max(w, 10);
        if (b.maxX - (x + w) < 6) w = b.maxX - x;
        const atEastCorner = x + w >= b.maxX - 0.01 && b.roadE;
        const corners: Face[] = [];
        if (atWestCorner) corners.push('w');
        if (atEastCorner) corners.push('e');
        const cx = x + w / 2;
        lots.push(makeLot(cx, row.z, w - 0.02, rowDepth - 0.02, row.face, corners.length > 0, nearPlay(cx, row.z) ? corners : []));
        x += w;
      }
    }
    // East & west columns (avenue frontage between the rows).
    const zStart = b.minZ + (b.roadN ? rowDepth : 0);
    const zEnd = b.maxZ - (b.roadS ? rowDepth : 0);
    const cols: { face: Face; x: number }[] = [];
    if (b.roadW) cols.push({ face: 'w', x: b.minX + colDepth / 2 });
    if (b.roadE) cols.push({ face: 'e', x: b.maxX - colDepth / 2 });
    for (const col of cols) {
      let z = zStart;
      while (z < zEnd - 2) {
        let w = (2 + Math.floor(rand() * 3)) * BAY_W;
        if (zEnd - (z + w) < 6) w = zEnd - z;
        lots.push(makeLot(col.x, z + w / 2, colDepth - 0.02, w - 0.02, col.face, true, []));
        z += w;
      }
    }
  }

  // Assign landmark businesses to the nearest lot on the requested face.
  const landmarkLots = new Map<PoiId, Lot>();
  const used = new Set<number>();
  for (const spec of LANDMARKS) {
    let best: Lot | null = null;
    let bestD = Infinity;
    for (const lot of lots) {
      if (used.has(lot.id) || lot.front !== spec.face) continue;
      const fx = spec.face === 'e' ? lot.x + lot.w / 2 : spec.face === 'w' ? lot.x - lot.w / 2 : lot.x;
      const fz = spec.face === 'n' ? lot.z - lot.d / 2 : spec.face === 's' ? lot.z + lot.d / 2 : lot.z;
      const dd = Math.hypot(fx - spec.x, fz - spec.z);
      if (dd < bestD) { bestD = dd; best = lot; }
    }
    if (!best) continue;
    used.add(best.id);
    if (spec.style) best.style = spec.style;
    if (spec.floors) best.floors = spec.floors;
    if (spec.style === 'tenement') { best.fireEscape = true; best.color = spec.color; }
    if (spec.shop) {
      best.shopFaces = Array.from(new Set([spec.face, ...best.shopFaces]));
      best.shopName = spec.name;
      best.shopColor = spec.color;
      best.awning = spec.color;
      if (best.style === 'brownstone') best.style = 'tenement';
    } else {
      best.shopFaces = [];
      best.shopName = undefined;
      best.awning = undefined;
    }
    if (spec.style === 'modern') best.fireEscape = false;
    best.poi = spec.poi;
    if (spec.poi) landmarkLots.set(spec.poi, best);
  }
  return { lots, landmarkLots };
}

const generated = generateLots();
export const LOTS = generated.lots;

export function faceCenter(lot: Lot, face: Face = lot.front) {
  switch (face) {
    case 'n': return { x: lot.x, z: lot.z - lot.d / 2, nx: 0, nz: -1 };
    case 's': return { x: lot.x, z: lot.z + lot.d / 2, nx: 0, nz: 1 };
    case 'e': return { x: lot.x + lot.w / 2, z: lot.z, nx: 1, nz: 0 };
    default: return { x: lot.x - lot.w / 2, z: lot.z, nx: -1, nz: 0 };
  }
}

// Subway: Astor Place (6 train) entrance, on the west sidewalk of 3rd Avenue near St Marks Pl.
export const SUBWAY = { x: -180 - 10 - 2.1, z: -13, w: 1.9, d: 5, name: 'Astor Pl', line: '6' };

const POI_TEXT: Record<PoiId, { name: string; prompt: string; tag: string; color: string }> = {
  apartment: { name: 'Your walk-up', prompt: 'ENTER YOUR APARTMENT · 3B', tag: 'HOME', color: '#f1c751' },
  'furniture-shop': { name: 'Bowery Home Furnishings', prompt: 'BROWSE FURNITURE', tag: 'FURNITURE', color: '#c9a36a' },
  dealership: { name: 'East Side Motors', prompt: 'VISIT EAST SIDE MOTORS', tag: 'CARS', color: '#6d9bd6' },
  deli: { name: '7th St Deli & Grocery', prompt: 'WALK INTO THE BODEGA', tag: 'DELI', color: '#e0544a' },
  laundromat: { name: 'Suds Laundromat', prompt: 'DO LAUNDRY & CLEAN UP', tag: 'LAUNDRY', color: '#6fb0e8' },
  subway: { name: 'Astor Pl Station (6)', prompt: 'ENTER ASTOR PL STATION · 6', tag: 'SUBWAY', color: '#2fa04a' },
  pizza: { name: 'St Marks Pizza', prompt: 'GRAB A SLICE', tag: 'PIZZA', color: '#e0703a' },
  'job-barista': { name: 'Tompkins Coffee Co.', prompt: 'START A BARISTA SHIFT', tag: 'JOB', color: '#c48a5a' },
  'job-courier': { name: 'Rapid Courier Dispatch', prompt: 'PICK UP COURIER RUNS', tag: 'JOB', color: '#e89a4a' },
  'job-photo-assistant': { name: 'Ninth St Photo Studio', prompt: 'ASSIST ON A PHOTO SHOOT', tag: 'JOB', color: '#bbbbbb' },
};

function buildPois(): Poi[] {
  const out: Poi[] = [];
  for (const [id, lot] of generated.landmarkLots) {
    const face = faceCenter(lot);
    const t = POI_TEXT[id];
    out.push({ id, name: t.name, prompt: t.prompt, mapTag: t.tag, color: t.color, x: face.x + face.nx * 1.4, z: face.z + face.nz * 1.4, radius: 2.4 });
  }
  const s = POI_TEXT.subway;
  out.push({ id: 'subway', name: s.name, prompt: s.prompt, mapTag: s.tag, color: s.color, x: SUBWAY.x + 1.6, z: SUBWAY.z + SUBWAY.d / 2 + 0.6, radius: 2.6 });
  return out;
}

export const POIS = buildPois();
export const HOME_LOT = generated.landmarkLots.get('apartment')!;
export const DEALER_LOT = generated.landmarkLots.get('dealership')!;

const homeFace = faceCenter(HOME_LOT);
/** Where you appear after leaving your building. */
export const HOME_DOOR_POSE = { x: homeFace.x, z: homeFace.z + 2.2, yaw: Math.PI };
export const STREET_START_POSE = HOME_DOOR_POSE;

// Curbside parking spots (front = -z / north when yaw = 0).
export const OWNED_PARKING = { x: HOME_LOT.x - 9, z: ST - 5.5 + PARKING_LANE / 2 + 0.05, yaw: Math.PI / 2 };
const dealerFace = faceCenter(DEALER_LOT);
export const TEST_CAR_PARKING = { x: dealerFace.x + 3, z: 2 * ST - 5.5 + PARKING_LANE / 2 + 0.05, yaw: -Math.PI / 2 };

// ---------- colliders ----------

export const PARK_FENCE: Box[] = (() => {
  const p = PARK;
  const out: Box[] = [];
  const t = 0.25;
  const gap = 4;
  const midX = (p.minX + p.maxX) / 2;
  const midZ = (p.minZ + p.maxZ) / 2;
  // north + south edges with gaps at the corners and middle
  for (const z of [p.minZ, p.maxZ]) {
    out.push({ x: (p.minX + gap + midX - gap / 2) / 2, z, w: midX - gap / 2 - (p.minX + gap), d: t });
    out.push({ x: (midX + gap / 2 + p.maxX - gap) / 2, z, w: p.maxX - gap - (midX + gap / 2), d: t });
  }
  for (const x of [p.minX, p.maxX]) {
    out.push({ x, z: (p.minZ + gap + midZ - gap / 2) / 2, w: t, d: midZ - gap / 2 - (p.minZ + gap) });
    out.push({ x, z: (midZ + gap / 2 + p.maxZ - gap) / 2, w: t, d: p.maxZ - gap - (midZ + gap / 2) });
  }
  return out;
})();

export const BUILDING_COLLIDERS: Box[] = [
  ...LOTS.map((l) => ({ x: l.x, z: l.z, w: l.w, d: l.d })),
  ...PARK_FENCE,
  { x: SUBWAY.x, z: SUBWAY.z, w: SUBWAY.w + 0.3, d: SUBWAY.d + 0.2 },
];

// ---------- traffic lanes ----------

export interface Lane {
  axis: 'x' | 'z';
  fixed: number;
  dir: 1 | -1;
  start: number;
  end: number;
  crossings: { at: number; half: number }[];
  avenue: boolean;
  bus?: string;
}

function buildLanes(): Lane[] {
  const lanes: Lane[] = [];
  const zs = Array.from(new Set(STREETS.map((s) => s.z)));
  for (const a of AVENUES) {
    const travel = a.width - PARKING_LANE * 2;
    const crossings = zs.filter((z) => streetCovers(z, a.x)).map((z) => ({ at: z, half: 5.5 }));
    const base = { axis: 'z' as const, start: WORLD.minZ, end: WORLD.maxZ, crossings, avenue: true, bus: a.bus };
    if (a.flow === 'two-way') {
      lanes.push({ ...base, fixed: a.x + travel / 4, dir: -1 });
      lanes.push({ ...base, fixed: a.x - travel / 4, dir: 1 });
    } else {
      const dir = a.flow === 'north' ? -1 : 1;
      lanes.push({ ...base, fixed: a.x - travel / 4, dir });
      lanes.push({ ...base, fixed: a.x + travel / 4, dir });
    }
  }
  for (const s of STREETS) {
    if (!s.traffic) continue;
    const crossings = AVENUES.filter((a) => a.x >= s.from && a.x <= s.to).map((a) => ({ at: a.x, half: a.width / 2 }));
    lanes.push({ axis: 'x', fixed: s.z, dir: s.flow === 'east' ? 1 : -1, start: s.from, end: s.to, crossings, avenue: false });
  }
  return lanes;
}

export const LANES = buildLanes();

// ---------- parked cars ----------

export const CITI_BIKE_DOCK = { x: -8, z: ST - 5.5 + 1.2, count: 9 };

export interface ParkedCar { x: number; z: number; yaw: number; kind: number; color: number }

function buildParked(): ParkedCar[] {
  const rand = mulberry32(77);
  const out: ParkedCar[] = [];
  const keepClear = [OWNED_PARKING, TEST_CAR_PARKING];
  const clear = (x: number, z: number) => keepClear.every((p) => Math.hypot(p.x - x, p.z - z) > 6.5)
    && Math.hypot(x - CITI_BIKE_DOCK.x, z - CITI_BIKE_DOCK.z) > 9;
  const place = (x: number, z: number, yaw: number) => {
    if (!clear(x, z)) return;
    const r = rand();
    out.push({ x, z, yaw, kind: r < 0.08 ? 1 : r < 0.36 ? 2 : r < 0.47 ? 3 : 0, color: Math.floor(rand() * 1000) });
  };
  // Avenues: both curbs
  for (const a of AVENUES) {
    const zs = STREETS.filter((s) => streetCovers(s.z, a.x)).map((s) => s.z);
    for (const side of [-1, 1]) {
      const px = a.x + side * (a.width / 2 - PARKING_LANE / 2);
      let z = PLAY.minZ - 30;
      while (z < PLAY.maxZ + 30) {
        const nearCross = zs.some((sz) => Math.abs(sz - z) < 5.5 + 6);
        const yaw = a.flow === 'north' ? 0 : a.flow === 'south' ? Math.PI : side > 0 ? 0 : Math.PI;
        if (!nearCross && rand() < 0.72) place(px, z, yaw);
        z += 5.6 + rand() * 3.2;
      }
    }
  }
  for (const s of STREETS) {
    for (const side of [-1, 1]) {
      const pz = s.z + side * (s.width / 2 - PARKING_LANE / 2);
      let x = Math.max(s.from, PLAY.minX - 30);
      const end = Math.min(s.to, PLAY.maxX + 30);
      while (x < end) {
        const nearCross = AVENUES.some((a) => Math.abs(a.x - x) < a.width / 2 + 6);
        if (!nearCross && rand() < (s.traffic ? 0.7 : 0.5)) place(x, pz, s.flow === 'east' ? -Math.PI / 2 : Math.PI / 2);
        x += 5.6 + rand() * 3.2;
      }
    }
  }
  return out;
}

export const PARKED_CARS = buildParked();
export const PARKED_COLLIDERS: Box[] = PARKED_CARS.map((c) => {
  const alongX = Math.abs(Math.sin(c.yaw)) > 0.5;
  return { x: c.x, z: c.z, w: alongX ? 4.5 : 1.9, d: alongX ? 1.9 : 4.5 };
});

export const ALL_COLLIDERS: Box[] = [...BUILDING_COLLIDERS, ...PARKED_COLLIDERS];

export function blocked(x: number, z: number, radius: number, boxes: Box[] = ALL_COLLIDERS) {
  if (x < PLAY.minX || x > PLAY.maxX || z < PLAY.minZ || z > PLAY.maxZ) return true;
  for (const b of boxes) {
    if (Math.abs(x - b.x) < b.w / 2 + radius && Math.abs(z - b.z) < b.d / 2 + radius) return true;
  }
  return false;
}

// ---------- traffic signals ----------

export type Signal = 'green' | 'yellow' | 'red';
export const SIGNAL_CYCLE = 32;
export function signalState(t: number): { ns: Signal; ew: Signal } {
  const p = ((t % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  if (p < 13) return { ns: 'green', ew: 'red' };
  if (p < 16) return { ns: 'yellow', ew: 'red' };
  if (p < 17) return { ns: 'red', ew: 'red' };
  if (p < 28) return { ns: 'red', ew: 'green' };
  if (p < 31) return { ns: 'red', ew: 'yellow' };
  return { ns: 'red', ew: 'red' };
}

export const INTERSECTIONS = AVENUES.flatMap((a) =>
  Array.from(new Set(STREETS.map((s) => s.z)))
    .filter((z) => streetCovers(z, a.x))
    .map((z) => ({ avenue: a, z, street: STREETS.find((s) => Math.abs(s.z - z) < 0.01 && a.x >= s.from - 0.01 && a.x <= s.to + 0.01)! })),
);

// ---------- naming / geography ----------

export function describePlace(x: number, z: number): { street: string; hood: string } {
  const hood = x > 0 + 7 ? 'ALPHABET CITY' : 'EAST VILLAGE';
  if (inPark(x, z, 1)) return { street: 'Tompkins Square Park', hood };
  const nearestAve = AVENUES.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
  const candidates = STREETS.filter((s) => x >= s.from - 8 && x <= s.to + 8);
  const nearestSt = candidates.length
    ? candidates.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a))
    : STREETS[0];
  const onAve = Math.abs(nearestAve.x - x) < nearestAve.width / 2 + SIDEWALK + 0.5;
  const onSt = Math.abs(nearestSt.z - z) < nearestSt.width / 2 + SIDEWALK + 0.5;
  if (onAve && onSt) return { street: `${nearestSt.name} & ${nearestAve.name}`, hood };
  if (onAve) {
    const sorted = [...STREETS].filter((s) => x >= s.from - 8 && x <= s.to + 8).sort((a, b) => a.z - b.z);
    const north = [...sorted].reverse().find((s) => s.z < z);
    const south = sorted.find((s) => s.z > z);
    return { street: `${nearestAve.name}${north && south ? ` · ${south.sign.replace('E ', '')}–${north.sign.replace('E ', '')} Sts` : ''}`, hood };
  }
  const sortedAves = [...AVENUES].sort((a, b) => a.x - b.x);
  const west = [...sortedAves].reverse().find((a) => a.x < x);
  const east = sortedAves.find((a) => a.x > x);
  return { street: `${nearestSt.name}${west && east ? ` · ${west.sign} – ${east.sign}` : ''}`, hood };
}

/** Converts compressed world coordinates into real latitude/longitude. */
export function worldToLatLng(x: number, z: number): { lat: number; lng: number } {
  const lat0 = 40.72727; // Avenue A & St Marks Pl
  const lng0 = -73.98385;
  const east = x * 3.2;
  const north = -z * 2.0;
  const a = (29 * Math.PI) / 180;
  const trueE = east * Math.cos(a) + north * Math.sin(a);
  const trueN = -east * Math.sin(a) + north * Math.cos(a);
  return {
    lat: lat0 + trueN / 111320,
    lng: lng0 + trueE / (111320 * Math.cos((lat0 * Math.PI) / 180)),
  };
}

