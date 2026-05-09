import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db';

const BCRYPT_ROUNDS = 12;

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'dev-refresh-secret';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

interface User {
  id: string;
  email: string;
  role: string;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export async function signupService(
  email: string,
  password: string,
): Promise<{ token: string; refresh: string; userId: string }> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user: User;
  try {
    const { rows } = await pool.query<User>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role`,
      [email, passwordHash],
    );
    user = rows[0];
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      throw new AppError('Email já cadastrado', 409);
    }
    throw err;
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, roles: [user.role] },
    ACCESS_SECRET,
    { expiresIn: 900 },
  );

  const refresh = jwt.sign(
    { sub: user.id },
    REFRESH_SECRET,
    { expiresIn: 604800 },
  );

  const tokenHash = crypto.createHash('sha256').update(refresh).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt],
  );

  return { token, refresh, userId: user.id };
}
