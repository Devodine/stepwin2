# StepWin

Step-count challenges with a real entry fee (₹59) and a winner-takes-the-pool
prize. No mock users, no stubbed payments — this version is wired to real
Postgres and real Razorpay.

## Structure

```
backend/    Express API — Postgres + Razorpay + bcrypt + JWT
frontend/   HTML/CSS/JS client using Razorpay Checkout
```

## Setup

### 1. Database
Create a Postgres database, then apply the schema:
```
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
npm install
npm run migrate
```
`schema.sql` only seeds two **challenges** (title/dates) — no user accounts.
Every user is a real signup.

### 2. Razorpay
1. Create a Razorpay account and complete business KYC — required before you
   can accept live payments. Ask their support directly whether real-money
   step-challenges fall under a restricted category for your account type;
   this varies and is worth confirming before launch.
2. Grab your Key ID and Key Secret from Settings → API Keys and put them in `.env`.
3. Start in **test mode** (Razorpay gives you test keys + test cards/UPI) until
   you've verified the full flow end to end, then switch to live keys.

### 3. Run it
```
cd backend
npm start
```
Then open `frontend/index.html` in a browser (or serve it statically).

## What's real now

- Signup/login: real Postgres users, bcrypt-hashed passwords, JWT sessions
- Join flow: real Razorpay order → real Checkout widget → signature verified
  server-side before the join (and the money) is recorded
- Prize pool: calculated only from `amount_paid IS NOT NULL`, so unpaid/
  abandoned checkouts never inflate it
- Leaderboard & step logging: backed by real Postgres tables, scoped per user

## Before you launch to the public

- Confirm your Razorpay account is cleared for this category of app.
- Add rate limiting and input validation hardening on the auth endpoints.
- Add HTTPS (Razorpay requires it for live mode) and set secure CORS origins
  instead of the open `cors()` default.
- Decide how disputes/refunds/no-shows are handled — write that policy before
  you take the first real payment, not after.
