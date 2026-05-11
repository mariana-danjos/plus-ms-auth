import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody, validateRequest, validateRequestSchema } from '../middleware/validateBody';
import { authenticateAccessToken } from '../middleware/authenticateAccessToken';
import { errorBody } from '../errors';
import {
  signupSchema,
  loginSchema,
  assignRoleSchema,
  refreshTokenRequestSchema,
  userIdParamsSchema,
  userRoleParamsSchema,
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

const isTestEnv = process.env.NODE_ENV === 'test';

const signupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: errorBody('RATE_LIMITED', 'Muitas tentativas de cadastro. Aguarde 1 minuto.'),
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  // Rate limit por email para bloquear ataques de força bruta por conta específica
  keyGenerator: (req: Request) => {
    const rawEmail = (req.body as { email?: unknown }).email;
    const email = typeof rawEmail === 'string' ? rawEmail : req.ip ?? 'unknown';
    return `login:${email.toLowerCase()}`;
  },
  message: errorBody('RATE_LIMITED', 'Muitas tentativas de login. Aguarde 1 minuto.'),
});

const router = Router();
const validateRefreshTokenRequest = validateRequestSchema(refreshTokenRequestSchema, (req, data) => {
  const currentBody =
    typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)
      ? req.body
      : {};
  req.body = { ...currentBody, refresh: data.refresh };
});

router.post('/signup', signupLimiter, validateBody(signupSchema), asyncHandler(signupHandler));
router.post('/register', signupLimiter, validateBody(signupSchema), asyncHandler(signupHandler));
router.post('/login', loginLimiter, validateBody(loginSchema), asyncHandler(loginHandler));
router.post('/refresh', validateRefreshTokenRequest, asyncHandler(refreshTokenHandler));
router.post('/logout', asyncHandler(logoutHandler));
router.get('/me', asyncHandler(authenticateAccessToken), meHandler);

router.get('/roles', listRolesHandler);
router.post(
  '/users/:userId/roles',
  asyncHandler(requireRole('admin')),
  validateRequest({ params: userIdParamsSchema, body: assignRoleSchema }),
  asyncHandler(assignRoleHandler),
);
router.delete(
  '/users/:userId/roles/:roleId',
  asyncHandler(requireRole('admin')),
  validateRequest({ params: userRoleParamsSchema }),
  asyncHandler(removeRoleHandler),
);

export default router;
