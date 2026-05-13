# Schema do Banco de Dados — MS Auth

## Tabelas

### users
Armazena os usuários do sistema.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Chave primária, gerado automaticamente |
| name | TEXT | Nome do usuário |
| email | TEXT | Email único do usuário |
| password_hash | TEXT | Senha hasheada com bcrypt (salt rounds: 12) |
| role | TEXT | Papel do usuário: admin, vendedor (padrão) ou gestor |
| created_at | TIMESTAMPTZ | Data de criação |
| updated_at | TIMESTAMPTZ | Data de atualização (atualizado automaticamente via trigger) |

**Constraints:** `users_email_format` (regex de email), `users_role_check` (valores permitidos), `users_name_length` (`length(trim(name)) >= 2`)

### refresh_tokens
Armazena os refresh tokens ativos por usuário.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Chave primária |
| user_id | UUID | FK para users (CASCADE DELETE) |
| token | TEXT | Hash SHA-256 do refresh JWT |
| expires_at | TIMESTAMPTZ | Data de expiração (7 dias) |
| created_at | TIMESTAMPTZ | Data de criação |

**Índices:** `idx_refresh_tokens_user_id`, `idx_refresh_tokens_expires_at`

### token_blocklist
Armazena access tokens revogados (logout/invalidação forçada).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Chave primária |
| token | TEXT | Hash SHA-256 do access JWT |
| blocked_at | TIMESTAMPTZ | Data de revogação |
| expires_at | TIMESTAMPTZ | Data de expiração (default `NOW() + 15 minutes`) |

**Índices:** `idx_token_blocklist_blocked_at`, `idx_token_blocklist_expires_at`

## Rodando as migrations

```bash
# Aplicar migrations
npm run migrate:up

# Reverter migrations
npm run migrate:down

# Ver status
npm run migrate:status
```
