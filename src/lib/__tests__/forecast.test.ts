import { buildForecast, HistoryPoint } from "../forecast";

function hist(values: number[]): HistoryPoint[] {
  return values.map((v, i) => ({
    date: `2026-05-${String(i + 1).padStart(2, "0")}`,
    value: v,
  }));
}

const TODAY = new Date("2026-06-15T00:00:00Z"); // no policy event within 7 days

describe("buildForecast", () => {
  it("recommends waiting when prices are near the top of the cycle", () => {
    // 28 days climbing to a peak -> position high -> decline expected.
    const rising = hist(Array.from({ length: 28 }, (_, i) => 180 + i)); // 180..207
    const r = buildForecast(rising, { fuel: "U91", today: TODAY });

    expect(r.forecast).toHaveLength(7);
    expect(r.recommendation).toBe("wait");
    expect(r.forecast[0].projected).toBeLessThan(207);
    expect(r.events).toHaveLength(0);
  });

  it("recommends buying now near the bottom of the cycle", () => {
    // 28 days grinding down to the trough -> hike likely next.
    const falling = hist(Array.from({ length: 28 }, (_, i) => 207 - i)); // 207..180
    const r = buildForecast(falling, { fuel: "U91", today: TODAY });

    expect(r.recommendation).toBe("buy_now");
    expect(r.forecast[0].projected).toBeGreaterThan(180);
  });

  it("flags a policy step in the window and says buy now", () => {
    // Forecasting from 25 Jun -> the 30 Jun excise-cut expiry falls in the window.
    const flat = hist(Array.from({ length: 28 }, () => 190));
    const r = buildForecast(flat, { fuel: "U91", today: new Date("2026-06-25T00:00:00Z") });

    expect(r.events.length).toBeGreaterThan(0);
    expect(r.recommendation).toBe("buy_now");
    // The ~26 c/L step should dominate the projection after 30 Jun.
    expect(Math.max(...r.forecast.map((f) => f.projected))).toBeGreaterThan(210);
  });

  it("does NOT apply the excise step to LPG", () => {
    const flat = hist(Array.from({ length: 28 }, () => 90));
    const r = buildForecast(flat, { fuel: "LPG", today: new Date("2026-06-25T00:00:00Z") });
    expect(r.events).toHaveLength(0);
    expect(Math.max(...r.forecast.map((f) => f.projected))).toBeLessThan(120);
  });

  it("degrades gracefully with too little history", () => {
    const r = buildForecast(hist([190, 191, 192]), { fuel: "U91", today: TODAY });
    expect(r.confidence).toBe("low");
    expect(r.recommendation).toBe("neutral");
    expect(r.forecast).toHaveLength(7);
    expect(r.forecast.every((f) => f.projected === 192)).toBe(true);
  });

  it("widens the confidence band further out", () => {
    const noisy = hist([190, 200, 184, 206, 188, 203, 191, 205, 187, 201, 190, 202]);
    const r = buildForecast(noisy, { fuel: "U91", today: TODAY });
    const w0 = r.forecast[0].upper - r.forecast[0].lower;
    const w6 = r.forecast[6].upper - r.forecast[6].lower;
    expect(w6).toBeGreaterThan(w0);
  });
});
