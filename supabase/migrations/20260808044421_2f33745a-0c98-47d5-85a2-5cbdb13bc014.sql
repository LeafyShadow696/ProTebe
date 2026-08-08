-- Auth V2 foundation (additive only). No legacy column is touched.

CREATE TABLE public.pair_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'partner')),
  token_digest text NOT NULL UNIQUE,
  device_label text,
  platform text,
  created_via text NOT NULL CHECK (created_via IN ('create', 'invite', 'recovery', 'legacy_migration', 'rotation')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by_session_id uuid REFERENCES public.pair_sessions(id) ON DELETE SET NULL,
  rotated_from_session_id uuid REFERENCES public.pair_sessions(id) ON DELETE SET NULL,
  created_via_invite_id uuid,
  CONSTRAINT pair_sessions_idle_within_absolute CHECK (idle_expires_at <= absolute_expires_at),
  CONSTRAINT pair_sessions_absolute_after_created CHECK (absolute_expires_at > created_at)
);
GRANT ALL ON public.pair_sessions TO service_role;
ALTER TABLE public.pair_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pair_sessions FROM PUBLIC, anon, authenticated;
CREATE INDEX pair_sessions_pair_role_idx ON public.pair_sessions (pair_id, role);
CREATE INDEX pair_sessions_active_idx ON public.pair_sessions (pair_id, last_seen_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX pair_sessions_expiry_idx ON public.pair_sessions (idle_expires_at) WHERE revoked_at IS NULL;
CREATE INDEX pair_sessions_absolute_expiry_idx ON public.pair_sessions (absolute_expires_at) WHERE revoked_at IS NULL;

CREATE TABLE public.pair_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  created_by_session_id uuid REFERENCES public.pair_sessions(id) ON DELETE SET NULL,
  target_role text NOT NULL CHECK (target_role IN ('owner', 'partner')),
  link_secret_digest text NOT NULL UNIQUE,
  manual_code_hmac text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by_session_id uuid REFERENCES public.pair_sessions(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  CONSTRAINT pair_invites_expires_after_created CHECK (expires_at > created_at),
  CONSTRAINT pair_invites_consumer_requires_consumed CHECK (consumed_by_session_id IS NULL OR consumed_at IS NOT NULL)
);
GRANT ALL ON public.pair_invites TO service_role;
ALTER TABLE public.pair_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pair_invites FROM PUBLIC, anon, authenticated;
CREATE INDEX pair_invites_pair_idx ON public.pair_invites (pair_id, created_at DESC);
CREATE INDEX pair_invites_expiry_idx ON public.pair_invites (expires_at);
CREATE INDEX pair_invites_open_idx ON public.pair_invites (pair_id, target_role) WHERE consumed_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.pair_sessions
  ADD CONSTRAINT pair_sessions_created_via_invite_fkey
  FOREIGN KEY (created_via_invite_id) REFERENCES public.pair_invites(id) ON DELETE SET NULL;
CREATE INDEX pair_sessions_created_via_invite_idx ON public.pair_sessions (created_via_invite_id) WHERE created_via_invite_id IS NOT NULL;

CREATE TABLE public.pair_recovery_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL UNIQUE REFERENCES public.pairs(id) ON DELETE CASCADE,
  secret_digest text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz
);
GRANT ALL ON public.pair_recovery_keys TO service_role;
ALTER TABLE public.pair_recovery_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pair_recovery_keys FROM PUBLIC, anon, authenticated;

CREATE TABLE public.rate_limit_buckets (
  scope text NOT NULL,
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1 CHECK (count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (scope, key_hash, window_start)
);
GRANT ALL ON public.rate_limit_buckets TO service_role;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_buckets FROM PUBLIC, anon, authenticated;
CREATE INDEX rate_limit_buckets_expiry_idx ON public.rate_limit_buckets (expires_at);

CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  _scope text,
  _key_hash text,
  _limit integer,
  _window_seconds integer
)
RETURNS TABLE (allowed boolean, current_count integer, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  _window interval := make_interval(secs => GREATEST(_window_seconds, 1));
  _start timestamptz := to_timestamp(floor(extract(epoch FROM _now) / GREATEST(_window_seconds, 1)) * GREATEST(_window_seconds, 1));
  _count integer;
BEGIN
  IF _limit < 1 THEN RAISE EXCEPTION 'rate_limit_hit: _limit must be >= 1'; END IF;
  INSERT INTO public.rate_limit_buckets AS b (scope, key_hash, window_start, count, expires_at)
  VALUES (_scope, _key_hash, _start, 1, _start + _window)
  ON CONFLICT (scope, key_hash, window_start)
  DO UPDATE SET count = b.count + 1
  RETURNING b.count INTO _count;
  RETURN QUERY SELECT
    _count <= _limit,
    _count,
    GREATEST(_limit - _count, 0),
    CASE WHEN _count <= _limit THEN 0 ELSE GREATEST(CEIL(extract(epoch FROM (_start + _window - _now)))::integer, 1) END;
END;
$$;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.rate_limit_cleanup()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE _deleted integer;
BEGIN
  DELETE FROM public.rate_limit_buckets WHERE expires_at < now();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.rate_limit_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_cleanup() TO service_role;