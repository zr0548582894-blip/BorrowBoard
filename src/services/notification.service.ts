import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { notFound } from '../utils/http-error';

type Db = Prisma.TransactionClient | typeof prisma;

/** יוצר הודעה למשתמש. נקרא מתוך שירותים אחרים בעת אירועים. */
export async function notify(db: Db, userId: number, type: NotificationType, text: string, link?: string) {
  await db.notification.create({ data: { userId, type, text: text.slice(0, 300), link } });
}

export async function listNotifications(userId: number, unread?: boolean) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(unread === undefined ? {} : { isRead: !unread }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items, unreadCount };
}

export async function markRead(userId: number, id: number) {
  // הודעה של משתמש אחר מחזירה 404 כדי לא לחשוף שהיא קיימת
  const n = await prisma.notification.findFirst({ where: { id, userId } });
  if (!n) throw notFound('ההודעה לא נמצאה');
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllRead(userId: number) {
  const result = await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  return { updated: result.count };
}
