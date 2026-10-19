export type WorldLocation = 'street' | 'apartment';

export type WorldInteraction =
  | 'apartment'
  | 'apartment-exit'
  | 'furniture-shop'
  | 'dealership'
  | 'test-car';

export interface WorldPose {
  x: number;
  z: number;
  yaw: number;
}

export interface FurniturePlacement {
  itemId: string;
  x: number;
  z: number;
  rotation: number;
}

export interface CityWorldProps {
  location: WorldLocation;
  initialPose: WorldPose;
  character: string;
  placements: FurniturePlacement[];
  pendingFurnitureId: string | null;
  driving: boolean;
  paused: boolean;
  onPoseChange: (pose: WorldPose) => void;
  onLocationChange: (location: WorldLocation) => void;
  onInteract: (target: WorldInteraction) => void;
  onToggleDrive: () => void;
  onPlaceFurniture: (itemId: string, x: number, z: number, rotation: number) => void;
  onInspectFurniture: (itemId: string | null) => void;
}
