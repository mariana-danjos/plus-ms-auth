import type { OpenAPIV3 } from 'openapi-types';

export const swaggerSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Plus MS Auth',
    version: '1.0.0',
    description: 'Microsserviço de autenticação — sistema de gestão de estoque plus size',
  },
  servers: [{ url: 'http://localhost:3004', description: 'Desenvolvimento local' }],
  tags: [{ name: 'Auth', description: 'Operações de autenticação e sessão' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', example: 'Mensagem de erro' },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        required: ['error', 'details'],
        properties: {
          error: { type: 'string', example: 'Dados inválidos' },
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
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Cadastro de novo usuário',
        description:
          'Registra um novo usuário com role padrão `vendedor`, emite access token (15 min) e refresh token (7 dias).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'password_confirm'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'vendedor@loja.com',
                  },
                  password: {
                    type: 'string',
                    minLength: 8,
                    description:
                      'Mínimo 8 chars. Deve conter ao menos 1 letra, 1 número e 1 caractere especial.',
                    example: 'Senha@123',
                  },
                  password_confirm: {
                    type: 'string',
                    description: 'Deve ser idêntico ao campo `password`.',
                    example: 'Senha@123',
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
                schema: {
                  type: 'object',
                  required: ['token', 'refresh', 'userId'],
                  properties: {
                    token: {
                      type: 'string',
                      description: 'Access token JWT (expira em 15 min)',
                    },
                    refresh: {
                      type: 'string',
                      description: 'Refresh token JWT (expira em 7 dias)',
                    },
                    userId: {
                      type: 'string',
                      format: 'uuid',
                      example: '550e8400-e29b-41d4-a716-446655440000',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Corpo da requisição inválido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Email já cadastrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { error: 'Email já cadastrado' },
              },
            },
          },
          '429': {
            description: 'Rate limit atingido (máx. 5 tentativas/min por IP)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { error: 'Muitas tentativas de cadastro. Aguarde 1 minuto.' },
              },
            },
          },
          '500': {
            description: 'Erro interno',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
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
          'Valida credenciais e emite access token (15 min) + refresh token (7 dias). Rate limit: 10 tentativas/min por email.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'vendedor@loja.com' },
                  password: { type: 'string', example: 'Senha@123' },
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
                schema: {
                  type: 'object',
                  required: ['token', 'refresh', 'user'],
                  properties: {
                    token: { type: 'string', description: 'Access token JWT (15 min)' },
                    refresh: { type: 'string', description: 'Refresh token JWT (7 dias)' },
                    user: {
                      type: 'object',
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
                  },
                },
              },
            },
          },
          '400': {
            description: 'Dados inválidos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Credenciais inválidas (mensagem genérica — não revela se email existe)',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '429': {
            description: 'Rate limit atingido (máx. 10 tentativas/min por email)',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '500': {
            description: 'Erro interno',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh'],
                properties: {
                  refresh: { type: 'string', description: 'Refresh token JWT válido' },
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
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', description: 'Novo access token JWT (15 min)' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Refresh token não informado',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Refresh token inválido ou expirado',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
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
          'Revoga o access token (insere na blocklist) e deleta os refresh tokens do usuário. Idempotente — revogar um token já revogado retorna 200 normalmente.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Sessão encerrada com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Token não fornecido',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '500': {
            description: 'Erro interno',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
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
        responses: {
          '200': {
            description: 'Dados do usuário autenticado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    email: { type: 'string', format: 'email' },
                    roles: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: ['admin', 'vendedor', 'gestor'],
                      },
                      example: ['vendedor'],
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Token ausente, inválido ou expirado',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/auth/roles': {
      get: {
        tags: ['RBAC'],
        summary: 'Listar roles disponíveis',
        description: 'Retorna a lista de roles do sistema. Endpoint público.',
        responses: {
          '200': {
            description: 'Lista de roles',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    roles: {
                      type: 'array',
                      items: { type: 'string', enum: ['admin', 'vendedor', 'gestor'] },
                      example: ['admin', 'vendedor', 'gestor'],
                    },
                  },
                },
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
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role'],
                properties: {
                  role: {
                    type: 'string',
                    enum: ['admin', 'vendedor', 'gestor'],
                    example: 'gestor',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Role atribuída com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Role atribuída com sucesso' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                        roles: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Role inválida ou userId malformado',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Acesso negado — requer role admin',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Usuário não encontrado',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
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
          'Remove a role especificada, revertendo o usuário para a role padrão `vendedor`. Não é possível remover a role `vendedor`. Requer token de admin.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'roleId',
            in: 'path',
            required: true,
            description: 'Nome da role a remover (ex: admin, gestor)',
            schema: { type: 'string', enum: ['admin', 'gestor'] },
          },
        ],
        responses: {
          '204': { description: 'Role removida com sucesso (sem corpo)' },
          '400': {
            description: 'Role inválida, userId malformado ou tentativa de remover role padrão',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Acesso negado — requer role admin',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Usuário não encontrado ou não possui essa role',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
  },
};
