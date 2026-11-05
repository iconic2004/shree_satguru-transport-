-- ==============================================================================
-- Shree Satguru Transport - Fresh Business Start Cleanup Script
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query).
-- 
-- WHAT THIS DOES:
-- 1. Clears all dummy test data (sample goods, dispatches, vehicles, drivers,
--    invoices, payments, expenses, etc.)
-- 2. PRESERVES your Admin login credentials (auth.users & public.profiles)
-- 3. Sets up a clean Central Godown warehouse ready for real business cargo.
-- ==============================================================================

-- 1. Truncate all transactional & operational tables with CASCADE
TRUNCATE TABLE 
  public.trip_staff_allowances,
  public.trip_staff_assignments,
  public.trip_records,
  public.proof_of_delivery,
  public.delivery_status_history,
  public.deliveries,
  public.dispatch_items,
  public.dispatch_stops,
  public.dispatches,
  public.loading_unloading_staff,
  public.loading_unloading_items,
  public.loading_unloading_operations,
  public.inventory_movements,
  public.goods_items,
  public.goods_receipts,
  public.warehouse_locations,
  public.warehouses,
  public.vehicle_maintenance,
  public.vehicle_documents,
  public.fuel_logs,
  public.vehicles,
  public.driver_documents,
  public.driver_attendance,
  public.drivers,
  public.staff_payment_allocations,
  public.staff_payment_approvals,
  public.staff_payments,
  public.staff_deductions,
  public.staff_earnings,
  public.staff_salary_rates,
  public.staff_ledger_entries,
  public.staff_advances,
  public.staff_attendance,
  public.payroll_entries,
  public.payroll_periods,
  public.staff_members,
  public.payment_allocations,
  public.payments,
  public.invoice_items,
  public.invoices,
  public.rate_card_items,
  public.rate_cards,
  public.expenses,
  public.customer_addresses,
  public.customers,
  public.companies,
  public.notifications,
  public.audit_logs
CASCADE;

-- 2. Insert a clean default Central Godown so inward cargo receipts can be recorded immediately
INSERT INTO public.warehouses (id, name, code, address_line1, city, state, pin_code, is_active)
VALUES 
  ('a0000001-0000-0000-0000-000000000001', 'Central Godown Bhiwandi', 'BHW-01', 'Bhiwandi Logistics Hub', 'Bhiwandi', 'Maharashtra', '421302', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.warehouse_locations (id, warehouse_id, name, code, is_active)
VALUES
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'General Storage Bay A', 'BAY-A', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Log initial fresh start audit log
INSERT INTO public.audit_logs (action, entity_type, entity_id, new_values)
VALUES (
  'SYSTEM_FRESH_START',
  'system',
  'PRODUCTION_INIT',
  '{"status": "cleaned", "mode": "production_ready", "timestamp": "' || NOW() || '"}'::jsonb
);
