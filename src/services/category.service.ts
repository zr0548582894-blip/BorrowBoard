import { prisma } from '../db/prisma';
import { badRequest, conflict, notFound } from '../utils/http-error';

export function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

/** בודק שקטגוריה קיימת (לשימוש בעת יצירת מוצר או בקשה) */
export async function assertCategoryExists(categoryId: number) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw badRequest('הקטגוריה שנבחרה לא קיימת', 'INVALID_CATEGORY');
}

async function assertNameFree(name: string, exceptId?: number) {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
  });
  if (existing) throw conflict('קטגוריה בשם זה כבר קיימת', 'CATEGORY_EXISTS');
}

export async function createCategory(name: string) {
  await assertNameFree(name);
  return prisma.category.create({ data: { name } });
}

export async function updateCategory(id: number, name: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw notFound('הקטגוריה לא נמצאה');
  await assertNameFree(name, id);
  return prisma.category.update({ where: { id }, data: { name } });
}

export async function deleteCategory(id: number) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, wantedItems: true } } },
  });
  if (!category) throw notFound('הקטגוריה לא נמצאה');
  if (category._count.products > 0 || category._count.wantedItems > 0) {
    throw conflict('לא ניתן למחוק קטגוריה שיש בה מוצרים או בקשות', 'CATEGORY_IN_USE');
  }
  await prisma.category.delete({ where: { id } });
}
