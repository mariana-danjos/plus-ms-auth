import crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db';
import { AppError } from '../errors';

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-access-secret';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  exp?: number;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getBearerToken(req: Request): string {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    throw new AppError('Token não fornecido', 401, 'TOKEN_MISSING');
  }

  return auth.slice(7);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw new AppError('Token inválido ou expirado', 401, 'TOKEN_INVALID');
  }
}

export async function assertTokenNotRevoked(token: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT 1
       FROM token_blocklist
      WHERE token IN ($1, $2)
        AND expires_at > NOW()`,
    [hashToken(token), token],
  );

  if (rows.length > 0) {
    throw new AppError('Token revogado', 401, 'TOKEN_REVOKED');
  }
}

export async function authenticateAccessToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = getBearerToken(req);
    const payload = verifyAccessToken(token);
    await assertTokenNotRevoked(token);

    req.user = { id: payload.sub, email: payload.email, roles: payload.roles };
    next();
  } catch (err) {
    next(err);
  }
}
