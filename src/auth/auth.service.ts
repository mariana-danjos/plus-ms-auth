import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db';
import { VALID_ROLES, type Role } from './auth.schema';
import { AppError } from '../errors';
import { hashToken, type AccessTokenPayload } from '../middleware/authenticateAccessToken';

const BCRYPT_ROUNDS = 12;
const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-access-secret';
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'dev-refresh-secret';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

// Dummy hash usado quando o usuário não existe — evita timing attack que revelaria
// se um email está cadastrado pela diferença de tempo de resposta
const DUMMY_HASH = '$2b$12$invalidhashtopreventtimingattacksonlogin00000000000000';

interface DbUser {
  id: string;
  email: string;
  role: string;
  password_hash: string;
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildTokens(userId: string, email: string, role: string) {
  const token = jwt.sign(
    { sub: userId, email, roles: [role] },
    ACCESS_SECRET,
    { expiresIn: 900 },
  );
  const refresh = jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: 604800 });
  return { token, refresh };
}

async function persistRefreshToken(userId: string, refresh: string): Promise<void> {
  const tokenHash = hashRefreshToken(refresh);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

// ── Signup ─────────────────────────────────────────────────────────────────

export async function signupService(
  email: string,
  password: string,
): Promise<{ token: string; refresh: string; userId: string }> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user: DbUser;
  try {
    const { rows } = await pool.query<DbUser>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role, password_hash`,
      [email, passwordHash],
    );
    user = rows[0];
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      throw new AppError('Email já cadastrado', 409, 'EMAIL_ALREADY_EXISTS');
    }
    throw err;
  }

  const { token, refresh } = buildTokens(user.id, user.email, user.role);
  await persistRefreshToken(user.id, refresh);

  return { token, refresh, userId: user.id };
}

// ── Login ──────────────────────────────────────────────────────────────────

export async function loginService(
  email: string,
  password: string,
): Promise<{ token: string; refresh: string; user: { id: string; email: string; roles: string[] } }> {
  const { rows } = await pool.query<DbUser>(
    `SELECT id, email, role, password_hash FROM users WHERE email = $1`,
    [email],
  );

  const dbUser = rows[0];
  // Sempre chama bcrypt.compare mesmo quando o usuário não existe (dummy hash)
  // para garantir tempo de resposta constante e não vazar se o email está cadastrado
  const passwordMatch = await bcrypt.compare(password, dbUser?.password_hash ?? DUMMY_HASH);

  if (!dbUser || !passwordMatch) {
    throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
  }

  const { token, refresh } = buildTokens(dbUser.id, dbUser.email, dbUser.role);
  await persistRefreshToken(dbUser.id, refresh);

  return {
    token,
    refresh,
    user: { id: dbUser.id, email: dbUser.email, roles: [dbUser.role] },
  };
}

// ── Role management ────────────────────────────────────────────────────────

export async function assignRoleService(
  userId: string,
  role: Role,
): Promise<{ id: string; email: string; roles: string[] }> {
  let rows: DbUser[];
  let rowCount: number | null;

  try {
    ({ rows, rowCount } = await pool.query<DbUser>(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role, password_hash`,
      [role, userId],
    ));
  } catch (err: unknown) {
    // 22P02 = invalid_text_representation (UUID malformado)
    if ((err as { code?: string }).code === '22P02') {
      throw new AppError('ID de usuário inválido', 400, 'INVALID_USER_ID');
    }
    throw err;
  }

  if (!rowCount) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  const user = rows[0];
  return { id: user.id, email: user.email, roles: [user.role] };
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function refreshAccessTokenService(refresh: string): Promise<{ token: string }> {
  let payload: { sub: string };
  try {
    payload = jwt.verify(refresh, REFRESH_SECRET) as { sub: string };
  } catch {
    throw new AppError('Refresh token inválido ou expirado', 401, 'REFRESH_TOKEN_INVALID');
  }

  const tokenHash = hashRefreshToken(refresh);
  const { rows } = await pool.query<Pick<DbUser, 'id' | 'email' | 'role'>>(
    `SELECT users.id, users.email, users.role
       FROM refresh_tokens
       INNER JOIN users ON users.id = refresh_tokens.user_id
      WHERE refresh_tokens.token = $1
        AND refresh_tokens.user_id = $2
        AND refresh_tokens.expires_at > NOW()`,
    [tokenHash, payload.sub],
  );

  const user = rows[0];
  if (!user) {
    throw new AppError('Refresh token revogado ou expirado', 401, 'REFRESH_TOKEN_REVOKED');
  }

  return {
    token: jwt.sign(
      { sub: user.id, email: user.email, roles: [user.role] },
      ACCESS_SECRET,
      { expiresIn: 900 },
    ),
  };
}

export async function logoutService(
  token: string,
  payload: AccessTokenPayload,
): Promise<void> {
  const expiresAt = payload.exp
    ? new Date(payload.exp * 1000)
    : new Date(Date.now() + 900_000);

  await pool.query(
    `INSERT INTO token_blocklist (token, expires_at) VALUES ($1, $2) ON CONFLICT (token) DO NOTHING`,
    [hashToken(token), expiresAt],
  );

  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [payload.sub]);
}

export async function removeRoleService(userId: string, roleId: string): Promise<void> {
  if (!VALID_ROLES.includes(roleId as Role)) {
    throw new AppError(
      `Role inválida. Valores aceitos: ${VALID_ROLES.join(', ')}`,
      400,
      'INVALID_ROLE',
    );
  }

  let rows: DbUser[];
  let rowCount: number | null;

  try {
    ({ rows, rowCount } = await pool.query<DbUser>(
      `SELECT id, role FROM users WHERE id = $1`,
      [userId],
    ));
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '22P02') {
      throw new AppError('ID de usuário inválido', 400, 'INVALID_USER_ID');
    }
    throw err;
  }

  if (!rowCount) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  const user = rows[0];

  if (user.role !== roleId) {
    throw new AppError('Usuário não possui essa role', 404, 'ROLE_NOT_ASSIGNED');
  }

  const DEFAULT_ROLE: Role = 'vendedor';
  if (roleId === DEFAULT_ROLE) {
    throw new AppError('Não é possível remover a role padrão', 400, 'DEFAULT_ROLE_REQUIRED');
  }

  await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [DEFAULT_ROLE, userId]);
}
