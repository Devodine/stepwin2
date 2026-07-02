-- StepWin schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  entry_fee INTEGER NOT NULL, -- in rupees
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT,
  amount_paid INTEGER, -- filled in once payment is verified
  joined_at TIMESTAMPTZ,
  UNIQUE (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS steps (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  UNIQUE (participant_id, log_date)
);

-- Seed a couple of real challenges (not fake users — no accounts are seeded).
INSERT INTO challenges (title, description, entry_fee, start_date, end_date)
SELECT '7-Day Step Sprint', 'Walk the most steps over 7 days and win the pool.', 59, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days'
WHERE NOT EXISTS (SELECT 1 FROM challenges WHERE title = '7-Day Step Sprint');

INSERT INTO challenges (title, description, entry_fee, start_date, end_date)
SELECT 'Weekend Warrior', 'A quick 2-day challenge, perfect for a weekend push.', 59, CURRENT_DATE, CURRENT_DATE + INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM challenges WHERE title = 'Weekend Warrior');
