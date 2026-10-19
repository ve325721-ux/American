import { useCallback, useEffect, useState } from "react";
import type { FurniturePlacement, WorldLocation, WorldPose } from "./three/worldTypes";

export type Direction = "north" | "south" | "east" | "west";
export type TransactionKind = "income" | "expense" | "bank";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  kind: TransactionKind;
  amount: number;
}

export interface GameState {
  username: string;
  character: string;
  position: { lat: number; lng: number };
  worldPose: WorldPose;
  worldLocation: WorldLocation;
  cash: number;
  bank: number;
  hunger: number;
  energy: number;
  hygiene: number;
  apartmentId: string;
  vehicles: string[];
  furniture: string[];
  placedFurniture: FurniturePlacement[];
  inventory: Record<string, number>;
  transactions: Transaction[];
}

export interface Job {
  id: string;
  name: string;
  description: string;
  pay: number;
  energyCost: number;
  hungerCost: number;
}

export interface Vehicle {
  id: string;
  name: string;
  type: string;
  price: number;
  description: string;
}

export interface Furniture {
  id: string;
  name: string;
  price: number;
  description: string;
}

export interface Supply {
  id: string;
  name: string;
  price: number;
  description: string;
  effect: "hunger" | "energy" | "hygiene";
  restore: number;
}

export interface Apartment {
  id: string;
  name: string;
  rent: number;
  description: string;
}

export const JOBS: Job[] = [
  { id: "barista", name: "Barista shift", description: "A morning behind the counter in Midtown.", pay: 180, energyCost: 9, hungerCost: 6 },
  { id: "courier", name: "Bike courier", description: "Beat the traffic and deliver downtown.", pay: 245, energyCost: 16, hungerCost: 12 },
  { id: "photo-assistant", name: "Photo assistant", description: "Help a local crew on a street shoot.", pay: 320, energyCost: 21, hungerCost: 10 },
];

export const CARS: Vehicle[] = [
  { id: "city-bike", name: "City Bike", type: "Two wheels", price: 450, description: "A reliable ride for getting around the boroughs." },
  { id: "used-sedan", name: "Used Sedan", type: "Compact", price: 2400, description: "A little worn, but it gets you there." },
  { id: "electric-hatch", name: "Electric Hatch", type: "Electric", price: 18500, description: "Quiet, quick, and ready for the next chapter." },
  { id: "luxury-suv", name: "Luxury SUV", type: "Luxury", price: 74000, description: "A top-floor view of the city, wherever you go." },
];

export const FURNITURE: Furniture[] = [
  { id: "mattress", name: "Real Mattress", price: 120, description: "A proper place to recharge at home." },
  { id: "houseplant", name: "Window Plant", price: 85, description: "A little green for a small apartment." },
  { id: "sofa", name: "Secondhand Sofa", price: 360, description: "Room for a friend and a slow Sunday." },
  { id: "desk", name: "Work Desk", price: 210, description: "A place to plan the next move." },
];

export const SUPPLIES: Supply[] = [
  { id: "deli-sandwich", name: "Deli Sandwich", price: 14, description: "A quick meal from the corner deli.", effect: "hunger", restore: 38 },
  { id: "energy-drink", name: "Energy Drink", price: 8, description: "A quick boost for the afternoon.", effect: "energy", restore: 24 },
  { id: "soap", name: "Soap & Shampoo", price: 11, description: "The essentials for a fresh start.", effect: "hygiene", restore: 42 },
];

export const APARTMENTS: Apartment[] = [
  { id: "walkup", name: "Walk-up Studio", rent: 0, description: "Your first keys. Small, affordable, all yours." },
  { id: "brownstone", name: "Brooklyn Brownstone", rent: 4800, description: "A sunlit brownstone with room to breathe." },
  { id: "skyline", name: "Midtown Skyline", rent: 22000, description: "A corner apartment above the city lights." },
];

const STORAGE_KEY = "american-dream-nyc-save-v1";
const STARTING_POSITION = { lat: 40.758, lng: -73.9855 };
const CITY_BOUNDS = { north: 40.92, south: 40.57, east: -73.69, west: -74.06 };
const STARTING_WORLD_POSE: WorldPose = { x: 0, z: 4, yaw: 0 };

function makeTransaction(description: string, amount: number, kind: TransactionKind): Transaction {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    description,
    kind,
    amount,
  };
}

function withTransaction(game: GameState, description: string, amount: number, kind: TransactionKind): GameState {
  return { ...game, transactions: [makeTransaction(description, amount, kind), ...game.transactions].slice(0, 60) };
}

