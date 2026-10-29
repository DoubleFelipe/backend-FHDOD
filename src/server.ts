import { buildApp } from './app.js';
import { config } from './config.js';
import { pool } from './infrastructure/database.js';

const app = buildApp();
try { await app.listen({ host: config.HOST, port: config.PORT }); }
catch (error) { app.log.error({ err: error }, 'server startup failed'); process.exitCode = 1; await pool.end(); }
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => { await app.close(); await pool.end(); process.exit(0); });
