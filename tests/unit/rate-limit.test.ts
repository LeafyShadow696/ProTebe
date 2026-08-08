import { beforeAll, describe, expect, it, vi } from "vitest";

import { RATE_LIMIT_MAX_WINDOW_SECONDS, evaluateRateLimit, rateLimitHit, rateLimitKeyMaterial } from "@/lib/rate-limit.server";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => rpc(...args) },
}));

beforeAll(() => {
  process.env["AUTH_V2_PEPPER"] = "test-pepper-value-for-unit-tests-only";
});

describe("evaluateRateLimit", () => {
  it("allows the first N hits and blocks N+1", () => {
    const results = [1, 2, 3, 4].map((count) => evaluateRateLimit(count, 3, 60));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[3]!.retryAfterSeconds).toBe(60);
    expect(results[0]!.retryAfterSeconds).toBe(0);
  });

  it("never reports negative remaining", () => {
    expect(evaluateRateLimit(99, 3, 60).remaining).toBe(0);
  });

  it("always reports at least one second of retry-after", () => {
    expect(evaluateRateLimit(5, 1, 1).retryAfterSeconds).toBe(1);
  });

  it("rejects invalid limits instead of producing nonsense", () => {
    for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => evaluateRateLimit(1, limit, 60)).toThrow(/invalid limit/);
    }
  });

  it("rejects invalid windows", () => {
    for (const w of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, RATE_LIMIT_MAX_WINDOW_SECONDS + 1]) {
      expect(() => evaluateRateLimit(1, 3, w)).toThrow(/invalid window/);
    }
  });

  it("rejects invalid counts", () => {
    for (const count of [-1, 1.5, Number.NaN]) expect(() => evaluateRateLimit(count, 3, 60)).toThrow(/invalid count/);
  });
});

describe("rateLimitHit input validation", () => {
  it("rejects an empty or whitespace key before touching the database", async () => {
    for (const key of ["", "   ", "\n"]) {
      await expect(rateLimitHit({ scope: "join", key, limit: 3, windowSeconds: 60 })).rejects.toThrow(/invalid key/);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an unknown runtime scope", async () => {
    await expect(
      rateLimitHit({ scope: "totally-unknown" as unknown as "join", key: "1.2.3.4", limit: 3, windowSeconds: 60 }),
    ).rejects.toThrow(/invalid scope/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid limit/window before touching the database", async () => {
    await expect(rateLimitHit({ scope: "join", key: "1.2.3.4", limit: 0, windowSeconds: 60 })).rejects.toThrow(/invalid limit/);
    await expect(rateLimitHit({ scope: "join", key: "1.2.3.4", limit: 3, windowSeconds: 0 })).rejects.toThrow(/invalid window/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("never fails open: an RPC error propagates instead of allowing the request", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(rateLimitHit({ scope: "join", key: "1.2.3.4", limit: 3, windowSeconds: 60 })).rejects.toThrow(/rate limit unavailable/);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns the counter row on success", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ allowed: true, current_count: 1, remaining: 2, retry_after_seconds: 0 }],
      error: null,
    });
    await expect(rateLimitHit({ scope: "join", key: "1.2.3.4", limit: 3, windowSeconds: 60 })).resolves.toEqual({
      allowed: true,
      count: 1,
      remaining: 2,
      retryAfterSeconds: 0,
    });
  });
});

describe("rate limit bucket key", () => {
  it("is scoped so the same identifier cannot collide across scopes", () => {
    expect(rateLimitKeyMaterial("join", "1.2.3.4")).not.toBe(rateLimitKeyMaterial("upload", "1.2.3.4"));
  });

  it("hashes the identifier so no raw value is ever stored", async () => {
    const { rateLimitKeyHash } = await import("@/lib/rate-limit.server");
    const hash = await rateLimitKeyHash("join", "1.2.3.4");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("1.2.3.4");
    expect(await rateLimitKeyHash("join", "1.2.3.4")).toBe(hash);
    expect(await rateLimitKeyHash("join", "1.2.3.5")).not.toBe(hash);
  });
});

describe.skip("rate_limit_hit (database integration)", () => {
  it("is covered in C4 against the HTTP surface, not against production data", () => {
    expect(true).toBe(true);
  });
});
