import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { AuthUser } from '../middleware/auth';
import type { CreateProductInput, ListProductsQuery, UpdateProductInput } from '../schemas/product.schema';
import { conflict, forbidden, notFound } from '../utils/http-error';
import { today, toDateString } from '../utils/dates';
import { publicUserSelect, toPage } from '../utils/serialize';
import { assertCategoryExists } from './category.service';
import { assertImageExists } from './image.service';

/**
 * מוצר נחשב "מושאל" (BORROWED) כשיש לו בקשת השאלה מאושרת שכבר התחילה
 * ועוד לא סומנה כ"הוחזר". הסטטוס מחושב ולא נשמר במסד.
 */
export function borrowedNowWhere(): Prisma.BorrowRequestWhereInput {
  return { status: 'APPROVED', startDate: { lte: today() } };
}

function productInclude() {
  return {
    category: true,
    owner: { select: publicUserSelect },
    borrowRequests: { where: borrowedNowWhere(), select: { id: true }, take: 1 },
  } satisfies Prisma.ProductInclude;
}

type ProductWithRelations = Prisma.ProductGetPayload<{ include: ReturnType<typeof productInclude> }>;

function serialize(p: ProductWithRelations) {
  const { borrowRequests, ...rest } = p;
  return { ...rest, status: borrowRequests.length > 0 ? ('BORROWED' as const) : ('AVAILABLE' as const) };
}

const orderByMap: Record<ListProductsQuery['sort'], Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  name: [{ name: 'asc' }, { id: 'asc' }],
};

export async function listProducts(q: ListProductsQuery) {
  const where: Prisma.ProductWhereInput = {
    ...(q.search && {
      OR: [
        { name: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ],
    }),
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...(q.city && { city: { contains: q.city, mode: 'insensitive' } }),
    ...(q.condition && { condition: q.condition }),
    ...(q.ownerId && { ownerId: q.ownerId }),
    ...(q.status === 'BORROWED' && { borrowRequests: { some: borrowedNowWhere() } }),
    ...(q.status === 'AVAILABLE' && { borrowRequests: { none: borrowedNowWhere() } }),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude(),
      orderBy: orderByMap[q.sort],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.product.count({ where }),
  ]);
  return toPage(items.map(serialize), total, q.page, q.limit);
}

export async function getProduct(id: number) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude() });
  if (!product) throw notFound('המוצר לא נמצא');

  // תקופות תפוסות (השאלות מאושרות שעוד לא הסתיימו) - בלי פרטים על הלווה
  const booked = await prisma.borrowRequest.findMany({
    where: { productId: id, status: 'APPROVED' },
    orderBy: { startDate: 'asc' },
    select: { startDate: true, endDate: true },
  });

  return {
    ...serialize(product),
    bookedPeriods: booked.map((b) => ({ startDate: toDateString(b.startDate), endDate: toDateString(b.endDate) })),
  };
}

export async function listMyProducts(userId: number) {
  const products = await prisma.product.findMany({
    where: { ownerId: userId },
    include: {
      ...productInclude(),
      _count: { select: { borrowRequests: { where: { status: 'PENDING' } } } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return products.map(({ _count, ...p }) => ({ ...serialize(p), pendingRequestsCount: _count.borrowRequests }));
}

export async function createProduct(userId: number, input: CreateProductInput) {
  await assertCategoryExists(input.categoryId);
  if (input.imageUrl) await assertImageExists(input.imageUrl);

  const product = await prisma.product.create({
    data: { ...input, ownerId: userId },
    include: productInclude(),
  });
  return serialize(product);
}

/** מחזיר את המוצר אם המשתמש הוא הבעלים. אחרת 404/403. */
async function getOwnedProduct(id: number, userId: number) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw notFound('המוצר לא נמצא');
  if (product.ownerId !== userId) throw forbidden('רק בעלת המוצר יכולה לבצע פעולה זו', 'NOT_OWNER');
  return product;
}

export async function updateProduct(id: number, userId: number, input: UpdateProductInput) {
  await getOwnedProduct(id, userId);
  if (input.categoryId) await assertCategoryExists(input.categoryId);
  if (input.imageUrl) await assertImageExists(input.imageUrl);

  const product = await prisma.product.update({ where: { id }, data: input, include: productInclude() });
  return serialize(product);
}

/**
 * בעלת המוצר יכולה למחוק רק כשאין לו השאלה מאושרת פעילה או עתידית.
 * מנהל יכול למחוק כל מוצר.
 */
export async function deleteProduct(id: number, user: AuthUser) {
  if (user.role === 'ADMIN') {
    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) throw notFound('המוצר לא נמצא');
  } else {
    await getOwnedProduct(id, user.id);
    const activeLoans = await prisma.borrowRequest.count({ where: { productId: id, status: 'APPROVED' } });
    if (activeLoans > 0) {
      throw conflict('לא ניתן למחוק מוצר שיש לו השאלה מאושרת שעוד לא הוחזרה', 'PRODUCT_BORROWED');
    }
  }
  await prisma.product.delete({ where: { id } });
}
