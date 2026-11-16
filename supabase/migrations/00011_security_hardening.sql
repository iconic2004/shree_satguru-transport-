-- ============================================================================
-- Migration 00011: Security hardening & data-integrity fixes
-- Shree Satguru Transport Management System
--
-- NON-DESTRUCTIVE: replaces functions, adjusts / adds RLS policies and adds one
-- trigger. No tables, columns or rows are dropped or modified.
-- Safe to re-run (idempotent).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fix privilege escalation in handle_new_user()
--    Previously the role was taken from raw_user_meta_data, which any caller of
--    the public auth.signUp() endpoint controls (e.g. role = 'super_admin').
--    New accounts now ALWAYS get the least-privileged role; roles are granted
--    by a Super Admin afterwards (see /api/admin/users).
--    The very first account on an empty database still becomes super_admin so
--    the system can be bootstrapped.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

  INSERT INTO public.profiles (id, full_name, avatar_url, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'phone',
    CASE WHEN is_first_user THEN 'super_admin'::public.user_role
         ELSE 'warehouse_staff'::public.user_role END
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name;   -- never touch role on conflict

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Pin search_path on SECURITY DEFINER helpers (prevents search_path hijack)
--    and add an "active user" helper.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role::text FROM public.profiles WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND is_active = true);
$$;

