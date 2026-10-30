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
