import { z } from 'zod';
import { cityField } from './common';

const phoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(0\d{8,9}|\+972\d{8,9})$/, { message: 'מספר טלפון לא תקין' }));

const passwordField = z
  .string()
  .min(8, { message: 'הסיסמה חייבת להכיל לפחות 8 תווים' })
  .max(72)
  .regex(/[A-Za-z]/, { message: 'הסיסמה חייבת להכיל לפחות אות אחת באנגלית' })
  .regex(/\d/, { message: 'הסיסמה חייבת להכיל לפחות ספרה אחת' });

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.email().trim().toLowerCase().max(255),
  password: passwordField,
  phone: phoneField,
  city: cityField.optional(),
});

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(50),
    phone: phoneField,
    city: cityField.nullable(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'יש לשלוח לפחות שדה אחד לעדכון' });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
