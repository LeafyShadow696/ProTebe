/**
 * Auth V2 session resolver (Fáze C2). The resolver core is deliberately free of
 * cookie/request I/O so it can be exercised against a fake Supabase client.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_TOUCH_AFTER_MS,
  createSessionRow,
  isUpgradeEnabled,
  LEGACY_COMPAT_COOKIE,
  parseRole,
  readSessionCredentialFromRequest,
  resolveLegacyCompatCredential,
  resolveRequestSession,
  resolveSessionCredential,
  revokeSessionRow,
  SESSION_COOKIE,
  UPGRADE_FLAG_ENV,
} from "@/lib/auth-session.server";
import { formatSessionCredential, generateSessionSecret } from "@/lib/auth-v2-format";
import { sessionSecretDigest } from "@/lib/auth-v2.server";
import { toPublicPair, type PairRow } from "@/lib/protebe.server";

type Table = "pair_sessions" | "pairs";

const state = {
  sessions: [] as Record<string, unknown>[],
  pairs: [] as Record<string, unknown>[],
  inserted: [] as Record<string, unknown>[],
  updates: [] as { table: Table; patch: Record<string, unknown> }[],
};

function rowsFor(table: Table) {
  return table === "pairs" ? state.pairs : state.sessions;
}

function builder(table: Table) {
  const filters: [string, unknown][] = [];
  let pendingInsert: Record<string, unknown> | null = null;
  let pendingPatch: Record<string, unknown> | null = null;

  const match = () => rowsFor(table).filter((row) => filters.every(([key, value]) => row[key] === value));

  const api: Record<string, unknown> = {
    select: () => api,
    eq: (key: string, value: unknown) => {
      filters.push([key, value]);
      return api;
    },
    is: (key: string, value: unknown) => {
      filters.push([key, value]);
      return api;
    },
    insert: (values: Record<string, unknown>) => {
      pendingInsert = values;
      state.inserted.push(values);
      return api;
    },
    update: (patch: Record<string, unknown>) => {
      pendingPatch = patch;
      return api;
    },
    maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
    single: async () => {
      if (pendingInsert) {
        const row = { id: `sess-${state.sessions.length + 1}`, ...pendingInsert };
        state.sessions.push(row);
        return { data: row, error: null };
      }
      return { data: match()[0] ?? null, error: null };
    },
    then: undefined,
  };

  (api as { then?: unknown }).then = (resolve: (value: unknown) => unknown) => {
    if (pendingPatch) state.updates.push({ table, patch: pendingPatch });
    return Promise.resolve({ data: null, error: null }).then(resolve);
  };

  return api;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: Table) => builder(table) },
}));

const PAIR: PairRow = {
  id: "11111111-1111-1111-1111-111111111111",
  code: "ABC234",
  owner_name: "Já",
  partner_name: "Ty",
  anniversary: "2026-04-03",
  owner_token: "a".repeat(48),
  partner_token: null,
  created_at: new Date("2026-01-01T00:00:00Z").toISOString(),
};

const NOW = new Date("2026-06-01T12:00:00Z");

async function seedSession(overrides: Record<string, unknown> = {}) {
  const secret = generateSessionSecret();
  const row = {
    id: "22222222-2222-2222-2222-222222222222",
    pair_id: PAIR.id,
    role: "partner",
    token_digest: await sessionSecretDigest(secret),
    last_seen_at: NOW.toISOString(),
    idle_expires_at: new Date(NOW.getTime() + 86_400_000).toISOString(),
    absolute_expires_at: new Date(NOW.getTime() + 10 * 86_400_000).toISOString(),
    revoked_at: null,
    ...overrides,
  };
  state.sessions.push(row);
  return { row, credential: formatSessionCredential(row.id, secret) };
}

beforeEach(() => {
  state.sessions = [];
  state.pairs = [{ ...PAIR } as unknown as Record<string, unknown>];
  state.inserted = [];
  state.updates = [];
  delete process.env[UPGRADE_FLAG_ENV];
});

describe("resolveSessionCredential", () => {
  it("resolves a valid credential to the pair and the role stored in the DB", async () => {
    const { credential } = await seedSession({ role: "partner" });
    const session = await resolveSessionCredential(credential, NOW);
    expect(session?.pair.id).toBe(PAIR.id);
    expect(session?.role).toBe("partner");
    expect(session?.authMode).toBe("v2");
  });

  it("rejects malformed credentials without touching the database", async () => {
    for (const value of [null, undefined, "", "nope", "ps1.only-two", "ps2.a.b", 42]) {
      expect(await resolveSessionCredential(value as string | null, NOW)).toBeNull();
    }
    expect(state.updates).toHaveLength(0);
  });

  it("rejects an unknown session id", async () => {
    const credential = formatSessionCredential("33333333-3333-3333-3333-333333333333", generateSessionSecret());
    expect(await resolveSessionCredential(credential, NOW)).toBeNull();
  });

  it("rejects a correct session id carrying the wrong secret", async () => {
    const { row } = await seedSession();
    const forged = formatSessionCredential(row.id, generateSessionSecret());
    expect(await resolveSessionCredential(forged, NOW)).toBeNull();
  });

  it("rejects revoked, idle-expired and absolute-expired sessions", async () => {
    const revoked = await seedSession({ revoked_at: NOW.toISOString() });
    expect(await resolveSessionCredential(revoked.credential, NOW)).toBeNull();

    state.sessions = [];
    const idle = await seedSession({ idle_expires_at: new Date(NOW.getTime() - 1000).toISOString() });
    expect(await resolveSessionCredential(idle.credential, NOW)).toBeNull();

    state.sessions = [];
    const absolute = await seedSession({ absolute_expires_at: new Date(NOW.getTime() - 1000).toISOString() });
    expect(await resolveSessionCredential(absolute.credential, NOW)).toBeNull();
  });

  it("does not write on every request (lazy last_seen touch)", async () => {
    const { credential } = await seedSession({ last_seen_at: new Date(NOW.getTime() - 1000).toISOString() });
    await resolveSessionCredential(credential, NOW);
    expect(state.updates).toHaveLength(0);
  });

  it("slides last_seen_at and idle expiry once the session goes stale, clamped by absolute", async () => {
    const absolute = new Date(NOW.getTime() + 60_000);
    const { credential } = await seedSession({
      last_seen_at: new Date(NOW.getTime() - SESSION_TOUCH_AFTER_MS - 1000).toISOString(),
      absolute_expires_at: absolute.toISOString(),
    });
    await resolveSessionCredential(credential, NOW);
    expect(state.updates).toHaveLength(1);
    const patch = state.updates[0]!.patch;
    expect(patch["last_seen_at"]).toBe(NOW.toISOString());
    expect(patch["idle_expires_at"]).toBe(absolute.toISOString());
  });
});

describe("createSessionRow", () => {
  it("stores only a digest and returns a credential that never leaks into PublicPair", async () => {
    const issued = await createSessionRow({ pairId: PAIR.id, role: "owner", createdVia: "create", now: NOW });

    expect(issued.credential.startsWith("ps1.")).toBe(true);
    const row = state.inserted[0]!;
    expect(row["created_via"]).toBe("create");
    expect(row["role"]).toBe("owner");
    expect(row["pair_id"]).toBe(PAIR.id);
    expect(row["absolute_expires_at"]).toBe(new Date(NOW.getTime() + 365 * 86_400_000).toISOString());
    expect(JSON.stringify(row)).not.toContain(issued.credential.split(".")[2]);

    const publicPair = toPublicPair(PAIR, "owner") as Record<string, unknown>;
    expect(publicPair["token"]).toBeUndefined();
    expect(JSON.stringify(publicPair)).not.toContain("ps1.");
  });
});

describe("revokeSessionRow", () => {
  it("marks exactly one session revoked", async () => {
    await revokeSessionRow("22222222-2222-2222-2222-222222222222", NOW);
    expect(state.updates).toEqual([{ table: "pair_sessions", patch: { revoked_at: NOW.toISOString() } }]);
  });
});

describe("cookie plumbing", () => {
  it("reads the session credential out of a raw Request cookie header", () => {
    const credential = formatSessionCredential("44444444-4444-4444-4444-444444444444", generateSessionSecret());
    const request = new Request("http://localhost/api/public/upload", {
      headers: { cookie: `other=1; ${SESSION_COOKIE}=${credential}; protebe_recovery=x` },
    });
    expect(readSessionCredentialFromRequest(request)).toBe(credential);
    expect(readSessionCredentialFromRequest(new Request("http://localhost/"))).toBeNull();
  });
});

describe("silent upgrade kill-switch", () => {
  it("defaults to on and only an explicit false disables it", () => {
    expect(isUpgradeEnabled()).toBe(true);
    process.env[UPGRADE_FLAG_ENV] = "true";
    expect(isUpgradeEnabled()).toBe(true);
    process.env[UPGRADE_FLAG_ENV] = "False";
    expect(isUpgradeEnabled()).toBe(false);
  });
});

describe("role defence in depth", () => {
  it("never maps an unexpected DB role onto owner", async () => {
    expect(parseRole("owner")).toBe("owner");
    expect(parseRole("partner")).toBe("partner");
    for (const value of ["Owner", "admin", "", null, undefined, 1]) expect(parseRole(value)).toBeNull();

    const { credential } = await seedSession({ role: "superuser" });
    expect(await resolveSessionCredential(credential, NOW)).toBeNull();
  });
});

describe("legacy compatibility resolver", () => {
  it("resolves a strictly valid legacy token to the pair and role from the DB", async () => {
    const session = await resolveLegacyCompatCredential(PAIR.owner_token);
    expect(session?.pair.id).toBe(PAIR.id);
    expect(session?.role).toBe("owner");
    expect(session?.authMode).toBe("legacy");
    expect(session?.sessionId).toBeNull();
  });

  it("fails closed on malformed or unknown legacy values", async () => {
    for (const value of [null, undefined, "", "nope", "A".repeat(48), "a".repeat(47), "b".repeat(48)]) {
      expect(await resolveLegacyCompatCredential(value as string | null)).toBeNull();
    }
  });
});

describe("request resolver precedence", () => {
  const requestWith = (cookie: string) => new Request("http://localhost/api/public/upload", { headers: { cookie } });

  it("flag ON: a legacy compat cookie is not an authorisation fallback", async () => {
    process.env[UPGRADE_FLAG_ENV] = "true";
    const session = await resolveRequestSession(requestWith(`${LEGACY_COMPAT_COOKIE}=${PAIR.owner_token}`), NOW);
    expect(session).toBeNull();
  });

  it("flag OFF: a valid legacy compat cookie authorises with DB-derived role", async () => {
    process.env[UPGRADE_FLAG_ENV] = "false";
    const session = await resolveRequestSession(requestWith(`${LEGACY_COMPAT_COOKIE}=${PAIR.owner_token}`), NOW);
    expect(session?.pair.id).toBe(PAIR.id);
    expect(session?.role).toBe("owner");
    expect(session?.authMode).toBe("legacy");
  });

  it("flag OFF: a malformed legacy compat cookie fails closed", async () => {
    process.env[UPGRADE_FLAG_ENV] = "false";
    expect(await resolveRequestSession(requestWith(`${LEGACY_COMPAT_COOKIE}=zzz`), NOW)).toBeNull();
  });

  it("V2 wins over a legacy compat cookie even with the flag OFF", async () => {
    process.env[UPGRADE_FLAG_ENV] = "false";
    const { credential } = await seedSession({ role: "partner" });
    const session = await resolveRequestSession(
      requestWith(`${SESSION_COOKIE}=${credential}; ${LEGACY_COMPAT_COOKIE}=${PAIR.owner_token}`),
      NOW,
    );
    expect(session?.authMode).toBe("v2");
    expect(session?.role).toBe("partner");
  });

  it("switching the flag back ON makes the compat cookie alone insufficient", async () => {
    process.env[UPGRADE_FLAG_ENV] = "false";
    expect(await resolveRequestSession(requestWith(`${LEGACY_COMPAT_COOKIE}=${PAIR.owner_token}`), NOW)).not.toBeNull();
    delete process.env[UPGRADE_FLAG_ENV];
    expect(await resolveRequestSession(requestWith(`${LEGACY_COMPAT_COOKIE}=${PAIR.owner_token}`), NOW)).toBeNull();
  });
});
