/**
 * Fallback: fetch live Brent + AUD/USD via the Anthropic Messages API with web_search tool.
 * Only used when the free public sources (Frankfurter, Stooq) fail AND ANTHROPIC_API_KEY is set.
 */

export interface FetchedMarketData {
  brent_usd: number;
  aud_usd: number;
  as_of: string;
  source: string;
}

const SYSTEM_PROMPT =
  "Search for the current Brent crude oil price in USD per barrel and the current AUD/USD exchange rate. " +
  'Respond ONLY with raw JSON, no markdown, no backticks: ' +
  '{"brent_usd":NUMBER,"aud_usd":NUMBER,"source":"brief source string","as_of":"YYYY-MM-DD"}';

const USER_MESSAGE =
  "Current Brent crude oil price (USD per barrel) and AUD/USD exchange rate. JSON only.";

export async function fetchAnthropicMarketData(): Promise<FetchedMarketData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: USER_MESSAGE }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const textBlock = extractFinalTextBlock(payload);
  const parsed = parseJsonResponse(textBlock);
  validate(parsed);
  return parsed;
}

function extractFinalTextBlock(payload: unknown): string {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("content" in payload) ||
    !Array.isArray((payload as { content: unknown }).content)
  ) {
    throw new Error("Unexpected Anthropic response shape: no content array");
  }
  const blocks = (payload as { content: Array<{ type: string; text?: string }> }).content;
  // Model may emit multiple text blocks; the final JSON is in the last text block.
  const textBlocks = blocks.filter((b) => b.type === "text" && typeof b.text === "string");
  if (textBlocks.length === 0) {
    throw new Error("No text blocks in Anthropic response");
  }
  return textBlocks[textBlocks.length - 1].text!;
}

function parseJsonResponse(raw: string): FetchedMarketData {
  // Strip markdown fences if the model added them despite the system prompt.
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  try {
    return JSON.parse(cleaned) as FetchedMarketData;
  } catch {
    throw new Error(`Failed to parse market-data JSON: ${cleaned.slice(0, 200)}`);
  }
}

function validate(data: FetchedMarketData): void {
  if (typeof data.brent_usd !== "number" || data.brent_usd <= 0 || data.brent_usd > 500) {
    throw new Error(`Invalid brent_usd: ${data.brent_usd}`);
  }
  if (typeof data.aud_usd !== "number" || data.aud_usd <= 0 || data.aud_usd > 2) {
    throw new Error(`Invalid aud_usd: ${data.aud_usd}`);
  }
  if (typeof data.as_of !== "string" || data.as_of.length === 0) {
    throw new Error("Missing as_of date");
  }
  if (typeof data.source !== "string") {
    throw new Error("Missing source");
  }
}
