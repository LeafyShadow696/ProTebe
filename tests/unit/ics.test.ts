import { describe, expect, it } from "vitest";
import { addDays, compactDate, escapeIcs, fold, stamp } from "@/lib/ics";

describe("escapeIcs", () => {
  it("escapes special chars", () => {
    expect(escapeIcs("a;b")).toBe("a\\;b");
    expect(escapeIcs("a,b")).toBe("a\\,b");
    expect(escapeIcs("a\\b")).toBe("a\\\\b");
    expect(escapeIcs("line1\nline2")).toBe("line1\\nline2");
  });
  it("cannot inject property", () => {
    const escaped = escapeIcs("evil\nSUMMARY:injected");
    expect(escaped).not.toContain("\n");
    expect(escaped).toBe("evil\\nSUMMARY:injected");
  });
});
describe("compactDate", () => {
  it("drops dashes", () => {
    expect(compactDate("2024-05-01")).toBe("20240501");
  });
});
describe("addDays", () => {
  it("crosses boundaries", () => {
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});
describe("stamp", () => {
  it("renders UTC DTSTAMP", () => {
    expect(stamp(new Date("2024-05-01T10:15:00.123Z"))).toBe("20240501T101500Z");
  });
});
describe("fold", () => {
  it("leaves short lines", () => {
    expect(fold("x".repeat(73))).toBe("x".repeat(73));
  });
  it("folds long lines", () => {
    const parts = fold("y".repeat(200)).split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toHaveLength(73);
  });
});
