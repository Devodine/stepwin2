const { Pool } = require('pg');

// DATABASE_URL example: postgres://user:password@localhost:5432/stepwin
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres error', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
