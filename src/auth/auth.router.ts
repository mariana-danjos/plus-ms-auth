import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateBody';
import { authenticateAccessToken } from '../middleware/authenticateAccessToken';
import { errorBody } from '../errors';
import {
  signupSchema,
  loginSchema,
  assignRoleSchema,
  refreshTokenSchema,
} from './auth.schema';
import {
  signupHandler,
  loginHandler,
  logoutHandler,
  refreshTokenHandler,
  meHandler,
  listRolesHandler,
  assignRoleHandler,
  removeRoleHandler,
} from './auth.controller';

const signupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorBody('RATE_LIMITED', 'Muitas tentativas de cadastro. Aguarde 1 minuto.'),
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
  message: errorBody('RATE_LIMITED', 'Muitas tentativas de login. Aguarde 1 minuto.'),
});

const router = Router();

router.post('/register', signupLimiter, validateBody(signupSchema), asyncHandler(signupHandler));
router.post('/login', loginLimiter, validateBody(loginSchema), asyncHandler(loginHandler));
router.post('/refresh', validateBody(refreshTokenSchema), asyncHandler(refreshTokenHandler));
router.post('/logout', asyncHandler(logoutHandler));
router.get('/me', asyncHandler(authenticateAccessToken), meHandler);

router.get('/roles', listRolesHandler);
router.post(
  '/users/:userId/roles',
  asyncHandler(requireRole('admin')),
  validateBody(assignRoleSchema),
  asyncHandler(assignRoleHandler),
);
router.delete(
  '/users/:userId/roles/:roleId',
  asyncHandler(requireRole('admin')),
  asyncHandler(removeRoleHandler),
);

export default router;
