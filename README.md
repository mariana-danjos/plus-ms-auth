# plus-ms-auth

[![CI](https://github.com/mariana-danjos/plus-ms-auth/actions/workflows/ci.yml/badge.svg)](https://github.com/mariana-danjos/plus-ms-auth/actions/workflows/ci.yml)

Microsserviço de autenticação do projeto **Plus** — sistema de gestão de estoque de roupas.

Expõe uma API REST com JWT (access + refresh) para cadastro, login, refresh, logout e gerenciamento de roles (admin / vendedor / gestor). Persiste usuários, refresh tokens e blocklist em PostgreSQL, com documentação OpenAPI servida em `/api-docs`.

---

## Sumário

- [Stack](#stack)
- [Setup local](#setup-local)
- [Scripts npm](#scripts-npm)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Endpoints](#endpoints)
- [Schema do banco](#schema-do-banco)
- [Estrutura do código](#estrutura-do-código)
- [Segurança](#segurança)
- [Testes](#testes)
- [Lint](#lint)
- [CI/CD](#cicd)
- [Docker](#docker)
- [Executando com a stack completa](#executando-com-a-stack-completa)

---

## Stack

| Pacote | Versão | Finalidade |
|---|---|---|
| Node.js | 20 LTS | Runtime |
| TypeScript | 5.x | Tipagem (target ES2020, módulo CommonJS) |
| Express | 4.x | Framework HTTP |
| `jsonwebtoken` | 9.x | Access token (15 min) + Refresh token (7 dias), HS256 |
| `bcryptjs` | 2.x | Hash de senhas (12 rounds) |
| `pg` | 8.x | Cliente PostgreSQL (pool) |
| `zod` | 3.x | Validação de schemas |
| `express-rate-limit` | 7.x | Rate limiting por rota |
| `pino` | 9.x | Logger estruturado (JSON) |
| `cors` | 2.x | CORS middleware com whitelist |
| `swagger-jsdoc` + `swagger-ui-express` | — | OpenAPI 3.0 em `/api-docs` |
| `node-pg-migrate` | 7.x | Migrations SQL |
| Jest + Supertest | 30.x / 7.x | Testes de integração |
| ESLint 9 + typescript-eslint 8 | — | Lint (flat config) |

---

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env   # edite com seus valores

# 3. Aplicar migrations
npm run migrate:up

# 4. Subir em modo desenvolvimento
npm run dev
```

A API sobe em `http://localhost:3001` e a documentação Swagger em `http://localhost:3001/api-docs`.

> Para rodar isolado é necessário ter o PostgreSQL disponível na porta configurada em `.env`. Em ambiente completo, use `make setup` no `plus-infra`.

---

## Scripts npm

| Comando | Descrição |
|---|---|
| `npm run dev` | Dev server com `ts-node` (hot reload via nodemon) |
| `npm run build` | Compila TypeScript em `dist/` (`tsc`) |
| `npm start` | Executa o build compilado (`node dist/index.js`) |
| `npm test` | Roda Jest sequencial (`--runInBand`) |
| `npm run coverage` | Relatório de cobertura (threshold mínimo: 70%) |
| `npm run lint` | ESLint sobre `src/**/*.ts` |
| `npm run migrate:up` | Aplica migrations pendentes |
| `npm run migrate:down` | Reverte a última migration |
| `npm run migrate:status` | Lista o status das migrations |
| `npm run migrate:create` | Cria um novo arquivo de migration |
| `npm run cleanup:tokens` | Remove tokens expirados (`token_blocklist` e `refresh_tokens`) |

---

## Variáveis de ambiente

Copie `.env.example` e ajuste:

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta do servidor |
| `DATABASE_URL` | — | Connection string completa do PostgreSQL (precedência maior) |
| `DB_HOST` | `localhost` | Host do PostgreSQL |
| `DB_PORT` | `5432` | Porta do PostgreSQL |
| `DB_USER` | `plus` | Usuário do banco |
| `DB_PASSWORD` | `plus_secret` | Senha do banco |
| `DB_NAME` | `plus_auth` | Nome do banco |
| `JWT_ACCESS_SECRET` | `dev-access-secret` | Segredo para assinar o access token (mín. 32 chars em prod) |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret` | Segredo para assinar o refresh token (mín. 32 chars em prod) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Expiração do access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Expiração do refresh token |
| `AWS_ACCESS_KEY_ID` | `test` | Placeholder para LocalStack (não usado hoje) |
| `AWS_SECRET_ACCESS_KEY` | `test` | Placeholder |
| `AWS_DEFAULT_REGION` | `us-east-1` | Placeholder |
| `AWS_ENDPOINT` | `http://localhost:4566` | Placeholder |
| `LOG_LEVEL` | `info` | Nível do Pino (`debug` / `info` / `warn` / `error`) |
| `NODE_ENV` | — | Quando `test`, desabilita rate limiting |

---

## Endpoints

Todas as rotas são prefixadas com `/auth`. Documentação OpenAPI interativa em `/api-docs`.

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

### Resumo

| Método | Path | Auth | Role | Rate limit | Descrição |
|---|---|---|---|---|---|
| `POST` | `/auth/signup` | — | — | 5/min por IP | Cria conta |
| `POST` | `/auth/register` | — | — | 5/min por IP | Alias de `/signup` |
| `POST` | `/auth/login` | — | — | 10/min por e-mail | Autentica |
| `POST` | `/auth/refresh` | — | — | — | Renova access token |
| `POST` | `/auth/logout` | Bearer | — | — | Encerra sessão |
| `GET` | `/auth/me` | Bearer | — | — | Dados do usuário autenticado |
| `GET` | `/auth/roles` | — | — | — | Lista os papéis disponíveis |
| `POST` | `/auth/users/:userId/roles` | Bearer | admin | — | Atribui role a um usuário |
| `DELETE` | `/auth/users/:userId/roles/:roleId` | Bearer | admin | — | Remove role de um usuário |

### `POST /auth/signup` · `POST /auth/register`

**Body:**

```json
{
  "name": "string (2–100 caracteres)",
  "email": "string (e-mail válido)",
  "password": "string (mín. 8, letra + número + caractere especial)",
  "password_confirm": "string (deve ser igual a password)"
}
```

**201 Created:**

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

**Erros:** `400 VALIDATION_ERROR` · `409 EMAIL_ALREADY_EXISTS` · `429 RATE_LIMITED`

### `POST /auth/login`

**Body:**

```json
{
  "email": "string",
  "password": "string"
}
```

**200 OK:** mesmo payload de `signup`.

**Erros:** `400 VALIDATION_ERROR` · `401 INVALID_CREDENTIALS` · `429 RATE_LIMITED`

> Login usa um hash bcrypt dummy mesmo quando o e-mail não existe (proteção contra timing attack).

### `POST /auth/refresh`

Aceita o refresh token em qualquer um destes formatos:

```json
{ "refresh": "<refresh token>" }
```
```json
{ "refreshToken": "<refresh token>" }
```
```
Header: X-Refresh-Token: <refresh token>
```

**200 OK:** novo access token (o refresh token é reutilizado até expirar).

**Erros:** `400 VALIDATION_ERROR` · `401 REFRESH_TOKEN_INVALID` · `401 REFRESH_TOKEN_REVOKED`

### `POST /auth/logout`

**Header:** `Authorization: Bearer <access token>`

**200 OK:**

```json
{ "success": true }
```

Efeitos colaterais: o access token vai para o `token_blocklist` (até expirar) e todos os refresh tokens do usuário são deletados.

**Erros:** `401 TOKEN_MISSING` · `401 TOKEN_INVALID` · `401 TOKEN_REVOKED`

### `GET /auth/me`

**Header:** `Authorization: Bearer <access token>`

**200 OK:**

```json
{
  "id": "uuid",
  "email": "usuario@exemplo.com",
  "name": "Nome Completo",
  "roles": ["vendedor"]
}
```

### `GET /auth/roles`

**200 OK:**

```json
{ "roles": ["admin", "vendedor", "gestor"] }
```

### `POST /auth/users/:userId/roles` _(admin)_

**Header:** `Authorization: Bearer <token de admin>`

**Body:**

```json
{ "role": "admin | vendedor | gestor" }
```

**Erros:** `400 VALIDATION_ERROR` · `403 FORBIDDEN` · `404 USER_NOT_FOUND`

### `DELETE /auth/users/:userId/roles/:roleId` _(admin)_

**Resposta:** `204 No Content`

**Erros:** `400 VALIDATION_ERROR` · `400 DEFAULT_ROLE_REQUIRED` · `403 FORBIDDEN` · `404 USER_NOT_FOUND` · `404 ROLE_NOT_ASSIGNED`

---

## Schema do banco

### `users`

| Coluna | Tipo | Restrição |
|---|---|---|
| `id` | UUID | PK · default `gen_random_uuid()` |
| `name` | TEXT | NOT NULL · `length(trim) >= 2` |
| `email` | TEXT | NOT NULL · UNIQUE · regex de e-mail |
| `password_hash` | TEXT | NOT NULL |
| `role` | TEXT | NOT NULL · default `vendedor` · CHECK `IN (admin, vendedor, gestor)` |
| `created_at` | TIMESTAMPTZ | NOT NULL · default `NOW()` |
| `updated_at` | TIMESTAMPTZ | NOT NULL · trigger `set_updated_at()` |

Extensão usada: `pgcrypto` (para `gen_random_uuid()`).

### `refresh_tokens`

| Coluna | Tipo | Restrição |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id` (ON DELETE CASCADE) |
| `token` | TEXT | UNIQUE · SHA-256 do JWT |
| `expires_at` | TIMESTAMPTZ | NOT NULL · indexado |
| `created_at` | TIMESTAMPTZ | NOT NULL · default `NOW()` |

### `token_blocklist`

Access tokens invalidados (logout). Entradas com `expires_at` passado são removidas pelo script `cleanup:tokens`.

| Coluna | Tipo | Restrição |
|---|---|---|
| `id` | UUID | PK |
| `token` | TEXT | UNIQUE · SHA-256 do access token |
| `blocked_at` | TIMESTAMPTZ | NOT NULL · default `NOW()` · indexado |
| `expires_at` | TIMESTAMPTZ | NOT NULL · default `NOW() + 15 min` · indexado |

### Migrations

Em ordem cronológica em `migrations/`:

1. `1715000000000_create-users.ts` — extensão `pgcrypto`, tabela `users`, trigger `set_updated_at`
2. `1715000001000_create-refresh-tokens.ts` — tabela + índices
3. `1715000002000_create-token-blocklist.ts` — tabela + índice em `blocked_at`
4. `1715000003000_add-expires-at-to-token-blocklist.ts` — coluna `expires_at` + índice
5. `1715000004000_add-name-to-users.ts` — coluna `name` + constraint

---

## Estrutura do código

```
src/
├── index.ts               # Carrega .env, cria app, escuta em PORT
├── app.ts                 # Factory createApp(): CORS, JSON, Swagger, /auth, error handler
├── db.ts                  # Pool PostgreSQL singleton
├── logger.ts              # Logger Pino (nível por env)
├── errors.ts              # AppError + errorBody() padronizado
├── swagger.ts             # OpenAPI 3.0 spec
├── types/
│   └── express.d.ts       # Augment Request.user
├── security/
│   └── sanitize.ts        # Remove control chars + HTML escape
├── middleware/
│   ├── asyncHandler.ts             # Wrapper async → next(err)
│   ├── authenticateAccessToken.ts  # Bearer JWT + check blocklist
│   ├── errorHandler.ts             # Tratamento centralizado de erros
│   ├── notFoundHandler.ts          # 404 padronizado
│   ├── validateBody.ts             # Validação com Zod (body / params / query / headers)
│   └── requireRole.ts              # RBAC (token + role)
├── auth/
│   ├── auth.router.ts     # Router + rate limiters + validações
│   ├── auth.controller.ts # Handlers (req, res)
│   ├── auth.schema.ts     # Schemas Zod (signup, login, refresh, params)
│   └── auth.service.ts    # Lógica de negócio (bcrypt, JWT, DB)
└── scripts/
    └── cleanup-tokens.ts  # Remove tokens expirados (executável)
```

---

## Segurança

| Mecanismo | Detalhe |
|---|---|
| **JWT** | HS256. Access 15 min · Refresh 7 dias. Secrets em `.env`. |
| **Senhas** | `bcryptjs` 12 rounds. |
| **Timing attack** | Login sempre executa `bcrypt.compare` (dummy hash quando o e-mail não existe). |
| **Revogação** | Access tokens → `token_blocklist`. Refresh tokens → tabela própria, deletados no logout. |
| **Hash de tokens** | Refresh tokens e entradas da blocklist guardam SHA-256 (não o JWT cru). |
| **Sanitização** | `sanitizeText()` remove caracteres de controle (`0x00–0x1F`, `0x7F`) e faz HTML escape. |
| **Validação** | Zod em todos os inputs (body, params, headers, query). |
| **RBAC** | Middleware `requireRole(...)`. Roles: `admin`, `vendedor`, `gestor`. |
| **Rate limit** | Signup 5/min por IP, login 10/min por e-mail. Desabilitado em `NODE_ENV=test`. |
| **CORS** | Whitelist `http://localhost:3000`, `http://localhost:4001`. Credentials habilitado. |
| **Erros** | `AppError` padronizado, sem stack trace exposta. |

---

## Testes

Configuração em `jest.config.js`:

- Preset `ts-jest` (ambiente Node).
- `testMatch`: `**/src/**/*.test.ts`.
- Coverage threshold global de **70%** em branches, functions, lines e statements.
- Excludes do coverage: `index.ts`, `swagger.ts`, `scripts/**`, `types/**`.

Suite em `src/auth/auth.routes.test.ts` (~31 casos) cobre:

- Swagger UI disponível em `/api-docs`.
- Validação Zod (senha fraca, e-mail inválido, etc.).
- Signup com persistência e conflito de e-mail.
- Login com proteção contra timing attack.
- Refresh (válido, expirado, revogado).
- Logout (blocklist + cleanup de refresh tokens).
- `/auth/me` (autenticação obrigatória).
- Atribuição e remoção de roles (admin only · default role protegida).
- Rate limiting nos endpoints sensíveis.
- Revogação via blocklist.

```bash
npm run coverage   # gera relatório em coverage/
```

---

## Lint

ESLint 9.x com **flat config** (`eslint.config.mjs`).

Presets:

- `@eslint/js:recommended`
- `typescript-eslint:recommended`
- Globals: `node` + `jest`

Regras customizadas:

- `@typescript-eslint/no-unused-vars`: error, ignora identificadores prefixados com `_`.

Ignorados: `dist/`, `coverage/`, `node_modules/`, `migrations/`, `src/**/*.bak`, `src/index.js`.

```bash
npm run lint                       # lista warnings/errors
npm run lint -- --max-warnings 0   # mesmo comando do CI (falha em qualquer warning)
```

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`). Roda em **pull request** e **push em `main`**.

Pipeline:

```
lint  ─┐
test  ─┼─→ build ──→ docker
       │
(lint e test rodam em paralelo; build espera ambos; docker espera build)
```

| Job | Faz | Timeout |
|---|---|---|
| `lint` | `npm ci` → `npm run lint -- --max-warnings 0` | 10 min |
| `test` | `npm ci` → `npm run coverage` → upload de `coverage/` como artifact (7 dias) | 15 min |
| `build` | `npm ci` → `npm run build` | 10 min |
| `docker` | `docker/build-push-action@v7` com `push: false`, `load: true`, cache `type=gha` | 10 min |

Configurações:

- `concurrency: cancel-in-progress` por ref (cancela runs antigos no mesmo PR).
- `permissions: contents: read, actions: read` (least-privilege).
- Node 20 com cache `npm` baseado em `package-lock.json`.

### Rodando o pipeline localmente

```bash
npm ci
npm run lint -- --max-warnings 0
npm run coverage
npm run build
docker build -t plus-ms-auth:ci .
```

Ou com [`act`](https://github.com/nektos/act):

```bash
act pull_request
```

---

## Docker

`Dockerfile` multi-stage com Node 20 Alpine:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
```

Build local:

```bash
docker build -t plus-ms-auth:dev .
docker run -p 3001:3001 --env-file .env plus-ms-auth:dev
```

---

## Executando com a stack completa

Este serviço é orquestrado pelo `plus-infra` (Docker Compose + Terraform + LocalStack). Consulte o [README do plus-infra](https://github.com/mariana-danjos/plus-infra) para subir o ambiente completo (postgres + ministack + ms-auth + mfe-auth + shell).

```bash
cd ../plus-infra
make setup    # sobe a stack
make migrate  # aplica migrations
make init-db  # insere usuário de teste
```
