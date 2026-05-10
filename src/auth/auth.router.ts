import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { requireRole } from '../middleware/requireRole';
import {
  signupHandler,
  loginHandler,
  logoutHandler,
  listRolesHandler,
  assignRoleHandler,
  removeRoleHandler,
} from './auth.controller';

const signupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Aguarde 1 minuto.' },
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Rate limit por email para bloquear ataques de força bruta por conta específica
  keyGenerator: (req: Request) => {
    const email = (req.body as { email?: string }).email ?? req.ip ?? 'unknown';
    return `login:${email.toLowerCase()}`;
  },
  message: { error: 'Muitas tentativas de login. Aguarde 1 minuto.' },
});

const router = Router();

router.post('/register', signupLimiter, signupHandler);
router.post('/login', loginLimiter, loginHandler);
router.post('/logout', logoutHandler);

router.get('/roles', listRolesHandler);
router.post('/users/:userId/roles', requireRole('admin'), assignRoleHandler);
router.delete('/users/:userId/roles/:roleId', requireRole('admin'), removeRoleHandler);

export default router;
