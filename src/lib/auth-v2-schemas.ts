/** Auth V2 — Zod schemas for the new credential formats (server boundaries). */
import { z } from "zod";

import { isSessionCredential, normalizeManualCode, normalizeRecoveryCode } from "./auth-v2-format";

export const sessionCredentialSchema = z.string().refine(isSessionCredential, {
  message: "invalid session credential",
});

export const manualInviteCodeSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeManualCode(value);
  if (!normalized) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid invite code" });
    return z.NEVER;
  }
  return normalized;
});

export const recoveryCodeSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeRecoveryCode(value);
  if (!normalized) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid recovery code" });
    return z.NEVER;
  }
  return normalized;
});

export const inviteLinkSecretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const sessionRoleSchema = z.enum(["owner", "partner"]);
export const sessionOriginSchema = z.enum([
  "create",
  "invite",
  "recovery",
  "legacy_migration",
  "rotation",
]);
export const deviceMetaSchema = z.object({
  device_label: z.string().trim().min(1).max(60).optional(),
  platform: z.string().trim().min(1).max(40).optional(),
});
