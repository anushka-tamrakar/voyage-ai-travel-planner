-- =============================================================================
-- Personalized Travel Itinerary Planner - Supabase Database Schema
-- =============================================================================
-- Paste and run this script in your Supabase project's SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast user lookup by email
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (lower(email));

-- 2. TRIPS TABLE
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    destination VARCHAR(150) NOT NULL,
    origin VARCHAR(150),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    travel_style VARCHAR(50) NOT NULL,
    interests JSONB NOT NULL DEFAULT '[]'::jsonb,
    group_size INT NOT NULL DEFAULT 1,
    pace VARCHAR(20) NOT NULL DEFAULT 'moderate' CHECK (pace IN ('relaxed', 'moderate', 'fast')),
    budget_per_day VARCHAR(50) NOT NULL,
    total_budget NUMERIC,
    stay_budget_per_night NUMERIC,
    food_budget_per_meal NUMERIC,
    stay_type VARCHAR(50),
    diet VARCHAR(50),
    dietary_restrictions JSONB NOT NULL DEFAULT '[]'::jsonb,
    mobility_concerns TEXT,
    vibe VARCHAR(50) NOT NULL DEFAULT 'chill',
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Safe migration statements in case table was created with an earlier schema
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS origin VARCHAR(150);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS total_budget NUMERIC;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS stay_budget_per_night NUMERIC;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS food_budget_per_meal NUMERIC;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS stay_type VARCHAR(50);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS diet VARCHAR(50);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';

-- Indexes for trips query performance
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON public.trips (user_id);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON public.trips (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_destination ON public.trips (destination);

-- 3. ITINERARIES TABLE
CREATE TABLE IF NOT EXISTS public.itineraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    days JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for itineraries retrieval
CREATE INDEX IF NOT EXISTS idx_itineraries_trip_id ON public.itineraries (trip_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_created_at ON public.itineraries (created_at DESC);

-- =============================================================================
-- PERMISSIONS & ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- Grant table permissions to public roles used by FastAPI
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.trips TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.itineraries TO anon, authenticated, service_role;

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;

-- Permissive policies so backend requests via anon or service_role key are allowed
DROP POLICY IF EXISTS "service_role_full_access_users" ON public.users;
DROP POLICY IF EXISTS "allow_all_users" ON public.users;
CREATE POLICY "allow_all_users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_trips" ON public.trips;
DROP POLICY IF EXISTS "allow_all_trips" ON public.trips;
CREATE POLICY "allow_all_trips" ON public.trips FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_itineraries" ON public.itineraries;
DROP POLICY IF EXISTS "allow_all_itineraries" ON public.itineraries;
CREATE POLICY "allow_all_itineraries" ON public.itineraries FOR ALL USING (true) WITH CHECK (true);
