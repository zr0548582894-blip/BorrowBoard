import type { User } from '@prisma/client';

/** פרטי משתמש שמותר להחזיר ללקוח - ללא passwordHash */
export type SafeUser = Omit<User, 'passwordHash'>;

export function toSafeUser(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}

/** בחירה (select) של שדות ציבוריים בלבד של משתמש אחר */
export const publicUserSelect = { id: true, name: true, city: true } as const;

/** בחירה של פרטי קשר - נחשפים רק אחרי אישור */
export const contactUserSelect = { id: true, name: true, city: true, phone: true } as const;

/** מסתיר את הטלפון כשאין עדיין אישור */
export function withContact<T extends { phone: string }>(user: T, visible: boolean) {
  return { ...user, phone: visible ? user.phone : null };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function toPage<T>(items: T[], total: number, page: number, limit: number): Page<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
