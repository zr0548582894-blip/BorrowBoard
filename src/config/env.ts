import { config } from 'dotenv';
import { z } from 'zod';

// טוען משתני סביבה מקובץ .env (אם קיים). בענן המשתנים מגיעים מהגדרות השירות.
config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL חסר'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET חייב להכיל לפחות 32 תווים'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  // רשימת כתובות מופרדות בפסיק, או * כדי לאפשר לכולם
  CORS_ORIGIN: z.string().default('*'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`❌ הגדרות סביבה שגויות:\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins: string[] | '*' =
  env.CORS_ORIGIN.trim() === '*'
    ? '*'
    : env.CORS_ORIGIN.split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean);
