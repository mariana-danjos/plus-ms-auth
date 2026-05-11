import swaggerJSDoc from 'swagger-jsdoc';
import type { Options } from 'swagger-jsdoc';
import type { OpenAPIV3 } from 'openapi-types';

const errorExample = (code: string, message: string, details?: unknown) => ({
  error: {
    code,
    message,
    ...(details === undefined ? {} : { details }),
  },
});

const authTokenExample =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.exemplo.assinatura';

const swaggerDefinition: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Plus MS Auth',
    version: '1.0.0',
    description: 'Microsserviço de autenticação do sistema de gestão de estoque plus size.',
  },
  servers: [{ url: 'http://localhost:3001', description: 'Desenvolvimento local' }],
  tags: [
    { name: 'Auth', description: 'Operações de autenticação e sessão' },
    { name: 'RBAC', description: 'Operações de controle de acesso por perfil' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    parameters: {
      AuthorizationHeader: {
        name: 'Authorization',
        in: 'header',
        required: true,
        description: 'Access token no formato Bearer.',
        schema: { type: 'string', example: `Bearer ${authTokenExample}` },
      },
      RefreshTokenHeader: {
        name: 'X-Refresh-Token',
        in: 'header',
        required: false,
        description:
          'Refresh token JWT. Também é aceito no body como `refresh` ou `refreshToken`.',
        schema: { type: 'string', example: authTokenExample },
      },
      UserIdPath: {
        name: 'userId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
      RoleIdPath: {
        name: 'roleId',
        in: 'path',
        required: true,
        schema: { type: 'string', enum: ['admin', 'vendedor', 'gestor'] },
        example: 'gestor',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'TOKEN_INVALID' },
              message: { type: 'string', example: 'Token inválido ou expirado' },
              details: {
                description: 'Detalhes adicionais quando aplicável.',
                nullable: true,
              },
            },
          },
        },
        example: errorExample('TOKEN_INVALID', 'Token inválido ou expirado'),
      },
      ValidationErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'details'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Dados inválidos' },
              details: {
                type: 'object',
                additionalProperties: {
                  type: 'array',
                  items: { type: 'string' },
                },
                example: {
                  email: ['Formato de email inválido'],
                  password: ['Senha deve ter no mínimo 8 caracteres'],
                },
              },
            },
          },
        },
      },
      SignupRequest: {
        type: 'object',
        required: ['email', 'password', 'password_confirm'],
        properties: {
          email: { type: 'string', format: 'email', example: 'vendedor@loja.com' },
          password: {
            type: 'string',
            minLength: 8,
            description:
              'Mínimo 8 caracteres, com pelo menos 1 letra, 1 número e 1 caractere especial.',
            example: 'Senha@123',
          },
          password_confirm: {
            type: 'string',
            description: 'Deve ser idêntico ao campo `password`.',
            example: 'Senha@123',
          },
        },
      },
      SignupResponse: {
        type: 'object',
        required: ['token', 'refresh', 'userId'],
        properties: {
          token: { type: 'string', description: 'Access token JWT, expira em 15 minutos' },
          refresh: { type: 'string', description: 'Refresh token JWT, expira em 7 dias' },
          userId: {
            type: 'string',
            format: 'uuid',
            example: '550e8400-e29b-41d4-a716-446655440000',
          },
        },
        example: {
          token: authTokenExample,
          refresh: authTokenExample,
          userId: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'vendedor@loja.com' },
          password: { type: 'string', example: 'Senha@123' },
        },
      },
      AuthUser: {
        type: 'object',
        required: ['id', 'email', 'roles'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          roles: {
            type: 'array',
            items: { type: 'string', enum: ['admin', 'vendedor', 'gestor'] },
            example: ['vendedor'],
          },
        },
      },
      LoginResponse: {
        type: 'object',
        required: ['token', 'refresh', 'user'],
        properties: {
          token: { type: 'string', description: 'Access token JWT, expira em 15 minutos' },
          refresh: { type: 'string', description: 'Refresh token JWT, expira em 7 dias' },
          user: { $ref: '#/components/schemas/AuthUser' },
        },
        example: {
          token: authTokenExample,
          refresh: authTokenExample,
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'vendedor@loja.com',
            roles: ['vendedor'],
          },
        },
      },
      RefreshRequest: {
        type: 'object',
        properties: {
          refresh: { type: 'string', description: 'Refresh token JWT válido' },
          refreshToken: {
            type: 'string',
            description: 'Alias aceito para compatibilidade com clientes existentes',
          },
        },
        example: { refresh: authTokenExample },
      },
      RefreshResponse: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Novo access token JWT, expira em 15 minutos' },
        },
        example: { token: authTokenExample },
      },
      LogoutResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean', example: true },
        },
      },
      RolesResponse: {
        type: 'object',
        required: ['roles'],
        properties: {
          roles: {
            type: 'array',
            items: { type: 'string', enum: ['admin', 'vendedor', 'gestor'] },
            example: ['admin', 'vendedor', 'gestor'],
          },
        },
      },
      AssignRoleRequest: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['admin', 'vendedor', 'gestor'], example: 'gestor' },
        },
      },
      AssignRoleResponse: {
        type: 'object',
        required: ['message', 'user'],
        properties: {
          message: { type: 'string', example: 'Role atribuída com sucesso' },
          user: { $ref: '#/components/schemas/AuthUser' },
        },
      },
    },
  },
  paths: {
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Cadastro de novo usuário',
        description:
          'Registra usuário com role padrão `vendedor` e emite access token e refresh token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SignupRequest' },
              examples: {
                valid: {
                  summary: 'Cadastro válido',
                  value: {
                    email: 'vendedor@loja.com',
                    password: 'Senha@123',
                    password_confirm: 'Senha@123',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Usuário cadastrado com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SignupResponse' },
              },
            },
          },
          '400': {
            description: 'Corpo da requisição inválido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
                example: errorExample('VALIDATION_ERROR', 'Dados inválidos', {
                  password: ['Senha deve conter pelo menos 1 caractere especial'],
                }),
              },
            },
          },
          '409': {
            description: 'Email já cadastrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('EMAIL_ALREADY_EXISTS', 'Email já cadastrado'),
              },
            },
          },
          '429': {
            description: 'Rate limit atingido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample(
                  'RATE_LIMITED',
                  'Muitas tentativas de cadastro. Aguarde 1 minuto.',
                ),
              },
            },
          },
          '500': {
            description: 'Erro interno sem exposição de stack trace',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('INTERNAL_SERVER_ERROR', 'Erro interno no servidor'),
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login de usuário',
        description:
          'Valida credenciais e emite access token e refresh token. A mensagem de erro de credenciais é genérica.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              examples: {
                valid: {
                  summary: 'Login válido',
                  value: { email: 'vendedor@loja.com', password: 'Senha@123' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login realizado com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          '400': {
            description: 'Dados inválidos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
                example: errorExample('VALIDATION_ERROR', 'Dados inválidos', {
                  email: ['Formato de email inválido'],
                }),
              },
            },
          },
          '401': {
            description: 'Credenciais inválidas',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('INVALID_CREDENTIALS', 'Credenciais inválidas'),
              },
            },
          },
          '429': {
            description: 'Rate limit atingido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample(
                  'RATE_LIMITED',
                  'Muitas tentativas de login. Aguarde 1 minuto.',
                ),
              },
            },
          },
          '500': {
            description: 'Erro interno sem exposição de stack trace',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('INTERNAL_SERVER_ERROR', 'Erro interno no servidor'),
              },
            },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar access token',
        description:
          'Aceita o refresh token no header `X-Refresh-Token` ou no body como `refresh`/`refreshToken`.',
        parameters: [{ $ref: '#/components/parameters/RefreshTokenHeader' }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshRequest' },
              examples: {
                body: {
                  summary: 'Refresh token no body',
                  value: { refresh: authTokenExample },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Novo access token emitido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RefreshResponse' },
              },
            },
          },
          '400': {
            description: 'Refresh token não informado ou inválido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
                example: errorExample('VALIDATION_ERROR', 'Dados inválidos', {
                  refresh: ['Refresh token obrigatório'],
                }),
              },
            },
          },
          '401': {
            description: 'Refresh token inválido, expirado ou revogado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  invalid: {
                    summary: 'Token inválido',
                    value: errorExample(
                      'REFRESH_TOKEN_INVALID',
                      'Refresh token inválido ou expirado',
                    ),
                  },
                  revoked: {
                    summary: 'Token revogado',
                    value: errorExample(
                      'REFRESH_TOKEN_REVOKED',
                      'Refresh token revogado ou expirado',
                    ),
                  },
                },
              },
            },
          },
          '500': {
            description: 'Erro interno sem exposição de stack trace',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('INTERNAL_SERVER_ERROR', 'Erro interno no servidor'),
              },
            },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Encerrar sessão',
        description:
          'Revoga o access token e remove os refresh tokens do usuário autenticado.',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/AuthorizationHeader' }],
        responses: {
          '200': {
            description: 'Sessão encerrada com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LogoutResponse' },
                example: { success: true },
              },
            },
          },
          '401': {
            description: 'Token ausente, malformado, inválido ou expirado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  missing: {
                    summary: 'Header ausente',
                    value: errorExample('TOKEN_MISSING', 'Token não fornecido'),
                  },
                  invalid: {
                    summary: 'Token inválido',
                    value: errorExample('TOKEN_INVALID', 'Token inválido ou expirado'),
                  },
                },
              },
            },
          },
          '500': {
            description: 'Erro interno sem exposição de stack trace',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('INTERNAL_SERVER_ERROR', 'Erro interno no servidor'),
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Dados do usuário autenticado',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/AuthorizationHeader' }],
        responses: {
          '200': {
            description: 'Dados do usuário autenticado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthUser' },
                example: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  email: 'vendedor@loja.com',
                  roles: ['vendedor'],
                },
              },
            },
          },
          '401': {
            description: 'Token ausente, inválido, expirado ou revogado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  missing: {
                    summary: 'Header ausente',
                    value: errorExample('TOKEN_MISSING', 'Token não fornecido'),
                  },
                  revoked: {
                    summary: 'Token revogado',
                    value: errorExample('TOKEN_REVOKED', 'Token revogado'),
                  },
                },
              },
            },
          },
          '500': {
            description: 'Erro interno sem exposição de stack trace',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('INTERNAL_SERVER_ERROR', 'Erro interno no servidor'),
              },
            },
          },
        },
      },
    },
    '/auth/roles': {
      get: {
        tags: ['RBAC'],
        summary: 'Listar roles disponíveis',
        responses: {
          '200': {
            description: 'Lista de roles',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RolesResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/users/{userId}/roles': {
      post: {
        tags: ['RBAC'],
        summary: 'Atribuir role a um usuário',
        description: 'Substitui a role atual do usuário. Requer token de admin.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/AuthorizationHeader' },
          { $ref: '#/components/parameters/UserIdPath' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AssignRoleRequest' },
              examples: {
                valid: { summary: 'Atribuir gestor', value: { role: 'gestor' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Role atribuída com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AssignRoleResponse' },
              },
            },
          },
          '400': {
            description: 'Body ou params inválidos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
                example: errorExample('VALIDATION_ERROR', 'Dados inválidos', {
                  role: ['Role inválida. Valores aceitos: admin, vendedor, gestor'],
                }),
              },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Token válido, mas sem role admin',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('FORBIDDEN', 'Acesso negado: requer role admin'),
              },
            },
          },
          '404': {
            description: 'Usuário não encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('USER_NOT_FOUND', 'Usuário não encontrado'),
              },
            },
          },
          '500': {
            description: 'Erro interno sem exposição de stack trace',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('INTERNAL_SERVER_ERROR', 'Erro interno no servidor'),
              },
            },
          },
        },
      },
    },
    '/auth/users/{userId}/roles/{roleId}': {
      delete: {
        tags: ['RBAC'],
        summary: 'Remover role de um usuário',
        description:
          'Remove a role informada e retorna o usuário para a role padrão `vendedor`. Requer token de admin.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/AuthorizationHeader' },
          { $ref: '#/components/parameters/UserIdPath' },
          { $ref: '#/components/parameters/RoleIdPath' },
        ],
        responses: {
          '204': { description: 'Role removida com sucesso, sem corpo' },
          '400': {
            description: 'Params inválidos ou tentativa de remover a role padrão',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  validation: {
                    summary: 'Params inválidos',
                    value: errorExample('VALIDATION_ERROR', 'Dados inválidos', {
                      roleId: ['Role inválida. Valores aceitos: admin, vendedor, gestor'],
                    }),
                  },
                  defaultRole: {
                    summary: 'Role padrão',
                    value: errorExample(
                      'DEFAULT_ROLE_REQUIRED',
                      'Não é possível remover a role padrão',
                    ),
                  },
                },
              },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Token válido, mas sem role admin',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('FORBIDDEN', 'Acesso negado: requer role admin'),
              },
            },
          },
          '404': {
            description: 'Usuário não encontrado ou role não atribuída',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  user: {
                    summary: 'Usuário não encontrado',
                    value: errorExample('USER_NOT_FOUND', 'Usuário não encontrado'),
                  },
                  role: {
                    summary: 'Role não atribuída',
                    value: errorExample('ROLE_NOT_ASSIGNED', 'Usuário não possui essa role'),
                  },
                },
              },
            },
          },
          '500': {
            description: 'Erro interno sem exposição de stack trace',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: errorExample('INTERNAL_SERVER_ERROR', 'Erro interno no servidor'),
              },
            },
          },
        },
      },
    },
  },
};

const swaggerOptions: Options = {
  definition: swaggerDefinition,
  apis: ['./src/**/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions) as OpenAPIV3.Document;

const signupPath = swaggerSpec.paths['/auth/signup'];
if (signupPath) {
  swaggerSpec.paths['/auth/register'] = signupPath;
}
