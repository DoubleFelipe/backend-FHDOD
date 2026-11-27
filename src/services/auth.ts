import { transaction } from '../utils/database.js';
import * as model from '../models/auth.js';
import { config } from '../config/index.js';
import {
  hashPassword,
  hashToken,
  issueTokens,
  verifyAccess,
  verifyPassword,
  verifyRefresh,
  type Principal,
} from '../infrastructure/auth.js';
import { AppError, unauthorized } from '../domain/errors.js';
import { type LoginInput, type PasswordInput } from '../validators/auth.js';

export async function authenticateToken(token: string): Promise<Principal> {
  const claims = await verifyAccess(token);
  const profile = (await model.findProfile([claims.id])).rows[0];
  if (!profile) throw unauthorized();
  return { id: profile.id, role: profile.role, mustChangePassword: profile.mustChangePassword };
}
export async function login(input: LoginInput) {
  const found = await model.findLoginProfile([input.email.toLowerCase()]);
  const user = found.rows[0];
  if (!user || !(await verifyPassword(user.password_hash, input.password)))
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  const principal = {
    id: user.id,
    role: user.role,
    mustChangePassword: user.must_change_password,
  };
  const tokens = await issueTokens(principal);
  await model.createSession([
    tokens.refreshJti,
    principal.id,
    hashToken(tokens.refreshToken),
    new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000),
  ]);
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
    mustChangePassword: principal.mustChangePassword,
  };
}

export async function refresh(refreshToken: string) {
  const token = await verifyRefresh(refreshToken);
  return transaction(async (client) => {
    const saved = await model.lockSession([token.jti, hashToken(refreshToken)], client);
    if (!saved.rowCount || saved.rows[0]!.id !== token.userId)
      throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    await model.revokeSession([token.jti], client);
    const principal = {
      id: saved.rows[0]!.id as string,
      role: saved.rows[0]!.role as Principal['role'],
      mustChangePassword: saved.rows[0]!.must_change_password as boolean,
    };
    const next = await issueTokens(principal);
    await model.createSession(
      [
        next.refreshJti,
        principal.id,
        hashToken(next.refreshToken),
        new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000),
      ],
      client,
    );
    return {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      tokenType: 'Bearer',
      expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
      mustChangePassword: principal.mustChangePassword,
    };
  });
}

export async function logout(refreshToken: string) {
  const token = await verifyRefresh(refreshToken);
  await model.revokeMatchingSession([token.jti, hashToken(refreshToken)]);
  return;
}

export async function changePassword(
  principal: Principal,
  { currentPassword, newPassword }: PasswordInput,
) {
  const result = await model.findPassword([principal.id]);
  if (
    !result.rowCount ||
    !(await verifyPassword(result.rows[0]!.password_hash as string, currentPassword))
  )
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  await model.updatePassword([principal.id, await hashPassword(newPassword)]);
  return;
}

export async function me(principal: Principal) {
  const result = await model.findProfile([principal.id]);
  if (!result.rowCount) throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
  return result.rows[0]!;
}
