import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MutableRefObject } from 'react';
import type {
  CityWorldProps,
  FurniturePlacement,
  WorldInteraction,
  WorldPose,
} from './worldTypes';
import { NycCity, addCar } from './nyc/NycCity';
import { GeoBuilder } from './nyc/geometry';
import {
  BUILDING_COLLIDERS,
  HOME_DOOR_POSE,
  OWNED_PARKING,
  POIS,
  TEST_CAR_PARKING,
  blocked,
  describePlace,
} from './nyc/layout';
/* eslint-disable @typescript-eslint/no-explicit-any */
type ThreeDirectionalLight = any;
type ThreeGroup = any;


export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  stickX: number;
  stickY: number;
  cameraX: number;
  cameraY: number;
}

interface SceneProps extends CityWorldProps {
  input: MutableRefObject<InputState>;
  onNearbyChange: (target: WorldInteraction | null) => void;
}

interface BoxCollider {
  x: number;
  z: number;
  w: number;
  d: number;
}

const INTERIOR_COLLIDERS: BoxCollider[] = [
  { x: 0, z: -5.05, w: 10.2, d: 0.35 },
  { x: -5.05, z: 0, w: 0.35, d: 10.2 },
  { x: 5.05, z: 0, w: 0.35, d: 10.2 },
  { x: -3.7, z: 5.05, w: 2.6, d: 0.35 },
  { x: 3.7, z: 5.05, w: 2.6, d: 0.35 },
];

/** Paint + body type for cars the player can drive. */
export const DRIVABLE: Record<string, { kind: number; color: string; label: string; top: number; accel: number }> = {
  'test-car': { kind: 0, color: '#c94d2f', label: 'loaner sedan', top: 15, accel: 7 },
  'used-sedan': { kind: 0, color: '#5c6770', label: 'used sedan', top: 14, accel: 6 },
  'electric-hatch': { kind: 0, color: '#e8e8e6', label: 'electric hatch', top: 17, accel: 10 },
  'luxury-suv': { kind: 3, color: '#1c1c1e', label: 'luxury SUV', top: 18, accel: 9 },
};

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

