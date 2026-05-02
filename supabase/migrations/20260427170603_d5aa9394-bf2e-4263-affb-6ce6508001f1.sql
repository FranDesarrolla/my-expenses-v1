CREATE TABLE public.wallet_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#D97757',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.wallet_accounts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.wallet_distributions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_account_id uuid REFERENCES public.wallet_accounts(id) ON DELETE CASCADE,
  month date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all" ON public.wallet_distributions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS wallet_account_id uuid REFERENCES public.wallet_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.fixed_expenses ADD COLUMN IF NOT EXISTS wallet_account_id uuid REFERENCES public.wallet_accounts(id) ON DELETE SET NULL;