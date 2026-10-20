import { z } from 'zod';

// הודעות השגיאה של Zod יוצגו בעברית
z.config(z.locales.he());

/** מזהה מספרי בכתובת, למשל /products/12 */
export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
};

export const sortOrder = z.enum(['newest', 'oldest', 'name']).default('newest');

/** תאריך בפורמט YYYY-MM-DD */
export const dateString = z.iso.date({ error: 'תאריך חייב להיות בפורמט YYYY-MM-DD' });

export const conditionEnum = z.enum(['NEW', 'LIKE_NEW', 'USED']);

export const cityField = z.string().trim().min(2).max(50);

/** כתובת תמונה: הכתובת שהשרת החזיר אחרי העלאה (/api/images/5) או קישור http/https */
export const imageUrlField = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/api\/images\/\d+$/.test(v) || /^https?:\/\/\S+$/i.test(v), {
    message: 'כתובת התמונה חייבת להיות /api/images/<id> או קישור http/https',
  });

/** "true"/"false" מתוך Query string */
export const booleanQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

/** טקסט חופשי לחיפוש */
export const searchField = z.string().trim().max(100).optional();
