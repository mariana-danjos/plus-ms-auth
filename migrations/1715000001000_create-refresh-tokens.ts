import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("refresh_tokens", {
    id: {
      type: "UUID",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
      notNull: true,
    },
    user_id: {
      type: "UUID",
      notNull: true,
      references: '"users"',
      onDelete: "CASCADE",
    },
    token: {
      type: "TEXT",
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: "TIMESTAMPTZ",
      notNull: true,
    },
    created_at: {
      type: "TIMESTAMPTZ",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.createIndex("refresh_tokens", "user_id", {
    name: "idx_refresh_tokens_user_id",
  });

  pgm.createIndex("refresh_tokens", "expires_at", {
    name: "idx_refresh_tokens_expires_at",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("refresh_tokens", "expires_at", {
    name: "idx_refresh_tokens_expires_at",
  });
  pgm.dropIndex("refresh_tokens", "user_id", {
    name: "idx_refresh_tokens_user_id",
  });
  pgm.dropTable("refresh_tokens");
}
