/** Server-only helpers for the Pro Tebe pair model. */

export type PairRow = {
  id: string;
  code: string;
  owner_name: string;
  partner_name: string;
  anniversary: string;
  owner_token: string;
  partner_token: string | null;
  created_at: string;
};

import { INVALID_TOKEN_MESSAGE, isPairToken } from "./pair-credentials";
import type { PairRole, PublicPair } from "./pair-types";
export type { PairRole, PublicPair };
export type PairSession = { pair: PairRow; role: PairRole };
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
export function dbFailure(context: string, detail: unknown): Error {
  const message = detail instanceof Error ? detail.message : String(detail);
  console.error(`[protebe] ${context}: ${message}`);
  return new Error("Něco se nepovedlo. Zkus to prosím znovu.");
}
export async function findPairByToken(token: string): Promise<PairSession | null> {
  if (!isPairToken(token)) return null;
  const supabase = await adminClient();
  const byOwner = await supabase.from("pairs").select("*").eq("owner_token", token).maybeSingle();
  if (byOwner.error) throw dbFailure("findPairByToken/owner", byOwner.error);
  if (byOwner.data) return { pair: byOwner.data as PairRow, role: "owner" };
  const byPartner = await supabase.from("pairs").select("*").eq("partner_token", token).maybeSingle();
  if (byPartner.error) throw dbFailure("findPairByToken/partner", byPartner.error);
  if (byPartner.data) return { pair: byPartner.data as PairRow, role: "partner" };
  return null;
}
export async function resolvePair(token: string): Promise<PairSession> {
  const session = await findPairByToken(token);
  if (!session) throw new Error(INVALID_TOKEN_MESSAGE);
  return session;
}
export function toPublicPair(pair: PairRow, role: PairRole): PublicPair {
  return { id: pair.id, code: pair.code, owner_name: pair.owner_name, partner_name: pair.partner_name, anniversary: pair.anniversary, has_partner: Boolean(pair.partner_token), role };
}