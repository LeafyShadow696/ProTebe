import { describe, expect, it } from "vitest";
import {
  CALENDAR_KEY_PATTERN,
  INVALID_TOKEN_MESSAGE,
  PAIR_CODE_PATTERN,
  PAIR_TOKEN_PATTERN,
  isCalendarKey,
  isPairToken,
} from "@/lib/pair-credentials";
import { pairCodeSchema, pairTokenSchema } from "@/lib/pair-schemas";
const VALID_TOKEN = "a".repeat(48);
const VALID_KEY = "0123456789abcdef0123456789abcdef";
const INJECTION_LIKE = [
  "' or 1=1--",
  "owner_token.eq.x,partner_token.eq.y",
  `${VALID_TOKEN},partner_token.eq.${VALID_TOKEN}`,
  `${VALID_TOKEN.slice(0, 40)}*)(or.true`,
  "or(owner_token.eq.1,partner_token.eq.1)",
  `${VALID_TOKEN};drop table pairs`,
  `${VALID_TOKEN}\n${VALID_TOKEN}`,
  "%2Cor%2Ctrue",
];
describe("isPairToken", () => {
  it("accepts exactly 48 lowercase hex", () => {
    expect(isPairToken(VALID_TOKEN)).toBe(true);
  });
  it("rejects wrong lengths", () => {
    expect(isPairToken("a".repeat(47))).toBe(false);
    expect(isPairToken("a".repeat(49))).toBe(false);
  });
  it("rejects injection-like", () => {
    for (const payload of INJECTION_LIKE) {
      expect(isPairToken(payload)).toBe(false);
      expect(pairTokenSchema.safeParse(payload).success).toBe(false);
    }
  });
  it("is anchored", () => {
    expect(PAIR_TOKEN_PATTERN.test(`x${VALID_TOKEN}`)).toBe(false);
  });
});
describe("pairTokenSchema", () => {
  it("passes valid", () => expect(pairTokenSchema.parse(VALID_TOKEN)).toBe(VALID_TOKEN));
});
describe("pairCodeSchema", () => {
  it("trims and uppercases", () => expect(pairCodeSchema.parse("  abc123 ")).toBe("ABC123"));
  it("accepts 4-12", () => expect(pairCodeSchema.parse("ABCDEF123456")).toBe("ABCDEF123456"));
  it("rejects malformed", () => {
    for (const bad of ["AB1", "ABCDEF1234567", "AB 12", "AB-12", "ABC_1", "kód!", "ABC.eq.1"])
      expect(pairCodeSchema.safeParse(bad).success).toBe(false);
  });
  it("alphabet anchored", () => {
    expect(PAIR_CODE_PATTERN.test("ABC123")).toBe(true);
  });
});
describe("isCalendarKey", () => {
  it("accepts 32 lower hex", () => {
    expect(isCalendarKey(VALID_KEY)).toBe(true);
    expect(CALENDAR_KEY_PATTERN.test(VALID_KEY)).toBe(true);
  });
  it("rejects traversal", () => expect(isCalendarKey("../../etc/passwd")).toBe(false));
});
describe("INVALID_TOKEN_MESSAGE", () => {
  it("is neutral", () => {
    expect(INVALID_TOKEN_MESSAGE).toBe("Toto propojení už neplatí.");
    expect(INVALID_TOKEN_MESSAGE).not.toMatch(/postgres|supabase|pairs|policy|token=/i);
  });
});
