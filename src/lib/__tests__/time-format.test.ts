import { formatAge } from "../time-format";

describe("formatAge", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-21T12:00:00Z").getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns minutes for ages under 1h", () => {
    const ts = new Date(Date.now() - 30 * 60_000).toISOString();
    expect(formatAge(ts)).toBe("30m ago");
  });

  it("returns at least 1m even when nearly-zero age", () => {
    const ts = new Date(Date.now() - 5_000).toISOString();
    expect(formatAge(ts)).toBe("1m ago");
  });

  it("returns hours for ages 1–48h", () => {
    const ts = new Date(Date.now() - 5 * 60 * 60_000).toISOString();
    expect(formatAge(ts)).toBe("5h ago");
  });

  it("returns days for ages over 48h", () => {
    const ts = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
    expect(formatAge(ts)).toBe("3d ago");
  });

  it("handles exactly 1h boundary", () => {
    const ts = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(formatAge(ts)).toBe("1h ago");
  });
});
