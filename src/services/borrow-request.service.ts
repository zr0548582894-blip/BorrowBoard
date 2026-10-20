import type { BorrowRequestStatus, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { CreateBorrowRequestInput, ListBorrowRequestsQuery } from '../schemas/borrow-request.schema';
import { badRequest, conflict, forbidden, notFound } from '../utils/http-error';
import { daysInclusive, today, toDate, toDateString } from '../utils/dates';
import { contactUserSelect, withContact } from '../utils/serialize';
import { notify } from './notification.service';

const include = {
  product: { select: { id: true, name: true, imageUrl: true, ownerId: true, owner: { select: contactUserSelect } } },
  borrower: { select: contactUserSelect },
} satisfies Prisma.BorrowRequestInclude;

type RequestWithRelations = Prisma.BorrowRequestGetPayload<{ include: typeof include }>;

/** הטלפונים נחשפים רק אחרי שהבקשה אושרה */
const CONTACT_VISIBLE: BorrowRequestStatus[] = ['APPROVED', 'RETURNED'];

function serialize(r: RequestWithRelations) {
  const visible = CONTACT_VISIBLE.includes(r.status);
  const { owner, ownerId: _ownerId, ...product } = r.product;
  return {
    id: r.id,
    status: r.status,
    startDate: toDateString(r.startDate),
    endDate: toDateString(r.endDate),
    message: r.message,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    product,
    borrower: withContact(r.borrower, visible),
    owner: withContact(owner, visible),
  };
}

/** תנאי חפיפה בין טווחי תאריכים */
function overlaps(start: Date, end: Date): Prisma.BorrowRequestWhereInput {
  return { startDate: { lte: end }, endDate: { gte: start } };
}

export async function createBorrowRequest(productId: number, borrowerId: number, input: CreateBorrowRequestInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound('המוצר לא נמצא');
  if (product.ownerId === borrowerId) throw forbidden('לא ניתן לבקש להשאיל מוצר של עצמך', 'OWN_PRODUCT');

  const start = toDate(input.startDate);
  const end = toDate(input.endDate);
  if (start < today()) throw badRequest('תאריך ההתחלה לא יכול להיות בעבר', 'START_IN_PAST');
  if (product.maxDays && daysInclusive(start, end) > product.maxDays) {
    throw badRequest(`ניתן להשאיל מוצר זה לכל היותר ${product.maxDays} ימים`, 'TOO_LONG');
  }

  const duplicate = await prisma.borrowRequest.findFirst({
    where: { productId, borrowerId, status: 'PENDING' },
  });
  if (duplicate) throw conflict('כבר שלחת בקשה ממתינה למוצר זה', 'DUPLICATE_REQUEST');

  const taken = await prisma.borrowRequest.findFirst({
    where: { productId, status: 'APPROVED', ...overlaps(start, end) },
  });
  if (taken) throw conflict('המוצר כבר מושאל בחלק מהתאריכים שביקשת', 'DATES_TAKEN');

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.borrowRequest.create({
      data: { productId, borrowerId, startDate: start, endDate: end, message: input.message },
      include,
    });
    await notify(
      tx,
      product.ownerId,
      'BORROW_REQUESTED',
      `${created.borrower.name} מבקשת להשאיל את "${product.name}" (${input.startDate} עד ${input.endDate})`,
      `/products/${productId}`,
    );
    return created;
  });
  return serialize(request);
}

export async function listBorrowRequests(userId: number, q: ListBorrowRequestsQuery) {
  const where: Prisma.BorrowRequestWhereInput = {
    ...(q.box === 'sent' ? { borrowerId: userId } : { product: { ownerId: userId } }),
    ...(q.status && { status: q.status }),
  };
  const items = await prisma.borrowRequest.findMany({
    where,
    include,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return items.map(serialize);
}

async function loadRequest(id: number, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const request = await db.borrowRequest.findUnique({ where: { id }, include });
  if (!request) throw notFound('הבקשה לא נמצאה');
  return request;
}

function assertOwner(r: RequestWithRelations, userId: number) {
  if (r.product.ownerId !== userId) throw forbidden('רק בעלת המוצר יכולה לבצע פעולה זו', 'NOT_OWNER');
}

function assertStatus(r: RequestWithRelations, expected: BorrowRequestStatus) {
  if (r.status !== expected) {
    throw conflict(`לא ניתן לבצע פעולה זו על בקשה בסטטוס ${r.status}`, 'INVALID_STATUS');
  }
}

/** אישור: מסמן APPROVED ודוחה אוטומטית רק בקשות ממתינות עם תאריכים חופפים */
export async function approveBorrowRequest(id: number, userId: number) {
  const result = await prisma.$transaction(async (tx) => {
    const r = await loadRequest(id, tx);
    assertOwner(r, userId);
    assertStatus(r, 'PENDING');

    const taken = await tx.borrowRequest.findFirst({
      where: { productId: r.productId, status: 'APPROVED', ...overlaps(r.startDate, r.endDate) },
    });
    if (taken) throw conflict('כבר אישרת השאלה אחרת בתאריכים חופפים', 'DATES_TAKEN');

    const approved = await tx.borrowRequest.update({ where: { id }, data: { status: 'APPROVED' }, include });
    await notify(tx, r.borrowerId, 'BORROW_APPROVED', `הבקשה שלך להשאיל את "${r.product.name}" אושרה`, `/products/${r.productId}`);

    const overlapping = await tx.borrowRequest.findMany({
      where: { productId: r.productId, status: 'PENDING', id: { not: id }, ...overlaps(r.startDate, r.endDate) },
    });
    for (const other of overlapping) {
      await tx.borrowRequest.update({ where: { id: other.id }, data: { status: 'REJECTED' } });
      await notify(
        tx,
        other.borrowerId,
        'BORROW_REJECTED',
        `הבקשה שלך להשאיל את "${r.product.name}" נדחתה כי המוצר הושאל בתאריכים אלו`,
        `/products/${r.productId}`,
      );
    }
    return approved;
  });
  return serialize(result);
}

export async function rejectBorrowRequest(id: number, userId: number) {
  const r = await loadRequest(id);
  assertOwner(r, userId);
  assertStatus(r, 'PENDING');
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.borrowRequest.update({ where: { id }, data: { status: 'REJECTED' }, include });
    await notify(tx, r.borrowerId, 'BORROW_REJECTED', `הבקשה שלך להשאיל את "${r.product.name}" נדחתה`, `/products/${r.productId}`);
    return u;
  });
  return serialize(updated);
}

export async function markReturned(id: number, userId: number) {
  const r = await loadRequest(id);
  assertOwner(r, userId);
  assertStatus(r, 'APPROVED');
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.borrowRequest.update({ where: { id }, data: { status: 'RETURNED' }, include });
    await notify(tx, r.borrowerId, 'BORROW_RETURNED', `"${r.product.name}" סומן כמוחזר. תודה!`, `/products/${r.productId}`);
    return u;
  });
  return serialize(updated);
}

export async function cancelBorrowRequest(id: number, userId: number) {
  const r = await loadRequest(id);
  if (r.borrowerId !== userId) throw forbidden('רק מי ששלחה את הבקשה יכולה לבטל אותה', 'NOT_REQUESTER');
  assertStatus(r, 'PENDING');
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.borrowRequest.update({ where: { id }, data: { status: 'CANCELLED' }, include });
    await notify(tx, r.product.ownerId, 'BORROW_CANCELLED', `${r.borrower.name} ביטלה את הבקשה ל"${r.product.name}"`, `/products/${r.productId}`);
    return u;
  });
  return serialize(updated);
}
