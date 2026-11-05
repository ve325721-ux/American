import * as THREE from 'three';
/* eslint-disable @typescript-eslint/no-explicit-any */
type ThreeTexture = any;


/**
 * Minimal mesh builder: accumulates quads / boxes with per-vertex colour and
 * world-space UVs into a single BufferGeometry, so a whole neighbourhood can
 * render in a few draw calls.
 */
export class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  private tmp = new THREE.Color();

  get vertexCount() {
    return this.pos.length / 3;
  }

  private rgb(color: string | [number, number, number]): [number, number, number] {
    if (Array.isArray(color)) return color;
    this.tmp.set(color);
    return [this.tmp.r, this.tmp.g, this.tmp.b];
  }

  /** Quad from four corners (counter-clockwise when viewed from the front). */
  quad(
    a: number[], b: number[], c: number[], d: number[],
    n: number[], color: string | [number, number, number],
    uvs: number[] = [0, 0, 1, 0, 1, 1, 0, 1],
  ) {
    const base = this.vertexCount;
    const [r, g, bl] = this.rgb(color);
    for (const p of [a, b, c, d]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(r, g, bl);
    }
    this.uv.push(...uvs);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Vertical wall quad facing direction (nx, nz). `x0,z0`→`x1,z1` run left→right
   * as seen from outside.
   */
  wall(
    x0: number, z0: number, x1: number, z1: number, y0: number, y1: number,
    nx: number, nz: number, color: string | [number, number, number],
    u0 = 0, u1 = 1, v0 = 0, v1 = 1,
  ) {
    this.quad(
      [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0],
      [nx, 0, nz], color, [u0, v0, u1, v0, u1, v1, u0, v1],
    );
  }

  /** Horizontal quad (top-facing) with world-space UVs scaled by `uvScale`. */
  flat(minX: number, minZ: number, maxX: number, maxZ: number, y: number, color: string | [number, number, number], uvScale = 0, uvFixed?: [number, number]) {
    const uvs = uvFixed
      ? [uvFixed[0], uvFixed[1], uvFixed[0], uvFixed[1], uvFixed[0], uvFixed[1], uvFixed[0], uvFixed[1]]
      : uvScale
        ? [minX / uvScale, -maxZ / uvScale, maxX / uvScale, -maxZ / uvScale, maxX / uvScale, -minZ / uvScale, minX / uvScale, -minZ / uvScale]
        : [0, 0, 1, 0, 1, 1, 0, 1];
    this.quad([minX, y, maxZ], [maxX, y, maxZ], [maxX, y, minZ], [minX, y, minZ], [0, 1, 0], color, uvs);
  }

  /** Axis-aligned (optionally Y-rotated) box. Bottom face omitted. */
  box(
    cx: number, cy: number, cz: number, w: number, h: number, d: number,
    color: string | [number, number, number], rotY = 0, uvFixed: [number, number] = [0.01, 0.01], bottom = false,
  ) {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const tr = (x: number, y: number, z: number) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const rn = (x: number, z: number) => [x * c + z * s, 0, -x * s + z * c];
    const u = [uvFixed[0], uvFixed[1], uvFixed[0], uvFixed[1], uvFixed[0], uvFixed[1], uvFixed[0], uvFixed[1]];
    // +z
    this.quad(tr(-hw, -hh, hd), tr(hw, -hh, hd), tr(hw, hh, hd), tr(-hw, hh, hd), rn(0, 1), color, u);
    // -z
    this.quad(tr(hw, -hh, -hd), tr(-hw, -hh, -hd), tr(-hw, hh, -hd), tr(hw, hh, -hd), rn(0, -1), color, u);
    // +x
    this.quad(tr(hw, -hh, hd), tr(hw, -hh, -hd), tr(hw, hh, -hd), tr(hw, hh, hd), rn(1, 0), color, u);
    // -x
    this.quad(tr(-hw, -hh, -hd), tr(-hw, -hh, hd), tr(-hw, hh, hd), tr(-hw, hh, -hd), rn(-1, 0), color, u);
    // top
    this.quad(tr(-hw, hh, hd), tr(hw, hh, hd), tr(hw, hh, -hd), tr(-hw, hh, -hd), [0, 1, 0], color, u);
    if (bottom) this.quad(tr(-hw, -hh, -hd), tr(hw, -hh, -hd), tr(hw, -hh, hd), tr(-hw, -hh, hd), [0, -1, 0], color, u);
  }

  /** Low-poly vertical cylinder (open bottom). */
  cylinder(cx: number, cy: number, cz: number, r: number, h: number, color: string | [number, number, number], seg = 8, rTop = r) {
    const y0 = cy - h / 2, y1 = cy + h / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      this.quad(
        [cx + Math.sin(a0) * r, y0, cz + Math.cos(a0) * r],
        [cx + Math.sin(a1) * r, y0, cz + Math.cos(a1) * r],
        [cx + Math.sin(a1) * rTop, y1, cz + Math.cos(a1) * rTop],
        [cx + Math.sin(a0) * rTop, y1, cz + Math.cos(a0) * rTop],
        [Math.sin(am), 0, Math.cos(am)], color, [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
      );
    }
    if (rTop > 0.001) {
      const [r1, g1, b1] = this.rgb(color);
      const base = this.vertexCount;
      this.pos.push(cx, y1, cz); this.nor.push(0, 1, 0); this.col.push(r1, g1, b1); this.uv.push(0.01, 0.01);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        this.pos.push(cx + Math.sin(a) * rTop, y1, cz + Math.cos(a) * rTop);
        this.nor.push(0, 1, 0); this.col.push(r1, g1, b1); this.uv.push(0.01, 0.01);
      }
      for (let i = 0; i < seg; i++) this.idx.push(base, base + 1 + i, base + 2 + i);
    }
  }

  /** Cone (for water-tower roofs). */
  cone(cx: number, cy: number, cz: number, r: number, h: number, color: string | [number, number, number], seg = 8) {
    const [r1, g1, b1] = this.rgb(color);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const base = this.vertexCount;
      this.pos.push(cx + Math.sin(a0) * r, cy, cz + Math.cos(a0) * r, cx + Math.sin(a1) * r, cy, cz + Math.cos(a1) * r, cx, cy + h, cz);
      const ny = r / Math.hypot(r, h);
      for (let k = 0; k < 3; k++) { this.nor.push(Math.sin(am), ny, Math.cos(am)); this.col.push(r1, g1, b1); this.uv.push(0.01, 0.01); }
      this.idx.push(base, base + 1, base + 2);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/**
 * Standard material whose texture tints only "wall" pixels (near-white) with
 * the vertex colour, leaving glass, frames and signage at their real colour.
 */
export function tintedFacadeMaterial(map: ThreeTexture, roughness = 0.92) {
  const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness, metalness: 0.02 });
  m.onBeforeCompile = (shader: { fragmentShader: string }) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', '')
      .replace(
        '#include <color_fragment>',
        `
        vec4 facadeTexel = texture2D( map, vMapUv );
        float wallMask = smoothstep( 0.86, 0.9, min( facadeTexel.r, min( facadeTexel.g, facadeTexel.b ) ) );
        vec3 tinted = vColor * ( facadeTexel.rgb / 0.97 );
        diffuseColor.rgb *= mix( facadeTexel.rgb, tinted, wallMask );
        `,
      );
  };
  m.customProgramCacheKey = () => 'tinted-facade';
  return m;
}
