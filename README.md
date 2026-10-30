# Shree Satguru Transport Management System (TMS)

A complete, enterprise-grade Transport Management System web application built for **Shree Satguru Transport** to manage daily operations: incoming goods, godown storage, loading/unloading, vehicle dispatch planning, delivery tracking with Proof of Delivery (POD), drivers, labourers, attendance, advances, salary settlements, fleet maintenance, customer freight billing, operating expenses, and transport profitability.

---

## 1. Technology Stack

- **Frontend**: Next.js 14 with App Router
- **Language**: TypeScript (Strict type checking)
- **UI & Styling**: Tailwind CSS, shadcn/ui design tokens, Lucide Icons
- **Backend & Database**: Supabase (PostgreSQL 15+, Supabase Auth, Row Level Security)
- **Forms & Validation**: React Hook Form, Zod
- **Tables**: TanStack Table v8
- **Charts**: Recharts
- **Timezone**: Asia/Kolkata (IST)
- **Currency**: Indian Rupees (₹) with Indian numbering format (`1,00,000`)

---

## 2. Implemented Features & Modules

### 🏢 1. Main Operations & Financial Dashboard (`/dashboard`)
- Real-time KPI counters:
  - Goods received today, awaiting verification, available for dispatch, godown stock count
  - Trucks on the road, available fleet, active drivers, active labourers
  - Today's deliveries (scheduled, completed, in-transit, failed)
  - Month recognized revenue, operating expenses, and estimated operating profit
  - Customer outstanding receivables and staff unapplied advances
- **Visual Analytics**:
  - Weekly delivery performance (Success vs Failed stops)
  - Monthly profitability (Operating Revenue vs Expenses vs Net Margin)
- **Actionable Operational Widgets**:
  - Recent incoming goods arrivals
  - Today's active truck dispatches
  - Mandatory document expiry alerts (PUC, Fitness certificates, Driver licences)

### 📦 2. Goods & Invoices Management (`/goods`)
- Inward goods registration against commercial invoice and challan numbers
- Cargo details: package counts, weight in KG, volume, product category, handling instructions
- Priority levels: Normal, High, Urgent
- Verification lifecycle: Expected → Received → Verification Pending → Available for Dispatch → Reserved → Dispatched → Delivered
- CSV export for cargo manifest

### 🏬 3. Warehouse & Godown Management (`/warehouse`)
- Multi-warehouse architecture (Bhiwandi Central Godown, Vashi Hub, Kalamboli Heavy Goods)
- Bay, section, and rack location tracking
- Expected vs actual received count reconciliation
- Physical inspection discrepancy tracking (accepted, damaged, missing, excess quantities)
- Aging days calculation to prevent godown stock stagnation

### 🚜 4. Loading & Unloading Management (`/loading-unloading`)
- Operation scheduling for truck loading at godowns and unloading at destinations
- Linkage to vehicle registration, driver, and assigned labour teams
- Loading slip generation and authorized verification checks
- Prevention of double-loading or unauthorized vehicle departures

### 🚛 5. Truck-Wise Dispatch Planning (`/dispatch`)
- Inspired by the Dispatch Planner Dashboard
- Consolidates goods consignments into multi-stop truck routes
- Real-time **cargo weight vs vehicle carrying capacity** utilization meter with overload alerts
- Driver & helper assignment
- Unassigned goods queue highlighting pending consignments
- Printable driver trip sheets

### 📍 6. Delivery Tracking & Proof of Delivery (`/deliveries`)
- Stop-by-stop delivery status transitions: Pending → Assigned → Loaded → In Transit → Delivered
- Exception handling: Failed Delivery with recorded reasons & instant rescheduling
- Proof of Delivery (POD) modal capturing receiver name, phone, inspection remarks, and signed challan photo

### 👥 7. Driver, Labour & Staff Management (`/drivers`, `/staff`)
- Driver profiles with commercial HMV/LMV licence numbers and document expiry reminders
- Flexible payment configurations: Fixed monthly salary, daily wage, or trip-based rate
- Assigned vehicle linkage
- Labourers and helper rosters with agreed daily wage rates

### 📅 8. Fast Attendance Muster Roll (`/staff/attendance`)
- Compact date-wise attendance table for rapid morning muster roll in busy transport offices
- One-click status toggles: **Present (P)**, **Absent (A)**, **Half Day (HD)**, **Leave (L)**, **Weekly Off (WO)**
- Real-time staff presence counters
- Route and vehicle assignment notes

### 💰 9. Staff Advances & Salary Settlements (`/staff/advances`, `/staff/payroll`)
- **Advance Register**:
  - Records cash, UPI, or bank transfer advances
  - Strict tracking: Advance Issued, Advance Applied to Payroll, and Remaining Unapplied Balance
  - Prevents double-deduction of advances
