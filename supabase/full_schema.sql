-- ============================================================================
-- FILE: 00001_initial_schema.sql
-- ============================================================================

-- ============================================================================
-- Migration 00001: Initial Schema - Core Infrastructure
-- Shree Satguru Transport Management System
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set default timezone
ALTER DATABASE postgres SET timezone TO 'Asia/Kolkata';

-- ============================================================================
-- Helper: updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.handle_updated_at() IS 'Automatically sets updated_at to current timestamp on row update';

-- ============================================================================
-- ENUM: User roles
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'admin',
    'operations_manager',
    'accountant',
    'warehouse_staff',
    'driver',
    'labour_supervisor'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: profiles
-- Extends Supabase auth.users with application-specific fields
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  avatar_url    TEXT,
  phone         TEXT,
  role          public.user_role NOT NULL DEFAULT 'warehouse_staff',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth, storing role and contact info';
COMMENT ON COLUMN public.profiles.role IS 'Application role controlling access permissions';

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: application_settings
-- Key-value configuration store
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.application_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.application_settings IS 'Application-wide configuration settings (key-value store)';

CREATE TRIGGER set_application_settings_updated_at
  BEFORE UPDATE ON public.application_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: notifications
-- In-app notification system
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'info',
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  related_entity  TEXT,          -- e.g. 'dispatch', 'delivery', 'invoice'
  related_id      UUID,          -- ID of the related entity
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notifications IS 'In-app notifications for users';
COMMENT ON COLUMN public.notifications.related_entity IS 'Entity type the notification references (e.g. dispatch, delivery)';
COMMENT ON COLUMN public.notifications.related_id IS 'UUID of the referenced entity';

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================================================
-- Table: audit_logs
-- Comprehensive audit trail for all data changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,        -- e.g. 'INSERT', 'UPDATE', 'DELETE', 'LOGIN'
  entity_type TEXT NOT NULL,        -- e.g. 'goods_receipt', 'dispatch'
  entity_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS 'Audit trail capturing all significant data changes';
COMMENT ON COLUMN public.audit_logs.old_values IS 'JSON snapshot of the row before modification';
COMMENT ON COLUMN public.audit_logs.new_values IS 'JSON snapshot of the row after modification';

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- Helper function: get_user_role
-- Used by RLS policies to determine the current user's role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_role(UUID) IS 'Returns the role of a user by their profile ID; used in RLS policies';

-- ============================================================================
-- Helper function: auto-create profile on auth.users insert
-- Automatically grants super_admin to the first registered user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user BOOLEAN;
  assigned_role public.user_role;
BEGIN
  -- If this is the first profile being created, assign super_admin
  SELECT (COUNT(*) = 0) INTO is_first_user FROM public.profiles;

  IF is_first_user THEN
    assigned_role := 'super_admin'::public.user_role;
  ELSE
    BEGIN
      assigned_role := (NEW.raw_user_meta_data ->> 'role')::public.user_role;
    EXCEPTION WHEN OTHERS THEN
      assigned_role := 'warehouse_staff'::public.user_role;
    END;
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'phone',
    COALESCE(assigned_role, 'warehouse_staff'::public.user_role)
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role = CASE WHEN public.profiles.role = 'super_admin' THEN 'super_admin' ELSE EXCLUDED.role END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;


-- ============================================================================
-- FILE: 00002_companies_customers.sql
-- ============================================================================

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


-- ============================================================================
-- FILE: 00003_goods_warehouse.sql
-- ============================================================================

-- ============================================================================
-- Migration 00003: Goods Receipts & Warehouse Management
-- Shree Satguru Transport Management System
-- ============================================================================

-- ============================================================================
-- ENUMs
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.goods_priority AS ENUM ('normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.goods_status AS ENUM (
    'expected',
    'received',
    'verification_pending',
    'available',
    'reserved',
    'partially_dispatched',
    'dispatched',
    'delivered',
    'damaged',
    'on_hold',
    'returned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_movement_type AS ENUM (
    'receipt',
    'adjustment',
    'reservation',
    'loading',
    'dispatch',
    'return',
    'correction',
    'transfer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: warehouses
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  code          TEXT UNIQUE NOT NULL,
  address       TEXT,
  city          TEXT,
  capacity_sqft NUMERIC(12, 2),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.warehouses IS 'Physical warehouse / godown locations';

CREATE INDEX IF NOT EXISTS idx_warehouses_code ON public.warehouses(code);
CREATE INDEX IF NOT EXISTS idx_warehouses_city ON public.warehouses(city);
CREATE INDEX IF NOT EXISTS idx_warehouses_is_active ON public.warehouses(is_active);

CREATE TRIGGER set_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: warehouse_locations
-- Sections, racks, shelves within a warehouse
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id  UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  section       TEXT,
  rack          TEXT,
  shelf         TEXT,
  capacity      TEXT,           -- free-form capacity description
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.warehouse_locations IS 'Storage locations within a warehouse (section/rack/shelf)';

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_warehouse_id ON public.warehouse_locations(warehouse_id);

CREATE TRIGGER set_warehouse_locations_updated_at
  BEFORE UPDATE ON public.warehouse_locations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: goods_receipts
-- Master record for received goods / consignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number          TEXT NOT NULL,
  challan_number          TEXT,
  invoice_date            DATE,
  consignor_company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  consignee_customer_id   UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  contact_number          TEXT,
  pickup_address          TEXT,
  delivery_address        TEXT,
  delivery_city           TEXT,
  delivery_area           TEXT,
  delivery_pin_code       TEXT,
  product_category        TEXT,
  product_name            TEXT,
  product_description     TEXT,
  quantity                NUMERIC(10, 3) NOT NULL DEFAULT 0,
  unit                    TEXT,             -- e.g. 'pcs', 'kg', 'box', 'carton'
  weight_kg               NUMERIC(10, 3) DEFAULT 0,
  volume_cbm              NUMERIC(10, 3) DEFAULT 0,
  declared_value          NUMERIC(15, 2) DEFAULT 0,
  expected_arrival_date   DATE,
  delivery_deadline       DATE,
  priority                public.goods_priority NOT NULL DEFAULT 'normal',
  handling_instructions   TEXT,
  status                  public.goods_status NOT NULL DEFAULT 'expected',
  invoice_attachment_url  TEXT,
  challan_attachment_url  TEXT,
  created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  warehouse_id            UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  warehouse_location_id   UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
  received_at             TIMESTAMPTZ,
  verified_at             TIMESTAMPTZ,
  verified_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate invoice per consignor
  CONSTRAINT uq_goods_receipts_invoice_consignor UNIQUE (invoice_number, consignor_company_id),

  -- Quantity validations
  CONSTRAINT chk_goods_receipts_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_goods_receipts_weight CHECK (weight_kg >= 0),
  CONSTRAINT chk_goods_receipts_volume CHECK (volume_cbm >= 0),
  CONSTRAINT chk_goods_receipts_value CHECK (declared_value >= 0)
);

COMMENT ON TABLE public.goods_receipts IS 'Master record for every goods consignment received';
COMMENT ON COLUMN public.goods_receipts.invoice_number IS 'Consignor invoice / bilti number';
COMMENT ON COLUMN public.goods_receipts.challan_number IS 'Delivery challan number';

