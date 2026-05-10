import * as jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db';

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token não fornecido' });
      return;
    }

    const rawToken = auth.slice(7);
    const secret =
      process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-access-secret';

    let payload: JwtPayload;
    try {
      payload = jwt.verify(rawToken, secret) as JwtPayload;
    } catch {
      res.status(401).json({ error: 'Token inválido ou expirado' });
      return;
    }

    try {
      const { rows } = await pool.query(
        `SELECT 1 FROM token_blocklist WHERE token = $1`,
        [rawToken],
      );
      if (rows.length > 0) {
        res.status(401).json({ error: 'Token revogado' });
        return;
      }
    } catch {
      res.status(500).json({ error: 'Erro interno no servidor' });
      return;
    }

    const userRole = payload.roles?.[0];
    if (!userRole || !allowedRoles.includes(userRole)) {
      res
        .status(403)
        .json({ error: `Acesso negado: requer role ${allowedRoles.join(' ou ')}` });
      return;
    }

    req.user = { id: payload.sub, email: payload.email, roles: payload.roles };
    next();
  };
}
