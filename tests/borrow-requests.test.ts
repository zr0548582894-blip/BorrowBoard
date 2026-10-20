import { beforeEach, describe, expect, it } from 'vitest';
import { api, createCategory, createProduct, createUser, day, prisma, resetDb } from './helpers';

beforeEach(resetDb);

async function setup(maxDays: number | null = null) {
  const owner = await createUser({ name: 'יעל' });
  const borrower = await createUser({ name: 'מרים' });
  const third = await createUser({ name: 'שרה' });
  const cat = await createCategory();
  const product = await createProduct(owner.user.id, cat.id, { name: 'מיחם', maxDays });
  return { owner, borrower, third, product };
}

const send = (productId: number, auth: string, body: object) =>
  api().post(`/api/products/${productId}/borrow-requests`).set('Authorization', auth).send(body);

describe('שליחת בקשת השאלה', () => {
  it('נשלחת בקשה ונוצרת הודעה לבעלים', async () => {
    const { owner, borrower, product } = await setup();
    const res = await send(product.id, borrower.auth, { startDate: day(1), endDate: day(3), message: 'לשבת' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDING', startDate: day(1), endDate: day(3), product: { id: product.id } });
    expect(res.body.owner.phone).toBeNull();
    expect(res.body.borrower.phone).toBeNull();

    const notes = await prisma.notification.findMany({ where: { userId: owner.user.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe('BORROW_REQUESTED');
  });

  it('אי אפשר לבקש מוצר של עצמך', async () => {
    const { owner, product } = await setup();
    const res = await send(product.id, owner.auth, { startDate: day(1), endDate: day(2) });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OWN_PRODUCT');
  });

  it('ולידציה של תאריכים: עבר, סדר, פורמט ו-maxDays', async () => {
    const { borrower, product } = await setup(3);
    expect((await send(product.id, borrower.auth, { startDate: day(-1), endDate: day(1) })).body.error.code).toBe('START_IN_PAST');
    expect((await send(product.id, borrower.auth, { startDate: day(3), endDate: day(1) })).status).toBe(400);
    expect((await send(product.id, borrower.auth, { startDate: '01/11/2026', endDate: day(1) })).status).toBe(400);
    const tooLong = await send(product.id, borrower.auth, { startDate: day(1), endDate: day(4) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.code).toBe('TOO_LONG');
    expect((await send(product.id, borrower.auth, { startDate: day(1), endDate: day(3) })).status).toBe(201);
  });

  it('בקשה ממתינה כפולה מחזירה 409', async () => {
    const { borrower, product } = await setup();
    await send(product.id, borrower.auth, { startDate: day(1), endDate: day(2) }).expect(201);
    const res = await send(product.id, borrower.auth, { startDate: day(5), endDate: day(6) });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_REQUEST');
  });

  it('מנהל ואורח לא יכולים לשלוח בקשה', async () => {
    const { product } = await setup();
    const admin = await createUser({ role: 'ADMIN' });
    expect((await send(product.id, admin.auth, { startDate: day(1), endDate: day(2) })).status).toBe(403);
    expect((await api().post(`/api/products/${product.id}/borrow-requests`).send({ startDate: day(1), endDate: day(2) })).status).toBe(401);
  });
});

describe('אישור, דחייה, החזרה וביטול', () => {
  it('אישור דוחה רק בקשות חופפות; בקשה לתאריכים אחרים נשארת ואפשר לבקש שוב בעתיד', async () => {
    const { owner, borrower, third, product } = await setup();
    const fourth = await createUser();
    const first = await send(product.id, borrower.auth, { startDate: day(0), endDate: day(3) });
    const overlapping = await send(product.id, third.auth, { startDate: day(2), endDate: day(5) });
    const later = await send(product.id, fourth.auth, { startDate: day(14), endDate: day(16) });

    const approved = await api().patch(`/api/borrow-requests/${first.body.id}/approve`).set('Authorization', owner.auth);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
    // אחרי אישור - הטלפונים נחשפים
    expect(approved.body.borrower.phone).toBe(borrower.user.phone);
    expect(approved.body.owner.phone).toBe(owner.user.phone);

    const statuses = Object.fromEntries(
      (await prisma.borrowRequest.findMany()).map((r) => [r.id, r.status]),
    );
    expect(statuses[overlapping.body.id]).toBe('REJECTED');
    expect(statuses[later.body.id]).toBe('PENDING');

    // המוצר מושאל עכשיו (ההשאלה התחילה היום)
    expect((await api().get(`/api/products/${product.id}`)).body.status).toBe('BORROWED');

    // בקשה חדשה חופפת להשאלה מאושרת - 409
    const clash = await send(product.id, third.auth, { startDate: day(1), endDate: day(2) });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('DATES_TAKEN');

    // בקשה לעוד שבועיים - מותרת למרות שהמוצר מושאל כרגע
    const future = await send(product.id, third.auth, { startDate: day(20), endDate: day(22) });
    expect(future.status).toBe(201);

    // הודעות לצדדים
    const thirdNotes = await prisma.notification.findMany({ where: { userId: third.user.id } });
    expect(thirdNotes.map((n) => n.type)).toContain('BORROW_REJECTED');
    const borrowerNotes = await prisma.notification.findMany({ where: { userId: borrower.user.id } });
    expect(borrowerNotes.map((n) => n.type)).toContain('BORROW_APPROVED');
  });

  it('רק הבעלים מאשרת או דוחה, ורק בקשה ממתינה', async () => {
    const { owner, borrower, third, product } = await setup();
    const r = await send(product.id, borrower.auth, { startDate: day(1), endDate: day(2) });
    expect((await api().patch(`/api/borrow-requests/${r.body.id}/approve`).set('Authorization', borrower.auth)).status).toBe(403);
    expect((await api().patch(`/api/borrow-requests/${r.body.id}/reject`).set('Authorization', third.auth)).status).toBe(403);

    const rejected = await api().patch(`/api/borrow-requests/${r.body.id}/reject`).set('Authorization', owner.auth);
    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.borrower.phone).toBeNull();

    const again = await api().patch(`/api/borrow-requests/${r.body.id}/approve`).set('Authorization', owner.auth);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_STATUS');
    expect((await api().patch('/api/borrow-requests/9999/approve').set('Authorization', owner.auth)).status).toBe(404);
  });

  it('סימון "הוחזר" מחזיר את המוצר לזמין', async () => {
    const { owner, borrower, product } = await setup();
    const r = await send(product.id, borrower.auth, { startDate: day(0), endDate: day(2) });
    await api().patch(`/api/borrow-requests/${r.body.id}/approve`).set('Authorization', owner.auth).expect(200);
    expect((await api().get(`/api/products/${product.id}`)).body.status).toBe('BORROWED');

    expect((await api().patch(`/api/borrow-requests/${r.body.id}/return`).set('Authorization', borrower.auth)).status).toBe(403);
    const returned = await api().patch(`/api/borrow-requests/${r.body.id}/return`).set('Authorization', owner.auth);
    expect(returned.body.status).toBe('RETURNED');
    expect((await api().get(`/api/products/${product.id}`)).body.status).toBe('AVAILABLE');
  });

  it('רק הלווה מבטלת בקשה ממתינה', async () => {
    const { owner, borrower, product } = await setup();
    const r = await send(product.id, borrower.auth, { startDate: day(1), endDate: day(2) });
    expect((await api().patch(`/api/borrow-requests/${r.body.id}/cancel`).set('Authorization', owner.auth)).status).toBe(403);
    const cancelled = await api().patch(`/api/borrow-requests/${r.body.id}/cancel`).set('Authorization', borrower.auth);
    expect(cancelled.body.status).toBe('CANCELLED');
  });
});

describe('פרטיות רשימת הבקשות', () => {
  it('כל משתמשת רואה רק בקשות ששלחה או שקיבלה', async () => {
    const { owner, borrower, third, product } = await setup();
    await send(product.id, borrower.auth, { startDate: day(1), endDate: day(2) }).expect(201);

    const sent = await api().get('/api/borrow-requests').query({ box: 'sent' }).set('Authorization', borrower.auth);
    expect(sent.body).toHaveLength(1);
    const received = await api().get('/api/borrow-requests').query({ box: 'received' }).set('Authorization', owner.auth);
    expect(received.body).toHaveLength(1);
    const ownerSent = await api().get('/api/borrow-requests').set('Authorization', owner.auth);
    expect(ownerSent.body).toHaveLength(0);

    for (const box of ['sent', 'received']) {
      const res = await api().get('/api/borrow-requests').query({ box }).set('Authorization', third.auth);
      expect(res.body).toHaveLength(0);
    }

    const filtered = await api().get('/api/borrow-requests').query({ box: 'received', status: 'APPROVED' }).set('Authorization', owner.auth);
    expect(filtered.body).toHaveLength(0);
    expect((await api().get('/api/borrow-requests')).status).toBe(401);
  });
});
