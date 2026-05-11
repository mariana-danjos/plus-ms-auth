import type { Request, Response } from 'express';
import { VALID_ROLES, type Role } from './auth.schema';
import {
  signupService,
  loginService,
  assignRoleService,
  removeRoleService,
  logoutService,
  refreshAccessTokenService,
} from './auth.service';
import { logger } from '../logger';
import { getBearerToken, verifyAccessToken } from '../middleware/authenticateAccessToken';

// Signup 

export async function signupHandler(req: Request, res: Response): Promise<void> {
  const ip = req.ip ?? 'unknown';
  const { email, password } = req.body as { email: string; password: string };
  const result = await signupService(email, password);

  logger.info({ userId: result.userId, email, ip, event: 'signup.success' }, 'Usuário cadastrado');
  res.status(201).json(result);
}

// Login 

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const ip = req.ip ?? 'unknown';
  const { email, password } = req.body as { email: string; password: string };
  const result = await loginService(email, password);

  logger.info({ userId: result.user.id, email, ip, event: 'login.success' }, 'Login realizado');
  res.json(result);
}

// Logout

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const token = getBearerToken(req);
  const payload = verifyAccessToken(token);

  await logoutService(token, payload);
  logger.info({ userId: payload.sub, event: 'logout.success' }, 'Logout realizado');
  res.json({ success: true });
}

export async function refreshTokenHandler(req: Request, res: Response): Promise<void> {
  const { refresh } = req.body as { refresh: string };
  const result = await refreshAccessTokenService(refresh);
  res.json(result);
}

export function meHandler(req: Request, res: Response): void {
  res.json(req.user);
}

// Roles

export function listRolesHandler(_req: Request, res: Response): void {
  res.json({ roles: VALID_ROLES });
}

export async function assignRoleHandler(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { role } = req.body as { role: string };

  const user = await assignRoleService(userId, role as Role);
  logger.info(
    { targetUserId: userId, role, adminId: req.user?.id, event: 'role.assigned' },
    'Role atribuída',
  );
  res.json({ message: 'Role atribuída com sucesso', user });
}

export async function removeRoleHandler(req: Request, res: Response): Promise<void> {
  const { userId, roleId } = req.params;
  await removeRoleService(userId, roleId);
  logger.info(
    { targetUserId: userId, roleId, adminId: req.user?.id, event: 'role.removed' },
    'Role removida',
  );
  res.status(204).send();
}
