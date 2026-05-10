import type { Request, Response } from 'express';
import { signupSchema, loginSchema, assignRoleSchema, VALID_ROLES } from './auth.schema';
import { signupService, loginService, assignRoleService, removeRoleService, logoutService, AppError } from './auth.service';
import { logger } from '../logger';

// Signup 

export async function signupHandler(req: Request, res: Response): Promise<void> {
  const ip = req.ip ?? 'unknown';

  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors });
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

// Login 

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const ip = req.ip ?? 'unknown';

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const result = await loginService(email, password);
    logger.info({ userId: result.user.id, email, ip, event: 'login.success' }, 'Login realizado');
    res.json(result);
  } catch (err: unknown) {
    if (err instanceof AppError && err.status === 401) {
      logger.warn({ email, ip, event: 'login.failed' }, 'Tentativa de login com credenciais inválidas');
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }
    logger.error({ err, ip, event: 'login.error' }, 'Erro interno no login');
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
}

// Logout

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }
  const token = auth.slice(7);
  try {
    await logoutService(token);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, event: 'logout.error' }, 'Erro no logout');
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
}

// Roles

export function listRolesHandler(_req: Request, res: Response): void {
  res.json({ roles: VALID_ROLES });
}

export async function assignRoleHandler(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const parsed = assignRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = await assignRoleService(userId, parsed.data.role);
    logger.info(
      { targetUserId: userId, role: parsed.data.role, adminId: req.user?.id, event: 'role.assigned' },
      'Role atribuída',
    );
    res.json({ message: 'Role atribuída com sucesso', user });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err, userId, event: 'role.assign.error' }, 'Erro ao atribuir role');
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
}

export async function removeRoleHandler(req: Request, res: Response): Promise<void> {
  const { userId, roleId } = req.params;

  try {
    await removeRoleService(userId, roleId);
    logger.info(
      { targetUserId: userId, roleId, adminId: req.user?.id, event: 'role.removed' },
      'Role removida',
    );
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err, userId, roleId, event: 'role.remove.error' }, 'Erro ao remover role');
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
