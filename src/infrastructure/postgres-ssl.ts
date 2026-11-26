import { readFileSync } from 'node:fs';
import { config } from '../config.js';

export function postgresSsl() {
  if (config.NODE_ENV !== 'production') return undefined;
  const ca = config.DATABASE_CA_CERT || (config.DATABASE_CA_CERT_PATH ? readFileSync(config.DATABASE_CA_CERT_PATH, 'utf8') : undefined);
  if (!ca) throw new Error('A PostgreSQL CA certificate is required in production');
  return { ca, rejectUnauthorized: true };
}

export function postgresConnectionOptions(connectionString: string) {
  const url = new URL(connectionString);
  for (const parameter of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslpassword']) url.searchParams.delete(parameter);
  return { connectionString: url.toString(), ssl: postgresSsl() };
}
