import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("token_blocklist", {
    id: {
      type: "UUID",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
      notNull: true,
    },
    token: {
      type: "TEXT",
      notNull: true,
      unique: true,
    },
    blocked_at: {
      type: "TIMESTAMPTZ",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.createIndex("token_blocklist", "blocked_at", {
    name: "idx_token_blocklist_blocked_at",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("token_blocklist", "blocked_at", {
    name: "idx_token_blocklist_blocked_at",
  });
  pgm.dropTable("token_blocklist");
}
