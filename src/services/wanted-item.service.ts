import type { OfferStatus, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { AuthUser } from '../middleware/auth';
import type {
  CreateOfferInput,
  CreateWantedItemInput,
  ListOffersQuery,
  ListWantedItemsQuery,
  UpdateWantedItemInput,
} from '../schemas/wanted-item.schema';
import { conflict, forbidden, notFound } from '../utils/http-error';
import { toDate, toDateString } from '../utils/dates';
import { contactUserSelect, publicUserSelect, toPage, withContact } from '../utils/serialize';
import { assertCategoryExists } from './category.service';
import { assertImageExists } from './image.service';
import { notify } from './notification.service';

// ---------- בקשות למוצרים (דף הבקשות) ----------

const wantedInclude = {
  category: true,
  requester: { select: publicUserSelect },
  _count: { select: { offers: { where: { status: 'PENDING' } } } },
} satisfies Prisma.WantedItemInclude;

type WantedWithRelations = Prisma.WantedItemGetPayload<{ include: typeof wantedInclude }>;

function serializeWanted(w: WantedWithRelations) {
  const { _count, neededFrom, neededUntil, ...rest } = w;
  return {
    ...rest,
    neededFrom: neededFrom ? toDateString(neededFrom) : null,
    neededUntil: neededUntil ? toDateString(neededUntil) : null,
    pendingOffersCount: _count.offers,
  };
}

const orderByMap: Record<ListWantedItemsQuery['sort'], Prisma.WantedItemOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  name: [{ title: 'asc' }, { id: 'asc' }],
};

/** ממיר תאריכים מ-YYYY-MM-DD ל-Date. null נשאר null (מחיקת ערך), undefined נשאר undefined (ללא שינוי) */
function dateOrNull(v: string | null | undefined) {
  return v === undefined ? undefined : v === null ? null : toDate(v);
}

