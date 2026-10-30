-- ============================================================================
-- Migration 00010: Row Level Security (RLS) Policies
-- Shree Satguru Transport Management System
-- ============================================================================

-- Helper functions for role-based security
CREATE OR REPLACE FUNCTION public.get_user_role(uid UUID)
RETURNS TEXT AS $$
  SELECT role::text FROM public.profiles WHERE id = uid;
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
