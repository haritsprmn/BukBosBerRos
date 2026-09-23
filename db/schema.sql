-- Isolated namespace: existing tables in this database are not changed.
BEGIN;
CREATE SCHEMA IF NOT EXISTS duitku;
CREATE TABLE IF NOT EXISTS duitku.users (
  id uuid PRIMARY KEY,
  name varchar(80) NOT NULL,
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS duitku.sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES duitku.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON duitku.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON duitku.sessions(expires_at);
CREATE TABLE IF NOT EXISTS duitku.transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES duitku.users(id) ON DELETE CASCADE,
  type varchar(10) NOT NULL CHECK (type IN ('income','expense')),
  title varchar(100) NOT NULL,
  amount numeric(14,0) NOT NULL CHECK (amount > 0 AND amount <= 10000000000),
  category varchar(40) NOT NULL,
  date date NOT NULL,
  note varchar(500) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON duitku.transactions(user_id,date DESC,created_at DESC);
CREATE TABLE IF NOT EXISTS duitku.auth_attempts (
  key char(64) PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL
);
COMMIT;
