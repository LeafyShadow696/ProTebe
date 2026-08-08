import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  clearLegacyCompatCookie,
  clearSessionCookie,
  createSessionRow,
  isUpgradeEnabled,
  issueSessionCookie,
  readLegacyCompatCookie,
  resolveActiveSession,
  resolveLegacyCompatCredential,
  resolveSessionFromCookie,
  revokeSessionRow,
  withSession,
  writeLegacyCompatCookie,
  writeSessionCookie,
} from "./auth-session.server";
import { logoutTarget, performLogout } from "./auth-logout";
import { legacyCompatAllowed, legacyTokenForRole, planResumeCredential } from "./auth-transition";
import { normalizeManualCode } from "./auth-v2-format";
import { inviteLinkSecretSchema } from "./auth-v2-schemas";
import { INVITE_INVALID_MESSAGE } from "./invite-core";
import { claimInvite, findRedeemableInvite } from "./invite.server";

import {
  adminClient,
  dbFailure,
  findPairByToken,
  randomCode,
  randomToken,
  toPublicPair,
  type PairRow,
} from "./protebe.server";
import { pairCodeSchema, pairTokenSchema } from "./pair-schemas";
import type { PublicPair } from "./pair-types";

const CreateInput = z.object({
  owner_name: z.string().trim().min(1).max(40),
  partner_name: z.string().trim().min(1).max(40),
  anniversary: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createPair = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data }) => {
    const supabase = await adminClient();
    const ownerToken = randomToken();

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data: row, error } = await supabase
        .from("pairs")
        .insert({
          code: randomCode(),
          owner_name: data.owner_name,
          partner_name: data.partner_name,
          anniversary: data.anniversary,
          owner_token: ownerToken,
        })
        .select("*")
        .single();

      if (!error && row) {
        const pair = row as PairRow;
        await issueSessionCookie({ pairId: pair.id, role: "owner", createdVia: "create" });
        return toPublicPair(pair, "owner");
      }
      if (error && error.code !== "23505") throw dbFailure("createPair", error);
    }
    throw new Error("Nepodařilo se vytvořit pár. Zkus to prosím znovu.");
  });

const JoinInput = z.object({
  code: z.string(),
  secret: z.string().optional(),
  joiner_name: z.string().trim().min(1).max(40),
});

async function discardSession(sessionId: string): Promise<void> {
  try {
    await revokeSessionRow(sessionId);
  } catch (error) {
    console.error(
      `[protebe] joinPair/discard: ${error instanceof Error ? error.message : "failed"}`,
    );
  }
}

export const joinPair = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => JoinInput.parse(input))
  .handler(async ({ data }) => {
    const code = normalizeManualCode(data.code);
    if (!code) throw new Error(INVITE_INVALID_MESSAGE);
    if (data.secret !== undefined && !inviteLinkSecretSchema.safeParse(data.secret).success) {
      throw new Error(INVITE_INVALID_MESSAGE);
    }

    const invite = await findRedeemableInvite({ code, secret: data.secret ?? null });
    const supabase = await adminClient();
    const { data: found, error } = await supabase
      .from("pairs")
      .select("*")
      .eq("id", invite.pair_id)
      .maybeSingle();
    if (error) throw dbFailure("joinPair/pair", error);
    if (!found) throw new Error(INVITE_INVALID_MESSAGE);

    const pair = found as PairRow;
    if (pair.partner_token) throw new Error(INVITE_INVALID_MESSAGE);

    const issued = await createSessionRow({
      pairId: pair.id,
      role: "partner",
      createdVia: "invite",
      inviteId: invite.id,
    });

    const claimed = await claimInvite({ inviteId: invite.id, sessionId: issued.sessionId });
    if (!claimed) {
      await discardSession(issued.sessionId);
      throw new Error(INVITE_INVALID_MESSAGE);
    }

    const { data: updated, error: updateError } = await supabase
      .from("pairs")
      .update({ partner_token: randomToken(), partner_name: data.joiner_name })
      .eq("id", pair.id)
      .is("partner_token", null)
      .select("*")
      .maybeSingle();
    if (updateError) {
      await discardSession(issued.sessionId);
      throw dbFailure("joinPair/link", updateError);
    }
    if (!updated) {
      await discardSession(issued.sessionId);
      throw new Error(INVITE_INVALID_MESSAGE);
    }

    writeSessionCookie(issued.credential);
    return toPublicPair(updated as PairRow, "partner");
  });

export const getPair = createServerFn({ method: "POST" }).handler(async () =>
  withSession(async ({ pair, role }) => toPublicPair(pair, role)),
);

