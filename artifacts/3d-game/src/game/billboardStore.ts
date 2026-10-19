export interface Billboard {
  id: string;
  title: string;
  image: string;
  location: string;
  lat: number;
  lng: number;
  price: number;
  link: string;
  views: number;
  clicks: number;
}

const STORAGE_KEY = "american-dream-nyc-billboards-v1";
let cached: Billboard[] = [];

function save(items: Billboard[]): void {
  cached = items;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function loadBillboards(): Promise<Billboard[]> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every((item) => item && typeof item.id === "string")) {
        cached = parsed as Billboard[];
        return cached;
      }
      throw new Error("Saved billboard data is invalid.");
    }

    const basePath = import.meta.env.BASE_URL.endsWith("/")
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    const url = `${basePath}data/billboards.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Billboards could not be loaded (${response.status}).`);
    const parsed: unknown = await response.json();
    if (!Array.isArray(parsed)) throw new Error("Billboard data has an unexpected format.");
    cached = parsed as Billboard[];
    return cached;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Billboards could not be loaded. Check your connection and try again.");
  }
}

export function saveBillboards(items: Billboard[]): void {
  save(items);
}

export function recordBillboardView(id: string): Billboard[] {
  const items = cached.map((item) => item.id === id ? { ...item, views: item.views + 1 } : item);
  save(items);
  return items;
}

export function recordBillboardClick(id: string): Billboard[] {
  const items = cached.map((item) => item.id === id ? { ...item, clicks: item.clicks + 1 } : item);
  save(items);
  return items;
}
