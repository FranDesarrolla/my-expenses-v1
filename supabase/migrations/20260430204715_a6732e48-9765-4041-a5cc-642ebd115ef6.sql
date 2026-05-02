ALTER TABLE public.salary ADD COLUMN wallet_account_id uuid;

CREATE TABLE public.wallet_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet_id uuid,
  to_wallet_id uuid,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all" ON public.wallet_transfers FOR ALL USING (true) WITH CHECK (true);