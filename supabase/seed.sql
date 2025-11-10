-- Set replication role to 'replica' to disable triggers and RLS for bulk inserting.
SET session_replication_role = replica;

-- Ensure pgcrypto extension is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

--
-- Step 1: Truncate all PUBLIC tables
-- This is safe and we own these.
--
TRUNCATE 
  public.transactions,
  public.positions,
  public.investment_history,
  public.symbol_refresh_state,
  public.symbols
RESTART IDENTITY CASCADE;

--
-- Step 2: Delete ONLY the test users from auth.users
-- This avoids the permissions error on auth tables.
--
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

--
-- Step 3: Create dummy users
-- Create two test users: alice@example.com and bob@example.com
-- The password for both is 'password123'
--
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  aud,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'alice@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  'authenticated',
  'authenticated'
), (
  '00000000-0000-0000-0000-000000000002',
  'bob@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  'authenticated',
  'authenticated'
);

--
-- Step 4: Seed symbol_refresh_state
--
INSERT INTO "public"."symbol_refresh_state" ("id", "next_offset", "last_run", "last_error") VALUES
	(1, 503, '2025-11-06 01:42:30.083+00', NULL)
ON CONFLICT (id) DO NOTHING;


--
-- Step 5: Seed symbols table (First 10)
--
INSERT INTO "public"."symbols" ("symbol", "company_name", "currency", "description", "exchange", "logo", "marketCapitalization", "current_price", "prev_close", "price_time", "day_change", "day_change_pct", "day_open", "day_high", "day_low") VALUES
	('BSX', 'Boston Scientific Corp', 'USD', 'Health Care', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/BSX.png', 146613.5100097005, 98.9, 98.84, '2025-11-05 21:00:00+00', 0.06, 0.0607, 98.38, 99.22, 97.725),
	('MO', 'Altria Group Inc', 'USD', 'Tobacco', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MO.png', 95952.86574164785, 57.16, 57.31, '2025-11-05 21:00:00+00', -0.15, -0.2617, 57.6, 58.17, 56.885),
	('BMY', 'Bristol-Myers Squibb Co', 'USD', 'Pharmaceuticals', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/BMY.png', 94601.44463153761, 46.47, 45.59, '2025-11-05 21:00:00+00', 0.88, 1.9302, 45.55, 46.63, 45.425),
	('BR', 'Broadridge Financial Solutions Inc', 'USD', 'Professional Services', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/BR.png', 25512.629586529838, 218.58, 222.86, '2025-11-05 21:00:00+00', -4.28, -1.9205, 221.35, 223.485, 217.93),
	('BF.B', 'Brown-Forman Corp', 'USD', 'Beverages', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/BF.B.png', 12760.598474509867, 27.07, 27.36, '2025-11-05 21:00:00+00', -0.29, -1.0599, 27.33, 27.57, 27.055),
	('AMZN', 'Amazon.com Inc', 'USD', 'Retail', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMZN.png', 2674692.0768162343, 250.2, 249.32, '2025-11-05 21:00:00+00', 0.88, 0.353, 249.03, 251, 246.16),
	('AEE', 'Ameren Corp', 'USD', 'Utilities', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AEE.png', 27387.1168822514, 101.28, 101.91, '2025-11-05 21:00:00+00', -0.63, -0.6182, 101.86, 102.36, 100.88),
	('AXP', 'American Express Co', 'USD', 'Financial Services', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AXP.png', 251981.91706288056, 365.8, 360.49, '2025-11-05 21:00:00+00', 5.31, 1.473, 359.69, 367.8151, 356.41),
	('AMT', 'American Tower Corp', 'USD', 'Real Estate', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/942959033886.png', 84430.248834, 179.43, 180.35, '2025-11-05 21:00:00+00', -0.92, -0.5101, 180.6, 182.03, 178.72),
	('AMP', 'Ameriprise Financial Inc', 'USD', 'Financial Services', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMP.png', 42650.223514765465, 459.07, 452, '2025-11-05 21:00:00+00', 7.07, 1.5642, 451.62, 462.51, 449.35);

--
-- Step 6: Seed transactions
--
INSERT INTO public.transactions
(user_id, symbol, side, quantity, price, executed_at)
VALUES
-- Alice's transactions
('00000000-0000-0000-0000-000000000001', 'AMZN', 'BUY', 10, 240.00, NOW() - interval '3 days'),
('00000000-0000-0000-0000-000000000001', 'AXP', 'BUY', 5, 350.00, NOW() - interval '2 days'),
-- Bob's transactions
('00000000-0000-0000-0000-000000000002', 'BMY', 'BUY', 100, 45.00, NOW() - interval '3 days'),
('00000000-0000-0000-0000-000000000002', 'BMY', 'BUY', 50, 46.00, NOW() - interval '2 days');

--
-- Step 7: Seed positions
-- This table reflects the *current state* calculated from the transactions above.
--
INSERT INTO public.positions
(user_id, symbol, quantity, average_cost, updated_at)
VALUES
-- Alice's positions
('00000000-0000-0000-0000-000000000001', 'AMZN', 10, 240.00, NOW() - interval '2 days'),
('00000000-0000-0000-0000-000000000001', 'AXP', 5, 350.00, NOW() - interval '2 days'),
-- Bob's position (150 shares @ avg cost of 45.333333)
('00000000-0000-0000-0000-000000000002', 'BMY', 150, 45.333333, NOW() - interval '2 days');

--
-- Step 8: Seed investment_history
-- This seeds *one* snapshot for "yesterday" (2025-11-04), based on the symbol's prev_close price.
--
INSERT INTO public.investment_history
(user_id, snapshot_date, total_worth, total_invested, unrealized_pnl)
VALUES
-- Alice's history snapshot for 2025-11-04
-- Total Invested: (10 * 240) + (5 * 350) = 4150
-- Total Worth: (10 * 249.32) + (5 * 360.49) = 2493.2 + 1802.45 = 4295.65
-- PNL: 4295.65 - 4150 = 145.65
('00000000-0000-0000-0000-000000000001', '2025-11-04', 4295.65, 4150.00, 145.65),

-- Bob's history snapshot for 2025-11-04
-- Total Invested: 150 * 45.333333 = 6800
-- Total Worth: 150 * 45.59 = 6838.5
-- PNL: 6838.5 - 6800 = 38.5
('00000000-0000-0000-0000-000000000002', '2025-11-04', 6838.50, 6800.00, 38.50);


--
-- Reset session replication role to default
--
SET session_replication_role = 'origin';