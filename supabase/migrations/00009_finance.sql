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
  created_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
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
  entered_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
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
