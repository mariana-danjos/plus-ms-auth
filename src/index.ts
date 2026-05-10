import 'dotenv/config';
import express from 'express';
import * as jwt from 'jsonwebtoken';
import swaggerUi from 'swagger-ui-express';
import { logger } from './logger';
import authRouter from './auth/auth.router';
import { swaggerSpec } from './swagger';

const app = express();
app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'dev-refresh-secret';
const PORT = process.env.PORT ?? 3001;

app.use('/auth', authRouter);

// POST /auth/refresh — TODO: validar contra refresh_tokens e token_blocklist
app.post('/auth/refresh', (req, res) => {
  const { refresh } = req.body as { refresh?: string };
  if (!refresh) {
    res.status(400).json({ error: 'refresh token obrigatório' });
    return;
  }

  try {
    const payload = jwt.verify(refresh, REFRESH_SECRET) as { sub: string };
    const token = jwt.sign({ sub: payload.sub }, ACCESS_SECRET, { expiresIn: 900 });
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
