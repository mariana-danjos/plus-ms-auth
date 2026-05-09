import type { Request, Response } from 'express';
import { signupSchema } from './auth.schema';
import { signupService, AppError } from './auth.service';
import { logger } from '../logger';

export async function signupHandler(req: Request, res: Response): Promise<void> {
  const ip = req.ip ?? 'unknown';

  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Dados inválidos',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const result = await signupService(email, password);
    logger.info({ userId: result.userId, email, ip, event: 'signup.success' }, 'Usuário cadastrado');
    res.status(201).json(result);
  } catch (err: unknown) {
    if (err instanceof AppError && err.status === 409) {
      logger.warn({ email, ip, event: 'signup.duplicate' }, 'Tentativa de cadastro com email duplicado');
      res.status(409).json({ error: err.message });
      return;
    }
    logger.error({ err, ip, event: 'signup.error' }, 'Erro interno no cadastro');
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
