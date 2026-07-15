import {
  loadFavourites,
  saveFavourites,
  toggleFavourite,
  isFavourite,
  FAVOURITES_STORAGE_KEY,
} from "../favourites";

/**
 * jest.config.js runs testEnvironment: "node" (no jsdom in this repo), so
 * `localStorage`/`window` aren't globally defined. Favourites store guards on
 * `typeof localStorage === "undefined"` specifically so it can be exercised
 * here with a minimal in-memory Storage stand-in.
 */
function makeMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  } as Storage;
}

describe("favourites store", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = makeMockStorage();
  });

  it("returns [] when nothing stored", () => {
    expect(loadFavourites()).toEqual([]);
  });

  it("toggleFavourite adds an id, then removes it", () => {
    expect(toggleFavourite("nt-1")).toEqual(["nt-1"]);
    expect(loadFavourites()).toEqual(["nt-1"]);

    expect(toggleFavourite("nt-1")).toEqual([]);
    expect(loadFavourites()).toEqual([]);
  });

  it("toggleFavourite accumulates multiple distinct ids", () => {
    toggleFavourite("a");
    toggleFavourite("b");
    expect(loadFavourites().sort()).toEqual(["a", "b"]);
  });

  it("saveFavourites persists the array verbatim", () => {
    saveFavourites(["x", "y", "y"]);
    expect(loadFavourites()).toEqual(["x", "y", "y"]);
  });

  it("isFavourite checks membership", () => {
    expect(isFavourite("a", ["a", "b"])).toBe(true);
    expect(isFavourite("c", ["a", "b"])).toBe(false);
  });

  it("tolerates corrupt (non-JSON) localStorage content", () => {
    localStorage.setItem(FAVOURITES_STORAGE_KEY, "{not valid json");
    expect(loadFavourites()).toEqual([]);
  });

  it("tolerates a non-array JSON value", () => {
    localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify({ oops: true }));
    expect(loadFavourites()).toEqual([]);
  });

  it("filters out non-string entries from a tampered array", () => {
    localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(["a", 5, null, "b", {}]));
    expect(loadFavourites()).toEqual(["a", "b"]);
  });

  it("toggleFavourite recovers gracefully even if prior content was corrupt", () => {
    localStorage.setItem(FAVOURITES_STORAGE_KEY, "not json at all");
    expect(toggleFavourite("nt-9")).toEqual(["nt-9"]);
    expect(loadFavourites()).toEqual(["nt-9"]);
  });
});
