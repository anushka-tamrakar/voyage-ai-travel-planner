-- =============================================================================
-- Migration V2: Add language and currency columns to trips table
-- =============================================================================

ALTER TABLE public.trips 
    ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR';

-- Note: The public.itineraries.days JSONB column accommodates the extended schema
-- (exact place names, coordinates, and recommendations) without requiring schema alteration.
