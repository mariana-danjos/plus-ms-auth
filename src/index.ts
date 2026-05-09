import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import swaggerUi from 'swagger-ui-express';
import { pool } from './db';
import { logger } from './logger';
import authRouter from './auth/auth.router';
import { swaggerSpec } from './swagger';

const app = express();
app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'dev-refresh-secret';
const PORT = process.env.PORT ?? 3001;

// Rotas de autenticação (register)
app.use('/auth', authRouter);

// POST /auth/login — TODO: implementar com refresh_tokens e token_blocklist
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email e password são obrigatórios' });
    return;
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash as string))) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, roles: [user.role] },
      ACCESS_SECRET,
      { expiresIn: '15m' },
    );
    const refresh = jwt.sign({ sub: user.id }, REFRESH_SECRET, { expiresIn: '7d' });

    res.json({ token, refresh });
  } catch (err) {
    logger.error({ err, event: 'login.error' }, 'Erro no login');
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// POST /auth/refresh — TODO: validar contra refresh_tokens e token_blocklist
app.post('/auth/refresh', (req, res) => {
  const { refresh } = req.body as { refresh?: string };
  if (!refresh) {
    res.status(400).json({ error: 'refresh token obrigatório' });
    return;
  }

  try {
    const payload = jwt.verify(refresh, REFRESH_SECRET) as { sub: string };
    const token = jwt.sign({ sub: payload.sub }, ACCESS_SECRET, { expiresIn: '15m' });
    res.json({ token });
  } catch {
    res.status(401).json({ error: 'Refresh token inválido ou expirado' });
  }
});

// POST /auth/logout — TODO: adicionar token_blocklist e revogar refresh_token
app.post('/auth/logout', (_req, res) => {
  res.status(204).send();
});

// GET /auth/me — TODO: verificar token_blocklist
app.get('/auth/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  try {
    const payload = jwt.verify(auth.slice(7), ACCESS_SECRET) as {
      sub: string;
      email: string;
      roles: string[];
    };
    res.json({ id: payload.sub, email: payload.email, roles: payload.roles });
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
});

app.listen(PORT, () => logger.info({ port: PORT }, 'plus-ms-auth iniciado'));
