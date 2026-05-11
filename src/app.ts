import express from 'express';
import swaggerUi from 'swagger-ui-express';
import authRouter from './auth/auth.router';
import { swaggerSpec } from './swagger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/auth', authRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
