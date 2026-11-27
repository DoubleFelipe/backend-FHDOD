import pg from 'pg';
import { config } from './index.js';
import { postgresConnectionOptions } from './postgres-ssl.js';

export const pool = new pg.Pool({
  ...postgresConnectionOptions(config.DATABASE_URL),
  max: config.DATABASE_POOL_MAX,
  idleTimeoutMillis: config.DATABASE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: config.DATABASE_CONNECTION_TIMEOUT_MS,
  statement_timeout: config.DATABASE_STATEMENT_TIMEOUT_MS,
});
