import { VehicleProfile } from "./types";

const STORAGE_KEY = "fuelsmart-vehicles";

export function loadVehicles(): VehicleProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveVehicle(profile: VehicleProfile): VehicleProfile[] {
  const vehicles = loadVehicles();
  const idx = vehicles.findIndex((v) => v.id === profile.id);
  if (idx >= 0) {
    vehicles[idx] = profile;
  } else {
    vehicles.push(profile);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
  return vehicles;
}

export function deleteVehicle(id: string): VehicleProfile[] {
  const vehicles = loadVehicles().filter((v) => v.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
  return vehicles;
}
