PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
    CHECK (length(name) BETWEEN 1 AND 60),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS fuel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL REFERENCES cars(id),
  event_date TEXT NOT NULL
    CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  odometer_km INTEGER NOT NULL CHECK (odometer_km >= 0),
  liters_milliliters INTEGER NOT NULL CHECK (liters_milliliters > 0),
  price_huf INTEGER NOT NULL
    CHECK (typeof(price_huf) = 'integer' AND price_huf >= 0),
  full_tank INTEGER NOT NULL CHECK (full_tank IN (0, 1)),
  remark TEXT CHECK (remark IS NULL OR length(remark) <= 500)
);

CREATE TABLE IF NOT EXISTS adblue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL REFERENCES cars(id),
  event_date TEXT NOT NULL
    CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  odometer_km INTEGER NOT NULL CHECK (odometer_km >= 0),
  liters_milliliters INTEGER NOT NULL CHECK (liters_milliliters > 0),
  price_huf INTEGER NOT NULL
    CHECK (typeof(price_huf) = 'integer' AND price_huf >= 0)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL REFERENCES cars(id),
  event_date TEXT NOT NULL
    CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  amount_huf INTEGER NOT NULL
    CHECK (typeof(amount_huf) = 'integer' AND amount_huf >= 0),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_fuel_car_event_date
  ON fuel(car_id, event_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_adblue_car_event_date
  ON adblue(car_id, event_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_car_event_date
  ON expenses(car_id, event_date DESC, id DESC);
