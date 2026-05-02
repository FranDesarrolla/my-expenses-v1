CREATE TABLE public.fixed_expense_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_expense_id uuid NOT NULL,
  month date NOT NULL,
  amount numeric,
  description text,
  category_id uuid,
  wallet_account_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (fixed_expense_id, month)
);

ALTER TABLE public.fixed_expense_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all" ON public.fixed_expense_overrides FOR ALL USING (true) WITH CHECK (true);