export async function listWantedItems(q: ListWantedItemsQuery) {
  const where: Prisma.WantedItemWhereInput = {
    status: q.status,
    ...(q.search && {
      OR: [
        { title: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ],
    }),
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...(q.city && { city: { contains: q.city, mode: 'insensitive' } }),
  };
  const [items, total] = await Promise.all([
    prisma.wantedItem.findMany({
      where,
      include: wantedInclude,
      orderBy: orderByMap[q.sort],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.wantedItem.count({ where }),
  ]);
  return toPage(items.map(serializeWanted), total, q.page, q.limit);
}

export async function getWantedItem(id: number) {
  const item = await prisma.wantedItem.findUnique({ where: { id }, include: wantedInclude });
  if (!item) throw notFound('הבקשה לא נמצאה');
  return serializeWanted(item);
}

export async function listMyWantedItems(userId: number) {
  const items = await prisma.wantedItem.findMany({
    where: { requesterId: userId },
    include: wantedInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return items.map(serializeWanted);
}

export async function createWantedItem(userId: number, input: CreateWantedItemInput) {
  await assertCategoryExists(input.categoryId);
  if (input.imageUrl) await assertImageExists(input.imageUrl);
  const item = await prisma.wantedItem.create({
    data: {
      ...input,
      neededFrom: dateOrNull(input.neededFrom),
      neededUntil: dateOrNull(input.neededUntil),
      requesterId: userId,
    },
    include: wantedInclude,
  });
  return serializeWanted(item);
}

async function getOwnedWantedItem(id: number, userId: number) {
  const item = await prisma.wantedItem.findUnique({ where: { id } });
  if (!item) throw notFound('הבקשה לא נמצאה');
  if (item.requesterId !== userId) throw forbidden('רק מי שפרסמה את הבקשה יכולה לבצע פעולה זו', 'NOT_OWNER');
  return item;
}

export async function updateWantedItem(id: number, userId: number, input: UpdateWantedItemInput) {
  const existing = await getOwnedWantedItem(id, userId);
  if (input.categoryId) await assertCategoryExists(input.categoryId);
  if (input.imageUrl) await assertImageExists(input.imageUrl);

  // בדיקת סדר התאריכים מול הערכים הקיימים, כשמעדכנים רק אחד מהם
  const from = input.neededFrom !== undefined ? input.neededFrom : existing.neededFrom && toDateString(existing.neededFrom);
  const until = input.neededUntil !== undefined ? input.neededUntil : existing.neededUntil && toDateString(existing.neededUntil);
  if (from && until && until < from) {
    throw conflict('תאריך "עד" חייב להיות אחרי תאריך "מ-"', 'INVALID_DATES');
  }

  const item = await prisma.wantedItem.update({
    where: { id },
    data: { ...input, neededFrom: dateOrNull(input.neededFrom), neededUntil: dateOrNull(input.neededUntil) },
    include: wantedInclude,
  });
  return serializeWanted(item);
}

export async function deleteWantedItem(id: number, user: AuthUser) {
  if (user.role === 'ADMIN') {
    const exists = await prisma.wantedItem.findUnique({ where: { id } });
    if (!exists) throw notFound('הבקשה לא נמצאה');
  } else {
    await getOwnedWantedItem(id, user.id);
  }
  await prisma.wantedItem.delete({ where: { id } });
}

// ---------- הצעות של מלווים לבקשות ----------

const offerInclude = {
  offerer: { select: contactUserSelect },
  wantedItem: {
    select: { id: true, title: true, status: true, requesterId: true, requester: { select: contactUserSelect } },
  },
} satisfies Prisma.OfferInclude;

type OfferWithRelations = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;

const OFFER_CONTACT_VISIBLE: OfferStatus[] = ['ACCEPTED'];

function serializeOffer(o: OfferWithRelations) {
  const visible = OFFER_CONTACT_VISIBLE.includes(o.status);
  const { requester, requesterId: _requesterId, ...wantedItem } = o.wantedItem;
  return {
    id: o.id,
    status: o.status,
    message: o.message,
    condition: o.condition,
    imageUrl: o.imageUrl,
    createdAt: o.createdAt,
    wantedItem,
    offerer: withContact(o.offerer, visible),
    requester: withContact(requester, visible),
  };
}

export async function createOffer(wantedItemId: number, offererId: number, input: CreateOfferInput) {
  const item = await prisma.wantedItem.findUnique({ where: { id: wantedItemId } });
  if (!item) throw notFound('הבקשה לא נמצאה');
  if (item.requesterId === offererId) throw forbidden('לא ניתן להציע מוצר לבקשה של עצמך', 'OWN_WANTED_ITEM');
  if (item.status !== 'OPEN') throw conflict('הבקשה כבר נסגרה', 'WANTED_ITEM_CLOSED');
  if (input.imageUrl) await assertImageExists(input.imageUrl);

  const duplicate = await prisma.offer.findFirst({ where: { wantedItemId, offererId, status: 'PENDING' } });
  if (duplicate) throw conflict('כבר שלחת הצעה ממתינה לבקשה זו', 'DUPLICATE_OFFER');

  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.offer.create({ data: { ...input, wantedItemId, offererId }, include: offerInclude });
    await notify(tx, item.requesterId, 'OFFER_RECEIVED', `${created.offerer.name} מציעה לך את "${item.title}"`, `/wanted/${wantedItemId}`);
    return created;
  });
  return serializeOffer(offer);
}

export async function listOffers(userId: number, q: ListOffersQuery) {
  const where: Prisma.OfferWhereInput = {
    ...(q.box === 'sent' ? { offererId: userId } : { wantedItem: { requesterId: userId } }),
    ...(q.status && { status: q.status }),
  };
  const offers = await prisma.offer.findMany({ where, include: offerInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return offers.map(serializeOffer);
}

async function loadOffer(id: number, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const offer = await db.offer.findUnique({ where: { id }, include: offerInclude });
  if (!offer) throw notFound('ההצעה לא נמצאה');
  return offer;
}

function assertRequester(o: OfferWithRelations, userId: number) {
  if (o.wantedItem.requesterId !== userId) {
    throw forbidden('רק מי שפרסמה את הבקשה יכולה לבצע פעולה זו', 'NOT_OWNER');
  }
}

function assertPending(o: OfferWithRelations) {
  if (o.status !== 'PENDING') throw conflict(`לא ניתן לבצע פעולה זו על הצעה בסטטוס ${o.status}`, 'INVALID_STATUS');
}

/** אישור הצעה: סוגר את הבקשה ודוחה את שאר ההצעות הממתינות */
export async function acceptOffer(id: number, userId: number) {
  const result = await prisma.$transaction(async (tx) => {
    const o = await loadOffer(id, tx);
    assertRequester(o, userId);
    assertPending(o);
    if (o.wantedItem.status !== 'OPEN') throw conflict('הבקשה כבר נסגרה', 'WANTED_ITEM_CLOSED');

    const accepted = await tx.offer.update({ where: { id }, data: { status: 'ACCEPTED' }, include: offerInclude });
    await tx.wantedItem.update({ where: { id: o.wantedItemId }, data: { status: 'CLOSED' } });
    await notify(tx, o.offererId, 'OFFER_ACCEPTED', `ההצעה שלך ל"${o.wantedItem.title}" התקבלה`, `/wanted/${o.wantedItemId}`);

    const others = await tx.offer.findMany({ where: { wantedItemId: o.wantedItemId, status: 'PENDING', id: { not: id } } });
    for (const other of others) {
      await tx.offer.update({ where: { id: other.id }, data: { status: 'REJECTED' } });
      await notify(tx, other.offererId, 'OFFER_REJECTED', `הבקשה "${o.wantedItem.title}" נסגרה עם הצעה אחרת`, `/wanted/${o.wantedItemId}`);
    }
    // מחזירים את ההצעה עם הסטטוס המעודכן של הבקשה
    return { ...accepted, wantedItem: { ...accepted.wantedItem, status: 'CLOSED' as const } };
  });
  return serializeOffer(result);
}

export async function rejectOffer(id: number, userId: number) {
  const o = await loadOffer(id);
  assertRequester(o, userId);
  assertPending(o);
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.offer.update({ where: { id }, data: { status: 'REJECTED' }, include: offerInclude });
    await notify(tx, o.offererId, 'OFFER_REJECTED', `ההצעה שלך ל"${o.wantedItem.title}" נדחתה`, `/wanted/${o.wantedItemId}`);
    return u;
  });
  return serializeOffer(updated);
}

export async function cancelOffer(id: number, userId: number) {
  const o = await loadOffer(id);
  if (o.offererId !== userId) throw forbidden('רק מי ששלחה את ההצעה יכולה לבטל אותה', 'NOT_OFFERER');
  assertPending(o);
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.offer.update({ where: { id }, data: { status: 'CANCELLED' }, include: offerInclude });
    await notify(tx, o.wantedItem.requesterId, 'OFFER_CANCELLED', `${o.offerer.name} ביטלה את ההצעה ל"${o.wantedItem.title}"`, `/wanted/${o.wantedItemId}`);
    return u;
  });
  return serializeOffer(updated);
}
