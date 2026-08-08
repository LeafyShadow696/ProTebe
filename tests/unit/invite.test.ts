/**
 * Fáze C3 — invite lifecycle (pure rules + DB ops against a fake backend).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_PEPPER_ENV, manualCodeHmac } from "@/lib/auth-v2.server";
import { generateInviteLinkSecret, normalizeManualCode } from "@/lib/auth-v2-format";
import { buildInviteDeepLink, INVITE_INVALID_MESSAGE, INVITE_TTL_MS, parseInviteLink } from "@/lib/invite-core";
import { claimInvite, createPartnerInvite, findRedeemableInvite, revokePartnerInvite } from "@/lib/invite.server";

process.env[AUTH_PEPPER_ENV] = "unit-test-pepper-value-0123456789";

type Row = Record<string, unknown>;
const state = { invites: [] as Row[] };

function builder() {
  const eqs: [string, unknown][] = [];
  const isNulls: string[] = [];
  const gts: [string, string][] = [];
  let patch: Row | null = null;
  let insert: Row | null = null;

  const match = () =>
    state.invites.filter(
      (row) =>
        eqs.every(([k, v]) => row[k] === v) &&
        isNulls.every((k) => row[k] === null || row[k] === undefined) &&
        gts.every(([k, v]) => new Date(String(row[k])).getTime() > new Date(v).getTime()),
    );

  const applyPatch = () => {
    const rows = match();
    for (const row of rows) Object.assign(row, patch);
    return rows;
  };

  const api: Record<string, unknown> = {
    select: () => api,
    eq: (k: string, v: unknown) => {
      eqs.push([k, v]);
      return api;
    },
    is: (k: string) => {
      isNulls.push(k);
      return api;
    },
    gt: (k: string, v: string) => {
      gts.push([k, v]);
      return api;
    },
    update: (values: Row) => {
      patch = values;
      return api;
    },
    insert: (values: Row) => {
      insert = values;
      return api;
    },
    maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
    single: async () => {
      if (insert) {
        const row = {
          id: `inv-${state.invites.length + 1}`,
          consumed_at: null,
          revoked_at: null,
          consumed_by_session_id: null,
          ...insert,
        };
        state.invites.push(row);
        return { data: row, error: null };
      }
      return { data: match()[0] ?? null, error: null };
    },
  };

  (api as { then?: unknown }).then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: patch ? applyPatch() : match(), error: null }).then(resolve);

  return api;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => builder() },
}));

const PAIR_ID = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-08-08T12:00:00Z");

beforeEach(() => {
  state.invites = [];
});

describe("invite-core", () => {
  it("uses a 24h TTL and a fragment-carried deep link", () => {
    expect(INVITE_TTL_MS).toBe(24 * 60 * 60 * 1000);
    const link = buildInviteDeepLink("ABCDE12345", "secret-value");
    expect(link).toBe("/?join=ABCDE12345#s=secret-value");
  });

  it("parses ?join + #s and normalises the code", () => {
    expect(parseInviteLink({ search: "?join=abcde-12345", hash: "#s=xyz" })).toEqual({ code: "ABCDE12345", secret: "xyz" });
    expect(parseInviteLink({ search: "?join=ABCDE12345", hash: "" })?.secret).toBeNull();
    expect(parseInviteLink({ search: "?join=nope", hash: "" })?.code).toBe("");
    expect(parseInviteLink({ search: "?code=ABC123", hash: "" })).toBeNull();
  });
});

describe("createPartnerInvite", () => {
  it("stores only digests, a 24h expiry and partner target role", async () => {
    const invite = await createPartnerInvite({ pairId: PAIR_ID, sessionId: "sess-1", now: NOW });
    const row = state.invites[0]!;
    expect(row["target_role"]).toBe("partner");
    expect(row["expires_at"]).toBe(new Date(NOW.getTime() + INVITE_TTL_MS).toISOString());
    expect(String(row["manual_code_hmac"])).toMatch(/^[0-9a-f]{64}$/);
    expect(String(row["link_secret_digest"])).toMatch(/^[0-9a-f]{64}$/);
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain(invite.code);
    expect(serialised).not.toContain(invite.linkSecret);
    expect(normalizeManualCode(invite.code)).toBe(invite.code);
  });

  it("revokes the previous open partner invite of the same pair", async () => {
    await createPartnerInvite({ pairId: PAIR_ID, sessionId: null, now: NOW });
    await createPartnerInvite({ pairId: PAIR_ID, sessionId: null, now: NOW });
    expect(state.invites[0]!["revoked_at"]).toBe(NOW.toISOString());
    expect(state.invites[1]!["revoked_at"]).toBeNull();
  });
});

describe("redeem", () => {
  async function seed(overrides: Row = {}) {
    const created = await createPartnerInvite({ pairId: PAIR_ID, sessionId: null, now: NOW });
    Object.assign(state.invites[state.invites.length - 1]!, overrides);
    return created;
  }

  it("finds a live invite by the keyed code digest and verifies the secret", async () => {
    const created = await seed();
    const found = await findRedeemableInvite({ code: created.code, secret: created.linkSecret, now: NOW });
    expect(found.pair_id).toBe(PAIR_ID);
    expect(found.manual_code_hmac).toBe(await manualCodeHmac(created.code));
    expect((await findRedeemableInvite({ code: created.code, now: NOW })).id).toBe(found.id);
  });

  it("fails with one neutral message for wrong secret, expiry, revoke and unknown codes", async () => {
    const created = await seed();
    await expect(findRedeemableInvite({ code: created.code, secret: generateInviteLinkSecret(), now: NOW })).rejects.toThrow(INVITE_INVALID_MESSAGE);
    await expect(
      findRedeemableInvite({ code: created.code, now: new Date(NOW.getTime() + INVITE_TTL_MS + 1) }),
    ).rejects.toThrow(INVITE_INVALID_MESSAGE);
    await expect(findRedeemableInvite({ code: "ZZZZZZZZZZ", now: NOW })).rejects.toThrow(INVITE_INVALID_MESSAGE);

    const revoked = await seed({ revoked_at: NOW.toISOString() });
    await expect(findRedeemableInvite({ code: revoked.code, now: NOW })).rejects.toThrow(INVITE_INVALID_MESSAGE);
  });

  it("claims an invite exactly once, even for a repeated request", async () => {
    const created = await seed();
    const invite = await findRedeemableInvite({ code: created.code, now: NOW });
    expect(await claimInvite({ inviteId: invite.id, sessionId: "sess-a", now: NOW })).toBe(true);
    expect(state.invites[0]!["consumed_by_session_id"]).toBe("sess-a");
    expect(await claimInvite({ inviteId: invite.id, sessionId: "sess-b", now: NOW })).toBe(false);
    expect(state.invites[0]!["consumed_by_session_id"]).toBe("sess-a");
    await expect(findRedeemableInvite({ code: created.code, now: NOW })).rejects.toThrow(INVITE_INVALID_MESSAGE);
  });
});

describe("revokePartnerInvite", () => {
  it("is scoped to the owner's pair and idempotent afterwards", async () => {
    const created = await createPartnerInvite({ pairId: PAIR_ID, sessionId: null, now: NOW });
    const inviteId = state.invites[0]!["id"] as string;
    expect(await revokePartnerInvite({ pairId: "22222222-2222-2222-2222-222222222222", inviteId })).toBe(false);
    expect(state.invites[0]!["revoked_at"]).toBeNull();

    expect(await revokePartnerInvite({ pairId: PAIR_ID, inviteId, now: NOW })).toBe(true);
    expect(await revokePartnerInvite({ pairId: PAIR_ID, inviteId, now: NOW })).toBe(false);
    await expect(findRedeemableInvite({ code: created.code, now: NOW })).rejects.toThrow(INVITE_INVALID_MESSAGE);
  });
});
