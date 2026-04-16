/**
 * Orchestrator tests — we mock each fetcher module and assert the orchestrator
 * calls them in the right order and handles failures per the design:
 *   1. Try free sources (Stooq + Frankfurter) in parallel.
 *   2. If either fails AND ANTHROPIC_API_KEY is set, try Anthropic.
 *   3. If no key, propagate the free-source error.
 */

jest.mock("../fetchers/frankfurter", () => ({
  fetchFrankfurterAUD: jest.fn(),
}));
jest.mock("../fetchers/stooq", () => ({
  fetchStooqBrent: jest.fn(),
}));
jest.mock("../fetchers/anthropic", () => ({
  fetchAnthropicMarketData: jest.fn(),
}));

import { fetchLiveMarketData } from "../fetch-market-data";
import { fetchFrankfurterAUD } from "../fetchers/frankfurter";
import { fetchStooqBrent } from "../fetchers/stooq";
import { fetchAnthropicMarketData } from "../fetchers/anthropic";

const mockFrank = fetchFrankfurterAUD as jest.Mock;
const mockStooq = fetchStooqBrent as jest.Mock;
const mockAnthropic = fetchAnthropicMarketData as jest.Mock;

describe("fetchLiveMarketData orchestrator", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    mockFrank.mockReset();
    mockStooq.mockReset();
    mockAnthropic.mockReset();
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns combined result when both free sources succeed (no Anthropic call)", async () => {
    mockStooq.mockResolvedValue(94.78);
    mockFrank.mockResolvedValue(0.71364);

    const result = await fetchLiveMarketData();

    expect(result.brent_usd).toBe(94.78);
    expect(result.aud_usd).toBe(0.71364);
    expect(result.source).toBe("frankfurter+stooq");
    expect(result.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockAnthropic).not.toHaveBeenCalled();
  });

  it("falls back to Anthropic when free sources fail AND key is set", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockStooq.mockRejectedValue(new Error("Stooq down"));
    mockFrank.mockResolvedValue(0.71);
    mockAnthropic.mockResolvedValue({
      brent_usd: 90.0,
      aud_usd: 0.7,
      as_of: "2026-04-16",
      source: "anthropic-web-search",
    });

    const result = await fetchLiveMarketData();

    expect(result.source).toBe("anthropic-web-search");
    expect(mockAnthropic).toHaveBeenCalledTimes(1);
  });

  it("throws free-source error when free fails AND no key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockStooq.mockRejectedValue(new Error("Stooq down"));
    mockFrank.mockResolvedValue(0.71);

    await expect(fetchLiveMarketData()).rejects.toThrow(
      /Free market-data sources failed.*no ANTHROPIC_API_KEY/,
    );
    expect(mockAnthropic).not.toHaveBeenCalled();
  });

  it("throws combined error when both free and Anthropic fail", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockStooq.mockRejectedValue(new Error("Stooq down"));
    mockFrank.mockResolvedValue(0.71);
    mockAnthropic.mockRejectedValue(new Error("Anthropic 500"));

    await expect(fetchLiveMarketData()).rejects.toThrow(
      /Free sources failed.*Anthropic fallback also failed/,
    );
  });

  it("treats Frankfurter failure the same as Stooq failure (either triggers fallback)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockStooq.mockResolvedValue(94.78);
    mockFrank.mockRejectedValue(new Error("Frankfurter 503"));
    mockAnthropic.mockResolvedValue({
      brent_usd: 90.0,
      aud_usd: 0.7,
      as_of: "2026-04-16",
      source: "anthropic-web-search",
    });

    const result = await fetchLiveMarketData();
    expect(result.source).toBe("anthropic-web-search");
  });
});
