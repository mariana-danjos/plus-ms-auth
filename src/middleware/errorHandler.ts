import type { ErrorRequestHandler } from 'express';
import { AppError, errorBody } from '../errors';
import { logger } from '../logger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    const level = err.status >= 500 ? 'error' : 'warn';
    logger[level](
      {
        err,
        code: err.code,
        status: err.status,
        method: req.method,
        path: req.path,
        event: 'http.error',
      },
      err.message,
    );
    res.status(err.status).json(errorBody(err.code, err.message, err.details));
    return;
  }

  if ((err as { type?: string }).type === 'entity.parse.failed') {
    logger.warn(
      {
        err,
        code: 'INVALID_JSON',
        status: 400,
        method: req.method,
        path: req.path,
        event: 'http.error',
      },
      'JSON inválido',
    );
    res.status(400).json(errorBody('INVALID_JSON', 'JSON inválido'));
    return;
  }

  logger.error(
    {
      err,
      method: req.method,
      path: req.path,
      event: 'http.error',
    },
    'Erro interno no servidor',
  );
  res
    .status(500)
    .json(errorBody('INTERNAL_SERVER_ERROR', 'Erro interno no servidor'));
};
