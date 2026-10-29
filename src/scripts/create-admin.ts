import { z } from 'zod';
import { hashPassword } from '../infrastructure/auth.js';
import { pool } from '../infrastructure/database.js';

const input = z.object({ ADMIN_EMAIL: z.string().email().max(254), ADMIN_FULL_NAME: z.string().min(1).max(150), ADMIN_PASSWORD: z.string().min(12).max(200) }).safeParse(process.env);
if (!input.success) throw new Error('Set ADMIN_EMAIL, ADMIN_FULL_NAME, and an ADMIN_PASSWORD of at least 12 characters');
try {
  await pool.query('INSERT INTO profiles (email, full_name, password_hash, role, must_change_password) VALUES ($1, $2, $3, $4, false)', [input.data.ADMIN_EMAIL.toLowerCase(), input.data.ADMIN_FULL_NAME, await hashPassword(input.data.ADMIN_PASSWORD), 'admin']);
  console.info('Administrator account created.');
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw new Error('An account with that email already exists.');
  throw new Error('Administrator provisioning failed. Check the database connection and migration state.');
} finally { await pool.end(); }
