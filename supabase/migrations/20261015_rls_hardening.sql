-- ==============================================================================
-- NAVIGO SMART AIRPORT SYSTEM — ROW LEVEL SECURITY (RLS) PRODUCTION HARDENING
-- Migration: 20261015_rls_hardening.sql
--
-- Objective:
-- Ensure that direct client requests using the public anonymous Supabase key
-- (NEXT_PUBLIC_SUPABASE_ANON_KEY) cannot access, read, or modify another user's
-- personal data, bookings, biometric profiles, saved passengers, or credentials.
--
-- Safety Guarantees:
-- 1. Idempotent: Uses IF EXISTS / IF NOT EXISTS and DROP POLICY IF EXISTS before CREATE.
-- 2. Non-destructive: Does NOT drop tables, alter schemas, or delete data.
-- 3. Backward Compatible: Preserves public read for flight catalogs and seat availability.
-- ==============================================================================

-- 1. USERS TABLE
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (
    auth.uid() = id
    OR id::text = current_setting('request.jwt.claim.sub', true)
  );

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (
    auth.uid() = id
    OR id::text = current_setting('request.jwt.claim.sub', true)
  );

DROP POLICY IF EXISTS "Public registration insert" ON users;
CREATE POLICY "Public registration insert"
  ON users FOR INSERT
  WITH CHECK (true);

-- 2. FLIGHT CATALOG (PUBLIC READ-ONLY)
ALTER TABLE IF EXISTS flights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public flight catalog read" ON flights;
CREATE POLICY "Public flight catalog read"
  ON flights FOR SELECT
  USING (true);

ALTER TABLE IF EXISTS flight_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public flight instances read" ON flight_instances;
CREATE POLICY "Public flight instances read"
  ON flight_instances FOR SELECT
  USING (true);

ALTER TABLE IF EXISTS flight_instance_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public flight classes read" ON flight_instance_classes;
CREATE POLICY "Public flight classes read"
  ON flight_instance_classes FOR SELECT
  USING (true);

-- 3. BOOKINGS TABLE (OWNER-SCOPED)
ALTER TABLE IF EXISTS bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (
    auth.uid() = user_id
    OR user_id::text = current_setting('request.jwt.claim.sub', true)
  );

DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;
CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR user_id::text = current_setting('request.jwt.claim.sub', true)
  );

DROP POLICY IF EXISTS "Users can update own draft bookings" ON bookings;
CREATE POLICY "Users can update own draft bookings"
  ON bookings FOR UPDATE
  USING (
    (auth.uid() = user_id OR user_id::text = current_setting('request.jwt.claim.sub', true))
    AND status = 'draft'
  );

-- 4. BOOKING PASSENGERS
ALTER TABLE IF EXISTS booking_passengers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own booking passengers" ON booking_passengers;
CREATE POLICY "Users can view own booking passengers"
  ON booking_passengers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_passengers.booking_id
        AND (bookings.user_id = auth.uid() OR bookings.user_id::text = current_setting('request.jwt.claim.sub', true))
    )
  );

DROP POLICY IF EXISTS "Users can manage own booking passengers" ON booking_passengers;
CREATE POLICY "Users can manage own booking passengers"
  ON booking_passengers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_passengers.booking_id
        AND (bookings.user_id = auth.uid() OR bookings.user_id::text = current_setting('request.jwt.claim.sub', true))
        AND bookings.status = 'draft'
    )
  );

-- 5. SAVED PASSENGERS (HIGH PRIVACY)
ALTER TABLE IF EXISTS saved_passengers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own saved passengers" ON saved_passengers;
CREATE POLICY "Users view own saved passengers"
  ON saved_passengers FOR SELECT
  USING (
    auth.uid() = user_id
    OR user_id::text = current_setting('request.jwt.claim.sub', true)
  );

DROP POLICY IF EXISTS "Users manage own saved passengers" ON saved_passengers;
CREATE POLICY "Users manage own saved passengers"
  ON saved_passengers FOR ALL
  USING (
    auth.uid() = user_id
    OR user_id::text = current_setting('request.jwt.claim.sub', true)
  );

-- 6. BIOMETRIC PROFILES (CRITICAL PRIVACY)
ALTER TABLE IF EXISTS user_biometric_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own biometric profile" ON user_biometric_profiles;
CREATE POLICY "Users view own biometric profile"
  ON user_biometric_profiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR user_id::text = current_setting('request.jwt.claim.sub', true)
  );

DROP POLICY IF EXISTS "Users manage own biometric profile" ON user_biometric_profiles;
CREATE POLICY "Users manage own biometric profile"
  ON user_biometric_profiles FOR ALL
  USING (
    auth.uid() = user_id
    OR user_id::text = current_setting('request.jwt.claim.sub', true)
  );

-- 7. SMART CHECK-INS & BOARDING PASSES
ALTER TABLE IF EXISTS smart_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own smart checkins" ON smart_checkins;
CREATE POLICY "Users view own smart checkins"
  ON smart_checkins FOR SELECT
  USING (
    auth.uid() = user_id
    OR user_id::text = current_setting('request.jwt.claim.sub', true)
  );

DROP POLICY IF EXISTS "Users manage own smart checkins" ON smart_checkins;
CREATE POLICY "Users manage own smart checkins"
  ON smart_checkins FOR ALL
  USING (
    auth.uid() = user_id
    OR user_id::text = current_setting('request.jwt.claim.sub', true)
  );

-- 8. BOOKING SEATS
ALTER TABLE IF EXISTS booking_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read seat availability" ON booking_seats;
CREATE POLICY "Public read seat availability"
  ON booking_seats FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can lock seats for own draft booking" ON booking_seats;
CREATE POLICY "Users can lock seats for own draft booking"
  ON booking_seats FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_seats.booking_id
        AND (bookings.user_id = auth.uid() OR bookings.user_id::text = current_setting('request.jwt.claim.sub', true))
        AND bookings.status = 'draft'
    )
  );
