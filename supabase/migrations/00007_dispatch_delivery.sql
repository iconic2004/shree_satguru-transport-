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
