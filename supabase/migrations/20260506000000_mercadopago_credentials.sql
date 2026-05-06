-- Tabla para guardar credenciales de MercadoPago
CREATE TABLE IF NOT EXISTS public.mercado_pago_credentials (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    public_key text NOT NULL,
    access_token text NOT NULL,
    country text DEFAULT 'AR',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- Tabla para cachear movimientos (opcional, para histórico)
CREATE TABLE IF NOT EXISTS public.mercado_pago_movements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    external_id text NOT NULL,
    transaction_date date NOT NULL,
    type text NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency text DEFAULT 'ARS',
    description text,
    status text,
    created_at timestamptz DEFAULT NOW(),
    UNIQUE(user_id, external_id)
);

-- Habilitar RLS
ALTER TABLE public.mercado_pago_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercado_pago_movements ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - cada usuario solo ve sus propias credenciales
DROP POLICY IF EXISTS "Users can manage own mercadopago credentials" ON public.mercado_pago_credentials;
CREATE POLICY "Users can manage own mercadopago credentials" 
ON public.mercado_pago_credentials FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own mercadopago movements" ON public.mercado_pago_movements;
CREATE POLICY "Users can manage own mercadopago movements" 
ON public.mercado_pago_movements FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_mercado_pago_credentials_updated_at ON public.mercado_pago_credentials;
CREATE TRIGGER update_mercado_pago_credentials_updated_at
    BEFORE UPDATE ON public.mercado_pago_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();