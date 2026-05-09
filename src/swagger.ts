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
                  properties: {
                    token: { type: 'string', description: 'Access token JWT (15 min)' },
                    refresh: { type: 'string', description: 'Refresh token JWT (7 dias)' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Campos obrigatórios ausentes',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Credenciais inválidas',
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
        security: [{ bearerAuth: [] }],
        responses: {
          '204': { description: 'Sessão encerrada com sucesso (sem corpo)' },
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
  },
};
