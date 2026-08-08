CREATE TABLE public.pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  owner_name text NOT NULL DEFAULT 'Já',
  partner_name text NOT NULL DEFAULT 'Ty',
  anniversary date NOT NULL DEFAULT '2026-04-03',
  owner_token text NOT NULL UNIQUE,
  partner_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  author text NOT NULL DEFAULT 'owner',
  body text NOT NULL,
  reaction text,
  pinned boolean NOT NULL DEFAULT false,
  deliver_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_pair_created_idx ON public.messages (pair_id, created_at DESC);

CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photos_pair_created_idx ON public.photos (pair_id, created_at DESC);

GRANT ALL ON public.pairs TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.photos TO service_role;

ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;