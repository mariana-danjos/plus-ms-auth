import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('token_blocklist', {
    expires_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func("NOW() + INTERVAL '15 minutes'"),
    },
  });

  pgm.createIndex('token_blocklist', 'expires_at', {
    name: 'idx_token_blocklist_expires_at',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('token_blocklist', 'expires_at', {
    name: 'idx_token_blocklist_expires_at',
  });
  pgm.dropColumn('token_blocklist', 'expires_at');
}
