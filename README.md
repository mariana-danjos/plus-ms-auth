# plus-ms-auth

Microsserviço de autenticação do projeto **Plus**.

Expõe uma API REST com JWT para cadastro, login, refresh, logout e gerenciamento de roles. Persiste usuários em PostgreSQL (provisionado pelo `plus-infra`).

---

## Tecnologias

| Pacote | Finalidade |
|---|---|
| Node.js + TypeScript | Runtime e tipagem |
| Express 4 | Framework HTTP |
| `jsonwebtoken` | Access token (15 min) + Refresh token (7 dias) |
| `bcryptjs` | Hash de senhas |
| `pg` | Cliente PostgreSQL |
| `zod` | Validação de schemas |
| `express-rate-limit` | Rate limiting por rota |
| `pino` | Logger estruturado |
| `node-pg-migrate` | Migrations de banco |
| Jest + Supertest | Testes de integração |

---

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env   # edite com seus valores

# 3. Rodar migrations
npm run migrate:up

# 4. Subir em modo desenvolvimento
npm run dev
```

> Para rodar isolado é necessário ter o PostgreSQL disponível na porta configurada em `.env`.
> Em ambiente completo, use `make setup` no `plus-infra`.

### Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Dev server com `ts-node` |
| `npm run build` | Compila TypeScript em `dist/` |
| `npm start` | Executa o build compilado |
| `npm test` | Testes em modo watch |
| `npm run coverage` | Relatório de cobertura |
| `npm run migrate:up` | Aplica migrations pendentes |
| `npm run migrate:down` | Reverte a última migration |
| `npm run migrate:status` | Lista o status das migrations |
| `npm run migrate:create` | Cria um novo arquivo de migration |
| `npm run cleanup:tokens` | Remove tokens expirados do banco |

---

## Variáveis de ambiente

Copie `.env.example` e ajuste conforme necessário:

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta do servidor |
| `DATABASE_URL` | — | Connection string completa do PostgreSQL |
| `DB_HOST` | `localhost` | Host do PostgreSQL (alternativa ao `DATABASE_URL`) |
| `DB_PORT` | `5432` | Porta do PostgreSQL |
| `DB_USER` | `plus` | Usuário do banco |
| `DB_PASSWORD` | `plus_secret` | Senha do banco |
| `DB_NAME` | `plus_auth` | Nome do banco |
| `JWT_ACCESS_SECRET` | `change-me-min-32-chars` | Segredo para assinar o access token |
| `JWT_REFRESH_SECRET` | `change-me-min-32-chars` | Segredo para assinar o refresh token |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Expiração do access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Expiração do refresh token |
| `AWS_ACCESS_KEY_ID` | `test` | Chave de acesso AWS / LocalStack |
| `AWS_SECRET_ACCESS_KEY` | `test` | Segredo de acesso AWS / LocalStack |
| `AWS_DEFAULT_REGION` | `us-east-1` | Região AWS |
| `AWS_ENDPOINT` | `http://localhost:4566` | Endpoint do LocalStack |
| `LOG_LEVEL` | `info` | Nível de log do Pino (`debug`, `info`, `warn`, `error`) |

---

## Endpoints

Todas as rotas são prefixadas com `/auth`.

### Formato de erro padrão

```json
{
  "error": {
    "code": "CODIGO_DO_ERRO",
    "message": "Descrição legível",
    "details": {}
  }
}
```

---

### `POST /auth/signup` · `POST /auth/register`

Cria uma nova conta. As duas rotas são equivalentes.

**Rate limit:** 5 requisições / minuto por IP.

**Body:**

```json
{
  "name": "string (2–100 caracteres)",
  "email": "string (e-mail válido)",
  "password": "string (mín. 8 chars, precisa ter letra, número e caractere especial)",
  "password_confirm": "string (deve ser igual a password)"
}
```

**Resposta 201:**

```json
{
  "token": "<access token JWT>",
  "refreshToken": "<refresh token JWT>",
  "user": {
    "id": "uuid",
    "email": "usuario@exemplo.com",
    "name": "Nome Completo",
    "roles": ["vendedor"]
  }
}
```

**Erros:** `400 VALIDATION_ERROR` · `409 EMAIL_ALREADY_EXISTS`

---

### `POST /auth/login`

Autentica um usuário existente.

**Rate limit:** 10 requisições / minuto por e-mail.

**Body:**

```json
{
  "email": "string",
  "password": "string"
}
```

**Resposta 200:**

```json
{
  "token": "<access token JWT>",
  "refreshToken": "<refresh token JWT>",
  "user": {
    "id": "uuid",
    "email": "usuario@exemplo.com",
    "name": "Nome Completo",
    "roles": ["vendedor"]
  }
}
```