CREATE INDEX IF NOT EXISTS idx_goods_receipts_invoice_number ON public.goods_receipts(invoice_number);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_challan_number ON public.goods_receipts(challan_number);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_status ON public.goods_receipts(status);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_consignor ON public.goods_receipts(consignor_company_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_consignee ON public.goods_receipts(consignee_customer_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_warehouse ON public.goods_receipts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_priority ON public.goods_receipts(priority) WHERE priority != 'normal';
CREATE INDEX IF NOT EXISTS idx_goods_receipts_created_at ON public.goods_receipts(created_at DESC);

CREATE TRIGGER set_goods_receipts_updated_at
  BEFORE UPDATE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: goods_items
-- Individual items / line items within a goods receipt
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.goods_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id    UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  product_name        TEXT NOT NULL,
  description         TEXT,
  quantity            NUMERIC(10, 3) NOT NULL DEFAULT 0,
  unit                TEXT,
  weight_kg           NUMERIC(10, 3) DEFAULT 0,
  accepted_quantity   NUMERIC(10, 3) DEFAULT 0,
  damaged_quantity    NUMERIC(10, 3) DEFAULT 0,
  missing_quantity    NUMERIC(10, 3) DEFAULT 0,
  rejected_quantity   NUMERIC(10, 3) DEFAULT 0,
  excess_quantity     NUMERIC(10, 3) DEFAULT 0,
  dispatched_quantity NUMERIC(10, 3) DEFAULT 0,
  delivered_quantity  NUMERIC(10, 3) DEFAULT 0,
  remaining_quantity  NUMERIC(10, 3) DEFAULT 0,
  status              public.goods_status NOT NULL DEFAULT 'expected',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_goods_items_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_goods_items_weight CHECK (weight_kg >= 0),
  CONSTRAINT chk_goods_items_accepted CHECK (accepted_quantity >= 0),
  CONSTRAINT chk_goods_items_damaged CHECK (damaged_quantity >= 0),
  CONSTRAINT chk_goods_items_missing CHECK (missing_quantity >= 0),
  CONSTRAINT chk_goods_items_rejected CHECK (rejected_quantity >= 0),
  CONSTRAINT chk_goods_items_excess CHECK (excess_quantity >= 0),
  CONSTRAINT chk_goods_items_dispatched CHECK (dispatched_quantity >= 0),
  CONSTRAINT chk_goods_items_delivered CHECK (delivered_quantity >= 0),
  CONSTRAINT chk_goods_items_remaining CHECK (remaining_quantity >= 0)
);

COMMENT ON TABLE public.goods_items IS 'Individual line items within a goods receipt';

CREATE INDEX IF NOT EXISTS idx_goods_items_receipt_id ON public.goods_items(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_goods_items_status ON public.goods_items(status);

CREATE TRIGGER set_goods_items_updated_at
  BEFORE UPDATE ON public.goods_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: inventory_movements
-- Tracks every stock movement (receipt, dispatch, transfer, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id      UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  goods_item_id         UUID REFERENCES public.goods_items(id) ON DELETE SET NULL,
  warehouse_id          UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  warehouse_location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
  movement_type         public.inventory_movement_type NOT NULL,
  quantity              NUMERIC(10, 3) NOT NULL,
  reference_type        TEXT,       -- e.g. 'dispatch', 'loading_operation', 'adjustment'
  reference_id          UUID,       -- ID of the referencing entity
  remarks               TEXT,
  performed_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.inventory_movements IS 'Immutable log of every inventory stock movement';

CREATE INDEX IF NOT EXISTS idx_inventory_movements_receipt ON public.inventory_movements(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(goods_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON public.inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON public.inventory_movements(created_at DESC);


-- ============================================================================
-- FILE: 00004_drivers_vehicles.sql
-- ============================================================================

-- ============================================================================
-- Migration 00004: Drivers & Vehicles
-- Shree Satguru Transport Management System
-- ============================================================================

-- ============================================================================
-- ENUMs
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.employment_status AS ENUM ('active', 'inactive', 'terminated', 'on_leave');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.salary_type AS ENUM ('monthly', 'daily', 'trip_based', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vehicle_type AS ENUM ('truck', 'tempo', 'mini_truck', 'pickup', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.fuel_type AS ENUM ('diesel', 'petrol', 'cng', 'electric');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vehicle_status AS ENUM ('available', 'assigned', 'on_trip', 'under_maintenance', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.maintenance_type AS ENUM ('scheduled', 'repair', 'breakdown', 'inspection');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.maintenance_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: drivers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name           TEXT NOT NULL,
  photograph_url      TEXT,
  phone               TEXT,
  address             TEXT,
  emergency_contact   TEXT,
  emergency_phone     TEXT,
  joining_date        DATE,
  employment_status   public.employment_status NOT NULL DEFAULT 'active',
  licence_number      TEXT,
  licence_class       TEXT,
  licence_expiry      DATE,
  salary_type         public.salary_type NOT NULL DEFAULT 'monthly',
  monthly_salary      NUMERIC(15, 2) DEFAULT 0,
  daily_wage          NUMERIC(15, 2) DEFAULT 0,
  trip_rate           NUMERIC(15, 2) DEFAULT 0,
  assigned_vehicle_id UUID,        -- FK added after vehicles table creation
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_drivers_monthly_salary CHECK (monthly_salary >= 0),
  CONSTRAINT chk_drivers_daily_wage CHECK (daily_wage >= 0),
  CONSTRAINT chk_drivers_trip_rate CHECK (trip_rate >= 0)
);

COMMENT ON TABLE public.drivers IS 'Driver master records with licence, salary, and assignment details';

CREATE INDEX IF NOT EXISTS idx_drivers_profile_id ON public.drivers(profile_id);
CREATE INDEX IF NOT EXISTS idx_drivers_phone ON public.drivers(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(employment_status);
CREATE INDEX IF NOT EXISTS idx_drivers_licence_expiry ON public.drivers(licence_expiry);

CREATE TRIGGER set_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: driver_documents
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL,     -- e.g. 'licence', 'aadhar', 'pan'
  document_number TEXT,
  issue_date      DATE,
  expiry_date     DATE,
  file_url        TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.driver_documents IS 'Documents associated with a driver (licence, ID proof, etc.)';

CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON public.driver_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_expiry ON public.driver_documents(expiry_date);

CREATE TRIGGER set_driver_documents_updated_at
  BEFORE UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: vehicles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number   TEXT UNIQUE NOT NULL,
  vehicle_type          public.vehicle_type NOT NULL DEFAULT 'truck',
  make                  TEXT,
  model                 TEXT,
  cargo_capacity_kg     NUMERIC(10, 2) DEFAULT 0,
  cargo_capacity_cbm    NUMERIC(10, 2) DEFAULT 0,
  fuel_type             public.fuel_type NOT NULL DEFAULT 'diesel',
  current_odometer      NUMERIC(12, 1) DEFAULT 0,
  insurance_expiry      DATE,
  fitness_expiry        DATE,
  permit_expiry         DATE,
  puc_expiry            DATE,
  assigned_driver_id    UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  status                public.vehicle_status NOT NULL DEFAULT 'available',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_vehicles_capacity_kg CHECK (cargo_capacity_kg >= 0),
  CONSTRAINT chk_vehicles_capacity_cbm CHECK (cargo_capacity_cbm >= 0),
  CONSTRAINT chk_vehicles_odometer CHECK (current_odometer >= 0)
);

COMMENT ON TABLE public.vehicles IS 'Fleet vehicle master records';

CREATE INDEX IF NOT EXISTS idx_vehicles_reg_number ON public.vehicles(registration_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON public.vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_driver ON public.vehicles(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_insurance_expiry ON public.vehicles(insurance_expiry);
CREATE INDEX IF NOT EXISTS idx_vehicles_fitness_expiry ON public.vehicles(fitness_expiry);

CREATE TRIGGER set_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Add deferred FK from drivers -> vehicles (circular reference)
-- ============================================================================
ALTER TABLE public.drivers
  ADD CONSTRAINT fk_drivers_assigned_vehicle
  FOREIGN KEY (assigned_vehicle_id) REFERENCES public.vehicles(id)
  ON DELETE SET NULL;

-- ============================================================================
-- Table: vehicle_documents
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL,     -- e.g. 'insurance', 'rc', 'permit', 'fitness'
  document_number TEXT,
  issue_date      DATE,
  expiry_date     DATE,
  file_url        TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vehicle_documents IS 'Documents associated with a vehicle (insurance, RC, permits)';

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle_id ON public.vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_expiry ON public.vehicle_documents(expiry_date);

CREATE TRIGGER set_vehicle_documents_updated_at
  BEFORE UPDATE ON public.vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: vehicle_maintenance
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_maintenance (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id            UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  maintenance_type      public.maintenance_type NOT NULL,
  description           TEXT,
  start_date            DATE NOT NULL,
  end_date              DATE,
  cost                  NUMERIC(15, 2) DEFAULT 0,
  vendor                TEXT,
  odometer_reading      NUMERIC(12, 1),
  next_maintenance_date DATE,
  next_maintenance_km   NUMERIC(12, 1),
  invoice_number        TEXT,
  receipt_url           TEXT,
  status                public.maintenance_status NOT NULL DEFAULT 'scheduled',
  remarks               TEXT,
  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_vehicle_maintenance_cost CHECK (cost >= 0),
  CONSTRAINT chk_vehicle_maintenance_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

COMMENT ON TABLE public.vehicle_maintenance IS 'Vehicle maintenance, repair, and inspection records';

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_vehicle_id ON public.vehicle_maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_status ON public.vehicle_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_type ON public.vehicle_maintenance(maintenance_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_next_date ON public.vehicle_maintenance(next_maintenance_date);

CREATE TRIGGER set_vehicle_maintenance_updated_at
  BEFORE UPDATE ON public.vehicle_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- FILE: 00005_staff_attendance.sql
-- ============================================================================

-- ============================================================================
-- Migration 00005: Staff Members & Attendance
-- Shree Satguru Transport Management System
-- ============================================================================

-- ============================================================================
-- ENUMs
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.staff_type AS ENUM ('driver', 'labourer', 'helper', 'warehouse_staff', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method_preference AS ENUM ('cash', 'upi', 'bank_transfer', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM (
    'present', 'absent', 'half_day', 'leave', 'weekly_off', 'holiday'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: staff_members
-- Non-driver staff: labourers, helpers, warehouse staff
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_members (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name                   TEXT NOT NULL,
  phone                       TEXT,
  address                     TEXT,
  joining_date                DATE,
  employment_status           public.employment_status NOT NULL DEFAULT 'active',
  staff_type                  public.staff_type NOT NULL DEFAULT 'labourer',
  daily_wage                  NUMERIC(15, 2) DEFAULT 0,
  payment_method_preference   public.payment_method_preference DEFAULT 'cash',
  assigned_supervisor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_staff_members_daily_wage CHECK (daily_wage >= 0)
);

COMMENT ON TABLE public.staff_members IS 'Non-driver staff: labourers, helpers, warehouse workers';

CREATE INDEX IF NOT EXISTS idx_staff_members_profile_id ON public.staff_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_type ON public.staff_members(staff_type);
CREATE INDEX IF NOT EXISTS idx_staff_members_status ON public.staff_members(employment_status);
CREATE INDEX IF NOT EXISTS idx_staff_members_supervisor ON public.staff_members(assigned_supervisor_id);

CREATE TRIGGER set_staff_members_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: driver_attendance
-- Daily attendance records for drivers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.driver_attendance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  attendance_date   DATE NOT NULL,
  status            public.attendance_status NOT NULL DEFAULT 'present',
  check_in_time     TIME,
  check_out_time    TIME,
  assigned_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  assigned_trip_id  UUID,          -- FK added later when trips table exists
  remarks           TEXT,
  entered_by        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_driver_attendance UNIQUE (driver_id, attendance_date)
);

COMMENT ON TABLE public.driver_attendance IS 'Daily attendance records for drivers';

CREATE INDEX IF NOT EXISTS idx_driver_attendance_driver_id ON public.driver_attendance(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_attendance_date ON public.driver_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_driver_attendance_status ON public.driver_attendance(status);

CREATE TRIGGER set_driver_attendance_updated_at
  BEFORE UPDATE ON public.driver_attendance
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: staff_attendance
-- Daily attendance records for non-driver staff
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id     UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  attendance_date     DATE NOT NULL,
  status              public.attendance_status NOT NULL DEFAULT 'present',
  check_in_time       TIME,
  check_out_time      TIME,
  assigned_operation  TEXT,          -- description of assigned task/operation
  remarks             TEXT,
  entered_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_staff_attendance UNIQUE (staff_member_id, attendance_date)
);

COMMENT ON TABLE public.staff_attendance IS 'Daily attendance records for non-driver staff';

CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_id ON public.staff_attendance(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON public.staff_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_status ON public.staff_attendance(status);

CREATE TRIGGER set_staff_attendance_updated_at
  BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- FILE: 00006_staff_payroll.sql
-- ============================================================================

-- ============================================================================
-- Migration 00006: Staff Payroll System
-- Shree Satguru Transport Management System
-- ============================================================================

-- ============================================================================
-- ENUMs
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.rate_type AS ENUM ('monthly', 'daily', 'half_day', 'trip_based', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash', 'upi', 'bank_transfer', 'cheque', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.advance_status AS ENUM ('unapplied', 'partially_applied', 'fully_applied');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payroll_status AS ENUM ('draft', 'review', 'approved', 'finalized', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('unpaid', 'partially_paid', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.earning_type AS ENUM (
    'salary', 'daily_wage', 'half_day_wage', 'trip_allowance',
    'overtime', 'bonus', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.deduction_type AS ENUM (
    'advance', 'authorized_deduction', 'adjustment', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM (
    'salary_earned', 'wage_earned', 'trip_allowance', 'advance_issued',
    'advance_applied', 'salary_payment', 'deduction', 'adjustment', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.trip_staff_role AS ENUM ('driver', 'helper', 'loader', 'unloader');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.allowance_payment_status AS ENUM ('unpaid', 'included_in_payroll', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_txn_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_entity_type AS ENUM ('payroll', 'advance', 'allowance', 'payment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: staff_salary_rates
-- Historical salary/wage rates for staff and drivers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_salary_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id UUID REFERENCES public.staff_members(id) ON DELETE CASCADE,
  driver_id       UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  rate_type       public.rate_type NOT NULL,
  amount          NUMERIC(15, 2) NOT NULL,
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- At least one of staff_member_id or driver_id must be set
  CONSTRAINT chk_salary_rates_person CHECK (
    staff_member_id IS NOT NULL OR driver_id IS NOT NULL
  ),
  CONSTRAINT chk_salary_rates_amount CHECK (amount >= 0),
  CONSTRAINT chk_salary_rates_dates CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

COMMENT ON TABLE public.staff_salary_rates IS 'Historical salary / wage rate records for staff and drivers';

CREATE INDEX IF NOT EXISTS idx_salary_rates_staff ON public.staff_salary_rates(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_salary_rates_driver ON public.staff_salary_rates(driver_id);
CREATE INDEX IF NOT EXISTS idx_salary_rates_effective ON public.staff_salary_rates(effective_from, effective_to);

CREATE TRIGGER set_staff_salary_rates_updated_at
  BEFORE UPDATE ON public.staff_salary_rates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: staff_advances
-- Cash/UPI advances given to staff or drivers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_advances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id   UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  driver_id         UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  staff_type        public.staff_type NOT NULL DEFAULT 'labourer',
  advance_date      DATE NOT NULL,
  amount            NUMERIC(15, 2) NOT NULL,
  payment_method    public.payment_method NOT NULL DEFAULT 'cash',
  payment_reference TEXT,
  related_trip_id   UUID,          -- optional link to a trip
  reason            TEXT,
  receipt_url       TEXT,
  recorded_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approval_status   public.approval_status NOT NULL DEFAULT 'approved',
  approved_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status            public.advance_status NOT NULL DEFAULT 'unapplied',
  applied_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  remaining_amount  NUMERIC(15, 2),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_advances_person CHECK (
    staff_member_id IS NOT NULL OR driver_id IS NOT NULL
  ),
  CONSTRAINT chk_advances_amount CHECK (amount > 0),
  CONSTRAINT chk_advances_applied CHECK (applied_amount >= 0),
  CONSTRAINT chk_advances_remaining CHECK (remaining_amount IS NULL OR remaining_amount >= 0)
);

COMMENT ON TABLE public.staff_advances IS 'Advance payments issued to staff and drivers';

CREATE INDEX IF NOT EXISTS idx_advances_staff ON public.staff_advances(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_advances_driver ON public.staff_advances(driver_id);
CREATE INDEX IF NOT EXISTS idx_advances_date ON public.staff_advances(advance_date);
CREATE INDEX IF NOT EXISTS idx_advances_status ON public.staff_advances(status);
CREATE INDEX IF NOT EXISTS idx_advances_approval ON public.staff_advances(approval_status);

CREATE TRIGGER set_staff_advances_updated_at
  BEFORE UPDATE ON public.staff_advances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: payroll_periods
-- Monthly or custom payroll cycles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name   TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        public.payroll_status NOT NULL DEFAULT 'draft',
  created_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  finalized_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_payroll_periods_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.payroll_periods IS 'Payroll processing periods (typically monthly)';

CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON public.payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON public.payroll_periods(start_date, end_date);

CREATE TRIGGER set_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: payroll_entries
-- Per-person payroll calculation within a period
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id       UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  staff_member_id         UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  driver_id               UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  staff_type              public.staff_type NOT NULL DEFAULT 'labourer',
  gross_earnings          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_advances_applied  NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_deductions        NUMERIC(15, 2) NOT NULL DEFAULT 0,
  net_payable             NUMERIC(15, 2) NOT NULL DEFAULT 0,
  amount_paid             NUMERIC(15, 2) NOT NULL DEFAULT 0,
  outstanding_amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_status          public.payment_status NOT NULL DEFAULT 'unpaid',
  remarks                 TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_payroll_entries_earnings CHECK (gross_earnings >= 0),
  CONSTRAINT chk_payroll_entries_advances CHECK (total_advances_applied >= 0),
  CONSTRAINT chk_payroll_entries_deductions CHECK (total_deductions >= 0),
  CONSTRAINT chk_payroll_entries_paid CHECK (amount_paid >= 0)
);

COMMENT ON TABLE public.payroll_entries IS 'Individual payroll calculations per staff member per payroll period';

CREATE INDEX IF NOT EXISTS idx_payroll_entries_period ON public.payroll_entries(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_staff ON public.payroll_entries(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_driver ON public.payroll_entries(driver_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_payment_status ON public.payroll_entries(payment_status);

CREATE TRIGGER set_payroll_entries_updated_at
  BEFORE UPDATE ON public.payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: staff_earnings
-- Itemized earnings within a payroll entry
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_earnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id UUID NOT NULL REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  earning_type    public.earning_type NOT NULL,
  description     TEXT,
  amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  reference_id    UUID,            -- e.g. trip_record_id, attendance_id
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_staff_earnings_amount CHECK (amount >= 0)
);

COMMENT ON TABLE public.staff_earnings IS 'Itemized earning line items for a payroll entry';

CREATE INDEX IF NOT EXISTS idx_staff_earnings_entry ON public.staff_earnings(payroll_entry_id);

-- ============================================================================
-- Table: staff_deductions
-- Itemized deductions within a payroll entry
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_deductions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id UUID NOT NULL REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  deduction_type  public.deduction_type NOT NULL,
  description     TEXT,
  amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  advance_id      UUID REFERENCES public.staff_advances(id) ON DELETE SET NULL,
  reference_id    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_staff_deductions_amount CHECK (amount >= 0)
);

COMMENT ON TABLE public.staff_deductions IS 'Itemized deduction line items for a payroll entry';

CREATE INDEX IF NOT EXISTS idx_staff_deductions_entry ON public.staff_deductions(payroll_entry_id);
CREATE INDEX IF NOT EXISTS idx_staff_deductions_advance ON public.staff_deductions(advance_id);

-- ============================================================================
-- Table: staff_payments
-- Actual payment transactions to staff
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id UUID REFERENCES public.payroll_entries(id) ON DELETE SET NULL,
  staff_member_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  driver_id       UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  staff_type      public.staff_type NOT NULL DEFAULT 'labourer',
  payment_date    DATE NOT NULL,
  amount          NUMERIC(15, 2) NOT NULL,
  payment_method  public.payment_method NOT NULL DEFAULT 'cash',
  payment_reference TEXT,
  receipt_url     TEXT,
  remarks         TEXT,
  payment_status  public.payment_txn_status NOT NULL DEFAULT 'pending',
  recorded_by     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_staff_payments_amount CHECK (amount > 0)
);

COMMENT ON TABLE public.staff_payments IS 'Actual payment transactions made to staff/drivers';

CREATE INDEX IF NOT EXISTS idx_staff_payments_staff ON public.staff_payments(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_staff_payments_driver ON public.staff_payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_staff_payments_date ON public.staff_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_staff_payments_payroll ON public.staff_payments(payroll_entry_id);
CREATE INDEX IF NOT EXISTS idx_staff_payments_status ON public.staff_payments(payment_status);

CREATE TRIGGER set_staff_payments_updated_at
  BEFORE UPDATE ON public.staff_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: staff_payment_allocations
-- Tracks how a payment is allocated across payroll entries
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_payment_allocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_payment_id UUID NOT NULL REFERENCES public.staff_payments(id) ON DELETE CASCADE,
  payroll_entry_id UUID NOT NULL REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  amount          NUMERIC(15, 2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_staff_payment_alloc_amount CHECK (amount > 0)
);

COMMENT ON TABLE public.staff_payment_allocations IS 'Maps payment amounts to payroll entries (many-to-many)';

CREATE INDEX IF NOT EXISTS idx_staff_payment_alloc_payment ON public.staff_payment_allocations(staff_payment_id);
CREATE INDEX IF NOT EXISTS idx_staff_payment_alloc_entry ON public.staff_payment_allocations(payroll_entry_id);

-- ============================================================================
-- Table: staff_ledger_entries
-- Double-entry style running ledger for staff accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_ledger_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id   UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  driver_id         UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  staff_type        public.staff_type NOT NULL DEFAULT 'labourer',
  transaction_date  DATE NOT NULL,
  transaction_type  public.transaction_type NOT NULL,
  debit_amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
  credit_amount     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  balance           NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_method    public.payment_method,
  payment_reference TEXT,
  related_trip_id   UUID,
  payroll_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
  advance_id        UUID REFERENCES public.staff_advances(id) ON DELETE SET NULL,
  payment_id        UUID REFERENCES public.staff_payments(id) ON DELETE SET NULL,
  remarks           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.staff_ledger_entries IS 'Running ledger of all financial transactions for each staff/driver';

CREATE INDEX IF NOT EXISTS idx_staff_ledger_staff ON public.staff_ledger_entries(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_staff_ledger_driver ON public.staff_ledger_entries(driver_id);
CREATE INDEX IF NOT EXISTS idx_staff_ledger_date ON public.staff_ledger_entries(transaction_date);
CREATE INDEX IF NOT EXISTS idx_staff_ledger_type ON public.staff_ledger_entries(transaction_type);
CREATE INDEX IF NOT EXISTS idx_staff_ledger_payroll ON public.staff_ledger_entries(payroll_period_id);

-- ============================================================================
-- Table: trip_staff_assignments
-- Who is assigned to which trip/dispatch
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trip_staff_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id     UUID,            -- FK added in migration 00007
  trip_id         UUID,            -- FK added in migration 00007
  staff_member_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  driver_id       UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  staff_type      public.staff_type NOT NULL DEFAULT 'labourer',
  role            public.trip_staff_role NOT NULL DEFAULT 'helper',
  assignment_date DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.trip_staff_assignments IS 'Staff and driver assignments to dispatches/trips';

CREATE INDEX IF NOT EXISTS idx_trip_staff_assign_dispatch ON public.trip_staff_assignments(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_trip_staff_assign_trip ON public.trip_staff_assignments(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_staff_assign_staff ON public.trip_staff_assignments(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_trip_staff_assign_driver ON public.trip_staff_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_staff_assign_date ON public.trip_staff_assignments(assignment_date);

CREATE TRIGGER set_trip_staff_assignments_updated_at
  BEFORE UPDATE ON public.trip_staff_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: trip_staff_allowances
-- Per-trip allowances for assigned staff
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trip_staff_allowances (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_staff_assignment_id UUID NOT NULL REFERENCES public.trip_staff_assignments(id) ON DELETE CASCADE,
  dispatch_id             UUID,          -- FK added in migration 00007
  staff_member_id         UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  driver_id               UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  staff_type              public.staff_type NOT NULL DEFAULT 'labourer',
  trip_date               DATE NOT NULL,
  agreed_allowance        NUMERIC(15, 2) NOT NULL DEFAULT 0,
  additional_allowance    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_allowance         NUMERIC(15, 2) NOT NULL DEFAULT 0,
  approval_status         public.approval_status NOT NULL DEFAULT 'pending',
  approved_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_status          public.allowance_payment_status NOT NULL DEFAULT 'unpaid',
  payroll_entry_id        UUID REFERENCES public.payroll_entries(id) ON DELETE SET NULL,
  remarks                 TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_allowances_agreed CHECK (agreed_allowance >= 0),
  CONSTRAINT chk_allowances_additional CHECK (additional_allowance >= 0),
  CONSTRAINT chk_allowances_total CHECK (total_allowance >= 0)
);

COMMENT ON TABLE public.trip_staff_allowances IS 'Per-trip allowances for staff assigned to dispatches';

CREATE INDEX IF NOT EXISTS idx_trip_allowances_assignment ON public.trip_staff_allowances(trip_staff_assignment_id);
CREATE INDEX IF NOT EXISTS idx_trip_allowances_dispatch ON public.trip_staff_allowances(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_trip_allowances_staff ON public.trip_staff_allowances(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_trip_allowances_driver ON public.trip_staff_allowances(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_allowances_approval ON public.trip_staff_allowances(approval_status);
CREATE INDEX IF NOT EXISTS idx_trip_allowances_payment ON public.trip_staff_allowances(payment_status);

CREATE TRIGGER set_trip_staff_allowances_updated_at
  BEFORE UPDATE ON public.trip_staff_allowances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: staff_payment_approvals
-- Approval workflow for payroll, advances, allowances, payments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_payment_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     public.approval_entity_type NOT NULL,
  entity_id       UUID NOT NULL,
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  approved_by     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approval_date   TIMESTAMPTZ,
  remarks         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.staff_payment_approvals IS 'Approval records for payroll, advances, allowances, and payments';

CREATE INDEX IF NOT EXISTS idx_payment_approvals_entity ON public.staff_payment_approvals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_status ON public.staff_payment_approvals(approval_status);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_approved_by ON public.staff_payment_approvals(approved_by);


-- ============================================================================
-- FILE: 00007_dispatch_delivery.sql
-- ============================================================================

-- ============================================================================
-- Migration 00007: Dispatch, Delivery & Trip Records
-- Shree Satguru Transport Management System
-- ============================================================================

-- ============================================================================
-- ENUMs
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.dispatch_status AS ENUM (
    'draft', 'planned', 'loading', 'in_transit', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.stop_status AS ENUM ('pending', 'arrived', 'completed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dispatch_item_status AS ENUM (
    'assigned', 'loaded', 'in_transit', 'delivered', 'returned', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM (
    'pending', 'assigned', 'loaded', 'in_transit', 'delivered',
    'failed', 'rescheduled', 'returned', 'on_hold'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: dispatches
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.dispatches (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number         TEXT UNIQUE NOT NULL,
  dispatch_date           DATE NOT NULL,
  vehicle_id              UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  driver_id               UUID NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
  planned_departure       TIMESTAMPTZ,
  actual_departure        TIMESTAMPTZ,
  planned_arrival         TIMESTAMPTZ,
  actual_arrival          TIMESTAMPTZ,
  planned_distance_km     NUMERIC(10, 2) DEFAULT 0,
  actual_distance_km      NUMERIC(10, 2) DEFAULT 0,
  cargo_weight_kg         NUMERIC(10, 3) DEFAULT 0,
  capacity_utilization_pct NUMERIC(5, 2) DEFAULT 0,
  status                  public.dispatch_status NOT NULL DEFAULT 'draft',
  planned_cost            NUMERIC(15, 2) DEFAULT 0,
  actual_cost             NUMERIC(15, 2) DEFAULT 0,
  notes                   TEXT,
  created_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_dispatches_distance_planned CHECK (planned_distance_km >= 0),
  CONSTRAINT chk_dispatches_distance_actual CHECK (actual_distance_km >= 0),
  CONSTRAINT chk_dispatches_cargo CHECK (cargo_weight_kg >= 0),
  CONSTRAINT chk_dispatches_utilization CHECK (
    capacity_utilization_pct >= 0 AND capacity_utilization_pct <= 100
  ),
  CONSTRAINT chk_dispatches_planned_cost CHECK (planned_cost >= 0),
  CONSTRAINT chk_dispatches_actual_cost CHECK (actual_cost >= 0)
);

COMMENT ON TABLE public.dispatches IS 'Dispatch records: a vehicle+driver trip carrying goods to one or more stops';

CREATE INDEX IF NOT EXISTS idx_dispatches_number ON public.dispatches(dispatch_number);
CREATE INDEX IF NOT EXISTS idx_dispatches_date ON public.dispatches(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_dispatches_vehicle ON public.dispatches(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_driver ON public.dispatches(driver_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON public.dispatches(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_created_at ON public.dispatches(created_at DESC);

CREATE TRIGGER set_dispatches_updated_at
  BEFORE UPDATE ON public.dispatches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: dispatch_stops
-- Ordered stops within a dispatch route
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.dispatch_stops (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id       UUID NOT NULL REFERENCES public.dispatches(id) ON DELETE CASCADE,
  stop_sequence     INTEGER NOT NULL,
  customer_id       UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  company_id        UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  delivery_address  TEXT,
  city              TEXT,
  area              TEXT,
  pin_code          TEXT,
  planned_arrival   TIMESTAMPTZ,
  actual_arrival    TIMESTAMPTZ,
  status            public.stop_status NOT NULL DEFAULT 'pending',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_dispatch_stops_sequence CHECK (stop_sequence > 0)
);

COMMENT ON TABLE public.dispatch_stops IS 'Ordered delivery stops within a dispatch route';

CREATE INDEX IF NOT EXISTS idx_dispatch_stops_dispatch ON public.dispatch_stops(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_stops_customer ON public.dispatch_stops(customer_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_stops_status ON public.dispatch_stops(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dispatch_stops_sequence ON public.dispatch_stops(dispatch_id, stop_sequence);

CREATE TRIGGER set_dispatch_stops_updated_at
  BEFORE UPDATE ON public.dispatch_stops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: dispatch_items
-- Goods assigned to a dispatch (linked to stops)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.dispatch_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id       UUID NOT NULL REFERENCES public.dispatches(id) ON DELETE CASCADE,
  dispatch_stop_id  UUID NOT NULL REFERENCES public.dispatch_stops(id) ON DELETE CASCADE,
  goods_receipt_id  UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE RESTRICT,
  goods_item_id     UUID REFERENCES public.goods_items(id) ON DELETE SET NULL,
  quantity          NUMERIC(10, 3) NOT NULL DEFAULT 0,
  weight_kg         NUMERIC(10, 3) DEFAULT 0,
  status            public.dispatch_item_status NOT NULL DEFAULT 'assigned',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_dispatch_items_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_dispatch_items_weight CHECK (weight_kg >= 0)
);

COMMENT ON TABLE public.dispatch_items IS 'Goods items assigned to a dispatch, linked to their destination stop';

CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch ON public.dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_stop ON public.dispatch_items(dispatch_stop_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_goods_receipt ON public.dispatch_items(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_status ON public.dispatch_items(status);

CREATE TRIGGER set_dispatch_items_updated_at
  BEFORE UPDATE ON public.dispatch_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: deliveries
-- Delivery records (one per stop / goods receipt)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id           UUID NOT NULL REFERENCES public.dispatches(id) ON DELETE CASCADE,
  dispatch_stop_id      UUID REFERENCES public.dispatch_stops(id) ON DELETE SET NULL,
  driver_id             UUID NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
  vehicle_id            UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  customer_id           UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  company_id            UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  destination_address   TEXT,
  destination_city      TEXT,
  goods_receipt_id      UUID REFERENCES public.goods_receipts(id) ON DELETE SET NULL,
  planned_arrival       TIMESTAMPTZ,
  actual_arrival        TIMESTAMPTZ,
  delivered_quantity     NUMERIC(10, 3) DEFAULT 0,
  remaining_quantity     NUMERIC(10, 3) DEFAULT 0,
  receiver_name         TEXT,
  delivery_remarks      TEXT,
  status                public.delivery_status NOT NULL DEFAULT 'pending',
  failure_reason        TEXT,
  rescheduled_date      DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_deliveries_delivered_qty CHECK (delivered_quantity >= 0),
  CONSTRAINT chk_deliveries_remaining_qty CHECK (remaining_quantity >= 0)
);

COMMENT ON TABLE public.deliveries IS 'Individual delivery records per stop/consignment';

CREATE INDEX IF NOT EXISTS idx_deliveries_dispatch ON public.deliveries(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON public.deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_vehicle ON public.deliveries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON public.deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_goods_receipt ON public.deliveries(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON public.deliveries(created_at DESC);

CREATE TRIGGER set_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: delivery_status_history
-- Immutable log of delivery status changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  status      public.delivery_status NOT NULL,
  changed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  remarks     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.delivery_status_history IS 'Immutable audit log of delivery status transitions';

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_delivery ON public.delivery_status_history(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status_history_created ON public.delivery_status_history(created_at DESC);

-- ============================================================================
-- Table: proof_of_delivery
-- Evidence of successful delivery
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.proof_of_delivery (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id           UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  photograph_url        TEXT,
  signed_receipt_url    TEXT,
  receiver_name         TEXT,
  receiver_phone        TEXT,
  receiver_signature_url TEXT,
  remarks               TEXT,
  captured_at           TIMESTAMPTZ,
  captured_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.proof_of_delivery IS 'Proof of delivery: photos, signatures, receiver details';

CREATE INDEX IF NOT EXISTS idx_pod_delivery ON public.proof_of_delivery(delivery_id);

-- ============================================================================
-- Table: trip_records
-- Completed trip summary (distance, fuel, expenses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trip_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id     UUID REFERENCES public.dispatches(id) ON DELETE SET NULL,
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  driver_id       UUID NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
  trip_date       DATE NOT NULL,
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  start_odometer  NUMERIC(12, 1) DEFAULT 0,
  end_odometer    NUMERIC(12, 1) DEFAULT 0,
  total_km        NUMERIC(10, 2) DEFAULT 0,
  fuel_cost       NUMERIC(15, 2) DEFAULT 0,
  toll_cost       NUMERIC(15, 2) DEFAULT 0,
  other_expenses  NUMERIC(15, 2) DEFAULT 0,
  remarks         TEXT,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_trip_records_odometer CHECK (end_odometer >= start_odometer),
  CONSTRAINT chk_trip_records_km CHECK (total_km >= 0),
  CONSTRAINT chk_trip_records_fuel CHECK (fuel_cost >= 0),
  CONSTRAINT chk_trip_records_toll CHECK (toll_cost >= 0),
  CONSTRAINT chk_trip_records_expenses CHECK (other_expenses >= 0)
);

COMMENT ON TABLE public.trip_records IS 'Trip summary: distance, fuel, tolls, and expenses per dispatch';

CREATE INDEX IF NOT EXISTS idx_trip_records_dispatch ON public.trip_records(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_trip_records_vehicle ON public.trip_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trip_records_driver ON public.trip_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_records_date ON public.trip_records(trip_date);

CREATE TRIGGER set_trip_records_updated_at
  BEFORE UPDATE ON public.trip_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: fuel_logs
-- Individual fuel fill-up records
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fuel_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id       UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  trip_record_id  UUID REFERENCES public.trip_records(id) ON DELETE SET NULL,
  log_date        DATE NOT NULL,
  fuel_type       TEXT,            -- diesel, petrol, cng, etc.
  quantity_liters NUMERIC(8, 2) NOT NULL DEFAULT 0,
  amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  odometer_reading NUMERIC(12, 1),
  station_name    TEXT,
  receipt_url     TEXT,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_fuel_logs_quantity CHECK (quantity_liters >= 0),
  CONSTRAINT chk_fuel_logs_amount CHECK (amount >= 0)
);

COMMENT ON TABLE public.fuel_logs IS 'Individual fuel fill-up records for vehicles';

CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle ON public.fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_driver ON public.fuel_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_trip ON public.fuel_logs(trip_record_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_date ON public.fuel_logs(log_date);

CREATE TRIGGER set_fuel_logs_updated_at
  BEFORE UPDATE ON public.fuel_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Add deferred FKs from migration 00006 tables
-- ============================================================================
ALTER TABLE public.trip_staff_assignments
  ADD CONSTRAINT fk_trip_staff_assignments_dispatch
  FOREIGN KEY (dispatch_id) REFERENCES public.dispatches(id)
  ON DELETE SET NULL;

ALTER TABLE public.trip_staff_assignments
  ADD CONSTRAINT fk_trip_staff_assignments_trip
  FOREIGN KEY (trip_id) REFERENCES public.trip_records(id)
  ON DELETE SET NULL;

ALTER TABLE public.trip_staff_allowances
  ADD CONSTRAINT fk_trip_staff_allowances_dispatch
  FOREIGN KEY (dispatch_id) REFERENCES public.dispatches(id)
  ON DELETE SET NULL;


-- ============================================================================
-- FILE: 00008_loading_unloading.sql
-- ============================================================================

-- ============================================================================
-- Migration 00008: Loading & Unloading Operations
-- Shree Satguru Transport Management System
-- ============================================================================

-- ============================================================================
-- ENUMs
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.operation_type AS ENUM ('loading', 'unloading');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.operation_status AS ENUM (
    'scheduled', 'in_progress', 'completed', 'verified', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: loading_unloading_operations
-- Master record for loading/unloading events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loading_unloading_operations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type          public.operation_type NOT NULL,
  operation_date          DATE NOT NULL,
  start_time              TIME,
  completion_time         TIME,
  warehouse_id            UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  vehicle_id              UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  driver_id               UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  dispatch_id             UUID REFERENCES public.dispatches(id) ON DELETE SET NULL,
  status                  public.operation_status NOT NULL DEFAULT 'scheduled',
  remarks                 TEXT,
  photographs             TEXT[],        -- array of photo URLs
  supporting_documents    TEXT[],        -- array of document URLs
  responsible_employee    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  verified_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at             TIMESTAMPTZ,
  created_by              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.loading_unloading_operations IS 'Master record for loading/unloading operations at warehouse or vehicle';

CREATE INDEX IF NOT EXISTS idx_load_unload_ops_type ON public.loading_unloading_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_load_unload_ops_date ON public.loading_unloading_operations(operation_date);
CREATE INDEX IF NOT EXISTS idx_load_unload_ops_warehouse ON public.loading_unloading_operations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_load_unload_ops_vehicle ON public.loading_unloading_operations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_load_unload_ops_dispatch ON public.loading_unloading_operations(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_load_unload_ops_status ON public.loading_unloading_operations(status);

CREATE TRIGGER set_loading_unloading_operations_updated_at
  BEFORE UPDATE ON public.loading_unloading_operations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: loading_unloading_items
-- Individual items handled in an operation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loading_unloading_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id      UUID NOT NULL REFERENCES public.loading_unloading_operations(id) ON DELETE CASCADE,
  goods_receipt_id  UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE RESTRICT,
  goods_item_id     UUID REFERENCES public.goods_items(id) ON DELETE SET NULL,
  invoice_number    TEXT,
  challan_number    TEXT,
  expected_quantity NUMERIC(10, 3) NOT NULL DEFAULT 0,
  actual_quantity   NUMERIC(10, 3) NOT NULL DEFAULT 0,
  num_packages      INTEGER DEFAULT 0,
  weight_kg         NUMERIC(10, 3) DEFAULT 0,
  damaged_quantity  NUMERIC(10, 3) NOT NULL DEFAULT 0,
  missing_quantity  NUMERIC(10, 3) NOT NULL DEFAULT 0,
  excess_quantity   NUMERIC(10, 3) NOT NULL DEFAULT 0,
  remarks           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_load_items_expected CHECK (expected_quantity >= 0),
  CONSTRAINT chk_load_items_actual CHECK (actual_quantity >= 0),
  CONSTRAINT chk_load_items_packages CHECK (num_packages >= 0),
  CONSTRAINT chk_load_items_weight CHECK (weight_kg >= 0),
  CONSTRAINT chk_load_items_damaged CHECK (damaged_quantity >= 0),
  CONSTRAINT chk_load_items_missing CHECK (missing_quantity >= 0),
  CONSTRAINT chk_load_items_excess CHECK (excess_quantity >= 0)
);

COMMENT ON TABLE public.loading_unloading_items IS 'Items handled during a loading/unloading operation';

CREATE INDEX IF NOT EXISTS idx_load_unload_items_op ON public.loading_unloading_items(operation_id);
CREATE INDEX IF NOT EXISTS idx_load_unload_items_receipt ON public.loading_unloading_items(goods_receipt_id);

CREATE TRIGGER set_loading_unloading_items_updated_at
  BEFORE UPDATE ON public.loading_unloading_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: loading_unloading_staff
-- Staff assigned to a loading/unloading operation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loading_unloading_staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id    UUID NOT NULL REFERENCES public.loading_unloading_operations(id) ON DELETE CASCADE,
  staff_member_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  driver_id       UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  role            TEXT,            -- e.g. 'loader', 'unloader', 'supervisor'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.loading_unloading_staff IS 'Staff assigned to loading/unloading operations';

CREATE INDEX IF NOT EXISTS idx_load_unload_staff_op ON public.loading_unloading_staff(operation_id);
CREATE INDEX IF NOT EXISTS idx_load_unload_staff_member ON public.loading_unloading_staff(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_load_unload_staff_driver ON public.loading_unloading_staff(driver_id);


-- ============================================================================
-- FILE: 00009_finance.sql
-- ============================================================================

-- ============================================================================
-- Migration 00009: Finance - Invoices, Payments, Expenses
-- Shree Satguru Transport Management System
-- ============================================================================

-- ============================================================================
-- ENUMs
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM (
    'draft', 'review', 'approved', 'issued',
    'partially_paid', 'paid', 'overdue', 'cancelled', 'credited'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.customer_payment_method AS ENUM (
    'cash', 'cheque', 'upi', 'bank_transfer', 'neft', 'rtgs', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.customer_payment_status AS ENUM (
    'pending', 'completed', 'bounced', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.expense_category AS ENUM (
    'diesel_fuel', 'toll', 'driver_salary', 'labour_wages',
    'driver_allowance', 'vehicle_repair', 'maintenance',
    'loading_unloading', 'parking', 'insurance', 'permits',
    'warehouse_rent', 'office', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.expense_payment_method AS ENUM (
    'cash', 'upi', 'bank_transfer', 'cheque', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: invoices
-- Customer billing invoices
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number      TEXT UNIQUE NOT NULL,
  customer_id         UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  company_id          UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  billing_month       DATE,
  invoice_date        DATE NOT NULL,
  due_date            DATE NOT NULL,
  subtotal            NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tax_rate            NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tds_amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(15, 2) NOT NULL DEFAULT 0,
  paid_amount         NUMERIC(15, 2) NOT NULL DEFAULT 0,
  outstanding_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status              public.invoice_status NOT NULL DEFAULT 'draft',
  gst_number          TEXT,
  notes               TEXT,
  approved_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at           TIMESTAMPTZ,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_invoices_subtotal CHECK (subtotal >= 0),
  CONSTRAINT chk_invoices_tax_amount CHECK (tax_amount >= 0),
  CONSTRAINT chk_invoices_tax_rate CHECK (tax_rate >= 0 AND tax_rate <= 100),
  CONSTRAINT chk_invoices_tds CHECK (tds_amount >= 0),
  CONSTRAINT chk_invoices_total CHECK (total_amount >= 0),
  CONSTRAINT chk_invoices_paid CHECK (paid_amount >= 0),
  CONSTRAINT chk_invoices_outstanding CHECK (outstanding_amount >= 0),
  CONSTRAINT chk_invoices_due_date CHECK (due_date >= invoice_date)
);

COMMENT ON TABLE public.invoices IS 'Customer billing invoices';

CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_month ON public.invoices(billing_month);
CREATE INDEX IF NOT EXISTS idx_invoices_overdue ON public.invoices(due_date, status)
  WHERE status IN ('issued', 'partially_paid');

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: invoice_items
-- Line items within an invoice
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  service_type    TEXT,
  quantity        NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit            TEXT,
  rate            NUMERIC(15, 2) NOT NULL DEFAULT 0,
  amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  trip_record_id  UUID REFERENCES public.trip_records(id) ON DELETE SET NULL,
  dispatch_id     UUID REFERENCES public.dispatches(id) ON DELETE SET NULL,
  goods_receipt_id UUID REFERENCES public.goods_receipts(id) ON DELETE SET NULL,
  delivery_id     UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_invoice_items_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_invoice_items_rate CHECK (rate >= 0),
  CONSTRAINT chk_invoice_items_amount CHECK (amount >= 0)
);

COMMENT ON TABLE public.invoice_items IS 'Individual line items within a customer invoice';

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_dispatch ON public.invoice_items(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_goods_receipt ON public.invoice_items(goods_receipt_id);

CREATE TRIGGER set_invoice_items_updated_at
  BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: payments
-- Customer payment receipts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_id       UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  company_id        UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  payment_date      DATE NOT NULL,
  amount            NUMERIC(15, 2) NOT NULL,
  payment_method    public.customer_payment_method NOT NULL DEFAULT 'bank_transfer',
  payment_reference TEXT,
  bank_name         TEXT,
  cheque_number     TEXT,
  receipt_url       TEXT,
  status            public.customer_payment_status NOT NULL DEFAULT 'pending',
  remarks           TEXT,
  recorded_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_payments_amount CHECK (amount > 0)
);

COMMENT ON TABLE public.payments IS 'Customer payment receipts';

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_company ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Table: payment_allocations
-- Maps payments to invoices (many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount      NUMERIC(15, 2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_payment_allocations_amount CHECK (amount > 0)
);

COMMENT ON TABLE public.payment_allocations IS 'Maps customer payments to invoices (supports partial and split payments)';

CREATE INDEX IF NOT EXISTS idx_payment_alloc_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_invoice ON public.payment_allocations(invoice_id);

-- ============================================================================
-- Table: expenses
-- Business expense tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date    DATE NOT NULL,
  category        public.expense_category NOT NULL,
  amount          NUMERIC(15, 2) NOT NULL,
  payment_method  public.expense_payment_method NOT NULL DEFAULT 'cash',
  vendor          TEXT,
  vehicle_id      UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  dispatch_id     UUID REFERENCES public.dispatches(id) ON DELETE SET NULL,
  trip_record_id  UUID REFERENCES public.trip_records(id) ON DELETE SET NULL,
  staff_member_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  driver_id       UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  receipt_url     TEXT,
  description     TEXT,
  entered_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  remarks         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_expenses_amount CHECK (amount > 0)
);

COMMENT ON TABLE public.expenses IS 'All business expenses: fuel, tolls, salaries, maintenance, etc.';

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON public.expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_dispatch ON public.expenses(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_driver ON public.expenses(driver_id);
CREATE INDEX IF NOT EXISTS idx_expenses_staff ON public.expenses(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_expenses_entered_by ON public.expenses(entered_by);

CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- FILE: 00010_rls_policies.sql
-- ============================================================================

-- ============================================================================
-- Migration 00010: Row Level Security (RLS) Policies
-- Shree Satguru Transport Management System
-- ============================================================================

-- Helper functions for role-based security
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role::text FROM public.profiles WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND role = 'super_admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND role IN ('super_admin', 'admin') AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_operational(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = uid 
    AND role IN ('super_admin', 'admin', 'operations_manager') 
    AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_accountant(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = uid 
    AND role IN ('super_admin', 'admin', 'accountant') 
    AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- Enable RLS on all tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_card_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_salary_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_staff_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_payment_approvals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof_of_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.loading_unloading_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loading_unloading_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loading_unloading_staff ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Super Admins can insert/update/delete profiles"
  ON public.profiles FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can manage own notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- AUDIT LOGS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Super Admins and Admins view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- COMPANIES & CUSTOMERS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Staff can view companies"
  ON public.companies FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage companies"
  ON public.companies FOR ALL
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Staff can view customers"
  ON public.customers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage customers"
  ON public.customers FOR ALL
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Staff can view customer addresses"
  ON public.customer_addresses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage customer addresses"
  ON public.customer_addresses FOR ALL
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Accountants and Admins manage rate cards"
  ON public.rate_cards FOR ALL
  USING (public.is_accountant(auth.uid()));

CREATE POLICY "Staff view active rate cards"
  ON public.rate_cards FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountants and Admins manage rate card items"
  ON public.rate_card_items FOR ALL
  USING (public.is_accountant(auth.uid()));

CREATE POLICY "Staff view rate card items"
  ON public.rate_card_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------------------
-- WAREHOUSE & GOODS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Warehouse & Operations manage goods receipts"
  ON public.goods_receipts FOR ALL
  USING (
    public.is_operational(auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'warehouse_staff')
  );

CREATE POLICY "All authenticated staff view goods receipts"
  ON public.goods_receipts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Warehouse & Operations manage goods items"
  ON public.goods_items FOR ALL
  USING (
    public.is_operational(auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'warehouse_staff')
  );

CREATE POLICY "All authenticated staff view goods items"
  ON public.goods_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operations manage inventory movements"
  ON public.inventory_movements FOR ALL
  USING (
    public.is_operational(auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'warehouse_staff')
  );

CREATE POLICY "Staff view inventory movements"
  ON public.inventory_movements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff view warehouses"
  ON public.warehouses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage warehouses"
  ON public.warehouses FOR ALL
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Staff view warehouse locations"
  ON public.warehouse_locations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage warehouse locations"
  ON public.warehouse_locations FOR ALL
  USING (public.is_admin_or_super(auth.uid()));

-- ----------------------------------------------------------------------------
-- DRIVERS & VEHICLES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Operations manage drivers"
  ON public.drivers FOR ALL
  USING (public.is_operational(auth.uid()));

CREATE POLICY "Drivers view own record"
  ON public.drivers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operations manage driver documents"
  ON public.driver_documents FOR ALL
  USING (public.is_operational(auth.uid()));

CREATE POLICY "Drivers view own documents"
  ON public.driver_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers WHERE id = driver_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "Staff view vehicles"
  ON public.vehicles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operations manage vehicles"
  ON public.vehicles FOR ALL
  USING (public.is_operational(auth.uid()));

CREATE POLICY "Operations manage vehicle maintenance"
  ON public.vehicle_maintenance FOR ALL
  USING (public.is_operational(auth.uid()));

-- ----------------------------------------------------------------------------
-- ATTENDANCE & STAFF POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Supervisors and Operations manage staff attendance"
  ON public.staff_attendance FOR ALL
  USING (
    public.is_operational(auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'labour_supervisor')
  );

CREATE POLICY "Staff view own attendance"
  ON public.staff_attendance FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operations manage driver attendance"
  ON public.driver_attendance FOR ALL
  USING (public.is_operational(auth.uid()));

CREATE POLICY "Drivers view own attendance"
  ON public.driver_attendance FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.drivers WHERE id = driver_id AND profile_id = auth.uid())
    OR public.is_operational(auth.uid())
  );

CREATE POLICY "Operations manage staff members"
  ON public.staff_members FOR ALL
  USING (public.is_operational(auth.uid()));

CREATE POLICY "Staff view staff members"
  ON public.staff_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------------------
-- PAYROLL & FINANCE POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Accountants manage payroll"
  ON public.payroll_periods FOR ALL
  USING (public.is_accountant(auth.uid()));

CREATE POLICY "Accountants manage payroll entries"
  ON public.payroll_entries FOR ALL
  USING (public.is_accountant(auth.uid()));

CREATE POLICY "Accountants manage staff advances"
  ON public.staff_advances FOR ALL
  USING (public.is_accountant(auth.uid()) OR public.is_operational(auth.uid()));

CREATE POLICY "Accountants manage staff payments"
  ON public.staff_payments FOR ALL
  USING (public.is_accountant(auth.uid()));

CREATE POLICY "Accountants manage ledger"
  ON public.staff_ledger_entries FOR ALL
  USING (public.is_accountant(auth.uid()));

CREATE POLICY "Accountants manage invoices"
  ON public.invoices FOR ALL
  USING (public.is_accountant(auth.uid()));

CREATE POLICY "Accountants manage invoice items"
  ON public.invoice_items FOR ALL
  USING (public.is_accountant(auth.uid()));

CREATE POLICY "Accountants manage customer payments"
  ON public.payments FOR ALL
  USING (public.is_accountant(auth.uid()));

CREATE POLICY "Accountants manage expenses"
  ON public.expenses FOR ALL
  USING (public.is_accountant(auth.uid()));

CREATE POLICY "Operations create trip expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (public.is_operational(auth.uid()));

-- ----------------------------------------------------------------------------
-- DISPATCH & DELIVERY POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Operations manage dispatches"
  ON public.dispatches FOR ALL
  USING (public.is_operational(auth.uid()));

CREATE POLICY "Drivers view assigned dispatches"
  ON public.dispatches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers 
      WHERE id = driver_id AND profile_id = auth.uid()
    ) OR public.is_operational(auth.uid())
  );

CREATE POLICY "Operations manage dispatch stops"
  ON public.dispatch_stops FOR ALL
  USING (public.is_operational(auth.uid()));

CREATE POLICY "Staff view dispatch stops"
  ON public.dispatch_stops FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operations manage dispatch items"
  ON public.dispatch_items FOR ALL
  USING (public.is_operational(auth.uid()));

CREATE POLICY "Staff view dispatch items"
  ON public.dispatch_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operations manage deliveries"
  ON public.deliveries FOR ALL
  USING (public.is_operational(auth.uid()));

CREATE POLICY "Drivers update assigned deliveries"
  ON public.deliveries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers 
      WHERE id = driver_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "Drivers view assigned deliveries"
  ON public.deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers 
      WHERE id = driver_id AND profile_id = auth.uid()
    ) OR public.is_operational(auth.uid())
  );

CREATE POLICY "All authenticated staff view proof of delivery"
  ON public.proof_of_delivery FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Drivers and Operations submit proof of delivery"
  ON public.proof_of_delivery FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------------------
-- LOADING / UNLOADING POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Warehouse staff & Operations manage loading operations"
  ON public.loading_unloading_operations FOR ALL
  USING (
    public.is_operational(auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('warehouse_staff', 'labour_supervisor'))
  );

CREATE POLICY "Staff view loading operations"
  ON public.loading_unloading_operations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff manage loading items"
  ON public.loading_unloading_items FOR ALL
  USING (
    public.is_operational(auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'warehouse_staff')
  );


