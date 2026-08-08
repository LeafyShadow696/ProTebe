import { beforeAll, describe, expect, it } from "vitest";

import {
  CODE_ALPHABET,
  MANUAL_CODE_LENGTH,
  RECOVERY_CODE_LENGTH,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
  SESSION_SECRET_LENGTH,
  absoluteExpiryFrom,
  formatManualCodeForDisplay,
  formatRecoveryCodeForDisplay,
  formatSessionCredential,
  generateInviteLinkSecret,
  generateManualCode,
  generateRecoveryCode,
  generateSessionSecret,
  isSessionLive,
  nextIdleExpiry,
  normalizeCode,
  normalizeManualCode,
  normalizeRecoveryCode,
  parseSessionCredential,
} from "@/lib/auth-v2-format";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("session credential format", () => {
  it("generates a 43-char base64url secret", () => {
    const secret = generateSessionSecret();
    expect(secret).toHaveLength(SESSION_SECRET_LENGTH);
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never repeats a secret", () => {
    const secrets = new Set(Array.from({ length: 200 }, () => generateSessionSecret()));
    expect(secrets.size).toBe(200);
  });

  it("round-trips a credential", () => {
    const secret = generateSessionSecret();
    const parsed = parseSessionCredential(formatSessionCredential(UUID, secret));
    expect(parsed).toEqual({ sessionId: UUID, secret });
  });

  it("rejects malformed credentials", () => {
    const secret = generateSessionSecret();
    const bad = [
      "",
      "ps1",
      `ps1.${UUID}`,
      `ps2.${UUID}.${secret}`,
      `ps1.not-a-uuid.${secret}`,
      `ps1.${UUID}.short`,
      `ps1.${UUID}.${secret}extra`,
      `ps1.${UUID}.${secret}.x`,
      `ps1.${UUID}.${secret.slice(0, 42)}+`,
      `  ps1.${UUID}.${secret}`,
      null,
      undefined,
      42,
      { sessionId: UUID },
    ];
    for (const value of bad) expect(parseSessionCredential(value)).toBeNull();
  });
});

describe("manual invite code", () => {
  it("is 10 chars from the safe alphabet", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateManualCode();
      expect(code).toHaveLength(MANUAL_CODE_LENGTH);
      for (const char of code) expect(CODE_ALPHABET).toContain(char);
    }
  });

  it("never contains ambiguous glyphs", () => {
    const codes = Array.from({ length: 200 }, () => generateManualCode()).join("");
    expect(codes).not.toMatch(/[ILOU]/);
  });

  it("normalizes human input", () => {
    const code = generateManualCode();
    expect(normalizeManualCode(formatManualCodeForDisplay(code))).toBe(code);
    expect(normalizeManualCode(`  ${code.toLowerCase()}  `)).toBe(code);
    expect(normalizeManualCode(`${code.slice(0, 3)} ${code.slice(3)}`)).toBe(code);
  });

  it("folds confusable characters", () => {
    expect(normalizeCode("oil-u")).toBe("011V");
    expect(normalizeManualCode("OILOILOILO")).toBe("0110110110");
  });

  it("rejects wrong length or alphabet", () => {
    expect(normalizeManualCode("ABC")).toBeNull();
    expect(normalizeManualCode("ABCDEFGHJKM")).toBeNull();
    expect(normalizeManualCode("ABCDEFGH!K")).toBeNull();
    expect(normalizeManualCode(123)).toBeNull();
  });
});

describe("invite link secret", () => {
  it("has 256 bits of entropy in base64url form", () => {
    const secret = generateInviteLinkSecret();
    expect(secret).toHaveLength(SESSION_SECRET_LENGTH);
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateInviteLinkSecret()).not.toBe(secret);
  });
});

describe("recovery code", () => {
  it("is 32 chars (160 bits) from the safe alphabet", () => {
    const code = generateRecoveryCode();
    expect(code).toHaveLength(RECOVERY_CODE_LENGTH);
    expect(code).toMatch(new RegExp(`^[${CODE_ALPHABET}]+$`));
  });

  it("round-trips through the display grouping", () => {
    const code = generateRecoveryCode();
    const display = formatRecoveryCodeForDisplay(code);
    expect(display).toContain("-");
    expect(normalizeRecoveryCode(display)).toBe(code);
  });

  it("rejects a manual-code-length value", () => {
    expect(normalizeRecoveryCode(generateManualCode())).toBeNull();
  });
});

describe("session lifetimes", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("slides by 90 days when the absolute ceiling is far away", () => {
    const absolute = absoluteExpiryFrom(now);
    expect(absolute.getTime() - now.getTime()).toBe(SESSION_ABSOLUTE_TTL_MS);
    expect(nextIdleExpiry(now, absolute).getTime()).toBe(now.getTime() + SESSION_IDLE_TTL_MS);
  });

  it("clamps to the absolute expiry near the ceiling", () => {
    const absolute = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(nextIdleExpiry(now, absolute).getTime()).toBe(absolute.getTime());
  });

  it("clamps exactly at the boundary", () => {
    const absolute = new Date(now.getTime() + SESSION_IDLE_TTL_MS);
    expect(nextIdleExpiry(now, absolute).getTime()).toBe(absolute.getTime());
  });

  it("never returns a value in the past when the ceiling has passed", () => {
    const absolute = new Date(now.getTime() - 1000);
    expect(nextIdleExpiry(now, absolute).getTime()).toBe(absolute.getTime());
  });
});

describe("isSessionLive", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const live = {
    idle_expires_at: new Date(now.getTime() + 1000).toISOString(),
    absolute_expires_at: new Date(now.getTime() + 10_000).toISOString(),
    revoked_at: null as string | null,
  };

  it("accepts a live session", () => {
    expect(isSessionLive(live, now)).toBe(true);
  });

  it("rejects revoked, idle-expired and absolutely expired sessions", () => {
    expect(isSessionLive({ ...live, revoked_at: now.toISOString() }, now)).toBe(false);
    expect(isSessionLive({ ...live, idle_expires_at: now.toISOString() }, now)).toBe(false);
    expect(isSessionLive({ ...live, absolute_expires_at: now.toISOString() }, now)).toBe(false);
  });
});

describe("auth-v2 zod schemas", () => {
  beforeAll(() => {});

  it("validates credentials and codes", async () => {
    const { sessionCredentialSchema, manualInviteCodeSchema, recoveryCodeSchema } = await import("@/lib/auth-v2-schemas");
    const credential = formatSessionCredential(UUID, generateSessionSecret());
    expect(sessionCredentialSchema.parse(credential)).toBe(credential);
    expect(() => sessionCredentialSchema.parse("nope")).toThrow();

    const code = generateManualCode();
    expect(manualInviteCodeSchema.parse(formatManualCodeForDisplay(code).toLowerCase())).toBe(code);
    expect(() => manualInviteCodeSchema.parse("AB")).toThrow();

    const recovery = generateRecoveryCode();
    expect(recoveryCodeSchema.parse(formatRecoveryCodeForDisplay(recovery))).toBe(recovery);
    expect(() => recoveryCodeSchema.parse(code)).toThrow();
  });
});
