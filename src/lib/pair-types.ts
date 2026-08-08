export type PairRole = "owner" | "partner";

/**
 * Everything the client is allowed to know about the pair. Since Fáze C2 there
 * is deliberately NO credential here: the Auth V2 session secret lives only in
 * the Secure/HttpOnly `protebe_session` cookie.
 */
export type PublicPair = {
  id: string;
  code: string;
  owner_name: string;
  partner_name: string;
  anniversary: string;
  has_partner: boolean;
  role: PairRole;
};

/** Name of the person using the app right now, and of the one they love. */
export function pairNames(pair: PublicPair): { me: string; you: string } {
  return pair.role === "owner"
    ? { me: pair.owner_name, you: pair.partner_name }
    : { me: pair.partner_name, you: pair.owner_name };
}