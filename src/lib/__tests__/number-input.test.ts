import {
  clampNumber,
  commitDraft,
  defaultStep,
  formatValue,
  parseDraft,
  sanitiseDraft,
} from "../number-input";

// Rules matching the two fields on /fill-up that prompted this module.
const FILL_LITRES = { min: 5, max: 200, decimals: 0 };
const CONSUMPTION = { min: 2, max: 40, decimals: 1 };

describe("sanitiseDraft", () => {
  it("keeps an empty string empty", () => {
    // The whole point: clearing the box must survive the round trip.
    expect(sanitiseDraft("", FILL_LITRES)).toBe("");
  });

  it("preserves a trailing dot while a decimal is being typed", () => {
    expect(sanitiseDraft("10.", CONSUMPTION)).toBe("10.");
    expect(sanitiseDraft(".", CONSUMPTION)).toBe(".");
    expect(sanitiseDraft(".5", CONSUMPTION)).toBe(".5");
  });

  it("drops the dot entirely for integer-only fields", () => {
    expect(sanitiseDraft("10.5", FILL_LITRES)).toBe("105");
    expect(sanitiseDraft(".", FILL_LITRES)).toBe("");
  });

  it("strips letters and other junk", () => {
    expect(sanitiseDraft("4a2", FILL_LITRES)).toBe("42");
    expect(sanitiseDraft("1e5", FILL_LITRES)).toBe("15");
    expect(sanitiseDraft("$50", FILL_LITRES)).toBe("50");
  });

  it("keeps only the first decimal point", () => {
    expect(sanitiseDraft("1.2.3", CONSUMPTION)).toBe("1.2");
  });

  it("truncates to the allowed number of decimals", () => {
    expect(sanitiseDraft("10.567", CONSUMPTION)).toBe("10.5");
    expect(sanitiseDraft("0.98765", { decimals: 4 })).toBe("0.9876");
  });

  it("accepts pasted numbers with spaces or thousands separators", () => {
    expect(sanitiseDraft("12,500", { decimals: 0 })).toBe("12500");
    expect(sanitiseDraft("12 500", { decimals: 0 })).toBe("12500");
  });

  it("allows a minus sign only when the range goes negative", () => {
    expect(sanitiseDraft("-5", { min: -10, max: 10 })).toBe("-5");
    expect(sanitiseDraft("-", { min: -10, max: 10 })).toBe("-");
    expect(sanitiseDraft("-5", FILL_LITRES)).toBe("5");
  });

  it("does not clamp — that is blur's job", () => {
    // Typing toward 150 passes through "1", which is below the minimum of 5.
    expect(sanitiseDraft("1", FILL_LITRES)).toBe("1");
    expect(sanitiseDraft("999", FILL_LITRES)).toBe("999");
  });
});

describe("parseDraft", () => {
  it("returns null for drafts that are not yet a number", () => {
    expect(parseDraft("")).toBeNull();
    expect(parseDraft("-")).toBeNull();
    expect(parseDraft(".")).toBeNull();
    expect(parseDraft("-.")).toBeNull();
  });

  it("reads partial decimals as the number so far", () => {
    expect(parseDraft("10.")).toBe(10);
    expect(parseDraft(".5")).toBe(0.5);
  });

  it("reads ordinary numbers", () => {
    expect(parseDraft("0")).toBe(0);
    expect(parseDraft("42")).toBe(42);
    expect(parseDraft("-3.5")).toBe(-3.5);
  });
});

describe("clampNumber", () => {
  it("pins to the range", () => {
    expect(clampNumber(1, FILL_LITRES)).toBe(5);
    expect(clampNumber(999, FILL_LITRES)).toBe(200);
    expect(clampNumber(60, FILL_LITRES)).toBe(60);
  });

  it("rounds to the field's precision", () => {
    expect(clampNumber(10.567, CONSUMPTION)).toBe(10.6);
    expect(clampNumber(10.5, FILL_LITRES)).toBe(11);
  });

  it("leaves an open-ended side alone", () => {
    expect(clampNumber(1e6, { min: 0 })).toBe(1e6);
  });
});