const UpdateInput = z.object({
  owner_name: z.string().trim().min(1).max(40).optional(),
  partner_name: z.string().trim().min(1).max(40).optional(),
  anniversary: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const updatePair = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateInput.parse(input ?? {}))
  .handler(async ({ data }) =>
    withSession(async ({ pair, role }) => {
      const patch: { owner_name?: string; partner_name?: string; anniversary?: string } = {};
      if (data.owner_name) patch["owner_name"] = data.owner_name;
      if (data.partner_name) patch["partner_name"] = data.partner_name;
      if (data.anniversary) patch["anniversary"] = data.anniversary;
      if (Object.keys(patch).length === 0) return toPublicPair(pair, role);

      const supabase = await adminClient();
      const { data: updated, error } = await supabase
        .from("pairs")
        .update(patch)
        .eq("id", pair.id)
        .select("*")
        .single();

      if (error) throw dbFailure("updatePair", error);
      return toPublicPair(updated as PairRow, role);
    }),
  );

const ResumeInput = z.object({
  token: z.string().optional(),
  recovery: z
    .object({
      pair_id: z.string().uuid(),
      code: pairCodeSchema,
      role: z.enum(["owner", "partner"]),
    })
    .optional(),
});

export type ResumeResult =
  | { status: "ok"; pair: PublicPair; relinked: boolean; authMode: "v2" | "legacy" }
  | { status: "gone" };

export const resumeSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResumeInput.parse(input ?? {}))
  .handler(async ({ data }): Promise<ResumeResult> => {
    const current = await resolveSessionFromCookie();
    if (current) {
      return {
        status: "ok",
        pair: toPublicPair(current.pair, current.role),
        relinked: false,
        authMode: "v2",
      };
    }
    clearSessionCookie();

    const upgrade = isUpgradeEnabled();
    const compat = legacyCompatAllowed(upgrade);
    if (!compat) clearLegacyCompatCookie();

    if (compat) {
      const legacyCookie = await resolveLegacyCompatCredential(readLegacyCompatCookie());
      if (legacyCookie) {
        return {
          status: "ok",
          pair: toPublicPair(legacyCookie.pair, legacyCookie.role),
          relinked: false,
          authMode: "legacy",
        };
      }
    }

    if (data.token && pairTokenSchema.safeParse(data.token).success) {
      const legacy = await findPairByToken(data.token);
      if (legacy) {
        if (planResumeCredential(upgrade) === "issue_v2_session") {
          await issueSessionCookie({
            pairId: legacy.pair.id,
            role: legacy.role,
            createdVia: "legacy_migration",
          });
        } else {
          writeLegacyCompatCookie(data.token);
        }
        return {
          status: "ok",
          pair: toPublicPair(legacy.pair, legacy.role),
          relinked: false,
          authMode: upgrade ? "v2" : "legacy",
        };
      }
    }

    const recovery = data.recovery;
    if (!recovery) return { status: "gone" };

    const supabase = await adminClient();
    const { data: byCode, error: codeError } = await supabase
      .from("pairs")
      .select("*")
      .eq("code", recovery.code)
      .maybeSingle();
    if (codeError) throw dbFailure("resumeSession/code", codeError);
    if (!byCode) return { status: "gone" };

    const row = byCode as PairRow;
    if (row.id !== recovery.pair_id) return { status: "gone" };

    let pair = row;
    if (recovery.role === "partner" && !row.partner_token) {
      const { data: updated, error: updateError } = await supabase
        .from("pairs")
        .update({ partner_token: randomToken() })
        .eq("id", row.id)
        .select("*")
        .single();
      if (updateError) throw dbFailure("resumeSession/link", updateError);
      pair = updated as PairRow;
    }

    if (planResumeCredential(upgrade) === "issue_v2_session") {
      await issueSessionCookie({ pairId: pair.id, role: recovery.role, createdVia: "recovery" });
    } else {
      const legacyToken = legacyTokenForRole(pair, recovery.role);
      if (!legacyToken) return { status: "gone" };
      writeLegacyCompatCookie(legacyToken);
    }

    return {
      status: "ok",
      pair: toPublicPair(pair, recovery.role),
      relinked: true,
      authMode: upgrade ? "v2" : "legacy",
    };
  });

export const logoutDevice = createServerFn({ method: "POST" }).handler(async () => {
  const session = await resolveActiveSession();
  return performLogout(logoutTarget(session), {
    revoke: revokeSessionRow,
    clearCookies: () => {
      clearSessionCookie();
      clearLegacyCompatCookie();
    },
    logError: (message: string) => console.error(message),
  });
});
