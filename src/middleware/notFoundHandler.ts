import type { RequestHandler } from 'express';
import { AppError } from '../errors';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('Rota não encontrada', 404, 'ROUTE_NOT_FOUND'));
};
