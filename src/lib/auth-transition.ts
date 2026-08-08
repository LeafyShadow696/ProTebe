/** Pure decision layer for the legacy → Auth V2 transition. */
import type { PairRole } from "./pair-types";
export type ResumeCredentialPlan = "issue_v2_session" | "issue_legacy_compat_cookie";
export function planResumeCredential(upgradeEnabled: boolean): ResumeCredentialPlan { return upgradeEnabled ? "issue_v2_session" : "issue_legacy_compat_cookie"; }
export function legacyCompatAllowed(upgradeEnabled: boolean): boolean { return !upgradeEnabled; }
export function legacyTokenForRole(pair: { owner_token: string; partner_token: string | null }, role: PairRole): string | null { const token = role === "partner" ? pair.partner_token : pair.owner_token; return token && token.length > 0 ? token : null; }