CREATE INDEX pair_invites_created_by_session_idx
  ON public.pair_invites (created_by_session_id)
  WHERE created_by_session_id IS NOT NULL;

CREATE INDEX pair_invites_consumed_by_session_idx
  ON public.pair_invites (consumed_by_session_id)
  WHERE consumed_by_session_id IS NOT NULL;

CREATE INDEX pair_sessions_revoked_by_session_idx
  ON public.pair_sessions (revoked_by_session_id)
  WHERE revoked_by_session_id IS NOT NULL;

CREATE INDEX pair_sessions_rotated_from_session_idx
  ON public.pair_sessions (rotated_from_session_id)
  WHERE rotated_from_session_id IS NOT NULL;
