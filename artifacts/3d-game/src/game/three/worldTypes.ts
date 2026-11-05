export type WorldLocation = 'street' | 'apartment';

export type WorldInteraction =
  | 'apartment'
  | 'apartment-exit'
  | 'furniture-shop'
  | 'dealership'
  | 'test-car'
  | 'deli'
  | 'laundromat'
  | 'subway'
  | 'pizza'
  | 'job-barista'
  | 'job-courier'
  | 'job-photo-assistant';

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
  /** Owned car id (if any) parked outside your building; otherwise the dealership loaner is used. */
  vehicleId?: string | null;
  onPoseChange: (pose: WorldPose) => void;
  onLocationChange: (location: WorldLocation) => void;
  onInteract: (target: WorldInteraction) => void;
  onToggleDrive: () => void;
  onPlaceFurniture: (itemId: string, x: number, z: number, rotation: number) => void;
  onInspectFurniture: (itemId: string | null) => void;
  /** Called when the player's street address / neighbourhood changes. */
  onPlaceChange?: (place: { street: string; hood: string }) => void;
}
