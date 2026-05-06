-- Savings (metas de ahorro)
-- Saved as migration: 20260506_savings

-- Table: savings (metas)
CREATE TABLE IF NOT EXISTS savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  goal_amount NUMERIC,
  color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: savings_deposits (depósitos)
CREATE TABLE IF NOT EXISTS savings_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_id UUID REFERENCES savings(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  wallet_account_id UUID REFERENCES wallet_accounts(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own savings" ON savings;
DROP POLICY IF EXISTS "Users can manage own savings_deposits" ON savings_deposits;

CREATE POLICY "Users can manage own savings" ON savings FOR ALL USING (true);
CREATE POLICY "Users can manage own savings_deposits" ON savings_deposits FOR ALL USING (true);