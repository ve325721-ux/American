import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import type {
  CityWorldProps,
  FurniturePlacement,
  WorldInteraction,
  WorldPose,
} from './worldTypes';

interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
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

const STREET_COLLIDERS: BoxCollider[] = [
  { x: -8, z: -9, w: 7, d: 5 },
  { x: 0, z: -9, w: 7, d: 5 },
  { x: 8, z: -9, w: 7, d: 5 },
  { x: -15, z: 7, w: 6, d: 7 },
  { x: 14, z: 7, w: 7, d: 8 },
];

const INTERIOR_COLLIDERS: BoxCollider[] = [
  { x: 0, z: -5.05, w: 10.2, d: 0.35 },
  { x: -5.05, z: 0, w: 0.35, d: 10.2 },
  { x: 5.05, z: 0, w: 0.35, d: 10.2 },
  { x: -3.7, z: 5.05, w: 2.6, d: 0.35 },
  { x: 3.7, z: 5.05, w: 2.6, d: 0.35 },
];

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

function Sign({
  x,
  z,
  color,
  title,
  detail,
}: {
  x: number;
  z: number;
  color: string;
  title: string;
  detail: string;
}) {
  return (
    <group position={[x, 3.9, z]}>
      <Block position={[0, 0, 0]} size={[3.5, 0.8, 0.16]} color={color} />
      <Block
        position={[0, -0.49, 0]}
        size={[0.1, 0.2, 0.16]}
        color="#6d6659"
      />
      <Block
        position={[-0.8, 0, 0.1]}
        size={[0.12, 0.5, 0.03]}
        color="#f5ead5"
      />
      <Block
        position={[0.1, 0, 0.1]}
        size={[0.12, 0.5, 0.03]}
        color="#f5ead5"
      />
      <Block
        position={[1, 0, 0.1]}
        size={[0.12, 0.5, 0.03]}
        color="#f5ead5"
      />
      <mesh position={[0, -0.25, 0.12]}>
        <boxGeometry args={[2.8, 0.05, 0.02]} />
        <meshStandardMaterial color={detail} />
      </mesh>
      <group userData={{ title }} />
    </group>
  );
}

function Building({
  x,
  z,
  color,
  floors = 2,
  shop = false,
  name,
  marker,
}: {
  x: number;
  z: number;
  color: string;
  floors?: number;
  shop?: boolean;
  name: string;
  marker: string;
}) {
  const height = floors * 2.35;

  return (
    <group position={[x, 0, z]}>
      <Block
        position={[0, height / 2, 0]}
        size={[7, height, 5]}
        color={color}
      />
      <Block
        position={[0, height + 0.13, 0]}
        size={[7.35, 0.32, 5.3]}
        color={shop ? '#3e4645' : '#736c61'}
      />

      {Array.from({ length: floors }, (_, floor) =>
        [-2.1, 0, 2.1].map((wx, index) => (
          <group
            key={`${floor}-${index}`}
            position={[wx, 1.25 + floor * 2.35, 2.53]}
          >
            <Block
              position={[0, 0, 0]}
              size={[0.94, 1.22, 0.08]}
              color={shop && floor === 0 ? '#304d52' : '#b9d6cd'}
            />
            <Block
              position={[0, 0, 0.05]}
              size={[0.09, 1.25, 0.07]}
              color="#eee2c9"
            />
            <Block
              position={[0, 0, 0.06]}
              size={[0.94, 0.08, 0.07]}
              color="#eee2c9"
            />
            {floor > 0 && (
              <Block
                position={[0, -0.72, 0.12]}
                size={[1.16, 0.1, 0.22]}
                color="#8c5441"
              />
            )}
          </group>
        )),
      )}

      <Block
        position={[0, 1.05, 2.57]}
        size={[1.05, 2.05, 0.15]}
        color={shop ? '#25494b' : '#76533e'}
      />
      <Block
        position={[0, 2.18, 2.65]}
        size={[1.55, 0.2, 0.22]}
        color="#e2c77c"
      />
      <Block
        position={[0, height + 0.48, 0]}
        size={[2.1, 0.38, 0.18]}
        color={shop ? '#c94d2f' : '#31484b'}
      />

      <Sign
        x={0}
        z={2.73}
        color={shop ? '#ae4e36' : '#344c4b'}
        title={name}
        detail={marker}
      />
    </group>
  );
}