**Erros:** `400 VALIDATION_ERROR` · `401 INVALID_CREDENTIALS` · `429 RATE_LIMITED`

---

### `POST /auth/refresh`

Troca um refresh token válido por um novo access token.

**Body** (aceita qualquer um dos formatos abaixo):

```json
{ "refresh": "<refresh token>" }
```
```json
{ "refreshToken": "<refresh token>" }
```
```
Header: X-Refresh-Token: <refresh token>
```

**Resposta 200:**

```json
{
  "token": "<novo access token JWT>",
  "refreshToken": "<mesmo refresh token>",
  "user": {
    "id": "uuid",
    "email": "usuario@exemplo.com",
    "name": "Nome Completo",
    "roles": ["vendedor"]
  }
}
```

**Erros:** `400 VALIDATION_ERROR` · `401 REFRESH_TOKEN_INVALID` · `401 REFRESH_TOKEN_REVOKED`

---

### `POST /auth/logout`

Encerra a sessão adicionando o access token à blocklist.

**Header:** `Authorization: Bearer <access token>`

**Resposta 200:**

```json
{ "success": true }
```

**Erros:** `401 TOKEN_MISSING` · `401 TOKEN_INVALID` · `401 TOKEN_REVOKED`

---

### `GET /auth/me`

Retorna os dados do usuário autenticado.

**Header:** `Authorization: Bearer <access token>`

**Resposta 200:**

```json
{
  "id": "uuid",
  "email": "usuario@exemplo.com",
  "name": "Nome Completo",
  "roles": ["vendedor"]
}
```

**Erros:** `401 TOKEN_MISSING` · `401 TOKEN_INVALID` · `401 TOKEN_REVOKED`

---

### `GET /auth/roles`

Lista os perfis disponíveis no sistema. Não requer autenticação.

**Resposta 200:**

```json
{ "roles": ["admin", "vendedor", "gestor"] }
```

---

### `POST /auth/users/:userId/roles` _(admin)_

Atribui um perfil a um usuário.

**Header:** `Authorization: Bearer <access token de admin>`

**Params:** `userId` — UUID do usuário.

**Body:**

```json
{ "role": "admin | vendedor | gestor" }
```

**Resposta 200:**

```json
{
  "message": "Role atribuída com sucesso",
  "user": {
    "id": "uuid",
    "email": "usuario@exemplo.com",
    "name": "Nome Completo",
    "roles": ["gestor"]
  }
}
```

**Erros:** `400 VALIDATION_ERROR` · `403 FORBIDDEN` · `404 USER_NOT_FOUND`

---

### `DELETE /auth/users/:userId/roles/:roleId` _(admin)_

Remove um perfil de um usuário.

**Header:** `Authorization: Bearer <access token de admin>`

**Params:** `userId` — UUID do usuário · `roleId` — role a remover (`admin | vendedor | gestor`).

**Resposta:** `204 No Content`

**Erros:** `400 VALIDATION_ERROR` · `400 DEFAULT_ROLE_REQUIRED` · `403 FORBIDDEN` · `404 USER_NOT_FOUND` · `404 ROLE_NOT_ASSIGNED`

---

## Schema do banco de dados

### `users`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID | Chave primária (auto-gerada) |
| `name` | TEXT | Nome completo (mín. 2 chars após trim) |
| `email` | TEXT | E-mail único |
| `password_hash` | TEXT | Senha hasheada com bcrypt |
| `role` | TEXT | `vendedor` (padrão) · `gestor` · `admin` |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Atualizado automaticamente via trigger |

### `refresh_tokens`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID | Chave primária |
| `user_id` | UUID | FK → `users` (CASCADE delete) |
| `token` | TEXT | Valor do refresh token (único) |
| `expires_at` | TIMESTAMPTZ | Data de expiração |
| `created_at` | TIMESTAMPTZ | Data de criação |

### `token_blocklist`

Tokens de acesso invalidados (logout). Entradas com `expires_at` expirado são removidas pelo script `cleanup:tokens`.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID | Chave primária |
| `token` | TEXT | Hash SHA-256 do token bloqueado |
| `blocked_at` | TIMESTAMPTZ | Data do bloqueio |
| `expires_at` | TIMESTAMPTZ | Expiração do bloqueio (padrão: NOW() + 15 min) |

---

## Executando com a stack completa

Este serviço é orquestrado pelo `plus-infra`. Consulte o [README do plus-infra](https://github.com/pucrs-sweii-2026-1-30/plus-infra).
