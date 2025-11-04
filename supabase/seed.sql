SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict V5txF4w020IoMowqdPg6IzUChidw3IAv9m9uevpLFaGv9NZjceLejqxTqxlqLU6

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: symbol_refresh_state; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."symbol_refresh_state" ("id", "next_offset", "last_run", "last_error") VALUES
	(1, 0, '2025-11-04 16:29:39+00', '');


--
-- Data for Name: symbols; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."symbols" ("symbol", "company_name", "currency", "description", "exchange", "logo", "marketCapitalization") VALUES
	('MMM', '3M Co', 'USD', 'Industrial Conglomerates', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MMM.png', 86159.38998700002),
	('AOS', 'A O Smith Corp', 'USD', 'Building', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AOS.png', 9142.355317),
	('ABT', 'Abbott Laboratories', 'USD', 'Health Care', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ABT.png', 215341.895702),
	('MO', 'Altria Group Inc', 'USD', 'Tobacco', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MO.png', 95130.311329),
	('AMZN', 'Amazon.com Inc', 'USD', 'Retail', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMZN.png', 2715314.8183590006),
	('AMCR', 'Amcor PLC', 'USD', 'Packaging', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMCR.png', 18143.710753),
	('AEE', 'Ameren Corp', 'USD', 'Utilities', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AEE.png', 27457.422722999996),
	('AEP', 'American Electric Power Company Inc', 'USD', 'Utilities', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AEP.png', 64189.05277000001),
	('AXP', 'American Express Co', 'USD', 'Financial Services', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AXP.png', 249102.520739),
	('AIG', 'American International Group Inc', 'USD', 'Insurance', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AIG.png', 43744.143111),
	('AMT', 'American Tower Corp', 'USD', 'Real Estate', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/942959033886.png', 82693.421667),
	('AWK', 'American Water Works Co Inc', 'USD', 'Utilities', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AWK.png', 24579.715806),
	('AMP', 'Ameriprise Financial Inc', 'USD', 'Financial Services', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMP.png', 42028.68478000001),
	('AME', 'AMETEK Inc', 'USD', 'Electrical Equipment', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AME.png', 45743.813086),
	('AMGN', 'Amgen Inc', 'USD', 'Biotechnology', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMGN.png', 159516.61771399996),
	('APH', 'Amphenol Corp', 'USD', 'Electrical Equipment', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/APH.png', 173265.065705),
	('ADI', 'Analog Devices Inc', 'USD', 'Semiconductors', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ADI.png', 114925.71165199998),
	('AON', 'Aon PLC', 'USD', 'Insurance', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AON.png', 73043.60212300002),
	('APA', 'APA Corp (US)', 'USD', 'Energy', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/APA.png', 8046.617594999999),
	('APO', 'Apollo Global Management Inc', 'USD', 'Financial Services', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/APO.png', 71319.13664100002),
	('AAPL', 'Apple Inc', 'USD', 'Technology', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png', 3975577.470259),
	('AMAT', 'Applied Materials Inc', 'USD', 'Semiconductors', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMAT.png', 189369.883577),
	('ABBV', 'AbbVie Inc', 'USD', 'Biotechnology', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ABBV.png', 374439.69377),
	('ACN', 'Accenture PLC', 'USD', 'Technology', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ACN.png', 154067.298645),
	('ADBE', 'Adobe Inc', 'USD', 'Technology', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ADBE.png', 141264.944571),
	('AMD', 'Advanced Micro Devices Inc', 'USD', 'Semiconductors', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMD.png', 421371.369782),
	('AES', 'AES Corp', 'USD', 'Utilities', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AES.png', 9698.114933),
	('AFL', 'Aflac Inc', 'USD', 'Insurance', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AFL.png', 57210.924275),
	('A', 'Agilent Technologies Inc', 'USD', 'Life Sciences Tools & Services', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/A.png', 41019.67751),
	('APD', 'Air Products and Chemicals Inc', 'USD', 'Chemicals', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/APD.png', 53270.438124),
	('ABNB', 'Airbnb Inc', 'USD', 'Hotels, Restaurants & Leisure', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ABNB.png', 78798.045021),
	('AKAM', 'Akamai Technologies Inc', 'USD', 'Technology', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AKAM.png', 10686.523269),
	('ALB', 'Albemarle Corp', 'USD', 'Chemicals', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ALB.png', 11359.933089),
	('ARE', 'Alexandria Real Estate Equities Inc', 'USD', 'Real Estate', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/942959033376.png', 9624.627242),
	('ALGN', 'Align Technology Inc', 'USD', 'Health Care', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ALGN.png', 10041.536231),
	('ALLE', 'Allegion PLC', 'USD', 'Building', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ALLE.png', 14167.741209),
	('LNT', 'Alliant Energy Corp', 'USD', 'Utilities', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/LNT.png', 17086.352366),
	('ALL', 'Allstate Corp', 'USD', 'Insurance', 'NEW YORK STOCK EXCHANGE, INC.', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ALL.png', 50395.39638500001),
	('GOOGL', 'Alphabet Inc', 'USD', 'Media', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/GOOG.png', 3425812.021729),
	('GOOG', 'Alphabet Inc', 'USD', 'Media', 'NASDAQ NMS - GLOBAL MARKET', 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/GOOG.png', 3425812.021729);


--
-- PostgreSQL database dump complete
--

-- \unrestrict V5txF4w020IoMowqdPg6IzUChidw3IAv9m9uevpLFaGv9NZjceLejqxTqxlqLU6

RESET ALL;
