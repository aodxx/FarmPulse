PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  crop_type TEXT NOT NULL DEFAULT 'generic',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  area_rai REAL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_farms_active ON farms(is_active);

CREATE TABLE IF NOT EXISTS weather_snapshots (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'open-meteo',
  forecast_time TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  temperature_c REAL,
  humidity_percent REAL,
  precipitation_mm REAL,
  precipitation_probability_percent REAL,
  wind_speed_kmh REAL,
  weather_code INTEGER,
  raw_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_weather_farm_forecast ON weather_snapshots(farm_id, forecast_time DESC);
CREATE INDEX IF NOT EXISTS idx_weather_farm_fetched ON weather_snapshots(farm_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  weather_snapshot_id TEXT,
  activity_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('GOOD','CAUTION','NOT_RECOMMENDED','UNKNOWN')),
  reason_code TEXT,
  human_reason TEXT NOT NULL,
  metrics_json TEXT,
  rule_version TEXT NOT NULL,
  evaluated_for TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
  FOREIGN KEY (weather_snapshot_id) REFERENCES weather_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recommendations_farm_time ON recommendations(farm_id, evaluated_for DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_activity ON recommendations(farm_id, activity_type, evaluated_for DESC);

CREATE TABLE IF NOT EXISTS farm_tasks (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  task_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','DONE','SKIPPED','RESCHEDULED')),
  notes TEXT,
  estimated_cost REAL,
  rescheduled_from_task_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
  FOREIGN KEY (rescheduled_from_task_id) REFERENCES farm_tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_farm_date ON farm_tasks(farm_id, task_date DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status_date ON farm_tasks(status, task_date);

CREATE TABLE IF NOT EXISTS farm_logs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  task_id TEXT,
  activity_type TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT NOT NULL,
  result TEXT,
  notes TEXT,
  quantity REAL,
  unit TEXT,
  expense_amount REAL,
  weather_snapshot_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES farm_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (weather_snapshot_id) REFERENCES weather_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_farm_completed ON farm_logs(farm_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_activity ON farm_logs(farm_id, activity_type, completed_at DESC);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('farm','task','log')),
  entity_id TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL,
  file_name TEXT,
  size_bytes INTEGER,
  caption TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  farm_id TEXT,
  notification_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  transport TEXT NOT NULL DEFAULT 'ntfy',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED','SKIPPED')),
  sent_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status, created_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
