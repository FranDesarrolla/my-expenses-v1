
-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#D97757',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  description text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fixed Expenses
CREATE TABLE public.fixed_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Salary
CREATE TABLE public.salary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cards
CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#D97757',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Card Charges
CREATE TABLE public.card_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  card_id uuid REFERENCES public.cards(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'one-time',
  monthly_amount numeric NOT NULL,
  total_installments int NOT NULL DEFAULT 1,
  current_installment int NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  charge_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Charge Payments
CREATE TABLE public.charge_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid REFERENCES public.card_charges(id) ON DELETE CASCADE,
  month date NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(charge_id, month)
);

-- Enable RLS, public access (single-user personal app, no auth)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all" ON public.fixed_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all" ON public.salary FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all" ON public.cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all" ON public.card_charges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all" ON public.charge_payments FOR ALL USING (true) WITH CHECK (true);

-- Seed a few starter categories
INSERT INTO public.categories (name, color) VALUES
  ('Groceries', '#7A8B76'),
  ('Rent', '#D97757'),
  ('Transport', '#B8A36F'),
  ('Dining', '#B95F5F'),
  ('Subscriptions', '#6F8DAB'),
  ('Other', '#8B867D');
