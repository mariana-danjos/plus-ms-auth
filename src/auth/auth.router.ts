import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signupHandler } from './auth.controller';

const signupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Aguarde 1 minuto.' },
});

const router = Router();

router.post('/register', signupLimiter, signupHandler);

export default router;
