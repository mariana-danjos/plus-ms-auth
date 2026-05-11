import 'dotenv/config';
import { logger } from './logger';
import { createApp } from './app';

const PORT = process.env.PORT ?? 3001;
const app = createApp();

app.listen(PORT, () => logger.info({ port: PORT }, 'plus-ms-auth iniciado'));
