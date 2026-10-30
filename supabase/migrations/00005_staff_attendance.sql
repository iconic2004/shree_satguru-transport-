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
