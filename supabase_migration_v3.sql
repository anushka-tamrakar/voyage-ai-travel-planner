-- Migration v3: Add total budget, origin, and comfort preferences to trips table
-- Additive columns with safe IF NOT EXISTS clauses

ALTER TABLE trips ADD COLUMN IF NOT EXISTS total_budget numeric;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS stay_budget_per_night numeric;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS food_budget_per_meal numeric;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS stay_type text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS diet text;

-- Add index on destination for faster popular lookup if needed
CREATE INDEX IF NOT EXISTS idx_trips_destination ON trips(destination);
