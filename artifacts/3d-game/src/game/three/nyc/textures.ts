import * as THREE from 'three';
import { mulberry32 } from './layout';
/* eslint-disable @typescript-eslint/no-explicit-any */
type ThreeTexture = any;


/**
 * Procedural canvas textures. Facade textures use pure-white pixels for the
 * wall surface so the shader in `materials.ts` can tint them per building,
 * while window glass, frames and lintels keep their own colours.
 */

type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d') as Ctx];
}

function toTexture(c: HTMLCanvasElement, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/** Wall surface: very light grey noise (>= 0.9) so it reads as "tintable". */
function wall(ctx: Ctx, w: number, h: number, seed: number, brick: boolean) {
  const rand = mulberry32(seed);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (brick) {
    const bh = 6;
    for (let y = 0; y < h; y += bh) {
      const off = (y / bh) % 2 ? 7 : 0;
      for (let x = -off; x < w; x += 14) {
        const g = 236 + Math.floor(rand() * 19);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(x + 1, y + 1, 12, bh - 1);
      }
    }
  } else {
    for (let i = 0; i < 260; i++) {
      const g = 238 + Math.floor(rand() * 17);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(rand() * w, rand() * h, 2 + rand() * 5, 2 + rand() * 4);
    }
  }
}

function glass(ctx: Ctx, x: number, y: number, w: number, h: number, lit = false) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  if (lit) {
    g.addColorStop(0, '#5a5040');
    g.addColorStop(1, '#2a2620');
  } else {
    g.addColorStop(0, '#5f7a8c');
    g.addColorStop(0.45, '#33465a');
    g.addColorStop(1, '#1d2732');
  }
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** One window bay (BAY_W wide, FLOOR_H tall) in a brick walk-up tenement. */
function tenementCell(seed: number) {
  const [c, ctx] = canvas(64, 64);
  wall(ctx, 64, 64, seed, true);
  // window
  ctx.fillStyle = '#d6d0c4';
  ctx.fillRect(18, 12, 28, 40);
  glass(ctx, 20, 14, 24, 36, seed % 3 === 0);
  // muntin / sash
  ctx.fillStyle = '#cfc8ba';
  ctx.fillRect(20, 31, 24, 3);
  // lintel + sill
  ctx.fillStyle = '#b9b2a4';
  ctx.fillRect(15, 8, 34, 5);
  ctx.fillStyle = '#a49c8d';
  ctx.fillRect(16, 52, 32, 3);
  return toTexture(c);
}

function brownstoneCell(seed: number) {
  const [c, ctx] = canvas(64, 64);
  wall(ctx, 64, 64, seed, false);
  ctx.fillStyle = '#7a6656';
  ctx.fillRect(17, 6, 30, 50);
  glass(ctx, 20, 9, 24, 44);
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(20, 28, 24, 2);
  ctx.fillRect(31, 9, 2, 44);
  // carved hood
  ctx.fillStyle = '#6a5848';
  ctx.fillRect(14, 2, 36, 5);
  ctx.fillRect(15, 56, 34, 3);
  return toTexture(c);
}

function prewarCell(seed: number) {
  const [c, ctx] = canvas(64, 64);
  wall(ctx, 64, 64, seed, true);
  for (const x of [8, 36]) {
    ctx.fillStyle = '#dad4c8';
    ctx.fillRect(x - 2, 12, 24, 40);
    glass(ctx, x, 14, 20, 36, (seed + x) % 4 === 0);
    ctx.fillStyle = '#d8d2c6';
    ctx.fillRect(x, 30, 20, 2);
  }
  ctx.fillStyle = '#c4bcac';
  ctx.fillRect(0, 58, 64, 4);
  return toTexture(c);
}

function modernCell(seed: number) {
  const [c, ctx] = canvas(64, 64);
  wall(ctx, 64, 64, seed, false);
  glass(ctx, 2, 10, 60, 44);
  ctx.fillStyle = '#9aa3a8';
  ctx.fillRect(31, 10, 2, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(4, 54);
  ctx.lineTo(24, 10);
  ctx.lineTo(34, 10);
  ctx.lineTo(14, 54);
  ctx.fill();
  return toTexture(c);
}

/** Ground-floor storefront bay: plate glass, kickplate, transom. */
function storefrontCell() {
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#2e2e2e';
  ctx.fillRect(2, 6, 60, 52);
  const g = ctx.createLinearGradient(0, 8, 0, 50);
  g.addColorStop(0, '#d8c79a');
  g.addColorStop(0.5, '#8a7a5a');
  g.addColorStop(1, '#3d3a33');
  ctx.fillStyle = g;
  ctx.fillRect(5, 14, 54, 36);
  // shelves / goods suggestion
  const rand = mulberry32(5);
  for (let y = 22; y < 48; y += 8) {
    for (let x = 7; x < 57; x += 4) {
      const hue = Math.floor(rand() * 360);
      ctx.fillStyle = `hsla(${hue},45%,55%,0.55)`;
      ctx.fillRect(x, y, 3, 5);
    }
  }
  ctx.fillStyle = '#4a4a48';
  ctx.fillRect(5, 50, 54, 8);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(5, 8, 54, 5);
  return toTexture(c);
}

export function asphaltTexture() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#4a4c4e';
  ctx.fillRect(0, 0, 256, 256);
  const rand = mulberry32(21);
  for (let i = 0; i < 4200; i++) {
    const g = 60 + Math.floor(rand() * 40);
    ctx.fillStyle = `rgba(${g},${g},${g + 2},0.55)`;
    ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2);
  }
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = 'rgba(30,30,32,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let x = rand() * 256;
    let y = rand() * 256;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rand() - 0.5) * 40;
      y += (rand() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // a manhole / patch
  ctx.fillStyle = 'rgba(40,40,42,0.7)';
  ctx.fillRect(140, 60, 60, 34);
  return toTexture(c);
}

