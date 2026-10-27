-- =============================================================================
-- Personalized Travel Itinerary Planner - Supabase Database Schema
-- =============================================================================

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
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    travel_style VARCHAR(50) NOT NULL,
    interests JSONB NOT NULL DEFAULT '[]'::jsonb,
    group_size INT NOT NULL DEFAULT 1,
    pace VARCHAR(20) NOT NULL DEFAULT 'moderate' CHECK (pace IN ('relaxed', 'moderate', 'fast')),
    budget_per_day VARCHAR(50) NOT NULL,
    dietary_restrictions JSONB NOT NULL DEFAULT '[]'::jsonb,
    mobility_concerns TEXT,
    vibe VARCHAR(50) NOT NULL DEFAULT 'chill',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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
-- ROW LEVEL SECURITY (RLS) POLICIES & NOTES
-- =============================================================================
-- In this architecture, all database operations are secured and mediated through
-- the FastAPI backend service via Supabase service_role or API keys.
-- The backend enforces user authentication (JWT) and ownership checks.
--
-- To enable RLS for additional defense-in-depth:

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;

-- Allow full access to service_role (used by backend)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_access_users'
    ) THEN
        CREATE POLICY service_role_full_access_users ON public.users
            FOR ALL USING (auth.role() = 'service_role' OR current_user = 'postgres');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_access_trips'
    ) THEN
        CREATE POLICY service_role_full_access_trips ON public.trips
            FOR ALL USING (auth.role() = 'service_role' OR current_user = 'postgres');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_access_itineraries'
    ) THEN
        CREATE POLICY service_role_full_access_itineraries ON public.itineraries
            FOR ALL USING (auth.role() = 'service_role' OR current_user = 'postgres');
    END IF;
END $$;
