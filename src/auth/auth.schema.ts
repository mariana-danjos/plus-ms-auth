import { z } from 'zod';
import { sanitizeText } from '../security/sanitize';

export const signupSchema = z
  .object({
    name: z
      .string({ required_error: 'Nome é obrigatório' })
      .trim()
      .min(2, 'Nome deve ter no mínimo 2 caracteres')
      .max(100, 'Nome muito longo')
      .transform(sanitizeText),
    email: z
      .string({ required_error: 'Email é obrigatório' })
      .trim()
      .toLowerCase()
      .email('Formato de email inválido')
      .regex(
        /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
        'Formato de email inválido',
      )
      .transform(sanitizeText),
    password: z
      .string({ required_error: 'Senha é obrigatória' })
      .min(8, 'Senha deve ter no mínimo 8 caracteres')
      .regex(/[A-Za-z]/, 'Senha deve conter pelo menos 1 letra')
      .regex(/[0-9]/, 'Senha deve conter pelo menos 1 número')
      .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos 1 caractere especial'),
    password_confirm: z.string({ required_error: 'Confirmação de senha é obrigatória' }),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'As senhas não coincidem',
    path: ['password_confirm'],
  });

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .trim()
    .toLowerCase()
    .email('Formato de email inválido')
    .transform(sanitizeText),
  password: z.string({ required_error: 'Senha é obrigatória' }).min(1, 'Senha é obrigatória'),
});

export const VALID_ROLES = ['admin', 'vendedor', 'gestor'] as const;
export type Role = (typeof VALID_ROLES)[number];

export const assignRoleSchema = z.object({
  role: z.enum(VALID_ROLES, {
    errorMap: () => ({ message: `Role inválida. Valores aceitos: ${VALID_ROLES.join(', ')}` }),
  }),
});

const refreshTokenValueSchema = z
  .string({
    required_error: 'Refresh token obrigatório',
    invalid_type_error: 'Refresh token inválido',
  })
  .trim()
  .min(1, 'Refresh token obrigatório');

const optionalHeaderValue = (schema: z.ZodString) =>
  z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }, schema.optional());

export const authorizationHeaderValueSchema = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  },
  z
    .string({
      required_error: 'Authorization header obrigatório',
      invalid_type_error: 'Authorization header inválido',
    })
    .trim()
    .regex(/^Bearer\s+\S+$/, 'Authorization header deve usar Bearer token'),
);

export const userIdParamsSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
});

export const userRoleParamsSchema = userIdParamsSchema.extend({
  roleId: z.enum(VALID_ROLES, {
    errorMap: () => ({ message: `Role inválida. Valores aceitos: ${VALID_ROLES.join(', ')}` }),
  }),
});

export const refreshTokenRequestSchema = z
  .object({
    body: z
      .object({
        refresh: refreshTokenValueSchema.optional(),
        refreshToken: refreshTokenValueSchema.optional(),
      })
      .passthrough()
      .default({}),
    headers: z
      .object({
        'x-refresh-token': optionalHeaderValue(refreshTokenValueSchema),
      })
      .passthrough(),
  })
  .superRefine(({ body, headers }, ctx) => {
    if (!body.refresh && !body.refreshToken && !headers['x-refresh-token']) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['refresh'],
        message: 'Refresh token obrigatório',
      });
    }
  })
  .transform(({ body, headers }) => ({
    refresh: body.refresh ?? body.refreshToken ?? headers['x-refresh-token'] ?? '',
  }));

export const refreshTokenSchema = z.object({
  refresh: refreshTokenValueSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
