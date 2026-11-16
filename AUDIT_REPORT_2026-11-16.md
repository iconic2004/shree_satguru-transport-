# Audit Report — Shree Satguru Transport TMS

**Date:** 16 Nov 2026
**Scope:** Whole repository plus anonymous, read-only checks of https://shree-satguru-transport.vercel.app
**Status:** Initial audit, written before any code was changed. The fix log is in section 6.

---

## 1. Architecture

| Area | Finding |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript strict, Tailwind and Radix UI |
| Data access | All 22 dashboard pages are `'use client'` components. They query Supabase directly from the browser with the **anon key**, so **Postgres RLS is the only real authorization boundary**. |
| Server code | `src/middleware.ts` (session refresh and login redirect) and one API route, `src/app/api/goods/route.ts`, which uses the **service-role key**. |
| Auth | Supabase Auth with email and password. A `profiles.role` enum covers 7 roles. `handle_new_user()` trigger creates the profile. |
| DB | 10 migrations (`supabase/migrations`) with 50 tables and RLS enabled on all of them. `full_schema.sql` is identical to the concatenated migrations. |
| Tests / lint | No test framework. No ESLint config or ESLint dependency, so `npm run lint` cannot run non-interactively. |
| Env vars used | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (plus unused `NEXT_PUBLIC_APP_*`). No `.env.local` is present. |

## 2. Production observations (anonymous GETs only)

- Protected routes redirect to `/login`, which is correct.
- `GET /auth/callback` returns **404**, so the password-reset email link points to a missing route.
- `GET /api/goods` is reachable **without authentication**. It currently returns `500 {"error":"TypeError: fetch failed"}`.
- The Supabase host compiled into the live bundle **does not resolve (NXDOMAIN)**. The Supabase project has been deleted, paused or removed, or the Vercel env var is wrong. **Nobody can log in to production right now, and no data can load.**

## 3. Issues found

### Critical
| # | Issue | Location |
|---|---|---|
| C1 | **Privilege escalation through public sign-up.** `handle_new_user()` takes the role from `raw_user_meta_data.role`. That field is client-controlled through `supabase.auth.signUp({ options: { data: { role: 'super_admin' } } })` using the public anon key. | `00001_initial_schema.sql:163` |
| C2 | **Unauthenticated service-role API.** Middleware skips `/api/*`, and `/api/goods` never checks the session. It uses the service-role key, which bypasses RLS. Anyone on the internet can list every goods receipt and create goods, companies and customers. `admin.ts` also falls back silently to the anon key. | `api/goods/route.ts`, `lib/supabase/admin.ts`, `lib/supabase/middleware.ts:46` |
| C3 | **Login accepts any credentials.** If `signInWithPassword` fails, the code shows "Logged in successfully" and redirects to `/dashboard` anyway. | `(auth)/login/page.tsx:30-40` |
| C4 | **Middleware fails open.** If the env vars are missing or a placeholder, or if any exception occurs, the request passes through without an auth check. | `lib/supabase/middleware.ts:13,65` |
| C5 | **Writes fail silently and report success.** 13 create flows ignore the Supabase `error`, then insert a fake `Date.now()` record into the table and show a success toast. Users believe data was saved when it was not. This happens on every RLS denial or constraint violation. | goods, companies, customers, drivers, vehicles, staff, advances, billing, payments, expenses, dispatch, admin/users |
| C6 | **Billing can never save.** `invoices.customer_id` is `NOT NULL`, but the form never sends it. Every invoice is a fake local record. | `billing/page.tsx` |
| C7 | Production Supabase project is unreachable (section 2). This needs a manual fix. | Vercel env |

