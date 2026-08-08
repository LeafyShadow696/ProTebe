CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  title text NOT NULL,
  note text,
  starts_on date NOT NULL,
  starts_at time,
  all_day boolean NOT NULL DEFAULT true,
  kind text NOT NULL DEFAULT 'moment',
  author text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_pair_date_idx ON public.events (pair_id, starts_on);
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No public access to events" ON public.events FOR SELECT USING (false);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pairs
  ADD COLUMN IF NOT EXISTS calendar_key text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');

ALTER PUBLICATION supabase_realtime ADD TABLE public.events;