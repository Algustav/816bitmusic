import { describe, expect, it } from "vitest";
import { loadFavorites, toggleFavorite } from "./favorites";

describe("favorites", () => {
  it("adds new favorites first and removes an existing favorite", () => {
    const added = toggleFavorite([], "contra.nsfe", 2, 100);
    expect(added).toEqual([{ albumId: "contra.nsfe", track: 2, addedAt: 100 }]);
    expect(toggleFavorite(added, "contra.nsfe", 2, 200)).toEqual([]);
  });

  it("ignores malformed stored data", () => {
    const storage = {
      getItem: () =>
        JSON.stringify([
          { albumId: "valid.nsfe", track: 1, addedAt: 10 },
          { albumId: "broken.nsfe", track: 0, addedAt: 20 }
        ])
    };
    expect(loadFavorites(storage)).toEqual([
      { albumId: "valid.nsfe", track: 1, addedAt: 10 }
    ]);
  });
});
