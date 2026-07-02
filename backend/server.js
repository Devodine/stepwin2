require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!JWT_SECRET || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn(
    'Missing required env vars (JWT_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET). ' +
    'Set them in a .env file — see .env.example. Server will not work correctly without them.'
  );
}

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// ---------- auth middleware ----------

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Not authenticated' });
  }
}

// ---------- auth routes ----------

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'name, email and a password (min 6 chars) are required' });
  }
  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create account' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const result = await db.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

// ---------- challenges ----------

async function getChallengeSummary(challengeId) {
  const challengeRes = await db.query('SELECT * FROM challenges WHERE id = $1', [challengeId]);
  const challenge = challengeRes.rows[0];
  if (!challenge) return null;

  const statsRes = await db.query(
    `SELECT COUNT(*)::int AS participant_count, COALESCE(SUM(amount_paid), 0)::int AS prize_pool
     FROM participants WHERE challenge_id = $1 AND amount_paid IS NOT NULL`,
    [challengeId]
  );
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    entryFee: challenge.entry_fee,
    startDate: challenge.start_date,
    endDate: challenge.end_date,
    participantCount: statsRes.rows[0].participant_count,
    prizePool: statsRes.rows[0].prize_pool,
  };
}

async function getLeaderboard(challengeId) {
  const result = await db.query(
    `SELECT u.id AS user_id, u.name, COALESCE(SUM(s.count), 0)::int AS total_steps
     FROM participants p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN steps s ON s.participant_id = p.id
     WHERE p.challenge_id = $1 AND p.amount_paid IS NOT NULL
     GROUP BY u.id, u.name
     ORDER BY total_steps DESC`,
    [challengeId]
  );
  return result.rows.map((row, i) => ({
    rank: i + 1,
    userId: row.user_id,
    name: row.name,
    totalSteps: row.total_steps,
  }));
}

app.get('/api/challenges', async (req, res) => {
  const result = await db.query('SELECT id FROM challenges ORDER BY start_date');
  const summaries = await Promise.all(result.rows.map((r) => getChallengeSummary(r.id)));
  res.json(summaries);
});

app.get('/api/challenges/:id', async (req, res) => {
  const summary = await getChallengeSummary(req.params.id);
  if (!summary) return res.status(404).json({ error: 'Challenge not found' });
  const leaderboard = await getLeaderboard(req.params.id);
  res.json({ ...summary, leaderboard });
});

app.get('/api/challenges/:id/leaderboard', async (req, res) => {
  res.json(await getLeaderboard(req.params.id));
});

// ---------- join a challenge (real Razorpay flow) ----------

app.post('/api/challenges/:id/join/create-order', authMiddleware, async (req, res) => {
  const challengeId = req.params.id;
  try {
    const challengeRes = await db.query('SELECT * FROM challenges WHERE id = $1', [challengeId]);
    const challenge = challengeRes.rows[0];
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

    const existing = await db.query(
      'SELECT id FROM participants WHERE challenge_id = $1 AND user_id = $2',
      [challengeId, req.userId]
    );
    if (existing.rows.length) return res.status(409).json({ error: 'Already joined this challenge' });

    // Real Razorpay order — amount is in paise.
    const order = await razorpay.orders.create({
      amount: challenge.entry_fee * 100,
      currency: 'INR',
      receipt: `challenge_${challengeId}_user_${req.userId}`,
    });

    // Record the pending join. amount_paid stays NULL until payment is verified,
    // so pending/abandoned payments never count toward the prize pool or leaderboard.
    await db.query(
      `INSERT INTO participants (challenge_id, user_id, razorpay_order_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (challenge_id, user_id) DO UPDATE SET razorpay_order_id = EXCLUDED.razorpay_order_id`,
      [challengeId, req.userId, order.id]
    );

    res.json({
      orderId: order.id,
      amount: challenge.entry_fee,
      currency: 'INR',
      razorpayKeyId: RAZORPAY_KEY_ID, // public key — safe to expose to the frontend checkout widget
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create payment order' });
  }
});

app.post('/api/challenges/:id/join/verify', authMiddleware, async (req, res) => {
  const challengeId = req.params.id;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields' });
  }
  try {
    // Verify the signature Razorpay sends back — never trust the client's
    // word alone that a payment succeeded.
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const challengeRes = await db.query('SELECT entry_fee FROM challenges WHERE id = $1', [challengeId]);
    const challenge = challengeRes.rows[0];
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

    const result = await db.query(
      `UPDATE participants
       SET razorpay_payment_id = $1, amount_paid = $2, joined_at = now()
       WHERE challenge_id = $3 AND user_id = $4 AND razorpay_order_id = $5
       RETURNING id`,
      [razorpay_payment_id, challenge.entry_fee, challengeId, req.userId, razorpay_order_id]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: 'No matching pending order for this user/challenge' });
    }

    const summary = await getChallengeSummary(challengeId);
    res.json({ joined: true, challenge: summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not verify payment' });
  }
});

// ---------- steps ----------

app.post('/api/challenges/:id/steps', authMiddleware, async (req, res) => {
  const challengeId = req.params.id;
  const { date, count } = req.body;
  if (!date || typeof count !== 'number' || count < 0) {
    return res.status(400).json({ error: 'date and a non-negative count are required' });
  }
  try {
    const participantRes = await db.query(
      'SELECT id FROM participants WHERE challenge_id = $1 AND user_id = $2 AND amount_paid IS NOT NULL',
      [challengeId, req.userId]
    );
    const participant = participantRes.rows[0];
    if (!participant) return res.status(403).json({ error: 'Join (and pay for) the challenge before logging steps' });

    await db.query(
      `INSERT INTO steps (participant_id, log_date, count)
       VALUES ($1, $2, $3)
       ON CONFLICT (participant_id, log_date) DO UPDATE SET count = EXCLUDED.count`,
      [participant.id, date, count]
    );

    const leaderboard = await getLeaderboard(challengeId);
    const mine = leaderboard.find((row) => row.userId === req.userId);
    res.json({ totalSteps: mine ? mine.totalSteps : count, leaderboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not log steps' });
  }
});

app.get('/', (req, res) => res.send('StepWin API'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StepWin API running on port ${PORT}`));

module.exports = app;
