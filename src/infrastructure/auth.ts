import { SignJWT, jwtVerify } from 'jose';
import { randomUUID, createHash } from 'node:crypto';
import argon2 from 'argon2';
import { config } from '../config.js';
import { unauthorized } from '../domain/errors.js';

const accessKey = new TextEncoder().encode(config.ACCESS_TOKEN_SECRET);
const refreshKey = new TextEncoder().encode(config.REFRESH_TOKEN_SECRET);
export type Principal = { id: string; role: 'admin' | 'ombudsman' | 'sector_manager'; mustChangePassword: boolean };
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export async function issueTokens(user: Principal) {
  const accessToken = await new SignJWT({ role: user.role, mustChangePassword: user.mustChangePassword }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setJti(randomUUID()).setIssuedAt().setExpirationTime(`${config.ACCESS_TOKEN_TTL_SECONDS}s`).sign(accessKey);
  const refreshToken = await new SignJWT({ kind: 'refresh' }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setJti(randomUUID()).setIssuedAt().setExpirationTime(`${config.REFRESH_TOKEN_TTL_SECONDS}s`).sign(refreshKey);
  return { accessToken, refreshToken, refreshJti: (await jwtVerify(refreshToken, refreshKey)).payload.jti! };
}
export async function verifyAccess(token: string): Promise<Principal> {
  try {
    const { payload } = await jwtVerify(token, accessKey);
    if (!payload.sub || !['admin', 'ombudsman', 'sector_manager'].includes(String(payload.role))) throw unauthorized();
    return { id: payload.sub, role: payload.role as Principal['role'], mustChangePassword: payload.mustChangePassword === true };
  } catch { throw unauthorized(); }
}
export async function verifyRefresh(token: string) {
  try {
    const { payload } = await jwtVerify(token, refreshKey);
    if (payload.kind !== 'refresh' || !payload.sub || !payload.jti) throw unauthorized();
    return { userId: payload.sub, jti: payload.jti, expiresAt: new Date(Number(payload.exp) * 1000) };
  } catch { throw unauthorized(); }
}