function Streetlight({
  position,
}: {
  position: [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.08, 0.13, 4, 5]} />
        <meshStandardMaterial color="#4a4c45" />
      </mesh>
      <Block
        position={[0.48, 3.75, 0]}
        size={[1.05, 0.12, 0.12]}
        color="#4a4c45"
      />
      <Block
        position={[0.92, 3.55, 0]}
        size={[0.38, 0.35, 0.32]}
        color="#f2ca72"
      />
    </group>
  );
}

function Tree({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.14, 0.22, 1.6, 5]} />
        <meshStandardMaterial color="#725643" />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <icosahedronGeometry args={[1.05, 0]} />
        <meshStandardMaterial color="#66836b" flatShading />
      </mesh>
      <mesh position={[-0.34, 2.38, 0.16]}>
        <icosahedronGeometry args={[0.64, 0]} />
        <meshStandardMaterial color="#81946c" flatShading />
      </mesh>
    </group>
  );
}

type GroupHandle = {
  position: { set: (x: number, y: number, z: number) => void };
  rotation: { y: number };
};

function Car({
  position,
  rotation = 0,
  onClick,
  groupRef,
}: {
  position: [number, number, number];
  rotation?: number;
  onClick?: () => void;
  groupRef?: (group: GroupHandle | null) => void;
}) {
  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotation, 0]}
      onClick={onClick}
    >
      <Block
        position={[0, 0.58, 0]}
        size={[2.05, 0.62, 3.65]}
        color="#c94d2f"
      />
      <Block
        position={[0, 1.07, -0.15]}
        size={[1.54, 0.62, 1.82]}
        color="#e3d9c4"
      />
      <Block
        position={[0, 1.1, -0.15]}
        size={[1.3, 0.45, 1.63]}
        color="#7caaa7"
      />

      {[-1, 1].map((side) =>
        [-1.12, 1.12].map((front) => (
          <mesh
            key={`${side}-${front}`}
            position={[side * 0.96, 0.42, front]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.35, 0.35, 0.16, 8]} />
            <meshStandardMaterial color="#393d3b" />
          </mesh>
        )),
      )}

      <Block
        position={[0, 0.43, 1.83]}
        size={[1.45, 0.24, 0.08]}
        color="#f0d389"
      />
    </group>
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
}: Pick<
  SceneProps,
  | 'placements'
  | 'pendingFurnitureId'
  | 'onPlaceFurniture'
  | 'onInspectFurniture'
>) {
  const place = (event: {
    point: { x: number; z: number };
    stopPropagation: () => void;
  }) => {
    if (!pendingFurnitureId) return;

    event.stopPropagation();

    onPlaceFurniture(
      pendingFurnitureId,
      clamp(event.point.x, -4.1, 4.1),
      clamp(event.point.z, -4.1, 4.1),
      0,
    );
  };

  const furniture = [
    { id: 'sofa', x: -2.4, z: 1.6, rot: 0 },
    { id: 'television', x: -2.4, z: -1.55, rot: 0 },
    { id: 'bed', x: 2.8, z: -2.4, rot: Math.PI / 2 },
    { id: 'plant', x: 4, z: 1.8, rot: 0 },
    ...placements.map((item: FurniturePlacement) => ({
      id: item.itemId,
      x: item.x,
      z: item.z,
      rot: item.rotation,
    })),
  ];

  return (
    <group>
      <Block
        position={[0, -0.12, 0]}
        size={[10, 0.2, 10]}
        color="#d6c7ad"
        onClick={place}
      />
      <Block
        position={[0, 3, -5]}
        size={[10, 6, 0.3]}
        color="#e9ddc8"
      />
      <Block
        position={[-5, 3, 0]}
        size={[0.3, 6, 10]}
        color="#e6d9c2"
      />
      <Block
        position={[5, 3, 0]}
        size={[0.3, 6, 10]}
        color="#e6d9c2"
      />
      <Block
        position={[-3.7, 3, 5]}
        size={[2.6, 6, 0.3]}
        color="#e6d9c2"
      />
      <Block
        position={[3.7, 3, 5]}
        size={[2.6, 6, 0.3]}
        color="#e6d9c2"
      />
      <Block
        position={[0, 5.95, 0]}
        size={[10, 0.18, 10]}
        color="#d8c9b1"
      />
      <Block
        position={[0, 0.02, 0]}
        size={[0.3, 0.04, 9.7]}
        color="#c6b397"
      />
      <Block
        position={[0, 2.2, -4.78]}
        size={[2.2, 1.5, 0.12]}
        color="#8caa9d"
      />
      <Block
        position={[0, 2.2, -4.69]}
        size={[0.12, 1.5, 0.08]}
        color="#f5ead9"
      />
      <Block
        position={[0, 2.2, -4.68]}
        size={[2.2, 0.12, 0.08]}
        color="#f5ead9"
      />
      <Block
        position={[0, 2.8, 4.85]}
        size={[1.4, 2.7, 0.15]}
        color="#79533f"
      />
      <Block
        position={[-2.4, 0.84, -1.55]}
        size={[1.75, 1.05, 0.22]}
        color="#333b3e"
        onClick={(event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          onInspectFurniture('television');
        }}
      />

      {furniture.map((item, index) => (
        <FurnitureModel
          key={`${item.id}-${index}`}
          itemId={item.id}
          position={[item.x, 0, item.z]}
          rotation={item.rot}
          onClick={() => onInspectFurniture(item.id)}
        />
      ))}

      <Block
        position={[-2.25, 0.36, -3.1]}
        size={[0.95, 0.72, 0.72]}
        color="#aa7750"
        onClick={(event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          onInspectFurniture('coffee-table');
        }}
      />
      <Block
        position={[2.8, 0.18, -2.4]}
        size={[2.7, 0.35, 1.3]}
        color="#775340"
      />
    </group>
  );
}