function bounded(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function freshGame(username: string, character: string): GameState {
  return {
    username: username.trim().slice(0, 20),
    character,
    position: STARTING_POSITION,
    worldPose: STARTING_WORLD_POSE,
    worldLocation: "street",
    cash: 1000,
    bank: 0,
    hunger: 88,
    energy: 92,
    hygiene: 86,
    apartmentId: "walkup",
    vehicles: [],
    furniture: [],
    placedFurniture: [],
    inventory: {},
    transactions: [makeTransaction("Welcome to New York", 1000, "income")],
  };
}

function isValidSave(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const game = value as Partial<GameState>;
  return typeof game.username === "string"
    && typeof game.character === "string"
    && typeof game.cash === "number"
    && typeof game.bank === "number"
    && typeof game.position?.lat === "number"
    && typeof game.position?.lng === "number"
    && Array.isArray(game.transactions)
    && Array.isArray(game.vehicles)
    && Array.isArray(game.furniture)
    && !!game.inventory
    && typeof game.inventory === "object";
}

function normalizeSave(game: GameState): GameState {
  const savedPose = (game as GameState & { worldPose?: Partial<WorldPose> }).worldPose;
  const worldPose = savedPose
    && Number.isFinite(savedPose.x)
    && Number.isFinite(savedPose.z)
    && Number.isFinite(savedPose.yaw)
    ? { x: savedPose.x as number, z: savedPose.z as number, yaw: savedPose.yaw as number }
    : STARTING_WORLD_POSE;
  const savedPlacements = (game as GameState & { placedFurniture?: unknown }).placedFurniture;
  return {
    ...game,
    worldPose,
    worldLocation: (game as GameState & { worldLocation?: string }).worldLocation === "apartment" ? "apartment" : "street",
    placedFurniture: Array.isArray(savedPlacements)
      ? savedPlacements.filter((placement): placement is FurniturePlacement => {
        if (!placement || typeof placement !== "object") return false;
        const item = placement as Partial<FurniturePlacement>;
        return typeof item.itemId === "string"
          && Number.isFinite(item.x)
          && Number.isFinite(item.z)
          && Number.isFinite(item.rotation);
      })
      : [],
  };
}

function readSave(): { game: GameState | null; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { game: null, error: null };
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSave(parsed)) return { game: null, error: "Your saved game could not be read. Start a new game to continue." };
    return { game: normalizeSave(parsed), error: null };
  } catch {
    return { game: null, error: "Your saved game could not be loaded. Check browser storage, then start a new game." };
  }
}