### High
| # | Issue | Location |
|---|---|---|
| H1 | No route-level RBAC. Any logged-in role can open any page by URL. The sidebar shows **every** item when the profile is missing, and the header shows "Super Admin" by default. | `sidebar.tsx:211`, `header.tsx` |
| H2 | Deactivated users (`is_active=false`) can still sign in. Many RLS policies only check `auth.uid() IS NOT NULL`. | middleware, RLS |
| H3 | Password reset is broken. `/auth/callback` and the set-new-password page do not exist. | `forgot-password/page.tsx` |
| H4 | Dispatch ignores the vehicle and driver the user typed. It assigns the **first vehicle and driver in the DB**, and the capacity used is hard-coded at 9500 kg. | `dispatch/page.tsx:97-104` |
| H5 | Staff advances are attached to the **first driver in the DB** and `recorded_by` to the first profile, whoever was actually chosen. Payments use the same "first profile" pattern and are never linked to a client or invoice. Cash and cheque payments are saved as `upi`. | `staff/advances`, `payments` |
| H6 | Attendance "Save Muster" writes nothing to the database. | `staff/attendance/page.tsx:72` |
| H7 | The payroll page is **made-up money data**: every driver is "paid" at salary + ₹1,500 (₹24,000 when the salary is empty), and every labourer has a hard-coded ₹1,000 advance. | `staff/payroll/page.tsx` |
| H8 | 4 of 6 report exports select columns that do not exist (`package_count`, `employee_code`, `capacity_tonnes`, …). They download empty CSVs and still show "exported successfully". | `reports/page.tsx` |
| H9 | Warehouse stock reads columns that do not exist (`actual_quantity`, `package_count`, …), so every quantity shows 0. | `warehouse/page.tsx` |
| H10 | Admin "Create user" and "Activate/Deactivate" only change the screen. Settings "Save" only shows a toast. When the password change fails, the page reports "Password updated for the current session". | `admin/users`, `settings` |
| H11 | `ToastProvider` is mounted only inside the dashboard shell, so login and reset-password errors are never shown. | `app-shell.tsx` |
| H12 | Submit buttons have `onClick={handleCreate}`, which calls `preventDefault()` and cancels the native submit. HTML `required` validation never runs, so blank forms are sent. | 11 dialogs |
| H13 | Delivery POD: the receiver name, phone and remarks are discarded, and the display hard-codes "Store Manager". | `deliveries/page.tsx` |

### Medium
- M1: RLS lets the `anon` role INSERT `audit_logs` and `proof_of_delivery`, because those policies have no `TO authenticated`. Audit logs can be forged.
- M2: `SECURITY DEFINER` helper functions have no fixed `search_path`.
- M3: `application_settings` has RLS enabled but no policies, so settings can never be stored.
- M4: Dashboard charts use hard-coded sample numbers presented as real. Several KPIs are mislabelled, e.g. "trucks on road" is all dispatches ever and "present today" is all staff.
- M5: The layout is not responsive. The sidebar is always 256px wide, so on a phone the content area is about 120px. Dialog forms use fixed 2- and 3-column grids.
- M6: CSV exports use `encodeURI` (a `#` in the data truncates the file) and do not escape quotes.
- M7: `clean_start.sql` inserts columns that do not exist and a non-UUID `entity_id`, so it fails. It is also destructive (TRUNCATE).
- M8: There is no `error.tsx` or `not-found.tsx` error boundary.
- M9: Load errors are swallowed everywhere, so a failed query looks like "no records".
- M10: `next.config.mjs` allows images from any HTTPS host and disables the webpack cache.

### Low
- The header search box, the language selector and dark-mode persistence are not wired up.
- `useUser` is instantiated twice (sidebar and header), which doubles the profile queries.
- `PROJECT_AUDIT_REPORT.md` and `README.md` describe features that are not implemented (POD photo upload, unassigned goods queue, …).

## 4. Fix plan (priority order)
1. Security: C1, C2, C3, C4, H1, H2, M1, M2 (code plus a new **non-destructive** migration `00011`).
2. Data integrity: C5, C6, H4, H5, H6, H12, H13, M9.
3. Broken features: H3, H7, H8, H9, H10, H11, M3.
4. UX and robustness: M4, M5, M6, M8.
5. Tooling: ESLint config, unit tests (Vitest), build verification.

## 5. Constraints
- No reachable Supabase instance exists (production is down, and there are no local credentials). **DB-backed workflows cannot be exercised end to end**, and the migrations cannot be applied here. Verification covers the type check, lint, production build, unit tests and browser checks of the unauthenticated flows.
- Nothing will be deployed, pushed or run against a database.

---

## 6. Fix log (added after the fixes were made)

**Status:** 41 issues identified. 37 fixed in code. 4 need manual action or are out of scope (section 8).

