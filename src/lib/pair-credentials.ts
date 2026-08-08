/**
 * Single source of truth for the shape of the anonymous credentials this app
 * uses. Every server boundary validates against these before any DB query runs,
 * so a malformed value can never reach PostgREST.
 */
/** 24 random bytes rendered as lowercase hex (see randomToken). */
export const PAIR_TOKEN_PATTERN = /^[0-9a-f]{48}$/;
/** Invite code alphabet, 4-12 chars (see randomCode). */
export const PAIR_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;
/** uuid with dashes stripped (calendar_key default). */
export const CALENDAR_KEY_PATTERN = /^[0-9a-f]{32}$/;

export function isPairToken(value: unknown): value is string {
  return typeof value === "string" && PAIR_TOKEN_PATTERN.test(value);
}

export function isCalendarKey(value: unknown): value is string {
  return typeof value === "string" && CALENDAR_KEY_PATTERN.test(value);
}

/** Shared user-facing text for a token that no longer resolves to a pair. */
export const INVALID_TOKEN_MESSAGE = "Toto propojení už neplatí.";