function City({
  driving,
  onToggleDrive,
}: {
  onInteract: SceneProps['onInteract'];
  driving: boolean;
  onToggleDrive: () => void;
}) {
  return (
    <group>
      <Block
        position={[0, -0.22, 0]}
        size={[70, 0.4, 60]}
        color="#a9b8a2"
      />
      <Block
        position={[0, -0.04, 0]}
        size={[70, 0.12, 9]}
        color="#626b68"
      />

      {Array.from({ length: 13 }, (_, i) => (
        <Block
          key={i}
          position={[-30 + i * 5, 0.03, 0]}
          size={[2.2, 0.02, 0.12]}
          color="#e3d09b"
        />
      ))}

      <Block
        position={[0, 0.01, 6.3]}
        size={[70, 0.12, 2.4]}
        color="#d5c8ad"
      />
      <Block
        position={[0, 0.01, -6.3]}
        size={[70, 0.12, 2.4]}
        color="#d5c8ad"
      />

      <Building
        x={-8}
        z={-10}
        color="#b7785e"
        name="WALK-UP"
        marker="HOME"
      />
      <Building
        x={0}
        z={-10}
        color="#c7b08a"
        shop
        name="FURNITURE"
        marker="SHOP"
      />
      <Building
        x={8}
        z={-10}
        color="#7e9790"
        shop
        name="MOTOR ROW"
        marker="CARS"
      />
      <Building
        x={-17}
        z={8}
        color="#bd9d76"
        floors={3}
        name="CORNER DELI"
        marker="OPEN"
      />
      <Building
        x={17}
        z={8}
        color="#ad7060"
        floors={3}
        name="BROWNSTONE"
        marker="APT"
      />

      {[-24, -12, 0, 12, 24].map((x) => (
        <Streetlight key={x} position={[x, 0, -7.4]} />
      ))}

      {[-21, -6, 9, 22].map((x) => (
        <Tree
          key={x}
          position={[x, 0, 7.2]}
          scale={x % 2 ? 0.82 : 1}
        />
      ))}

      <group position={[-8, 0, -6.8]}>
        <Block
          position={[0, 1.1, 0]}
          size={[1.3, 2.2, 0.18]}
          color="#704632"
        />
        <Block
          position={[0, 2.35, 0.05]}
          size={[1.65, 0.18, 0.2]}
          color="#d4b96d"
        />
      </group>

      {!driving && (
        <Car
          position={[10, 0, -5.4]}
          onClick={() => {
            if (!driving) onToggleDrive();
          }}
        />
      )}
    </group>
  );
}

