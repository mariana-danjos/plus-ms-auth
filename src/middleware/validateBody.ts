import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodSchema, ZodType, ZodTypeDef } from 'zod';
import { AppError } from '../errors';

type RequestSegment = 'body' | 'params' | 'query' | 'headers';
type RequestSchemas = Partial<Record<RequestSegment, ZodSchema>>;

function validationDetails(error: ZodError): Record<string, string[]> {
  return error.issues.reduce<Record<string, string[]>>((details, issue) => {
    const field = String(issue.path[issue.path.length - 1] ?? 'request');
    details[field] = [...(details[field] ?? []), issue.message];
    return details;
  }, {});
}

function validationError(error: ZodError): AppError {
  return new AppError('Dados inválidos', 400, 'VALIDATION_ERROR', validationDetails(error));
}

export function validateRequest(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const target = req as unknown as Record<RequestSegment, unknown>;

    for (const [segment, schema] of Object.entries(schemas) as [RequestSegment, ZodSchema][]) {
      const parsed = schema.safeParse(target[segment]);

      if (!parsed.success) {
        next(validationError(parsed.error));
        return;
      }

      if (segment !== 'headers') {
        target[segment] = parsed.data;
      }
    }

    next();
  };
}

export function validateRequestSchema<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  applyParsedData: (req: Request, data: T) => void,
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse({
      body: req.body,
      headers: req.headers,
      params: req.params,
      query: req.query,
    });

    if (!parsed.success) {
      next(validationError(parsed.error));
      return;
    }

    applyParsedData(req, parsed.data);
    next();
  };
}

export function validateBody(schema: ZodSchema) {
  return validateRequest({ body: schema });
}