| Issue | Fix |
|---|---|
| C1 | `00011_security_hardening.sql`: `handle_new_user()` ignores the role in metadata, so every new account starts as `warehouse_staff`. Super Admins assign roles server-side in `/api/admin/users`. |
| C2 | `/api/goods` now authenticates the caller and checks permissions (`VIEW_GOODS`/`MANAGE_GOODS`), validates input with zod and inserts goods under the user's RLS. The service role is only used for consignor/customer auto-creation, and only after authorization. `admin.ts` no longer falls back to the anon key. |
| C3 | Login uses real auth only. Errors show inline, `redirectTo` is sanitized, and the demo shortcuts sit behind `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` and only prefill an email. |
| C4 | Middleware fails closed. It also enforces an active profile (deactivated users are signed out) and route-level RBAC through `src/lib/auth/route-access.ts`. |
| C5, M9 | All 13 create flows and every loader now check `error`, show real messages (`getErrorMessage`) and never insert fake records. |
| C6 | Billing has a customer picker, a GST rate selector and tested totals (`computeInvoiceTotals`). |
| H1 | Sidebar and header deny by default. Create buttons are disabled for roles that can view a module but not manage it. Dashboard finance widgets are hidden from non-finance roles. |
| H2 | Middleware blocks inactive users. 00011 requires an active profile in the RLS helpers and `SELECT` policies. |
| H3 | Added `/auth/callback` (PKCE and token_hash) and a `/reset-password` page. Forgot-password reports real failures. |
| H4 | Dispatch uses real vehicle and driver selects and the vehicle's actual capacity, blocks overloading, saves route stops to `dispatch_stops` (rolled back on failure) and lists unassigned goods. |
| H5 | Advances use a person picker and `recorded_by = current user`. Payments must be linked to an open invoice, store the correct method and are capped at the outstanding balance. A DB trigger in 00011 updates the invoice atomically. |
| H6 | Attendance loads and upserts `staff_attendance`/`driver_attendance` for the selected date. |
| H7 | Payroll shows real `payroll_entries` only. "Settle" records a `staff_payments` row and then updates the entry. |
| H8 | 12 reports, each with its own real query (`src/lib/reports.ts`). Export uses a Blob, quotes fields and guards against formula injection. |
| H9 | Warehouse uses real columns, shows godown statuses only and records `verified_by`/`verified_at`. |
| H10 | Admin users go through `/api/admin/users` (create, list emails, activate/deactivate) with self-lockout protection. Settings persist to `application_settings`. Password change re-verifies the current password. |
| H11 | `ToastProvider` moved to the root layout. |
| H12 | Removed `onClick={handleCreate}` from 11 submit buttons and added double-submit guards. |
| H13 | Delivery POD is written to `proof_of_delivery` and rolled back on failure. Reschedule is implemented for failed deliveries. |
| M1, M2, M3 | 00011: `audit_logs` and `proof_of_delivery` inserts are authenticated and attributed to the caller, `search_path` is pinned on SECURITY DEFINER functions, and `application_settings` has policies. |
| M4 | Dashboard KPIs and charts are computed from real data (`src/lib/dashboard-metrics.ts`). The fake 96.4% and +4.8% figures are removed. |
| M5 | Mobile sidebar drawer, responsive header, responsive dialog grids. |
| M6 | CSV helper `src/lib/utils/csv.ts`. |
| M7 | `clean_start.sql` columns fixed and a DESTRUCTIVE warning added. It was not run. |
| M8 | Added `error.tsx`, `global-error.tsx` and `not-found.tsx`. |
| M10 | Images are restricted to `*.supabase.co`. Security headers added and `x-powered-by` removed. |
| Tooling | ESLint (`next/core-web-vitals`), Vitest, Playwright (`channel: chrome`), and the scripts `typecheck`, `test` and `test:e2e`. |

### Verification
- `tsc --noEmit`: 0 errors.
- `next lint`: 0 warnings and 0 errors.
- `next build` passes, with 29 routes.
- `vitest run`: 87 of 87 tests pass. They cover the RBAC role matrix, open-redirect guard, middleware fail-closed and inactive-user handling, `/api/goods` 401/403/400, GST/TDS totals, capacity, CSV, IST dates and dashboard metrics.
- `playwright test`: 38 of 38 pass (19 scenarios on desktop and Pixel 7) against `next start`. They cover route protection, anonymous API rejection, the login-bypass regression, native validation, demo login hidden, link-expired and inactive messages, the forgot-password failure path, reset-password without a session, security headers and no horizontal overflow on auth pages.

## 7. Not tested (requires a reachable Supabase project)
None of the following was executed. They are written against the schema, but **none of them has been run end to end**:
- Any database write or read.
- Every authenticated page.
- Per-role behaviour with real accounts.
- The migration 00011 itself.
- The payment trigger.
- The attendance upserts.
- PostgREST FK hints (`fk_drivers_assigned_vehicle`, `vehicles_assigned_driver_id_fkey`, `loading_unloading_operations_responsible_employee_fkey`).
- Responsive layout of the authenticated shell.

## 8. Remaining / manual items
1. **Production is down.** The Supabase host in the Vercel build does not resolve. Create or restore the project, then set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (formerly `..._ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`) in Vercel and redeploy.
2. Apply `supabase/migrations/00011_security_hardening.sql` (it is non-destructive) after reviewing it. Then audit the existing `profiles` rows for roles granted through the old signup hole.
3. In the Supabase dashboard: disable public sign-ups, and add `https://<domain>/auth/callback` to the Redirect URLs.
4. Still not implemented (it would be new functionality): POD photo and file upload to Storage, payroll period generation, and a UI for editing or deleting records. The header search box and the language selector are still decorative.
5. Some RLS gaps remain: several tables have RLS enabled but no policies (for example `loading_unloading_staff` and `delivery_status_history`), so they return no rows. `drivers` (including salaries) and `staff_attendance` are readable by every active role. Tightening these is a business decision.
6. `README.md` and `PROJECT_AUDIT_REPORT.md` still describe features that do not exist.
