import { beforeAll, describe, expect, it } from "vitest";

import { generateManualCode, generateRecoveryCode, normalizeManualCode } from "@/lib/auth-v2-format";

const TEST_PEPPER = "test-pepper-value-for-unit-tests-only";

beforeAll(() => {
  process.env["AUTH_V2_PEPPER"] = TEST_PEPPER;
});

describe("digests", () => {
  it("are deterministic and 64 hex chars", async () => {
    const { sessionSecretDigest } = await import("@/lib/auth-v2.server");
    const a = await sessionSecretDigest("abc");
    const b = await sessionSecretDigest("abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differ for different secrets", async () => {
    const { sessionSecretDigest } = await import("@/lib/auth-v2.server");
    expect(await sessionSecretDigest("abc")).not.toBe(await sessionSecretDigest("abd"));
  });

  it("are domain-separated per credential kind", async () => {
    const { sessionSecretDigest, inviteLinkSecretDigest, recoveryCodeDigest } = await import("@/lib/auth-v2.server");
    const secret = "same-input";
    const digests = new Set([
      await sessionSecretDigest(secret),
      await inviteLinkSecretDigest(secret),
      await recoveryCodeDigest(secret),
    ]);
    expect(digests.size).toBe(3);
  });
});

describe("timing-safe compare", () => {
  it("matches equal strings and rejects everything else", async () => {
    const { timingSafeEqual } = await import("@/lib/auth-v2.server");
    expect(timingSafeEqual("abcdef", "abcdef")).toBe(true);
    expect(timingSafeEqual("abcdef", "abcdeg")).toBe(false);
    expect(timingSafeEqual("abcdef", "abcde")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});

describe("verification helpers", () => {
  it("verify the matching secret only", async () => {
    const {
      issueSessionSecret,
      verifySessionSecret,
      issueInvite,
      verifyInviteLinkSecret,
      verifyManualCode,
      issueRecoveryCode,
      verifyRecoveryCode,
    } = await import("@/lib/auth-v2.server");

    const session = await issueSessionSecret(new Date("2026-01-01T00:00:00.000Z"));
    expect(await verifySessionSecret(session.secret, session.digest)).toBe(true);
    expect(await verifySessionSecret("wrong", session.digest)).toBe(false);
    expect(session.credential("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toContain(session.secret);
    expect(session.idleExpiresAt.getTime()).toBeLessThan(session.absoluteExpiresAt.getTime());

    const invite = await issueInvite();
    expect(await verifyInviteLinkSecret(invite.linkSecret, invite.linkSecretDigest)).toBe(true);
    expect(await verifyInviteLinkSecret("wrong", invite.linkSecretDigest)).toBe(false);
    expect(normalizeManualCode(invite.manualCode)).toBe(invite.manualCode);
    expect(await verifyManualCode(invite.manualCode, invite.manualCodeHmac)).toBe(true);
    expect(await verifyManualCode(generateManualCode(), invite.manualCodeHmac)).toBe(false);

    const recovery = await issueRecoveryCode();
    expect(await verifyRecoveryCode(recovery.code, recovery.digest)).toBe(true);
    expect(await verifyRecoveryCode(generateRecoveryCode(), recovery.digest)).toBe(false);
  });
});

describe("manual code HMAC", () => {
  it("is deterministic under the same pepper", async () => {
    const { manualCodeHmac } = await import("@/lib/auth-v2.server");
    const code = generateManualCode();
    expect(await manualCodeHmac(code)).toBe(await manualCodeHmac(code));
  });

  it("changes when the code changes", async () => {
    const { manualCodeHmac } = await import("@/lib/auth-v2.server");
    expect(await manualCodeHmac("ABCDEFGHJK")).not.toBe(await manualCodeHmac("ABCDEFGHJM"));
  });

  it("changes when the pepper changes", async () => {
    const { manualCodeHmac } = await import("@/lib/auth-v2.server");
    const code = generateManualCode();
    const first = await manualCodeHmac(code);
    process.env["AUTH_V2_PEPPER"] = "a-completely-different-test-pepper";
    const second = await manualCodeHmac(code);
    process.env["AUTH_V2_PEPPER"] = TEST_PEPPER;
    expect(second).not.toBe(first);
  });

  it("fails closed without a pepper, while plain digests still work", async () => {
    const { manualCodeHmac, sessionSecretDigest, hasAuthPepper } = await import("@/lib/auth-v2.server");
    delete process.env["AUTH_V2_PEPPER"];
    expect(hasAuthPepper()).toBe(false);
    await expect(manualCodeHmac("ABCDEFGHJK")).rejects.toThrow(/AUTH_V2_PEPPER/);
    await expect(sessionSecretDigest("abc")).resolves.toMatch(/^[0-9a-f]{64}$/);
    process.env["AUTH_V2_PEPPER"] = TEST_PEPPER;
    expect(hasAuthPepper()).toBe(true);
  });

  it("never leaks the pepper into the derived value", async () => {
    const { manualCodeHmac } = await import("@/lib/auth-v2.server");
    expect(await manualCodeHmac("ABCDEFGHJK")).not.toContain(TEST_PEPPER);
  });
});
