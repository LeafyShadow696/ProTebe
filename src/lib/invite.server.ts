import { issueInvite, manualCodeHmac, verifyInviteLinkSecret } from "./auth-v2.server";
import { INVITE_INVALID_MESSAGE, INVITE_TARGET_ROLE, inviteExpiry } from "./invite-core";
import { adminClient, dbFailure } from "./protebe.server";

export type InviteRow = {
  id: string;
  pair_id: string;
  target_role: string;
  link_secret_digest: string;
  manual_code_hmac: string | null;
  expires_at: string;
  consumed_at: string | null;
  revoked_at: string | null;
};

export type CreatedInvite = {
  inviteId: string;
  code: string;
  linkSecret: string;
  expiresAt: string;
};

export async function revokeOpenPartnerInvites(pairId: string, now: Date): Promise<void> {
  const supabase = await adminClient();
  const { error } = await supabase.from("pair_invites").update({ revoked_at: now.toISOString() }).eq("pair_id", pairId).eq("target_role", INVITE_TARGET_ROLE).is("consumed_at", null).is("revoked_at", null);
  if (error) throw dbFailure("invite/revoke-open", error);
}

export async function createPartnerInvite(input: {
  pairId: string;
  sessionId: string | null;
  now?: Date;
}): Promise<CreatedInvite> {
  const now = input.now ?? new Date();
  await revokeOpenPartnerInvites(input.pairId, now);
  const issued = await issueInvite();
  const expiresAt = inviteExpiry(now).toISOString();
  const supabase = await adminClient();
  const { data, error } = await supabase.from("pair_invites").insert({ pair_id: input.pairId, created_by_session_id: input.sessionId, target_role: INVITE_TARGET_ROLE, link_secret_digest: issued.linkSecretDigest, manual_code_hmac: issued.manualCodeHmac, created_at: now.toISOString(), expires_at: expiresAt }).select("id").single();
  if (error || !data) throw dbFailure("invite/create", error ?? "no invite row");
  return {
    inviteId: (data as { id: string }).id,
    code: issued.manualCode,
    linkSecret: issued.linkSecret,
    expiresAt,
  };
}

export async function revokePartnerInvite(input: {
  pairId: string;
  inviteId: string;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const supabase = await adminClient();
  const { data, error } = await supabase.from("pair_invites").update({ revoked_at: now.toISOString() }).eq("id", input.inviteId).eq("pair_id", input.pairId).eq("target_role", INVITE_TARGET_ROLE).is("consumed_at", null).is("revoked_at", null).select("id");
  if (error) throw dbFailure("invite/revoke", error);
  return Array.isArray(data) && data.length > 0;
}

export async function findRedeemableInvite(input: {
  code: string;
  secret?: string | null;
  now?: Date;
}): Promise<InviteRow> {
  const now = input.now ?? new Date();
  const hmac = await manualCodeHmac(input.code);
  const supabase = await adminClient();
  const { data, error } = await supabase.from("pair_invites").select("*").eq("manual_code_hmac", hmac).maybeSingle();
  if (error) throw dbFailure("invite/lookup", error);
  if (!data) throw new Error(INVITE_INVALID_MESSAGE);
  const invite = data as unknown as InviteRow;
  if (invite.target_role !== INVITE_TARGET_ROLE) throw new Error(INVITE_INVALID_MESSAGE);
  if (invite.revoked_at || invite.consumed_at) throw new Error(INVITE_INVALID_MESSAGE);
  if (!(new Date(invite.expires_at).getTime() > now.getTime()))
    throw new Error(INVITE_INVALID_MESSAGE);
  if (input.secret) {
    const ok = await verifyInviteLinkSecret(input.secret, invite.link_secret_digest);
    if (!ok) throw new Error(INVITE_INVALID_MESSAGE);
  }
  return invite;
}

export async function claimInvite(input: {
  inviteId: string;
  sessionId: string;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const supabase = await adminClient();
  const { data, error } = await supabase.from("pair_invites").update({ consumed_at: now.toISOString(), consumed_by_session_id: input.sessionId }).eq("id", input.inviteId).is("consumed_at", null).is("revoked_at", null).gt("expires_at", now.toISOString()).select("id");
  if (error) throw dbFailure("invite/claim", error);
  return Array.isArray(data) && data.length > 0;
}
