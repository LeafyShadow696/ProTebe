import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withSession } from "./auth-session.server";
import { buildInviteDeepLink, formatManualCodeForDisplay } from "./invite-core";
import { createPartnerInvite, revokePartnerInvite } from "./invite.server";

const OWNER_ONLY_MESSAGE = "Kód může vytvořit jen zakladatel prostoru.";
const ALREADY_PAIRED_MESSAGE = "Jste už propojení. Nový kód pro připojení není potřeba.";

export type InviteTicket = {
  invite_id: string;
  code: string;
  display_code: string;
  deep_link: string;
  expires_at: string;
};

export const createInvite = createServerFn({ method: "POST" }).handler(async () =>
  withSession(async ({ pair, role, sessionId }): Promise<InviteTicket> => {
    if (role !== "owner") throw new Error(OWNER_ONLY_MESSAGE);
    if (pair.partner_token) throw new Error(ALREADY_PAIRED_MESSAGE);

    const invite = await createPartnerInvite({ pairId: pair.id, sessionId });
    return {
      invite_id: invite.inviteId,
      code: invite.code,
      display_code: formatManualCodeForDisplay(invite.code),
      deep_link: buildInviteDeepLink(invite.code, invite.linkSecret),
      expires_at: invite.expiresAt,
    };
  }),
);

const RevokeInput = z.object({ invite_id: z.string().uuid() });

export const revokeInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RevokeInput.parse(input))
  .handler(async ({ data }) =>
    withSession(async ({ pair, role }): Promise<{ ok: true }> => {
      if (role !== "owner") throw new Error(OWNER_ONLY_MESSAGE);
      await revokePartnerInvite({ pairId: pair.id, inviteId: data.invite_id });
      return { ok: true };
    }),
  );
