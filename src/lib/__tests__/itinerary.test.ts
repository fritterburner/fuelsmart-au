import { ITINERARY_PRESETS } from "../itinerary-presets";
import { arrivalDate, buildSchedule, formatDay, towingMinutes, waypointHash } from "../itinerary";

const preset = (id: string) => ITINERARY_PRESETS.find((p) => p.id === id)!;

describe("itinerary schedule", () => {
  it("Straight down lands in Toowoomba on Thu 12 Nov (delivery day) leaving Mon 2 Nov", () => {
    expect(arrivalDate(preset("straight-down").stops, "2026-11-02")).toBe("2026-11-12");
    expect(formatDay("2026-11-12")).toMatch(/Thu/);
  });
  it("Far North / Tropical coast / Outback land on Tue 17 Nov", () => {
    for (const id of ["far-north", "tropical-coast", "outback"]) {
      expect(arrivalDate(preset(id).stops, "2026-11-02")).toBe("2026-11-17");
    }
  });
  it("dates each leg by the nights before it and cumulates km", () => {
    const stops = preset("straight-down").stops;
    const legs = buildSchedule(stops, "2026-11-02", stops.slice(1).map(() => ({ km: 100, minutes: 60 })));
    expect(legs[0].date).toBe("2026-11-02"); // Palmerston → Katherine
    expect(legs[1].date).toBe("2026-11-03"); // Katherine (1 night) → Renner Springs
    expect(legs[legs.length - 1].from.label).toBe("Bundaberg (friends)");
    expect(legs[legs.length - 1].date).toBe("2026-11-12"); // after 2 nights at Bundaberg
    expect(legs[legs.length - 1].endKm).toBeCloseTo(100 * legs.length);
  });
  it("towing time follows the Trip Planner rule (80 km/h + 15 min)", () => {
    expect(towingMinutes(300)).toBeCloseTo(240);
  });
  it("hash ignores labels and nights", () => {
    const a = preset("outback").stops;
    const b = a.map((s) => ({ ...s, label: "x", nights: 9 }));
    expect(waypointHash(a)).toBe(waypointHash(b));
  });
});