function Avatar({
  character,
  walking,
  driving,
}: {
  character: string;
  walking: boolean;
  driving: boolean;
}) {
  const bob = useRef<{ position: { y: number } } | null>(null);

  const outfit =
    character.toLowerCase() === 'creative'
      ? '#785e91'
      : character.toLowerCase() === 'street'
        ? '#4b7183'
        : character.toLowerCase() === 'polished'
          ? '#a78b51'
          : '#c94d2f';

  useFrame(({ clock }) => {
    if (bob.current) {
      bob.current.position.y = walking
        ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.07
        : 0;
    }
  });

  if (driving) return null;

  return (
    <group ref={bob}>
      <mesh position={[0, 1.48, 0]}>
        <capsuleGeometry args={[0.3, 0.72, 3, 6]} />
        <meshStandardMaterial color={outfit} flatShading />
      </mesh>

      <mesh position={[0, 2.16, 0]}>
        <dodecahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color="#c98f69" flatShading />
      </mesh>

      <mesh position={[0, 2.43, -0.02]}>
        <icosahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color="#493e36" flatShading />
      </mesh>

      {[-0.43, 0.43].map((x) => (
        <mesh key={x} position={[x, 1.45, 0]}>
          <capsuleGeometry args={[0.12, 0.54, 2, 5]} />
          <meshStandardMaterial color="#c98f69" />
        </mesh>
      ))}

      {[-0.17, 0.17].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.53, 0]}>
            <capsuleGeometry args={[0.14, 0.6, 2, 5]} />
            <meshStandardMaterial color="#343f49" />
          </mesh>
          <mesh position={[x, 0.15, -0.08]}>
            <boxGeometry args={[0.3, 0.18, 0.52]} />
            <meshStandardMaterial color="#665141" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function WorldScene(props: SceneProps) {
  const {
    location,
    initialPose,
    input,
    onPoseChange,
    onInteract,
    onToggleDrive,
    onPlaceFurniture,
    onInspectFurniture,
    placements,
    pendingFurnitureId,
    character,
    driving,
    paused,
    onNearbyChange,
  } = props;

  const actor = useRef<{
    position: { set: (x: number, y: number, z: number) => void };
    rotation: { y: number };
  } | null>(null);

  const vehicle = useRef<GroupHandle | null>(null);
  const pose = useRef<WorldPose>({ ...initialPose });
  const previousLocation = useRef(location);
  const yaw = useRef(initialPose.yaw || 0);

  // Camera rotation is independent of the character's movement direction.
  const cameraYaw = useRef(0);
  const cameraPitch = useRef(0);

  const lastPoseNotify = useRef(0);
  const lastNearbyNotify = useRef<WorldInteraction | null>(null);
  const wasDriving = useRef(driving);
  const [walking, setWalking] = useState(false);

  const collisions =
    location === 'street' ? STREET_COLLIDERS : INTERIOR_COLLIDERS;

  useEffect(() => {
    if (previousLocation.current === location) return;

    previousLocation.current = location;

    pose.current =
      location === 'apartment'
        ? { x: 0, z: 0, yaw: 0 }
        : { x: -8, z: -6.1, yaw: Math.PI };

    yaw.current = pose.current.yaw;
    cameraYaw.current = 0;
    cameraPitch.current = 0;
  }, [location]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const controls = input.current;

    // Horizontal and vertical camera input from touch dragging.
    cameraYaw.current += controls.cameraX;

    cameraPitch.current = clamp(
      cameraPitch.current + controls.cameraY * 0.01,
      -0.65,
      0.65,
    );

    // Consume each drag movement once.
    controls.cameraX = 0;
    controls.cameraY = 0;

    const moveX = paused
      ? 0
      : (controls.right ? 1 : 0) -
        (controls.left ? 1 : 0) +
        controls.stickX;

    const moveY = paused
      ? 0
      : (controls.back ? 1 : 0) -
        (controls.forward ? 1 : 0) +
        controls.stickY;

    const magnitude = Math.min(1, Math.hypot(moveX, moveY));
    const speed = driving ? 7 : 3.2;

    let moved = false;

    if (magnitude > 0.05) {
      const length = Math.hypot(moveX, moveY) || 1;
      const localX = moveX / length;
      const localZ = moveY / length;

      const sin = Math.sin(cameraYaw.current);
      const cos = Math.cos(cameraYaw.current);

      const dx =
        (localX * cos + localZ * sin) * speed * dt * magnitude;

      const dz =
        (-localX * sin + localZ * cos) * speed * dt * magnitude;

      const candidateX = pose.current.x + dx;
      const candidateZ = pose.current.z + dz;

      const blockedX = collisions.some(
        (box) =>
          Math.abs(candidateX - box.x) < box.w / 2 + 0.34 &&
          Math.abs(pose.current.z - box.z) < box.d / 2 + 0.34,
      );

      const blockedZ = collisions.some(
        (box) =>
          Math.abs(pose.current.x - box.x) < box.w / 2 + 0.34 &&
          Math.abs(candidateZ - box.z) < box.d / 2 + 0.34,
      );

      if (!blockedX) pose.current.x = candidateX;
      if (!blockedZ) pose.current.z = candidateZ;

      moved = !blockedX || !blockedZ;

      if (moved && !driving) {
        yaw.current = Math.atan2(dx, dz) + Math.PI;
      }
    }

    setWalking((previous) => {
      const next = moved && !driving;
      return previous !== next ? next : previous;
    });

    let found: WorldInteraction | null = null;

    const near = (x: number, z: number, radius: number) =>
      Math.hypot(pose.current.x - x, pose.current.z - z) < radius;

    if (location === 'street') {
      if (driving) {
        found = 'test-car';
      } else if (near(-8, -6.45, 2.35)) {
        found = 'apartment';
      } else if (near(0, -6.45, 2.5)) {
        found = 'furniture-shop';
      } else if (near(8, -6.5, 1.8)) {
        found = 'dealership';
      } else if (near(10, -5.4, 1.9)) {
        found = 'test-car';
      }

      if (driving && vehicle.current) {
        vehicle.current.position.set(
          pose.current.x,
          0,
          pose.current.z,
        );
        vehicle.current.rotation.y = yaw.current;
      }
    } else if (near(0, 4.1, 1.8)) {
      found = 'apartment-exit';
    }

    if (found !== lastNearbyNotify.current) {
      lastNearbyNotify.current = found;
      onNearbyChange(found);
    }

    if (actor.current) {
      actor.current.position.set(
        pose.current.x,
        0,
        pose.current.z,
      );
      actor.current.rotation.y = yaw.current;
    }

    if (!driving && vehicle.current) {
      vehicle.current.position.set(10, 0, -5.4);
    }

    // Third-person camera. Horizontal dragging rotates around the player.
    // Vertical dragging changes the viewing angle, with limits to prevent
    // the camera from flipping upside down.
    const lookDistance = 7;
    const follow = 1 - Math.exp(-5 * dt);

    const camX =
      pose.current.x + Math.sin(cameraYaw.current) * lookDistance;

    const camZ =
      pose.current.z + Math.cos(cameraYaw.current) * lookDistance;

    const camY = 4.4 + Math.sin(cameraPitch.current) * 2.5;

    const targetY =
      1.1 - Math.sin(cameraPitch.current) * 4;

    state.camera.position.x +=
      (camX - state.camera.position.x) * follow;

    state.camera.position.y +=
      (camY - state.camera.position.y) * follow;

    state.camera.position.z +=
      (camZ - state.camera.position.z) * follow;

    state.camera.lookAt(
      pose.current.x,
      targetY,
      pose.current.z,
    );

    if (state.clock.elapsedTime - lastPoseNotify.current > 0.65) {
      lastPoseNotify.current = state.clock.elapsedTime;

      onPoseChange({
        x: pose.current.x,
        z: pose.current.z,
        yaw: yaw.current,
      });
    }

    if (wasDriving.current !== driving) {
      wasDriving.current = driving;
    }
  });

  const testCarClick = () => {
    if (!driving) onToggleDrive();
  };

  return (
    <>
      <color
        attach="background"
        args={[location === 'street' ? '#b8d1ce' : '#d8ccba']}
      />

      <ambientLight intensity={1.15} />
      <directionalLight position={[-5, 10, 6]} intensity={1.4} />

      {location === 'street' ? (
        <City
          onInteract={onInteract}
          driving={driving}
          onToggleDrive={testCarClick}
        />
      ) : (
        <ApartmentInterior
          placements={placements}
          pendingFurnitureId={pendingFurnitureId}
          onPlaceFurniture={onPlaceFurniture}
          onInspectFurniture={onInspectFurniture}
        />
      )}

      {driving && location === 'street' && (
        <Car
          position={[pose.current.x, 0, pose.current.z]}
          rotation={yaw.current}
          groupRef={(group) => {
            vehicle.current = group;
          }}
        />
      )}

      <group ref={actor}>
        <Avatar
          character={character}
          walking={walking}
          driving={driving}
        />
      </group>
    </>
  );
}

export default WorldScene;