import request from 'supertest';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../app';
import { pool } from '../db';
import { hashToken } from '../middleware/authenticateAccessToken';

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-access-secret';
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'dev-refresh-secret';

const app = createApp();
const user = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'vendedor@loja.com',
  role: 'vendedor',
  password_hash: bcrypt.hashSync('Senha@123', 12),
};
const admin = {
  id: '6b264e7a-a61b-4c43-976e-13551cb263e8',
  email: 'admin@loja.com',
  role: 'admin',
};

const queryMock = jest.spyOn(pool, 'query') as jest.Mock;
type QueryMockCall = [string, unknown[]?];

function accessToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: [user.role],
      ...overrides,
    },
    ACCESS_SECRET,
    { expiresIn: 900 },
  );
}

function refreshToken(sub = user.id) {
  return jwt.sign({ sub }, REFRESH_SECRET, { expiresIn: 604800 });
}

function expiredAccessToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: [user.role],
      ...overrides,
    },
    ACCESS_SECRET,
    { expiresIn: -1 },
  );
}

function expiredRefreshToken(sub = user.id) {
  return jwt.sign({ sub }, REFRESH_SECRET, { expiresIn: -1 });
}

function mockDb(
  handler: (sql: string, params: unknown[]) => Promise<unknown> | unknown,
) {
  queryMock.mockImplementation(async (...args: unknown[]) => {
    const [queryText, rawParams] = args;
    const params = Array.isArray(rawParams) ? rawParams : [];
    const sql =
      typeof queryText === 'string'
        ? queryText
        : JSON.stringify(queryText);
    return handler(sql, params);
  });
}

beforeEach(() => {
  queryMock.mockReset();
});

afterAll(async () => {
  queryMock.mockRestore();
  await pool.end();
});

