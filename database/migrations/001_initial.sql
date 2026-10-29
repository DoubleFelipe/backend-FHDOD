CREATE TYPE profile_role AS ENUM ('admin', 'sector_manager');
CREATE TYPE survey_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE question_kind AS ENUM ('rating', 'nps');
CREATE TYPE work_shift AS ENUM ('morning', 'afternoon', 'night');
CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'closed');

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, full_name varchar(150) NOT NULL,
  password_hash text NOT NULL, role profile_role NOT NULL, active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sector_managers (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  sector_id uuid NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
  PRIMARY KEY (profile_id, sector_id)
);
CREATE TABLE surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sector_id uuid NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
  title varchar(150) NOT NULL, status survey_status NOT NULL DEFAULT 'draft', published_at timestamptz,
  tablet_reset_seconds smallint NOT NULL DEFAULT 20 CHECK (tablet_reset_seconds BETWEEN 10 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX surveys_one_published_per_sector ON surveys(sector_id) WHERE status = 'published';
CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sector_id uuid REFERENCES sectors(id) ON DELETE RESTRICT,
  text varchar(300) NOT NULL, kind question_kind NOT NULL, required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true, position integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_active_sector_idx ON questions(sector_id, position) WHERE active;
CREATE TABLE responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE RESTRICT,
  nps smallint NOT NULL CHECK (nps BETWEEN 0 AND 10), shift work_shift NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_responses_survey_created ON responses(survey_id, created_at DESC);
CREATE INDEX idx_responses_created ON responses(created_at DESC);
CREATE TABLE answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), response_id uuid NOT NULL REFERENCES responses(id) ON DELETE RESTRICT,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  value smallint NOT NULL CHECK (value BETWEEN 1 AND 5), question_text varchar(300) NOT NULL,
  UNIQUE (response_id, question_id)
);
CREATE TABLE complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), response_id uuid NOT NULL UNIQUE REFERENCES responses(id) ON DELETE RESTRICT,
  comment varchar(2000), contact varchar(30), contact_consent boolean NOT NULL DEFAULT false,
  status complaint_status NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contact IS NULL OR contact_consent = true)
);
CREATE INDEX complaints_status_date_idx ON complaints(status, created_at DESC);
CREATE TABLE app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id), notification_emails text[] NOT NULL DEFAULT '{}',
  notifications_enabled boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE submission_keys (
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL, response_id uuid REFERENCES responses(id) ON DELETE RESTRICT,
  session_hash char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, submission_id)
);
CREATE INDEX idx_submission_keys_session_created ON submission_keys(session_hash, created_at DESC);
CREATE TABLE notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), complaint_id uuid NOT NULL UNIQUE REFERENCES complaints(id) ON DELETE RESTRICT,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0), locked_until timestamptz, delivered_at timestamptz,
  last_error varchar(200), created_at timestamptz NOT NULL DEFAULT now(), available_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_jobs_queue ON notification_jobs(available_at, created_at) WHERE delivered_at IS NULL;
CREATE TABLE refresh_sessions (
  jti uuid PRIMARY KEY, profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_sessions_profile_idx ON refresh_sessions(profile_id) WHERE revoked_at IS NULL;
