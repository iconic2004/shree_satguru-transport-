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
