# SETUP AND DEPLOYMENT GUIDE
## Shree Satguru Transport Management System (TMS)

This guide provides instructions to connect the TMS to a live Supabase backend and deploy it to Vercel or your hosting environment.

---

## 1. Prerequisites
- **Node.js:** v18.18.0 or v20+
- **Supabase Account:** Free or Pro account at [supabase.com](https://supabase.com)
- **Git** (for version control and deployment)

---

## 2. Supabase Backend Setup

### Step 2.1: Create a Supabase Project
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project**.
3. Name your project: `shree-satguru-tms`.
4. Choose region: **South Asia (Mumbai)** for optimal low latency across Maharashtra and India.
5. Set a strong database password and create the project.

### Step 2.2: Run Database Migrations
1. In the Supabase project dashboard, navigate to the **SQL Editor** tab (left sidebar).
2. Open each file in `supabase/migrations/` in sequential order (00001 through 00010) and execute the SQL query:
   - `00001_initial_schema.sql`
   - `00002_companies_customers.sql`
   - `00003_goods_warehouse.sql`
   - `00004_drivers_vehicles.sql`
   - `00005_staff_attendance.sql`
   - `00006_staff_payroll.sql`
   - `00007_dispatch_delivery.sql`
   - `00008_loading_unloading.sql`
   - `00009_finance.sql`
   - `00010_rls_policies.sql`
3. Click **Run** for each file. Ensure all tables, enums, triggers, and RLS policies are created without errors.

### Step 2.3: Seed Demo Operational Data
1. In the **SQL Editor**, open `supabase/seed.sql`.
2. Click **Run** to load initial warehouses (Bhiwandi, Vashi), vehicles, drivers, staff members, sample consignments, and rate cards.

### Step 2.4: Create Storage Buckets
In the Supabase **Storage** section, create four public/authenticated buckets:
- `invoices` — Customer invoices and bills
- `challans` — Inward delivery challans & LR notes
- `pod-photos` — Driver Proof-of-Delivery photos and signatures
- `driver-documents` — Driver licences, insurance, and vehicle fitness certificates

---

## 3. Local Environment Configuration

1. In the project root, open `.env.local`.
2. Update with your real Supabase project credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_TIMEZONE=Asia/Kolkata
   ```

---

## 4. Running the Application Locally

```bash
# 1. Install dependencies (if not already installed)
npm install

# 2. Run TypeScript checks to verify clean state
npm run tsc --noEmit

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
The default route `/` will redirect you to the main `/dashboard`.

---

## 5. Production Deployment (Vercel)

1. Push your code to your GitHub/GitLab repository.
2. In [Vercel](https://vercel.com), click **Add New Project** and select your repository.
3. Configure the Environment Variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (set to your Vercel production domain)
   - `NEXT_PUBLIC_TIMEZONE` (`Asia/Kolkata`)
4. Click **Deploy**. Vercel will build and host the Next.js 14 App Router application with automatic SSL and edge CDN.

