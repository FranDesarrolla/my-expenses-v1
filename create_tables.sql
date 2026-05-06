-- Create savings and savings_deposits tables
-- Run this in Supabase SQL Editor

-- Table: savings (metas de ahorro)
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

-- Add RLS
ALTER TABLE savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_deposits ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all authenticated users)
CREATE POLICY "Users can manage own savings" ON savings FOR ALL USING (true);
CREATE POLICY "Users can manage own savings_deposits" ON savings_deposits FOR ALL USING (true);