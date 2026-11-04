PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS license_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  code_hint TEXT NOT NULL,
  product_id TEXT NOT NULL,
  license_type TEXT NOT NULL CHECK (license_type IN ('trial','permanent')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  device_id TEXT,
  activated_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_codes_product ON license_codes(product_id);
CREATE INDEX IF NOT EXISTS idx_codes_device ON license_codes(device_id);

CREATE TABLE IF NOT EXISTS activation_events (
  id TEXT PRIMARY KEY,
  code_id TEXT,
  product_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_created ON activation_events(created_at);