export function useGameState() {
  const [initial] = useState(readSave);
  const [game, setGame] = useState<GameState | null>(initial.game);
  const [saveError, setSaveError] = useState<string | null>(initial.error);

  useEffect(() => {
    if (!game) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
      setSaveError(null);
    } catch {
      setSaveError("Progress could not be saved in this browser. Free up storage or enable site data.");
    }
  }, [game]);

  const createPlayer = useCallback((username: string, character: string) => {
    if (!username.trim()) {
      setSaveError("Choose a username before starting.");
      return;
    }
    setGame(freshGame(username, character));
  }, []);

  const updateWorldPose = useCallback((pose: WorldPose) => {
    if (![pose.x, pose.z, pose.yaw].every(Number.isFinite)) return;
    const boundedPose = {
      x: Math.max(-28, Math.min(28, pose.x)),
      z: Math.max(-32, Math.min(32, pose.z)),
      yaw: pose.yaw,
    };
    setGame((current) => current ? { ...current, worldPose: boundedPose } : current);
  }, []);

  const setWorldLocation = useCallback((worldLocation: WorldLocation) => {
    setGame((current) => current && current.worldLocation !== worldLocation
      ? { ...current, worldLocation }
      : current);
  }, []);

  const move = useCallback((direction: Direction) => {
    setGame((current) => {
      if (!current) return current;
      const step = 0.0015;
      const delta = {
        north: { lat: step, lng: 0 },
        south: { lat: -step, lng: 0 },
        east: { lat: 0, lng: step * 1.32 },
        west: { lat: 0, lng: -step * 1.32 },
      }[direction];
      const position = {
        lat: Math.max(CITY_BOUNDS.south, Math.min(CITY_BOUNDS.north, current.position.lat + delta.lat)),
        lng: Math.max(CITY_BOUNDS.west, Math.min(CITY_BOUNDS.east, current.position.lng + delta.lng)),
      };
      return { ...current, position, energy: bounded(current.energy - 1), hunger: bounded(current.hunger - 1) };
    });
  }, []);

  const work = useCallback((jobId: string) => {
    const job = JOBS.find((item) => item.id === jobId);
    if (!job) return;
    setGame((current) => {
      if (!current) return current;
      if (current.energy < job.energyCost || current.hunger < job.hungerCost) {
        setSaveError("You need more energy and food before taking this shift.");
        return current;
      }
      setSaveError(null);
      return withTransaction({
        ...current,
        cash: current.cash + job.pay,
        energy: bounded(current.energy - job.energyCost),
        hunger: bounded(current.hunger - job.hungerCost),
        hygiene: bounded(current.hygiene - 3),
      }, job.name, job.pay, "income");
    });
  }, []);

  const bank = useCallback((action: "deposit" | "withdraw", amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setGame((current) => {
      if (!current) return current;
      const value = Math.floor(amount);
      if (action === "deposit" && value <= current.cash) {
        setSaveError(null);
        return withTransaction({ ...current, cash: current.cash - value, bank: current.bank + value }, "Cash deposited", value, "bank");
      }
      if (action === "withdraw" && value <= current.bank) {
        setSaveError(null);
        return withTransaction({ ...current, cash: current.cash + value, bank: current.bank - value }, "Cash withdrawn", value, "bank");
      }
      setSaveError(action === "deposit" ? "You do not have that much cash on hand." : "Your bank balance is too low for that withdrawal.");
      return current;
    });
  }, []);

  const buyCar = useCallback((carId: string) => {
    const car = CARS.find((item) => item.id === carId);
    if (!car) return;
    setGame((current) => {
      if (!current) return current;
      if (current.vehicles.includes(carId)) {
        setSaveError("You already own this vehicle.");
        return current;
      }
      if (current.cash < car.price) {
        setSaveError("Not enough cash. Pick up a shift and come back.");
        return current;
      }
      setSaveError(null);
      return withTransaction({ ...current, cash: current.cash - car.price, vehicles: [...current.vehicles, carId] }, `Purchased ${car.name}`, -car.price, "expense");
    });
  }, []);

  const buyFurniture = useCallback((itemId: string) => {
    const item = FURNITURE.find((entry) => entry.id === itemId);
    if (!item) return;
    setGame((current) => {
      if (!current) return current;
      if (current.furniture.includes(itemId)) {
        setSaveError("You already have this piece at home.");
        return current;
      }
      if (current.cash < item.price) {
        setSaveError("Not enough cash for this furniture.");
        return current;
      }
      setSaveError(null);
      return withTransaction({ ...current, cash: current.cash - item.price, furniture: [...current.furniture, itemId] }, `Bought ${item.name}`, -item.price, "expense");
    });
  }, []);

  const placeFurniture = useCallback((itemId: string, x: number, z: number, rotation: number) => {
    if (![x, z, rotation].every(Number.isFinite)) return;
    setGame((current) => {
      if (!current) return current;
      if (!current.furniture.includes(itemId)) {
        setSaveError("You need to buy this furniture before placing it.");
        return current;
      }
      const placement = {
        itemId,
        x: Math.max(-3.1, Math.min(3.1, x)),
        z: Math.max(-4.4, Math.min(4.4, z)),
        rotation: ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
      };
      setSaveError(null);
      return {
        ...current,
        placedFurniture: [
          ...current.placedFurniture.filter((item) => item.itemId !== itemId),
          placement,
        ],
      };
    });
  }, []);

  const buySupply = useCallback((itemId: string) => {
    const item = SUPPLIES.find((entry) => entry.id === itemId);
    if (!item) return;
    setGame((current) => {
      if (!current) return current;
      if (current.cash < item.price) {
        setSaveError("Not enough cash for this item.");
        return current;
      }
      setSaveError(null);
      return withTransaction({
        ...current,
        cash: current.cash - item.price,
        inventory: { ...current.inventory, [itemId]: (current.inventory[itemId] ?? 0) + 1 },
      }, `Bought ${item.name}`, -item.price, "expense");
    });
  }, []);

  const useSupply = useCallback((itemId: string) => {
    const item = SUPPLIES.find((entry) => entry.id === itemId);
    if (!item) return;
    setGame((current) => {
      if (!current || !current.inventory[itemId]) {
        setSaveError("That item is not in your inventory.");
        return current;
      }
      setSaveError(null);
      return {
        ...current,
        [item.effect]: bounded(current[item.effect] + item.restore),
        inventory: { ...current.inventory, [itemId]: current.inventory[itemId] - 1 },
      };
    });
  }, []);

  const rentApartment = useCallback((apartmentId: string) => {
    const apartment = APARTMENTS.find((entry) => entry.id === apartmentId);
    if (!apartment) return;
    setGame((current) => {
      if (!current) return current;
      if (current.apartmentId === apartmentId) {
        setSaveError("You already live here.");
        return current;
      }
      if (current.cash < apartment.rent) {
        setSaveError("You need more cash for the move-in cost.");
        return current;
      }
      setSaveError(null);
      return withTransaction({ ...current, cash: current.cash - apartment.rent, apartmentId }, `Moved into ${apartment.name}`, -apartment.rent, "expense");
    });
  }, []);

  const rest = useCallback(() => {
    setGame((current) => current ? {
      ...current,
      energy: bounded(current.energy + 48),
      hunger: bounded(current.hunger - 12),
    } : current);
  }, []);

  const wash = useCallback(() => {
    setGame((current) => {
      if (!current) return current;
      if (current.cash < 12) {
        setSaveError("You need $12 for a laundromat wash.");
        return current;
      }
      setSaveError(null);
      return withTransaction({
        ...current,
        cash: current.cash - 12,
        hygiene: bounded(current.hygiene + 52),
      }, "Laundromat", -12, "expense");
    });
  }, []);

  return { game, createPlayer, move, work, bank, buyCar, buyFurniture, placeFurniture, buySupply, useSupply, rentApartment, rest, wash, updateWorldPose, setWorldLocation, saveError };
}
