
import pg from 'pg';
import { DEFAULT_STEPS } from './releaseLogic.js';

const { Pool } = pg;

export { DEFAULT_STEPS };

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://releasecheck:releasecheck_dev@localhost:5433/releasecheck',
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export { mapRelease } from './releaseMapping.js';

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS releases (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      due_date TIMESTAMPTZ NOT NULL,
      additional_info TEXT NOT NULL DEFAULT '',
      completed_steps INTEGER[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log('Database initialized successfully');
}