CREATE OR REPLACE FUNCTION public.has_active_role(uid UUID, roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND is_active = true AND role::text = ANY (roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.has_active_role(uid, ARRAY['super_admin']);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.has_active_role(uid, ARRAY['super_admin', 'admin']);
$$;

CREATE OR REPLACE FUNCTION public.is_operational(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.has_active_role(uid, ARRAY['super_admin', 'admin', 'operations_manager']);
$$;

CREATE OR REPLACE FUNCTION public.is_accountant(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.has_active_role(uid, ARRAY['super_admin', 'admin', 'accountant']);
$$;

-- ----------------------------------------------------------------------------
-- 3. Deactivated users must lose access.
--    Policies that only checked "auth.uid() IS NOT NULL" now require an
--    active profile.
-- ----------------------------------------------------------------------------
ALTER POLICY "Staff can view companies"                     ON public.companies                    USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff can view customers"                     ON public.customers                    USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff can view customer addresses"            ON public.customer_addresses           USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view active rate cards"                 ON public.rate_cards                   USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view rate card items"                   ON public.rate_card_items              USING (public.is_active_user(auth.uid()));
ALTER POLICY "All authenticated staff view goods receipts"  ON public.goods_receipts               USING (public.is_active_user(auth.uid()));
ALTER POLICY "All authenticated staff view goods items"     ON public.goods_items                  USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view inventory movements"               ON public.inventory_movements          USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view warehouses"                        ON public.warehouses                   USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view warehouse locations"               ON public.warehouse_locations          USING (public.is_active_user(auth.uid()));
ALTER POLICY "Drivers view own record"                      ON public.drivers                      USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view vehicles"                          ON public.vehicles                     USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view own attendance"                    ON public.staff_attendance             USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view staff members"                     ON public.staff_members                USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view dispatch stops"                    ON public.dispatch_stops               USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view dispatch items"                    ON public.dispatch_items               USING (public.is_active_user(auth.uid()));
ALTER POLICY "All authenticated staff view proof of delivery" ON public.proof_of_delivery          USING (public.is_active_user(auth.uid()));
ALTER POLICY "Staff view loading operations"                ON public.loading_unloading_operations USING (public.is_active_user(auth.uid()));

-- Inline role checks that ignored is_active
ALTER POLICY "Warehouse & Operations manage goods receipts" ON public.goods_receipts
  USING (public.has_active_role(auth.uid(), ARRAY['super_admin','admin','operations_manager','warehouse_staff']));
ALTER POLICY "Warehouse & Operations manage goods items" ON public.goods_items
  USING (public.has_active_role(auth.uid(), ARRAY['super_admin','admin','operations_manager','warehouse_staff']));
ALTER POLICY "Operations manage inventory movements" ON public.inventory_movements
  USING (public.has_active_role(auth.uid(), ARRAY['super_admin','admin','operations_manager','warehouse_staff']));
ALTER POLICY "Supervisors and Operations manage staff attendance" ON public.staff_attendance
  USING (public.has_active_role(auth.uid(), ARRAY['super_admin','admin','operations_manager','labour_supervisor']));
ALTER POLICY "Warehouse staff & Operations manage loading operations" ON public.loading_unloading_operations
  USING (public.has_active_role(auth.uid(), ARRAY['super_admin','admin','operations_manager','warehouse_staff','labour_supervisor']));
ALTER POLICY "Staff manage loading items" ON public.loading_unloading_items
  USING (public.has_active_role(auth.uid(), ARRAY['super_admin','admin','operations_manager','warehouse_staff']));

-- ----------------------------------------------------------------------------
-- 4. Close anonymous / forged writes
--    These INSERT policies previously applied to PUBLIC (including anon).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users insert own audit logs" ON public.audit_logs;
CREATE POLICY "Users insert own audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Drivers and Operations submit proof of delivery" ON public.proof_of_delivery;
CREATE POLICY "Drivers and Operations submit proof of delivery"
  ON public.proof_of_delivery FOR INSERT TO authenticated
  WITH CHECK (
    captured_by = auth.uid() AND (
      public.is_operational(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.deliveries d
        JOIN public.drivers dr ON dr.id = d.driver_id
        WHERE d.id = delivery_id AND dr.profile_id = auth.uid()
      )
    )
  );

-- Expense INSERT for operations must be attributed to the caller
DROP POLICY IF EXISTS "Operations create trip expenses" ON public.expenses;
CREATE POLICY "Operations create trip expenses"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_operational(auth.uid()) AND entered_by = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. application_settings had RLS enabled but no policies -> unusable.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Active users read settings" ON public.application_settings;
CREATE POLICY "Active users read settings"
  ON public.application_settings FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Admins manage settings" ON public.application_settings;
CREATE POLICY "Admins manage settings"
  ON public.application_settings FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- ----------------------------------------------------------------------------
-- 6. Apply customer payments to invoices atomically.
--    Previously a payment "allocated" to an invoice never changed the
--    invoice's paid / outstanding amounts. Over-payment is rejected and the
--    whole INSERT rolls back.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  new_paid NUMERIC(15, 2);
BEGIN
  IF NEW.invoice_id IS NULL OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = NEW.invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', NEW.invoice_id;
  END IF;

  IF inv.status IN ('cancelled', 'credited') THEN
    RAISE EXCEPTION 'Cannot record a payment against a % invoice', inv.status;
  END IF;

  new_paid := inv.paid_amount + NEW.amount;
  IF new_paid > inv.total_amount THEN
    RAISE EXCEPTION 'Payment of % exceeds outstanding amount % on invoice %',
      NEW.amount, inv.outstanding_amount, inv.invoice_number
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.invoices
     SET paid_amount = new_paid,
         outstanding_amount = total_amount - new_paid,
         status = CASE WHEN total_amount - new_paid <= 0 THEN 'paid'::public.invoice_status
                       ELSE 'partially_paid'::public.invoice_status END
   WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_payment_to_invoice ON public.payments;
CREATE TRIGGER trg_apply_payment_to_invoice
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.apply_payment_to_invoice();

-- ----------------------------------------------------------------------------
-- 7. Recommended (manual) Supabase dashboard settings — cannot be set via SQL:
--    * Authentication -> Providers -> Email: disable "Allow new users to sign up"
--      (accounts are created by a Super Admin from /admin/users).
--    * Authentication -> URL Configuration: add
--      https://<your-domain>/auth/callback to "Redirect URLs".
-- ----------------------------------------------------------------------------
