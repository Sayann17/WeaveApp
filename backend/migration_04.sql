-- Migration 04: Add Geolocation fields to users table (YQL Syntax)

-- STEP 1: Add columns
ALTER TABLE users ADD COLUMN latitude Double;
ALTER TABLE users ADD COLUMN longitude Double;
ALTER TABLE users ADD COLUMN city Utf8;
ALTER TABLE users ADD COLUMN last_location_updated_at Datetime;

-- STEP 2: Create Indexes
-- NOTE: YDB does NOT allow Double/Float types in indexes (Primary or Secondary keys).
-- We CANNOT create an index on latitude/longitude directly if they are Double.
-- For now, we will skip indexing coordinates. Performance will be fine for small datasets.

ALTER TABLE users ADD INDEX idx_users_city GLOBAL ON (city);