describe("commitDraft", () => {
  it("REGRESSION: clearing the box restores the previous value, not the minimum", () => {
    // The reported bug. Old behaviour: Number("") === 0, clamped up to min (5).
    // A blanked field must give back the 62 the user started with.
    expect(commitDraft("", FILL_LITRES, 62)).toBe(62);
    expect(commitDraft("", CONSUMPTION, 8.4)).toBe(8.4);
  });

  it("REGRESSION: a cleared field does not collapse to zero", () => {
    // The other flavour of the bug — bare Number(e.target.value) on Settings
    // and the trip form, which showed 0 the moment you hit backspace.
    expect(commitDraft("", { min: 10, max: 200 }, 55)).toBe(55);
    expect(commitDraft("", { min: 0, max: 200 }, 20)).toBe(20);
  });

  it("keeps a value the user actually typed", () => {
    expect(commitDraft("62", FILL_LITRES, 50)).toBe(62);
    expect(commitDraft("8.4", CONSUMPTION, 10.5)).toBe(8.4);
  });

  it("clamps out-of-range entries at the boundary", () => {
    expect(commitDraft("1", FILL_LITRES, 50)).toBe(5);
    expect(commitDraft("500", FILL_LITRES, 50)).toBe(200);
  });

  it("completes a half-typed decimal", () => {
    expect(commitDraft("10.", CONSUMPTION, 8)).toBe(10);
    expect(commitDraft(".5", { min: 0, max: 10, decimals: 1 }, 1)).toBe(0.5);
  });

  it("clamps the fallback too, so a stale out-of-range value is corrected", () => {
    expect(commitDraft("", FILL_LITRES, 1)).toBe(5);
  });
});

describe("formatValue", () => {
  it("renders without trailing-zero padding", () => {
    expect(formatValue(50, FILL_LITRES)).toBe("50");
    expect(formatValue(10.5, CONSUMPTION)).toBe("10.5");
    expect(formatValue(10, CONSUMPTION)).toBe("10");
  });

  it("rounds to the field's precision", () => {
    expect(formatValue(10.567, CONSUMPTION)).toBe("10.6");
  });

  it("renders a non-finite value as empty rather than 'NaN'", () => {
    expect(formatValue(NaN, FILL_LITRES)).toBe("");
    expect(formatValue(Infinity, FILL_LITRES)).toBe("");
  });
});

describe("defaultStep", () => {
  it("matches the field's precision", () => {
    expect(defaultStep(FILL_LITRES)).toBe(1);
    expect(defaultStep(CONSUMPTION)).toBeCloseTo(0.1);
    expect(defaultStep({ decimals: 2 })).toBeCloseTo(0.01);
  });
});

describe("typing a value end to end", () => {
  // Walks the exact sequence Fred described: select the box, wipe it, type a
  // real figure, tab away.
  it("lets you clear 50 and type 62 without interference", () => {
    const rules = FILL_LITRES;
    let draft = formatValue(50, rules);
    expect(draft).toBe("50");

    draft = sanitiseDraft("", rules);
    expect(draft).toBe(""); // stays empty — used to become "5"

    draft = sanitiseDraft("6", rules);
    expect(draft).toBe("6");
    expect(parseDraft(draft)).toBe(6);

    draft = sanitiseDraft("62", rules);
    expect(commitDraft(draft, rules, 50)).toBe(62);
  });

  it("lets you type 8.4 into an L/100km box that started at 10.5", () => {
    const rules = CONSUMPTION;
    let draft = sanitiseDraft("", rules);
    expect(draft).toBe("");

    draft = sanitiseDraft("8", rules);
    expect(draft).toBe("8");

    draft = sanitiseDraft("8.", rules);
    expect(draft).toBe("8."); // the dot survives — it used to be eaten

    draft = sanitiseDraft("8.4", rules);
    expect(commitDraft(draft, rules, 10.5)).toBe(8.4);
  });
});
