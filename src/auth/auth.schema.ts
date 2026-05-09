import { z } from 'zod';

export const signupSchema = z
  .object({
    email: z
      .string({ required_error: 'Email é obrigatório' })
      .email('Formato de email inválido')
      .regex(
        /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/,
        'Formato de email inválido',
      ),
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

export type SignupInput = z.infer<typeof signupSchema>;
