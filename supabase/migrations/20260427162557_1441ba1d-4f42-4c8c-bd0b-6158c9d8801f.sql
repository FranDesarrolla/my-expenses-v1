-- Drop existing type check constraint if present
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.card_charges'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.card_charges DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.card_charges
  ADD CONSTRAINT card_charges_type_check
  CHECK (type IN ('one-time', 'installment', 'recurring'));

ALTER TABLE public.card_charges
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;