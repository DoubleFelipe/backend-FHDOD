import { pool } from '../config/database.js';
export const ping = () => pool.query('SELECT 1');
