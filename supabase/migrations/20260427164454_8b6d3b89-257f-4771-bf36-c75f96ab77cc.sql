-- Add paid status to expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;

-- Create fixed_expense_payments for monthly paid tracking
CREATE TABLE IF NOT EXISTS public.fixed_expense_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixed_expense_id uuid,
  month date NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fixed_expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all" ON public.fixed_expense_payments FOR ALL USING (true) WITH CHECK (true);