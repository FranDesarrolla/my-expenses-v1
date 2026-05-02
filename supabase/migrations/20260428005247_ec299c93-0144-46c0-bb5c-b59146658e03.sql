CREATE TABLE public.extra_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.extra_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all" ON public.extra_income FOR ALL USING (true) WITH CHECK (true);