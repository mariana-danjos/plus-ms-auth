import 'dotenv/config';
import { pool } from '../db';
import { logger } from '../logger';

async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();

  const { rowCount: blocklist } = await pool.query(
    `DELETE FROM token_blocklist WHERE expires_at < $1`,
    [now],
  );

  const { rowCount: refresh } = await pool.query(
    `DELETE FROM refresh_tokens WHERE expires_at < $1`,
    [now],
  );

  logger.info(
    { blocklist, refresh, event: 'cleanup.done' },
    'Tokens expirados removidos',
  );
}

cleanupExpiredTokens()
  .then(() => pool.end())
  .catch((err) => {
    logger.error({ err }, 'Erro na limpeza de tokens');
    process.exit(1);
  });
