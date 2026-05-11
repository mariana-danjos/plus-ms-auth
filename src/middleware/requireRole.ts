import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import {
  assertTokenNotRevoked,
  getBearerToken,
  verifyAccessToken,
} from './authenticateAccessToken';

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawToken = getBearerToken(req);
    const payload = verifyAccessToken(rawToken);
    await assertTokenNotRevoked(rawToken);

    const userRole = payload.roles?.[0];
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new AppError(
        `Acesso negado: requer role ${allowedRoles.join(' ou ')}`,
        403,
        'FORBIDDEN',
      );
    }

    req.user = { id: payload.sub, email: payload.email, name: payload.name, roles: payload.roles };
    next();
  };
}