- **Payroll Settlement Engine**:
  - `Gross Earnings = Salary / Wages Earned + Approved Trip Allowances`
  - `Net Payable = Gross Earnings - Eligible Advances Applied - Authorized Deductions`
  - Partial payment settlements with outstanding payable tracking
  - Print-ready payroll sheets

### 🧾 10. Customer Billing & Invoices (`/billing`)
- Monthly freight invoicing for client corporations
- Configurable service rate cards (per trip, per delivery, distance-based, monthly contracts)
- Automatic GST (18%) and TDS (2%) tax calculations
- Print-friendly freight tax invoice format
- Invoice statuses: Draft, Approved, Issued, Partially Paid, Paid

### 💳 11. Customer Payments & Expense Management (`/payments`, `/expenses`)
- Inward payment recording (NEFT, RTGS, Cheque, UPI) with specific invoice allocation
- Operating expense ledger covering diesel logs, highway FASTag tolls, vehicle garage repairs, spare parts, and godown lease rent

### 📊 12. Reports & Audits (`/reports`, `/admin/audit-logs`)
- Comprehensive exportable CSV datasets across Goods, Transport, Staff, and Profitability
- Immutable compliance audit log tracking operational approvals, stock verifications, and financial settlements

---

## 3. Database Architecture (Supabase PostgreSQL)

All SQL migration scripts are located in `supabase/migrations/`:

| File | Purpose |
|------|---------|
| `00001_initial_schema.sql` | Extensions, `user_role` enum, `profiles`, `notifications`, `audit_logs` |
| `00002_companies_customers.sql` | `companies`, `customers`, `customer_addresses`, `rate_cards`, `rate_card_items` |
| `00003_goods_warehouse.sql` | `warehouses`, `warehouse_locations`, `goods_receipts`, `goods_items`, `inventory_movements` |
| `00004_drivers_vehicles.sql` | `drivers`, `driver_documents`, `vehicles`, `vehicle_documents`, `vehicle_maintenance` |
| `00005_staff_attendance.sql` | `staff_members`, `driver_attendance`, `staff_attendance` |
| `00006_staff_payroll.sql` | `staff_salary_rates`, `staff_advances`, `payroll_periods`, `payroll_entries`, `staff_payments`, `staff_ledger_entries`, `trip_staff_allowances` |
| `00007_dispatch_delivery.sql` | `dispatches`, `dispatch_stops`, `dispatch_items`, `deliveries`, `proof_of_delivery`, `trip_records`, `fuel_logs` |
| `00008_loading_unloading.sql` | `loading_unloading_operations`, `loading_unloading_items`, `loading_unloading_staff` |
| `00009_finance.sql` | `invoices`, `invoice_items`, `payments`, `payment_allocations`, `expenses` |
| `00010_rls_policies.sql` | Row Level Security (RLS) policies for all tables across the 7 user roles |
| `seed.sql` | Seed script with demo companies, vehicles, drivers, godowns, and sample consignments |

---

## 4. Setting Up Supabase & Initializing the Super Admin

### Step 1: Create a Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. Under **Project Settings > API**, copy:
   - Project URL
   - Project API anon key
   - Project API service_role key

### Step 2: Configure Environment Variables
Create `.env.local` in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

NEXT_PUBLIC_APP_NAME="Shree Satguru Transport"
NEXT_PUBLIC_APP_TIMEZONE="Asia/Kolkata"
NEXT_PUBLIC_DEFAULT_CURRENCY="INR"
NEXT_PUBLIC_DEFAULT_LOCALE="en-IN"
```

### Step 3: Run Database Migrations
In the Supabase Dashboard, navigate to the **SQL Editor**, and execute the migration files in numerical order:
1. `00001_initial_schema.sql` through `00010_rls_policies.sql`
2. Run `seed.sql` to populate initial demo data.

### Step 4: Create the First Super Admin
Run this query in the Supabase SQL Editor to elevate a registered user to Super Admin:
```sql
-- 1. Create the user in Auth or sign up via the application
-- 2. Once registered, assign the super_admin role:
UPDATE public.profiles
SET role = 'super_admin',
    full_name = 'Owner / Super Admin',
    is_active = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@satgurutransport.com' LIMIT 1
);
```

---

## 5. Local Development Instructions

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev

# 3. Open http://localhost:3000 in your browser
```

For quick local testing, you can use the **Quick Demo Access** buttons on the `/login` screen to test different role dashboards.

---

## 6. Vercel Deployment Instructions

1. Push this repository to GitHub or GitLab.
2. Import the repository in [Vercel](https://vercel.com).
3. Set the Framework Preset to **Next.js**.
4. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Deploy**.
