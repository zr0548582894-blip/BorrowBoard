import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { ListUsersQuery } from '../schemas/admin.schema';
import { badRequest, notFound } from '../utils/http-error';
import { toPage, toSafeUser } from '../utils/serialize';
import { borrowedNowWhere } from './product.service';

export async function getStats() {
  const [users, blockedUsers, products, borrowed, pendingRequests, activeLoans, openWantedItems, categories] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBlocked: true } }),
      prisma.product.count(),
      prisma.product.count({ where: { borrowRequests: { some: borrowedNowWhere() } } }),
      prisma.borrowRequest.count({ where: { status: 'PENDING' } }),
      prisma.borrowRequest.count({ where: { status: 'APPROVED' } }),
      prisma.wantedItem.count({ where: { status: 'OPEN' } }),
      prisma.category.count(),
    ]);
  return {
    users,
    blockedUsers,
    products,
    available: products - borrowed,
    borrowed,
    pendingRequests,
    activeLoans,
    openWantedItems,
    categories,
  };
}

export async function listUsers(q: ListUsersQuery) {
  const where: Prisma.UserWhereInput = {
    ...(q.search && {
      OR: [
        { name: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ],
    }),
    ...(q.isBlocked !== undefined && { isBlocked: q.isBlocked }),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { _count: { select: { products: true, borrowRequests: true, wantedItems: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.user.count({ where }),
  ]);
  const items = users.map(({ _count, ...u }) => ({
    ...toSafeUser(u),
    productCount: _count.products,
    borrowRequestCount: _count.borrowRequests,
    wantedItemCount: _count.wantedItems,
  }));
  return toPage(items, total, q.page, q.limit);
}

export async function setBlocked(adminId: number, userId: number, isBlocked: boolean) {
  if (adminId === userId) throw badRequest('לא ניתן לחסום את עצמך', 'CANNOT_BLOCK_SELF');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('המשתמש לא נמצא');
  if (user.role === 'ADMIN') throw badRequest('לא ניתן לחסום מנהל', 'CANNOT_BLOCK_ADMIN');
  const updated = await prisma.user.update({ where: { id: userId }, data: { isBlocked } });
  return toSafeUser(updated);
}