describe('MS Auth endpoints e middlewares', () => {
  it('serve Swagger UI em /api-docs', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Swagger UI');
  });

  it('valida schema do signup com resposta padronizada', async () => {
    const res = await request(app).post('/auth/signup').send({ email: 'invalido' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.password).toContain('Senha é obrigatória');
  });

  it('rejeita signup com senha fraca', async () => {
    const res = await request(app).post('/auth/signup').send({
      email: 'novo@loja.com',
      password: '123',
      password_confirm: '123',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.password).toEqual(
      expect.arrayContaining([
        'Senha deve ter no mínimo 8 caracteres',
        'Senha deve conter pelo menos 1 letra',
        'Senha deve conter pelo menos 1 caractere especial',
      ]),
    );
  });

  it('cadastra usuário e persiste refresh token com prepared statements', async () => {
    mockDb((sql) => {
      if (sql.includes('INSERT INTO users')) {
        return { rows: [user], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO refresh_tokens')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app).post('/auth/signup').send({
      email: ' VENDEDOR@LOJA.COM ',
      password: 'Senha@123',
      password_confirm: 'Senha@123',
    });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(user.id);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.refresh).toEqual(expect.any(String));
    expect(queryMock.mock.calls[0][0]).toContain('VALUES ($1, $2)');
  });

  it('retorna conflito quando email já existe', async () => {
    mockDb((sql) => {
      if (sql.includes('INSERT INTO users')) {
        return Promise.reject({ code: '23505' });
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app).post('/auth/signup').send({
      email: 'vendedor@loja.com',
      password: 'Senha@123',
      password_confirm: 'Senha@123',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('realiza login e emite access/refresh tokens', async () => {
    mockDb((sql) => {
      if (sql.includes('SELECT id, email, role, password_hash FROM users')) {
        return { rows: [user], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO refresh_tokens')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app).post('/auth/login').send({
      email: 'vendedor@loja.com',
      password: 'Senha@123',
    });

    expect(res.status).toBe(200);
    expect(res.body.user.roles).toEqual(['vendedor']);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.refresh).toEqual(expect.any(String));
  });

  it('nega login quando email não existe sem revelar se email está cadastrado', async () => {
    mockDb(() => ({ rows: [], rowCount: 0 }));

    const res = await request(app).post('/auth/login').send({
      email: 'ninguem@loja.com',
      password: 'Senha@123',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('nega login com senha errada', async () => {
    mockDb((sql) => {
      if (sql.includes('SELECT id, email, role, password_hash FROM users')) {
        return { rows: [user], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app).post('/auth/login').send({
      email: user.email,
      password: 'SenhaErrada@123',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('renova access token com refresh token ativo', async () => {
    const refresh = refreshToken();
    mockDb((sql) => {
      if (sql.includes('FROM refresh_tokens')) {
        return { rows: [user], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app).post('/auth/refresh').send({ refresh });
    const payload = jwt.decode(res.body.token) as { email: string; roles: string[] };

    expect(res.status).toBe(200);
    expect(payload.email).toBe(user.email);
    expect(payload.roles).toEqual(['vendedor']);
  });

  it('retorna 401 para refresh token revogado', async () => {
    mockDb(() => ({ rows: [], rowCount: 0 }));

    const res = await request(app).post('/auth/refresh').send({ refresh: refreshToken() });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_REVOKED');
  });

  it('retorna 401 para refresh token expirado', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh: expiredRefreshToken() });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('retorna 401 para refresh token inválido', async () => {
    const res = await request(app).post('/auth/refresh').send({ refresh: 'token-invalido' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('retorna dados do usuário autenticado em /auth/me', async () => {
    mockDb((sql) => {
      if (sql.includes('FROM token_blocklist')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: user.id,
      email: user.email,
      roles: ['vendedor'],
    });
  });

  it('retorna 401 em /auth/me sem token', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });

  it('retorna 401 em /auth/me com token expirado', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredAccessToken()}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('retorna 401 em /auth/me com token revogado', async () => {
    mockDb((sql) => {
      if (sql.includes('FROM token_blocklist')) {
        return { rows: [{ exists: 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('logout inclui access token na blacklist usando hash e remove refresh tokens', async () => {
    const token = accessToken();
    mockDb(() => ({ rows: [], rowCount: 1 }));

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const insertCall = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO token_blocklist'),
    ) as QueryMockCall | undefined;
    expect(insertCall?.[1]?.[0]).toBe(hashToken(token));
    expect(String(queryMock.mock.calls.at(-1)?.[0])).toContain('DELETE FROM refresh_tokens');
  });

  it('logout continua idempotente quando token já estava revogado', async () => {
    const token = accessToken();
    mockDb((sql) => {
      if (sql.includes('INSERT INTO token_blocklist')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('DELETE FROM refresh_tokens')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('lista roles disponíveis', async () => {
    const res = await request(app).get('/auth/roles');

    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(['admin', 'vendedor', 'gestor']);
  });

  it('atribui role quando token possui permissão admin', async () => {
    mockDb((sql) => {
      if (sql.includes('FROM token_blocklist')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('UPDATE users SET role')) {
        return { rows: [{ ...user, role: 'gestor' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post(`/auth/users/${user.id}/roles`)
      .set(
        'Authorization',
        `Bearer ${accessToken({ sub: admin.id, email: admin.email, roles: ['admin'] })}`,
      )
      .send({ role: 'gestor' });

    expect(res.status).toBe(200);
    expect(res.body.user.roles).toEqual(['gestor']);
  });

  it('nega atribuição de role para vendedor', async () => {
    mockDb((sql) => {
      if (sql.includes('FROM token_blocklist')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post(`/auth/users/${user.id}/roles`)
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ role: 'gestor' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('valida role inválida antes de atualizar usuário', async () => {
    mockDb((sql) => {
      if (sql.includes('FROM token_blocklist')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post(`/auth/users/${user.id}/roles`)
      .set(
        'Authorization',
        `Bearer ${accessToken({ sub: admin.id, email: admin.email, roles: ['admin'] })}`,
      )
      .send({ role: 'dono' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('remove role e volta usuário para vendedor', async () => {
    mockDb((sql) => {
      if (sql.includes('FROM token_blocklist')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('SELECT id, role FROM users')) {
        return { rows: [{ id: user.id, role: 'gestor' }], rowCount: 1 };
      }
      if (sql.includes('UPDATE users SET role')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .delete(`/auth/users/${user.id}/roles/gestor`)
      .set(
        'Authorization',
        `Bearer ${accessToken({ sub: admin.id, email: admin.email, roles: ['admin'] })}`,
      );

    expect(res.status).toBe(204);
  });

  it('bloqueia remoção da role padrão', async () => {
    mockDb((sql) => {
      if (sql.includes('FROM token_blocklist')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('SELECT id, role FROM users')) {
        return { rows: [{ id: user.id, role: 'vendedor' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .delete(`/auth/users/${user.id}/roles/vendedor`)
      .set(
        'Authorization',
        `Bearer ${accessToken({ sub: admin.id, email: admin.email, roles: ['admin'] })}`,
      );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DEFAULT_ROLE_REQUIRED');
  });

  it('padroniza erros de JSON inválido e rota inexistente', async () => {
    const badJson = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    const notFound = await request(app).get('/auth/rota-inexistente');

    expect(badJson.status).toBe(400);
    expect(badJson.body.error.code).toBe('INVALID_JSON');
    expect(notFound.status).toBe(404);
    expect(notFound.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