export function sidewalkTexture() {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#b7b3ab';
  ctx.fillRect(0, 0, 128, 128);
  const rand = mulberry32(8);
  for (let i = 0; i < 900; i++) {
    const g = 160 + Math.floor(rand() * 40);
    ctx.fillStyle = `rgba(${g},${g - 2},${g - 6},0.5)`;
    ctx.fillRect(rand() * 128, rand() * 128, 2, 2);
  }
  // NYC sidewalk flags, ~5ft squares
  ctx.strokeStyle = '#8f8b84';
  ctx.lineWidth = 2;
  for (let p = 0; p <= 128; p += 64) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(128, p); ctx.stroke();
  }
  // gum spots
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = 'rgba(70,70,70,0.35)';
    ctx.beginPath();
    ctx.arc(rand() * 128, rand() * 128, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c);
}

export function grassTexture() {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#55743f';
  ctx.fillRect(0, 0, 128, 128);
  const rand = mulberry32(3);
  for (let i = 0; i < 2400; i++) {
    const g = 90 + Math.floor(rand() * 70);
    ctx.fillStyle = `rgba(${g - 40},${g},${g - 60},0.5)`;
    ctx.fillRect(rand() * 128, rand() * 128, 1, 2 + rand() * 2);
  }
  return toTexture(c);
}

export interface FacadeSet {
  tenement: ThreeTexture;
  brownstone: ThreeTexture;
  prewar: ThreeTexture;
  modern: ThreeTexture;
  storefront: ThreeTexture;
}

export function facadeTextures(): FacadeSet {
  return {
    tenement: tenementCell(11),
    brownstone: brownstoneCell(12),
    prewar: prewarCell(13),
    modern: modernCell(14),
    storefront: storefrontCell(),
  };
}

/** Atlas of text labels. Returns uv rect lookup. */
export interface Atlas {
  texture: ThreeTexture;
  rect: (key: string) => { u0: number; v0: number; u1: number; v1: number };
}

export function labelAtlas(
  entries: { key: string; text: string; bg: string; fg: string; font?: string; border?: string }[],
  cellW = 512,
  cellH = 64,
): Atlas {
  const unique = Array.from(new Map(entries.map((e) => [e.key, e])).values());
  const cols = 2;
  const rows = Math.ceil(unique.length / cols);
  const [c, ctx] = canvas(cellW * cols, Math.max(cellH, cellH * rows));
  const rects = new Map<string, { u0: number; v0: number; u1: number; v1: number }>();
  unique.forEach((e, i) => {
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * cellH;
    ctx.fillStyle = e.bg;
    ctx.fillRect(x, y, cellW, cellH);
    if (e.border) {
      ctx.strokeStyle = e.border;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 4, y + 4, cellW - 8, cellH - 8);
    }
    ctx.fillStyle = e.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = cellH * 0.56;
    ctx.font = `${e.font ?? '700'} ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    while (ctx.measureText(e.text).width > cellW * 0.9 && size > 10) {
      size -= 2;
      ctx.font = `${e.font ?? '700'} ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    }
    ctx.fillText(e.text, x + cellW / 2, y + cellH / 2 + 2);
    const H = c.height;
    const W = c.width;
    rects.set(e.key, { u0: (x + 2) / W, u1: (x + cellW - 2) / W, v1: 1 - (y + 2) / H, v0: 1 - (y + cellH - 2) / H });
  });
  const texture = toTexture(c, false);
  return {
    texture,
    rect: (key) => rects.get(key) ?? { u0: 0, v0: 0, u1: 0.01, v1: 0.01 },
  };
}
