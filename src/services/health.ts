import { ping } from '../models/health.js';
export async function isReady() {
  try {
    await ping();
    return true;
  } catch {
    return false;
  }
}
