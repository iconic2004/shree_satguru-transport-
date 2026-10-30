-- ============================================================================
-- Migration 00002: Companies, Customers, Rate Cards
-- Shree Satguru Transport Management System
-- ============================================================================

-- ============================================================================
-- ENUM: Company type
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.company_type AS ENUM (
    'client',
    'consignor',
    'consignee',
    'supplier'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- ENUM: Address type
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.address_type AS ENUM (
    'billing',
    'pickup',
    'delivery'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- ENUM: Service type for rate cards
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.service_type AS ENUM (
    'per_trip',
    'per_delivery',
    'per_pickup',
    'per_km',
    'fixed_monthly',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: companies
-- Client, consignor, consignee, and supplier companies
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  company_type    public.company_type NOT NULL,
  contact_person  TEXT,
  phone           TEXT,
  email           TEXT,
  billing_address TEXT,
  city            TEXT,
  area            TEXT,
  pin_code        TEXT,
  gstin           TEXT,
  billing_terms   TEXT,
  credit_limit    NUMERIC(15, 2) DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_companies_credit_limit CHECK (credit_limit >= 0)
);

COMMENT ON TABLE public.companies IS 'Master record for all business entities: clients, consignors, consignees, suppliers';

CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_type ON public.companies(company_type);
CREATE INDEX IF NOT EXISTS idx_companies_city ON public.companies(city);
CREATE INDEX IF NOT EXISTS idx_companies_gstin ON public.companies(gstin);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON public.companies(is_active);

CREATE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: customers
-- Customers linked to a parent company
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  contact_person  TEXT,
  phone           TEXT,
  email           TEXT,
  city            TEXT,
  area            TEXT,
  pin_code        TEXT,
  gstin           TEXT,
  billing_terms   TEXT,
  credit_limit    NUMERIC(15, 2) DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_customers_credit_limit CHECK (credit_limit >= 0)
);

COMMENT ON TABLE public.customers IS 'Individual customers, optionally linked to a parent company';

CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_city ON public.customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON public.customers(is_active);

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: customer_addresses
-- Multiple addresses per customer (billing, pickup, delivery)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_type   public.address_type NOT NULL DEFAULT 'billing',
  address_line1  TEXT NOT NULL,
  address_line2  TEXT,
  city           TEXT NOT NULL,
  area           TEXT,
  pin_code       TEXT,
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.customer_addresses IS 'Multiple addresses per customer: billing, pickup, and delivery locations';

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON public.customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_type ON public.customer_addresses(address_type);

CREATE TRIGGER set_customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: rate_cards
-- Pricing agreements with customers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rate_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_rate_cards_date_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

COMMENT ON TABLE public.rate_cards IS 'Pricing agreements / rate cards for customers';

CREATE INDEX IF NOT EXISTS idx_rate_cards_customer_id ON public.rate_cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_active ON public.rate_cards(is_active) WHERE is_active = TRUE;

CREATE TRIGGER set_rate_cards_updated_at
  BEFORE UPDATE ON public.rate_cards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: rate_card_items
-- Individual line items within a rate card
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rate_card_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id    UUID NOT NULL REFERENCES public.rate_cards(id) ON DELETE CASCADE,
  service_type    public.service_type NOT NULL,
  description     TEXT,
  rate            NUMERIC(15, 2) NOT NULL,
  unit            TEXT,            -- e.g. 'kg', 'trip', 'km', 'month'
  min_charge      NUMERIC(15, 2),
  max_charge      NUMERIC(15, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_rate_card_items_rate CHECK (rate >= 0),
  CONSTRAINT chk_rate_card_items_min CHECK (min_charge IS NULL OR min_charge >= 0),
  CONSTRAINT chk_rate_card_items_max CHECK (max_charge IS NULL OR max_charge >= 0),
  CONSTRAINT chk_rate_card_items_min_max CHECK (
    min_charge IS NULL OR max_charge IS NULL OR max_charge >= min_charge
  )
);

COMMENT ON TABLE public.rate_card_items IS 'Individual rate line items within a rate card';

CREATE INDEX IF NOT EXISTS idx_rate_card_items_rate_card_id ON public.rate_card_items(rate_card_id);

CREATE TRIGGER set_rate_card_items_updated_at
  BEFORE UPDATE ON public.rate_card_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
