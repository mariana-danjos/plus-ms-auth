import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  pgm.createTable("users", {
    id: {
      type: "UUID",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
      notNull: true,
    },
    email: {
      type: "TEXT",
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: "TEXT",
      notNull: true,
    },
    role: {
      type: "TEXT",
      notNull: true,
      default: "vendedor",
    },
    created_at: {
      type: "TIMESTAMPTZ",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    updated_at: {
      type: "TIMESTAMPTZ",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.sql(`
    ALTER TABLE users
    ADD CONSTRAINT users_email_format
    CHECK (email ~* '^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$')
  `);

  pgm.sql(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'vendedor', 'gestor'))
  `);

  pgm.sql(`
    CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at()
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TRIGGER IF EXISTS users_updated_at ON users`);
  pgm.dropTable("users");
  pgm.sql(`DROP FUNCTION IF EXISTS set_updated_at()`);
  pgm.sql(`DROP EXTENSION IF EXISTS pgcrypto`);
}
