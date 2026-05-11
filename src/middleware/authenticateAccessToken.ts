import crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db';
import { AppError } from '../errors';
import { authorizationHeaderValueSchema } from '../auth/auth.schema';

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-access-secret';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  exp?: number;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getBearerToken(req: Request): string {
  if (!req.headers.authorization) {
    throw new AppError('Token não fornecido', 401, 'TOKEN_MISSING');
  }

  const parsed = authorizationHeaderValueSchema.safeParse(req.headers.authorization);
  if (!parsed.success) {
    throw new AppError('Authorization header deve usar Bearer token', 401, 'TOKEN_INVALID');
  }

  return parsed.data.replace(/^Bearer\s+/, '');
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

    req.user = { id: payload.sub, email: payload.email, name: payload.name, roles: payload.roles };
    next();
  } catch (err) {
    next(err);
  }
}
