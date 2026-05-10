import * as jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token não fornecido' });
      return;
    }

    const secret =
      process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-access-secret';

    try {
      const payload = jwt.verify(auth.slice(7), secret) as JwtPayload;

      const userRole = payload.roles?.[0];
      if (!userRole || !allowedRoles.includes(userRole)) {
        res.status(403).json({ error: 'Acesso negado: permissão insuficiente' });
        return;
      }

      req.user = { id: payload.sub, email: payload.email, roles: payload.roles };
      next();
    } catch {
      res.status(401).json({ error: 'Token inválido ou expirado' });
    }
  };
}
