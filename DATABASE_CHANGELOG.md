# DATABASE CHANGELOG
## Shree Satguru Transport Management System (TMS)
**Database Engine:** Supabase PostgreSQL with PostGIS extensions & RLS

---

### Migration Inventory:

| File | Purpose | Key Tables Created | Key Functions / Triggers |
|---|---|---|---|
| `00001_initial_schema.sql` | Core auth, roles, notifications, audit logs | `profiles`, `notifications`, `audit_logs` | `handle_new_user()`, `update_timestamp()` |
| `00002_companies_customers.sql` | Consignors, consignees, tariff rate cards | `companies`, `customers`, `customer_addresses`, `rate_cards`, `rate_card_items` | Auto-update timestamps |
| `00003_goods_warehouse.sql` | Godowns, goods receipts, movements | `warehouses`, `warehouse_locations`, `goods_receipts`, `goods_items`, `inventory_movements` | Stock balance checks |
| `00004_drivers_vehicles.sql` | Fleet assets, drivers, documents, repairs | `drivers`, `driver_documents`, `vehicles`, `vehicle_documents`, `vehicle_maintenance` | Document expiry tracking |
| `00005_staff_attendance.sql` | Gang labour & muster roll | `staff_members`, `driver_attendance`, `staff_attendance` | Unique muster constraint per staff/date |
| `00006_staff_payroll.sql` | Wage rates, advances, monthly payroll, ledger | `staff_salary_rates`, `staff_advances`, `payroll_periods`, `payroll_entries`, `staff_payments`, `staff_ledger_entries`, `trip_staff_allowances` | Advance balance ledger |
| `00007_dispatch_delivery.sql` | Trip manifests, stops, tracking & POD | `dispatches`, `dispatch_stops`, `dispatch_items`, `deliveries`, `delivery_status_history`, `proof_of_delivery`, `trip_records`, `fuel_logs` | Delivery status timeline |
| `00008_loading_unloading.sql` | Loading & unloading operations & gang logging | `loading_unloading_operations`, `loading_unloading_items`, `loading_unloading_staff` | Operation duration |
| `00009_finance.sql` | Customer invoicing, payments, operating expenses | `invoices`, `invoice_items`, `payments`, `payment_allocations`, `expenses` | Invoice balance calculation |
| `00010_rls_policies.sql` | Multi-role Row Level Security policies | Applied to all 28 tables | Role-based policies for all 7 roles |

---

### Seed Data Inventory (`supabase/seed.sql`):
1. **Warehouses:** Bhiwandi Central Godown (WH-01), Vashi Cold Storage Hub (WH-02).
2. **Companies (Consignors):** Parle Agro Logistics, Asian Paints Dist.
3. **Customers (Consignees):** DMart Hypermarket Thane, Reliance Retail Pune, Metro Cash & Carry.
4. **Vehicles:**
   - `MH-04-GP-4521` (Tata 1109, 7.5 Ton)
   - `MH-43-BP-8890` (Eicher Pro 3015, 10 Ton)
   - `MH-12-QW-3312` (Tata Ace, 1.5 Ton)
5. **Drivers:** Ramesh Yadav, Santosh Patil, Anil Gaikwad.
6. **Labour Staff:** Sanjay Shinde, Vikas Kamble, Prakash More, Rahul Chavan.
7. **Dispatches & Goods Receipts:** Sample FMCG goods receipts with realistic weights, delivery deadlines, and trip route stops.
8. **Expenses:** Diesel fuel receipts, toll plaza FASTag, vehicle brake maintenance, godown refreshments.

