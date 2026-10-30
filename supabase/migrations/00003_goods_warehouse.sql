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
