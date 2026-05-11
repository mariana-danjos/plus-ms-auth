import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../errors';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      next(
        new AppError(
          'Dados inválidos',
          400,
          'VALIDATION_ERROR',
          parsed.error.flatten().fieldErrors,
        ),
      );
      return;
    }

    req.body = parsed.data;
    next();
  };
}
