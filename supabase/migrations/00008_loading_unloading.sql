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
