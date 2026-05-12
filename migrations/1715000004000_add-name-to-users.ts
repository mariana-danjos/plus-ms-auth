import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("users", {
    name: { type: "TEXT", notNull: true },
  });

  pgm.sql(`
    ALTER TABLE users
    ADD CONSTRAINT users_name_length
    CHECK (char_length(trim(name)) >= 2)
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_length`);
  pgm.dropColumn("users", "name");
}
