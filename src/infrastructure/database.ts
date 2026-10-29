import { readFileSync } from 'node:fs';
import pg from 'pg';
import { config } from '../config.js';

const ssl = config.NODE_ENV === 'production'
  ? { ca: config.DATABASE_CA_CERT_PATH ? readFileSync(config.DATABASE_CA_CERT_PATH, 'utf8') : undefined, rejectUnauthorized: true }
  : undefined;

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: config.DATABASE_POOL_MAX, idleTimeoutMillis: config.DATABASE_IDLE_TIMEOUT_MS, connectionTimeoutMillis: config.DATABASE_CONNECTION_TIMEOUT_MS, statement_timeout: config.DATABASE_STATEMENT_TIMEOUT_MS, ssl });