function Block({
  position,
  size,
  color,
  rotation = 0,
  ...rest
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: number;
  [key: string]: unknown;
}) {
  return (
    <mesh
      position={position}
      rotation={[0, rotation, 0]}
      castShadow={false}
      receiveShadow={false}
      {...(rest as object)}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}


function FurnitureModel({
  itemId,
  position,
  rotation = 0,
  onClick,
}: {
  itemId: string;
  position: [number, number, number];
  rotation?: number;
  onClick?: () => void;
}) {
  const color = itemId.includes('plant')
    ? '#65805d'
    : itemId.includes('desk')
      ? '#9e7654'
      : itemId.includes('mattress')
        ? '#e4dac8'
        : '#a95d43';

  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onClick={(event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        onClick?.();
      }}
      userData={{ itemId }}
    >
      {itemId.includes('plant') ? (
        <>
          <mesh position={[0, 0.34, 0]}>
            <cylinderGeometry args={[0.22, 0.18, 0.48, 6]} />
            <meshStandardMaterial color="#aa7052" />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <icosahedronGeometry args={[0.58, 0]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
        </>
      ) : itemId.includes('desk') ? (
        <>
          <Block
            position={[0, 0.85, 0]}
            size={[1.55, 0.16, 0.8]}
            color={color}
          />
          {[-0.62, 0.62].map((x) => (
            <Block
              key={x}
              position={[x, 0.4, 0]}
              size={[0.13, 0.8, 0.7]}
              color="#72523d"
            />
          ))}
          <Block
            position={[0, 1.02, -0.22]}
            size={[0.62, 0.06, 0.4]}
            color="#d9d1bf"
          />
        </>
      ) : itemId.includes('mattress') ? (
        <>
          <Block
            position={[0, 0.48, 0]}
            size={[1.65, 0.26, 2.1]}
            color="#6f5343"
          />
          <Block
            position={[0, 0.72, 0]}
            size={[1.7, 0.3, 2.12]}
            color="#e5ddca"
          />
          <Block
            position={[0, 0.91, -0.68]}
            size={[0.72, 0.16, 0.44]}
            color="#c9d6ca"
          />
        </>
      ) : (
        <>
          <Block
            position={[0, 0.62, 0]}
            size={[2, 0.64, 0.92]}
            color={color}
          />
          <Block
            position={[0, 1.05, -0.3]}
            size={[2, 0.58, 0.28]}
            color="#8e4d3b"
          />
          {[-0.68, 0.68].map((x) => (
            <Block
              key={x}
              position={[x, 0.37, 0.35]}
              size={[0.12, 0.45, 0.12]}
              color="#72533d"
            />
          ))}
        </>
      )}
    </group>
  );
}

function ApartmentInterior({
  placements,
  pendingFurnitureId,
  onPlaceFurniture,
  onInspectFurniture,
}: Pick<SceneProps, 'placements' | 'pendingFurnitureId' | 'onPlaceFurniture' | 'onInspectFurniture'>) {
  const place = (event: { point: { x: number; z: number }; stopPropagation: () => void }) => {
    if (!pendingFurnitureId) return;
    event.stopPropagation();
    onPlaceFurniture(pendingFurnitureId, clamp(event.point.x, -4.1, 4.1), clamp(event.point.z, -4.1, 4.1), 0);
  };
  const furniture = [
    { id: 'sofa', x: -2.4, z: 1.6, rot: 0 },
    { id: 'bed', x: 2.8, z: -2.4, rot: Math.PI / 2 },
    { id: 'plant', x: 4, z: 1.8, rot: 0 },
    ...placements.map((item: FurniturePlacement) => ({ id: item.itemId, x: item.x, z: item.z, rot: item.rotation })),
  ];
  return (
    <group>
      {/* hardwood floor */}
      <Block position={[0, -0.12, 0]} size={[10, 0.2, 10]} color="#a7774f" onClick={place} />
      {Array.from({ length: 12 }, (_, i) => (
        <Block key={i} position={[-4.6 + i * 0.84, 0.0, 0]} size={[0.02, 0.02, 9.9]} color="#8a5f3e" />
      ))}
      {/* exposed brick wall + painted walls */}
      <Block position={[0, 3, -5]} size={[10, 6, 0.3]} color="#9a4f3a" />
      <Block position={[-5, 3, 0]} size={[0.3, 6, 10]} color="#ece6da" />
      <Block position={[5, 3, 0]} size={[0.3, 6, 10]} color="#ece6da" />
      <Block position={[-3.7, 3, 5]} size={[2.6, 6, 0.3]} color="#ece6da" />
      <Block position={[3.7, 3, 5]} size={[2.6, 6, 0.3]} color="#ece6da" />
      <Block position={[0, 5.95, 0]} size={[10, 0.18, 10]} color="#f2eee6" />
      {/* tall double-hung windows onto E 7th St, with radiator */}
      {[-2.4, 2.4].map((x) => (
        <group key={x}>
          <Block position={[x, 2.6, -4.82]} size={[1.5, 2.6, 0.08]} color="#9cc0d6" />
          <Block position={[x, 2.6, -4.76]} size={[1.6, 0.1, 0.06]} color="#f5f0e4" />
          <Block position={[x, 1.2, -4.7]} size={[1.8, 0.12, 0.3]} color="#f5f0e4" />
          <Block position={[x, 0.55, -4.6]} size={[1.3, 0.8, 0.25]} color="#d9d4c6" />
        </group>
      ))}
      {/* galley kitchen along the east wall */}
      <Block position={[4.45, 0.45, -1.2]} size={[0.9, 0.9, 3.4]} color="#e8e4da" />
      <Block position={[4.45, 0.93, -1.2]} size={[0.95, 0.06, 3.45]} color="#3a3a3a" />
      <Block position={[4.5, 0.95, -2.4]} size={[0.6, 0.04, 0.6]} color="#1a1a1a" />
      <Block position={[4.5, 1.0, 0.95]} size={[0.8, 2, 0.8]} color="#d8dadb" />
      <Block position={[4.45, 2.6, -1.2]} size={[0.6, 0.8, 3.4]} color="#e8e4da" />
      {/* front door */}
      <Block position={[0, 1.3, 4.85]} size={[1.4, 2.6, 0.15]} color="#5b3a2a" />
      <Block position={[-2.4, 0.84, -1.55]} size={[1.75, 1.05, 0.22]} color="#333b3e" onClick={(event: { stopPropagation: () => void }) => { event.stopPropagation(); onInspectFurniture('television'); }} />
      {furniture.map((item, index) => (
        <FurnitureModel key={`${item.id}-${index}`} itemId={item.id} position={[item.x, 0, item.z]} rotation={item.rot} onClick={() => onInspectFurniture(item.id)} />
      ))}
      <Block position={[-2.25, 0.36, -3.1]} size={[0.95, 0.72, 0.72]} color="#aa7750" onClick={(event: { stopPropagation: () => void }) => { event.stopPropagation(); onInspectFurniture('coffee-table'); }} />
      <pointLight position={[0, 5, 0]} intensity={14} distance={14} color="#ffe6c4" />
    </group>
  );
}

function Avatar({ character, walking, running, driving }: { character: string; walking: boolean; running: boolean; driving: boolean }) {
  const root = useRef<ThreeGroup | null>(null);
  const limbs = useRef<(ThreeGroup | null)[]>([]);
  const look = character.toLowerCase();
  const outfit = look === 'creative' ? '#785e91' : look === 'street' ? '#4b7183' : look === 'polished' ? '#2f3a4a' : '#c94d2f';
  const pants = look === 'polished' ? '#22262c' : look === 'street' ? '#2b2f36' : '#34465c';
  const skin = '#b98463';

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * (running ? 13 : 8.5);
    const swing = walking ? Math.sin(t) * (running ? 0.9 : 0.55) : 0;
    const [armL, armR, legL, legR] = limbs.current;
    if (armL) armL.rotation.x = swing;
    if (armR) armR.rotation.x = -swing;
    if (legL) legL.rotation.x = -swing;
    if (legR) legR.rotation.x = swing;
    if (root.current) root.current.position.y = walking ? Math.abs(Math.sin(t)) * (running ? 0.09 : 0.05) : 0;
  });

  if (driving) return null;
  return (
    <group ref={root}>
      {/* torso + jacket */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <boxGeometry args={[0.58, 0.72, 0.32]} />
        <meshStandardMaterial color={outfit} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <boxGeometry args={[0.52, 0.16, 0.3]} />
        <meshStandardMaterial color="#1f1f22" />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.88, 0]} castShadow>
        <boxGeometry args={[0.32, 0.36, 0.32]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh position={[0, 2.08, 0.02]}>
        <boxGeometry args={[0.34, 0.1, 0.34]} />
        <meshStandardMaterial color="#2a211b" />
      </mesh>
      {/* arms (pivot at shoulder) */}
      {[-0.37, 0.37].map((x, i) => (
        <group key={x} position={[x, 1.64, 0]} ref={(g: ThreeGroup | null) => { limbs.current[i] = g; }}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <boxGeometry args={[0.16, 0.62, 0.18]} />
            <meshStandardMaterial color={outfit} />
          </mesh>
          <mesh position={[0, -0.68, 0]}>
            <boxGeometry args={[0.13, 0.12, 0.14]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
      ))}
      {/* legs (pivot at hip) */}
      {[-0.14, 0.14].map((x, i) => (
        <group key={x} position={[x, 0.95, 0]} ref={(g: ThreeGroup | null) => { limbs.current[i + 2] = g; }}>
          <mesh position={[0, -0.44, 0]} castShadow>
            <boxGeometry args={[0.2, 0.82, 0.22]} />
            <meshStandardMaterial color={pants} />
          </mesh>
          <mesh position={[0, -0.88, -0.06]}>
            <boxGeometry args={[0.22, 0.12, 0.36]} />
            <meshStandardMaterial color="#efece4" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function PlayerCar({ vehicleId, groupRef }: { vehicleId: string; groupRef: MutableRefObject<ThreeGroup | null> }) {
  const spec = DRIVABLE[vehicleId] ?? DRIVABLE['test-car'];
  const geo = useMemo(() => {
    const g = new GeoBuilder();
    addCar(g, 0, 0, 0, spec.kind, 0, spec.color);
    return g.build();
  }, [spec.kind, spec.color]);
  return (
    <group ref={groupRef}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial vertexColors roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  );
}

/** Distant Midtown & Lower Manhattan skyline beyond the fog. */
function Skyline() {
  return (
    <group>
      {/* Empire State Building — north-west, up the grid */}
      <group position={[-380, 0, -1450]}>
        {[[60, 140, 50], [44, 230, 36], [30, 300, 26], [18, 345, 16], [8, 370, 8]].map(([w, h, d], i) => (
          <mesh key={i} position={[0, h / 2, 0]}><boxGeometry args={[w, h, d]} /><meshBasicMaterial color="#8d9aa6" fog={false} /></mesh>
        ))}
        <mesh position={[0, 400, 0]}><cylinderGeometry args={[0.6, 2, 60, 6]} /><meshBasicMaterial color="#8d9aa6" fog={false} /></mesh>
      </group>
      {/* Chrysler Building */}
      <group position={[-200, 0, -1250]}>
        <mesh position={[0, 120, 0]}><boxGeometry args={[34, 240, 34]} /><meshBasicMaterial color="#95a1ac" fog={false} /></mesh>
        <mesh position={[0, 265, 0]}><coneGeometry args={[16, 70, 8]} /><meshBasicMaterial color="#a7b2bb" fog={false} /></mesh>
      </group>
      {/* One World Trade Center — south-west */}
      <group position={[-520, 0, 1450]}>
        <mesh position={[0, 200, 0]} rotation={[0, Math.PI / 4, 0]}><cylinderGeometry args={[20, 42, 400, 4]} /><meshBasicMaterial color="#9aa8b4" fog={false} /></mesh>
        <mesh position={[0, 440, 0]}><cylinderGeometry args={[0.6, 1.4, 90, 6]} /><meshBasicMaterial color="#9aa8b4" fog={false} /></mesh>
      </group>
      {/* generic Midtown mass */}
      {Array.from({ length: 22 }, (_, i) => {
        const x = -900 + i * 60 + ((i * 37) % 23);
        const h = 80 + ((i * 53) % 140);
        return <mesh key={i} position={[x, h / 2, -1320 - ((i * 29) % 90)]}><boxGeometry args={[40, h, 40]} /><meshBasicMaterial color="#a3aeb8" fog={false} /></mesh>;
      })}
    </group>
  );
}

export function WorldScene(props: SceneProps) {
  const {
    location, initialPose, input, onPoseChange, onToggleDrive, onPlaceFurniture, onInspectFurniture,
    placements, pendingFurnitureId, character, driving, paused, onNearbyChange, vehicleId, onPlaceChange,
  } = props;

  const actor = useRef<ThreeGroup | null>(null);
  const vehicle = useRef<ThreeGroup | null>(null);
  const sun = useRef<ThreeDirectionalLight | null>(null);
  const carId = vehicleId && DRIVABLE[vehicleId] ? vehicleId : 'test-car';
  const carSpot = carId === 'test-car' ? TEST_CAR_PARKING : OWNED_PARKING;
  const carPose = useRef({ ...carSpot, speed: 0 });
  const pose = useRef<WorldPose>(
    location === 'street' && blocked(initialPose.x, initialPose.z, 0.35) ? { ...HOME_DOOR_POSE } : { ...initialPose },
  );
  const previousLocation = useRef(location);
  const yaw = useRef(initialPose.yaw || 0);
  const cameraYaw = useRef(pose.current.yaw || 0);
  const cameraPitch = useRef(0);
  const lastManualLook = useRef(-10);
  const lastPoseNotify = useRef(0);
  const lastPlace = useRef('');
  const lastNearbyNotify = useRef<WorldInteraction | null>(null);
  const wasDriving = useRef(driving);
  const [gait, setGait] = useState<'idle' | 'walk' | 'run'>('idle');

  // Re-park the car when the vehicle you own changes.
  useEffect(() => {
    if (!driving) carPose.current = { ...carSpot, speed: 0 };
  }, [carId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (previousLocation.current === location) return;
    previousLocation.current = location;
    pose.current = location === 'apartment' ? { x: 0, z: 3.2, yaw: 0 } : { ...HOME_DOOR_POSE };
    yaw.current = pose.current.yaw;
    cameraYaw.current = pose.current.yaw;
    cameraPitch.current = 0;
  }, [location]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const controls = input.current;
    const street = location === 'street';

    if (controls.cameraX || controls.cameraY) lastManualLook.current = state.clock.elapsedTime;
    cameraYaw.current += controls.cameraX;
    cameraPitch.current = clamp(cameraPitch.current + controls.cameraY * 0.01, -0.65, 0.65);
    controls.cameraX = 0;
    controls.cameraY = 0;

    // Getting in / out of the car.
    if (wasDriving.current !== driving) {
      wasDriving.current = driving;
      if (driving) {
        carPose.current.speed = 0;
        cameraYaw.current = carPose.current.yaw;
      } else {
        const c = carPose.current;
        const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
        const spots = [[-rx * 1.9, -rz * 1.9], [rx * 1.9, rz * 1.9], [Math.sin(c.yaw) * 3.4, Math.cos(c.yaw) * 3.4]];
        const free = spots.find(([dx, dz]) => !blocked(c.x + dx, c.z + dz, 0.35)) ?? spots[0];
        pose.current = { x: c.x + free[0], z: c.z + free[1], yaw: c.yaw };
        c.speed = 0;
      }
    }

    const moveX = paused ? 0 : (controls.right ? 1 : 0) - (controls.left ? 1 : 0) + controls.stickX;
    const moveY = paused ? 0 : (controls.back ? 1 : 0) - (controls.forward ? 1 : 0) + controls.stickY;
    let moved = false;

    if (driving && street) {
      const c = carPose.current;
      const spec = DRIVABLE[carId];
      const throttle = clamp(-moveY, -1, 1);
      const steer = clamp(moveX, -1, 1);
      if (throttle > 0.05) c.speed += (c.speed < 0 ? spec.accel * 2 : spec.accel) * throttle * dt;
      else if (throttle < -0.05) c.speed += (c.speed > 0 ? -spec.accel * 2.2 : -spec.accel * 0.6) * -throttle * dt;
      else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 3.2 * dt);
      c.speed = clamp(c.speed, -5, controls.sprint ? spec.top * 1.25 : spec.top);
      c.yaw -= steer * 1.9 * dt * clamp(c.speed / 5, -1, 1);
      const nx = c.x - Math.sin(c.yaw) * c.speed * dt;
      const nz = c.z - Math.cos(c.yaw) * c.speed * dt;
      const fx = nx - Math.sin(c.yaw) * Math.sign(c.speed || 1) * 1.6;
      const fz = nz - Math.cos(c.yaw) * Math.sign(c.speed || 1) * 1.6;
      if (blocked(nx, nz, 0.95) || blocked(fx, fz, 0.85)) {
        c.speed *= -0.25;
      } else {
        c.x = nx;
        c.z = nz;
      }
      moved = Math.abs(c.speed) > 0.1;
      pose.current = { x: c.x, z: c.z, yaw: c.yaw };
      yaw.current = c.yaw;
      if (state.clock.elapsedTime - lastManualLook.current > 1.2) {
        let diff = c.yaw - cameraYaw.current;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        cameraYaw.current += diff * Math.min(1, dt * 2.5);
      }
    } else {
      const magnitude = Math.min(1, Math.hypot(moveX, moveY));
      const running = controls.sprint && street;
      const speed = running ? 6.2 : 3.3;
      if (magnitude > 0.05) {
        const length = Math.hypot(moveX, moveY) || 1;
        const localX = moveX / length;
        const localZ = moveY / length;
        const sin = Math.sin(cameraYaw.current);
        const cos = Math.cos(cameraYaw.current);
        const dx = (localX * cos + localZ * sin) * speed * dt * magnitude;
        const dz = (-localX * sin + localZ * cos) * speed * dt * magnitude;
        const hit = (x: number, z: number) => street
          ? blocked(x, z, 0.34)
          : INTERIOR_COLLIDERS.some((b) => Math.abs(x - b.x) < b.w / 2 + 0.34 && Math.abs(z - b.z) < b.d / 2 + 0.34);
        const bx = hit(pose.current.x + dx, pose.current.z);
        if (!bx) pose.current.x += dx;
        const bz = hit(pose.current.x, pose.current.z + dz);
        if (!bz) pose.current.z += dz;
        moved = !bx || !bz;
        if (moved) yaw.current = Math.atan2(dx, dz) + Math.PI;
      }
      const nextGait = moved ? (running ? 'run' : 'walk') : 'idle';
      setGait((g) => (g === nextGait ? g : nextGait));
    }
    if (driving) setGait((g) => (g === 'idle' ? g : 'idle'));

    // What's nearby?
    let found: WorldInteraction | null = null;
    if (street) {
      if (driving) {
        found = Math.abs(carPose.current.speed) < 1.5 ? 'test-car' : null;
      } else {
        const c = carPose.current;
        if (Math.hypot(pose.current.x - c.x, pose.current.z - c.z) < 3) found = 'test-car';
        else {
          let best = Infinity;
          for (const p of POIS) {
            const d = Math.hypot(pose.current.x - p.x, pose.current.z - p.z);
            if (d < p.radius && d < best) { best = d; found = p.id; }
          }
        }
      }
    } else if (Math.hypot(pose.current.x, pose.current.z - 4.1) < 1.8) {
      found = 'apartment-exit';
    }
    if (found !== lastNearbyNotify.current) {
      lastNearbyNotify.current = found;
      onNearbyChange(found);
    }

    actor.current?.position.set(pose.current.x, street ? 0.15 : 0, pose.current.z);
    if (actor.current) actor.current.rotation.y = yaw.current;
    if (vehicle.current) {
      vehicle.current.position.set(carPose.current.x, 0, carPose.current.z);
      vehicle.current.rotation.y = carPose.current.yaw;
    }

    // Third-person camera that pulls in instead of clipping into buildings.
    const wantDist = driving ? 10 : 6.5;
    const sinY = Math.sin(cameraYaw.current), cosY = Math.cos(cameraYaw.current);
    let dist = wantDist;
    if (street) {
      for (let d = 1.2; d <= wantDist; d += 0.5) {
        if (blocked(pose.current.x + sinY * d, pose.current.z + cosY * d, 0.35, BUILDING_COLLIDERS)) { dist = Math.max(1.2, d - 0.6); break; }
      }
    } else {
      dist = Math.min(dist, 5.2);
    }
    const follow = 1 - Math.exp(-6 * dt);
    const camX = pose.current.x + sinY * dist;
    const camZ = pose.current.z + cosY * dist;
    const camY = (driving ? 4.2 : 3.4) + Math.sin(cameraPitch.current) * 2.5;
    const targetY = (driving ? 1.4 : 1.6) - Math.sin(cameraPitch.current) * 3.5;
    state.camera.position.x += (camX - state.camera.position.x) * follow;
    state.camera.position.y += (camY - state.camera.position.y) * follow;
    state.camera.position.z += (camZ - state.camera.position.z) * follow;
    state.camera.lookAt(pose.current.x, targetY, pose.current.z);

    // Sun + shadow frustum follow the player.
    if (sun.current) {
      sun.current.position.set(pose.current.x - 40, 80, pose.current.z + 30);
      sun.current.target.position.set(pose.current.x, 0, pose.current.z);
      sun.current.target.updateMatrixWorld();
    }

    if (state.clock.elapsedTime - lastPoseNotify.current > 0.5) {
      lastPoseNotify.current = state.clock.elapsedTime;
      onPoseChange({ x: pose.current.x, z: pose.current.z, yaw: yaw.current });
      if (street && onPlaceChange) {
        const place = describePlace(pose.current.x, pose.current.z);
        const key = `${place.street}|${place.hood}`;
        if (key !== lastPlace.current) { lastPlace.current = key; onPlaceChange(place); }
      }
    }
  });

  return (
    <>
      <color attach="background" args={[location === 'street' ? '#b9cdd8' : '#2a2420']} />
      {location === 'street' && <fog attach="fog" args={['#c3d2da', 70, 300]} />}
      <hemisphereLight args={['#dfeaf2', '#5b5148', location === 'street' ? 1.05 : 0.6]} />
      <directionalLight
        ref={sun}
        position={[-40, 80, 30]}
        intensity={location === 'street' ? 2.3 : 0.6}
        color="#fff1dc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-camera-near={10}
        shadow-camera-far={220}
        shadow-bias={-0.0005}
      />

      {location === 'street' ? (
        <>
          <NycCity />
          <Skyline />
          <group onClick={() => { if (!driving) onToggleDrive(); }}>
            <PlayerCar vehicleId={carId} groupRef={vehicle} />
          </group>
        </>
      ) : (
        <ApartmentInterior placements={placements} pendingFurnitureId={pendingFurnitureId} onPlaceFurniture={onPlaceFurniture} onInspectFurniture={onInspectFurniture} />
      )}

      <group ref={actor}>
        <Avatar character={character} walking={gait !== 'idle'} running={gait === 'run'} driving={driving} />
      </group>
    </>
  );
}

export default WorldScene;
