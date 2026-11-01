ALTER TYPE profile_role ADD VALUE IF NOT EXISTS 'ombudsman';

ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS attended_at timestamptz;
ALTER TABLE responses ALTER COLUMN shift DROP NOT NULL;

-- New submissions require attended_at in application validation. Existing rows remain NULL
-- because their historic appointment time cannot be reconstructed safely.

