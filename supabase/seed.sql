-- ============================================================================
-- Seed Data for Shree Satguru Transport Management System
-- NOTE: Demo data for testing and development only
-- ============================================================================

-- 1. Warehouses
INSERT INTO public.warehouses (id, name, code, address, city, capacity_sqft, is_active) VALUES
('a0000001-0000-0000-0000-000000000001', 'Bhiwandi Central Godown', 'BHW-01', 'Survey No 45, Mankoli Naka, Bhiwandi', 'Bhiwandi', 25000, true),
('a0000001-0000-0000-0000-000000000002', 'Vashi Hub & Logistics', 'VSH-01', 'Plot 12, APMC Market-2, Vashi', 'Navi Mumbai', 15000, true),
('a0000001-0000-0000-0000-000000000003', 'Kalamboli Steel & Heavy Goods', 'KLM-01', 'Road No 8, Kalamboli Industrial Area', 'Panvel', 30000, true)
ON CONFLICT (id) DO NOTHING;

-- 2. Warehouse Locations (Racks / Bays)
INSERT INTO public.warehouse_locations (id, warehouse_id, name, section, rack, shelf, capacity) VALUES
('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'Bay A-1', 'Section A - FMCG', 'Rack 1', 'Shelf 1-3', 500),
('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'Bay B-2', 'Section B - Heavy Hardware', 'Rack 2', 'Ground', 1200),
('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000002', 'Vashi Cold Bay 1', 'Section C - Perishables', 'Rack 1', 'Shelf 1', 300)
ON CONFLICT (id) DO NOTHING;

-- 3. Companies
INSERT INTO public.companies (id, name, company_type, contact_person, phone, email, billing_address, city, area, pin_code, gstin, billing_terms, credit_limit, is_active) VALUES
('c0000001-0000-0000-0000-000000000001', 'Parle Agro Industries Ltd', 'client', 'Rajesh Sharma', '+91 98201 12345', 'logistics@parleagro.com', 'Sahar Road, Andheri East', 'Mumbai', 'Andheri East', '400099', '27AAACP1234A1Z5', '30 Days Net', 500000.00, true),
('c0000001-0000-0000-0000-000000000002', 'Godrej Consumer Products', 'consignor', 'Anand Kulkarni', '+91 98199 54321', 'supplychain@godrej.com', 'Pirojshanagar, Eastern Express Highway', 'Mumbai', 'Vikhroli', '400079', '27AAACG5678B2Z1', '15 Days Net', 350000.00, true),
('c0000001-0000-0000-0000-000000000003', 'Asian Paints Ltd', 'client', 'Sanjay Deshmukh', '+91 98334 87654', 'dispatch@asianpaints.com', 'Santacruz West Industrial Estate', 'Mumbai', 'Santacruz', '400055', '27AAACA9876C3Z2', '30 Days Net', 600000.00, true),
('c0000001-0000-0000-0000-000000000004', 'Mahalaxmi Steel Traders', 'consignor', 'Virendra Singh', '+91 98670 99887', 'mahalaxmisteel@gmail.com', 'Loha Bhavan, P. D''Mello Road', 'Mumbai', 'Masjid Bunder', '400009', '27AABCM3456D4Z9', 'Immediate', 100000.00, true)
ON CONFLICT (id) DO NOTHING;

-- 4. Customers
INSERT INTO public.customers (id, company_id, name, contact_person, phone, email, city, area, pin_code, gstin, billing_terms, credit_limit, is_active) VALUES
('d0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'Reliance Retail Central Warehouse', 'Praveen Mehta', '+91 99200 11223', 'dc.bhiwandi@ril.com', 'Bhiwandi', 'Poman', '421302', '27AABCR4455E1Z4', '30 Days', 300000.00, true),
('d0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000002', 'DMart Distribution Center Thane', 'Satish Patil', '+91 98700 33445', 'dmart.thane@avenue.com', 'Thane', 'Ghodbunder Road', '400615', '27AACCA6677F2Z8', '15 Days', 250000.00, true),
('d0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000003', 'Apex Hardware & Paints Distributors', 'Ramesh Jain', '+91 98111 77889', 'apex.paints@gmail.com', 'Pune', 'Bhosari MIDC', '411026', '27AABCJ8899G3Z6', 'Weekly', 150000.00, true)
ON CONFLICT (id) DO NOTHING;

-- 5. Vehicles
INSERT INTO public.vehicles (id, registration_number, vehicle_type, make, model, cargo_capacity_kg, cargo_capacity_cbm, fuel_type, current_odometer, insurance_expiry, fitness_expiry, permit_expiry, puc_expiry, status) VALUES
('e0000001-0000-0000-0000-000000000001', 'MH-04-GP-4521', 'truck', 'Tata Motors', 'LPT 1613', 9500.00, 32.50, 'diesel', 74520.0, '2027-04-15', '2027-03-20', '2027-08-30', '2027-01-10', 'available'),
('e0000001-0000-0000-0000-000000000002', 'MH-43-BP-8890', 'truck', 'Eicher', 'Pro 3015', 8500.00, 28.00, 'diesel', 48210.0, '2027-06-10', '2027-05-18', '2027-11-25', '2026-12-05', 'available'),
('e0000001-0000-0000-0000-000000000003', 'MH-03-CP-1204', 'tempo', 'Tata Motors', 'Ace Gold', 1200.00, 8.50, 'cng', 31200.0, '2027-02-28', '2027-02-15', '2027-07-12', '2027-03-01', 'available'),
('e0000001-0000-0000-0000-000000000004', 'MH-04-KF-7763', 'mini_truck', 'Mahindra', 'Bolero Maxi Truck', 1700.00, 10.00, 'diesel', 62300.0, '2027-08-20', '2027-07-14', '2027-10-01', '2027-04-18', 'available'),
('e0000001-0000-0000-0000-000000000005', 'MH-46-AR-3312', 'truck', 'BharatBenz', '1617R', 10000.00, 36.00, 'diesel', 91400.0, '2027-01-25', '2026-12-30', '2027-06-15', '2026-11-20', 'under_maintenance')
ON CONFLICT (id) DO NOTHING;

-- 6. Drivers
INSERT INTO public.drivers (id, full_name, phone, address, emergency_contact, emergency_phone, joining_date, employment_status, licence_number, licence_class, licence_expiry, salary_type, monthly_salary, daily_wage, trip_rate, assigned_vehicle_id) VALUES
('f0000001-0000-0000-0000-000000000001', 'Ramesh Yadav', '+91 97654 32100', 'Shanti Nagar, Kalyan West, Thane', 'Sunita Yadav (Wife)', '+91 97654 32101', '2023-01-15', 'active', 'MH0420180045612', 'Heavy Transport (HMV)', '2028-09-12', 'monthly', 26000.00, NULL, NULL, 'e0000001-0000-0000-0000-000000000001'),
('f0000001-0000-0000-0000-000000000002', 'Santosh Patil', '+91 98223 44556', 'Sector 19, Airoli, Navi Mumbai', 'Vandana Patil (Wife)', '+91 98223 44557', '2023-05-10', 'active', 'MH4320190089123', 'Medium Goods Vehicle', '2027-11-20', 'monthly', 24000.00, NULL, NULL, 'e0000001-0000-0000-0000-000000000002'),
('f0000001-0000-0000-0000-000000000003', 'Mohammad Irfan', '+91 99300 88776', 'Kurla West, Mumbai', 'Amina Bi (Mother)', '+91 99300 88777', '2024-02-01', 'active', 'MH0320210034567', 'Light Motor Vehicle (LMV-TR)', '2029-04-10', 'daily', NULL, 900.00, NULL, 'e0000001-0000-0000-0000-000000000003'),
('f0000001-0000-0000-0000-000000000004', 'Dnyaneshwar Shinde', '+91 98690 12389', 'Bhiwandi Gaon, Bhiwandi', 'Kavita Shinde (Wife)', '+91 98690 12390', '2024-03-15', 'active', 'MH0420200067890', 'Heavy Transport (HMV)', '2028-01-18', 'trip_based', NULL, NULL, 1200.00, 'e0000001-0000-0000-0000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- 7. Staff Members (Labourers & Helpers)
INSERT INTO public.staff_members (id, full_name, phone, address, joining_date, employment_status, staff_type, daily_wage, payment_method_preference) VALUES
('10000001-0000-0000-0000-000000000001', 'Baban Kamble', '+91 96190 22334', 'Diva East, Thane', '2023-02-10', 'active', 'labourer', 650.00, 'cash'),
('10000001-0000-0000-0000-000000000002', 'Sunil Pawar', '+91 98330 44556', 'Kalwa Naka, Thane', '2023-04-01', 'active', 'labourer', 650.00, 'cash'),
('10000001-0000-0000-0000-000000000003', 'Deepak More', '+91 97690 66778', 'Rabale MIDC, Navi Mumbai', '2023-08-15', 'active', 'helper', 600.00, 'upi'),
('10000001-0000-0000-0000-000000000004', 'Vijay Jadhav', '+91 98190 88990', 'Bhiwandi Road, Thane', '2024-01-10', 'active', 'warehouse_staff', 750.00, 'bank_transfer')
ON CONFLICT (id) DO NOTHING;

-- 8. Sample Goods Receipts
INSERT INTO public.goods_receipts (id, invoice_number, challan_number, invoice_date, consignor_company_id, consignee_customer_id, contact_number, pickup_address, delivery_address, delivery_city, product_category, product_name, quantity, unit, weight_kg, priority, status, warehouse_id) VALUES
('20000001-0000-0000-0000-000000000001', 'INV-2026-0891', 'CH-5541', CURRENT_DATE - INTERVAL '2 days', 'c0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', '+91 98201 12345', 'Parle Agro Plant, Khopoli', 'Reliance DC, Bhiwandi', 'Bhiwandi', 'Beverages', 'Frooti 200ml Tetra Pack (Cartons)', 450, 'cartons', 4950.00, 'normal', 'available', 'a0000001-0000-0000-0000-000000000001'),
('20000001-0000-0000-0000-000000000002', 'INV-2026-0892', 'CH-5542', CURRENT_DATE - INTERVAL '1 day', 'c0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000002', '+91 98199 54321', 'Godrej Plant, Vikhroli', 'DMart DC, Thane', 'Thane', 'FMCG & Soaps', 'Cinthol Soap Cartons', 200, 'cartons', 2400.00, 'high', 'available', 'a0000001-0000-0000-0000-000000000001'),
('20000001-0000-0000-0000-000000000003', 'INV-2026-0893', 'CH-5543', CURRENT_DATE, 'c0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000003', '+91 98334 87654', 'Asian Paints, Taloja', 'Apex Paints, Pune', 'Pune', 'Paints & Primers', 'Royale Luxury Emulsion 20L Buckets', 120, 'buckets', 3120.00, 'urgent', 'verification_pending', 'a0000001-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- 9. Sample Dispatches
INSERT INTO public.dispatches (id, dispatch_number, dispatch_date, vehicle_id, driver_id, planned_distance_km, cargo_weight_kg, capacity_utilization_pct, status, planned_cost) VALUES
('30000001-0000-0000-0000-000000000001', 'DSP-2026-0041', CURRENT_DATE, 'e0000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 65.0, 4950.00, 52.1, 'in_transit', 3500.00),
('30000001-0000-0000-0000-000000000002', 'DSP-2026-0042', CURRENT_DATE, 'e0000001-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000002', 45.0, 2400.00, 28.2, 'planned', 2800.00)
ON CONFLICT (id) DO NOTHING;

-- 10. Sample Deliveries
INSERT INTO public.deliveries (id, dispatch_id, driver_id, vehicle_id, customer_id, destination_address, destination_city, goods_receipt_id, status) VALUES
('40000001-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'Reliance DC, Poman, Bhiwandi', 'Bhiwandi', '20000001-0000-0000-0000-000000000001', 'in_transit'),
('40000001-0000-0000-0000-000000000002', '30000001-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000002', 'DMart DC, Ghodbunder Rd, Thane', 'Thane', '20000001-0000-0000-0000-000000000002', 'assigned')
ON CONFLICT (id) DO NOTHING;

-- 11. Sample Operating Expenses
INSERT INTO public.expenses (id, expense_date, category, amount, payment_method, vendor, vehicle_id, description) VALUES
('50000001-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '1 day', 'diesel_fuel', 8500.00, 'upi', 'Indian Oil Corporation, Bhiwandi', 'e0000001-0000-0000-0000-000000000001', 'Diesel 92 Litres for MH-04-GP-4521'),
('50000001-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '2 days', 'toll', 680.00, 'upi', 'Fastag Toll Plaza', 'e0000001-0000-0000-0000-000000000001', 'Mumbai-Pune Expressway Toll'),
('50000001-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '3 days', 'vehicle_repair', 3200.00, 'cash', 'Sai Auto Garage', 'e0000001-0000-0000-0000-000000000003', 'Brake pad replacement and oil top-up')
ON CONFLICT (id) DO NOTHING;

-- 12. Sample Invoices
INSERT INTO public.invoices (id, invoice_number, customer_id, company_id, billing_month, invoice_date, due_date, subtotal, tax_amount, tax_rate, tds_amount, total_amount, paid_amount, outstanding_amount, status, gst_number) VALUES
('60000001-0000-0000-0000-000000000001', 'SST-INV-2026-101', 'd0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', '2026-09-01', '2026-10-01', '2026-10-31', 85000.00, 15300.00, 18.00, 1700.00, 100300.00, 50000.00, 50300.00, 'partially_paid', '27AAACP1234A1Z5'),
('60000001-0000-0000-0000-000000000002', 'SST-INV-2026-102', 'd0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000002', '2026-09-01', '2026-10-05', '2026-10-20', 42000.00, 7560.00, 18.00, 840.00, 49560.00, 49560.00, 0.00, 'paid', '27AAACG5678B2Z1')
ON CONFLICT (id) DO NOTHING;
