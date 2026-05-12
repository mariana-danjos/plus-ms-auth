import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import authRouter from './auth/auth.router';
import { swaggerSpec } from './swagger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4001',
];

export function createApp() {
  const app = express();

  app.use(cors({
    origin: DEV_ORIGINS,
    credentials: true,
  }));
  app.use(express.json());
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/auth', authRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
