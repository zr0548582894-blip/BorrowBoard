import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { ProductCondition, Role } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { signToken } from '../src/middleware/auth';
import { todayString } from '../src/utils/dates';

export const app = createApp();
export const api = () => request(app);
export { prisma };

/** מנקה את כל הטבלאות בין בדיקה לבדיקה */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Notification", "Offer", "WantedItem", "BorrowRequest", "Product", "Image", "Category", "User" RESTART IDENTITY CASCADE',
  );
}

let counter = 0;

export async function createUser(opts: { role?: Role; name?: string; password?: string; isBlocked?: boolean } = {}) {
  counter += 1;
  const password = opts.password ?? 'Passw0rd!';
  const user = await prisma.user.create({
    data: {
      name: opts.name ?? `משתמשת ${counter}`,
      email: `user${counter}@test.dev`,
      phone: `05000000${String(counter).padStart(2, '0')}`,
      city: 'בני ברק',
      role: opts.role ?? 'USER',
      isBlocked: opts.isBlocked ?? false,
      passwordHash: await bcrypt.hash(password, 4),
    },
  });
  return { user, password, token: signToken(user), auth: `Bearer ${signToken(user)}` };
}

export async function createCategory(name = `קטגוריה ${++counter}`) {
  return prisma.category.create({ data: { name } });
}

export async function createProduct(
  ownerId: number,
  categoryId: number,
  data: Partial<{ name: string; description: string; city: string; condition: ProductCondition; maxDays: number | null }> = {},
) {
  return prisma.product.create({
    data: {
      ownerId,
      categoryId,
      name: data.name ?? 'מוצר לבדיקה',
      description: data.description ?? 'תיאור',
      city: data.city ?? 'בני ברק',
      condition: data.condition ?? 'USED',
      maxDays: data.maxDays === undefined ? null : data.maxDays,
    },
  });
}

/** תאריך בפורמט YYYY-MM-DD, היום + מספר ימים */
export function day(offset: number) {
  const d = new Date(`${todayString()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** PNG תקין קטן (1x1) */
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
