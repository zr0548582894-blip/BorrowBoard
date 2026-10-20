import { beforeEach, describe, expect, it } from 'vitest';
import { api, createCategory, createUser, day, prisma, resetDb } from './helpers';

beforeEach(resetDb);

async function setup() {
  const requester = await createUser({ name: 'מרים' });
  const lender = await createUser({ name: 'יעל' });
  const lender2 = await createUser({ name: 'שרה' });
  const cat = await createCategory('ציוד לאירועים');
  const created = await api()
    .post('/api/wanted-items')
    .set('Authorization', requester.auth)
    .send({ title: 'מקרן', description: 'לערב אחד', categoryId: cat.id, city: 'ירושלים', neededFrom: day(3), neededUntil: day(4) });
  expect(created.status).toBe(201);
  return { requester, lender, lender2, cat, item: created.body };
}

describe('דף הבקשות', () => {
  it('מפרסמים, מחפשים ומסננים בקשות', async () => {
    const { item, cat } = await setup();
    expect(item).toMatchObject({ status: 'OPEN', neededFrom: day(3), neededUntil: day(4), pendingOffersCount: 0 });

    const list = await api().get('/api/wanted-items').query({ search: 'מקרן', categoryId: cat.id, city: 'ירושלים' });
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect((await api().get('/api/wanted-items').query({ city: 'חיפה' })).body.total).toBe(0);
    expect((await api().get('/api/wanted-items').query({ status: 'CLOSED' })).body.total).toBe(0);
    expect((await api().get(`/api/wanted-items/${item.id}`)).body.title).toBe('מקרן');
  });

  it('ולידציה של בקשה: תאריכים הפוכים נדחים', async () => {
    const { requester, cat } = await setup();
    const res = await api()
      .post('/api/wanted-items')
      .set('Authorization', requester.auth)
      .send({ title: 'כיסאות', description: 'x', categoryId: cat.id, city: 'אלעד', neededFrom: day(5), neededUntil: day(1) });
    expect(res.status).toBe(400);
  });

  it('רק מי שפרסמה עורכת; מנהל מוחק; אחרת לא מוחקת', async () => {
    const { requester, lender, item } = await setup();
    const admin = await createUser({ role: 'ADMIN' });
    expect((await api().put(`/api/wanted-items/${item.id}`).set('Authorization', lender.auth).send({ title: 'x1' })).status).toBe(403);
    const upd = await api().put(`/api/wanted-items/${item.id}`).set('Authorization', requester.auth).send({ description: 'עודכן', neededFrom: null });
    expect(upd.status).toBe(200);
    expect(upd.body).toMatchObject({ description: 'עודכן', neededFrom: null, neededUntil: day(4) });

    const mine = await api().get('/api/wanted-items/mine').set('Authorization', requester.auth);
    expect(mine.body).toHaveLength(1);

    expect((await api().delete(`/api/wanted-items/${item.id}`).set('Authorization', lender.auth)).status).toBe(403);
    expect((await api().delete(`/api/wanted-items/${item.id}`).set('Authorization', admin.auth)).status).toBe(204);
  });
});

describe('הצעות', () => {
  it('הצעה, ואישור שסוגר את הבקשה ודוחה הצעות אחרות', async () => {
    const { requester, lender, lender2, item } = await setup();

    const own = await api().post(`/api/wanted-items/${item.id}/offers`).set('Authorization', requester.auth).send({ message: 'שלי', condition: 'USED' });
    expect(own.status).toBe(403);

    const o1 = await api().post(`/api/wanted-items/${item.id}/offers`).set('Authorization', lender.auth).send({ message: 'יש לי מקרן', condition: 'USED' });
    expect(o1.status).toBe(201);
    expect(o1.body.offerer.phone).toBeNull();
    const dup = await api().post(`/api/wanted-items/${item.id}/offers`).set('Authorization', lender.auth).send({ message: 'שוב', condition: 'USED' });
    expect(dup.body.error.code).toBe('DUPLICATE_OFFER');
    const o2 = await api().post(`/api/wanted-items/${item.id}/offers`).set('Authorization', lender2.auth).send({ message: 'גם לי', condition: 'NEW' });
    expect(o2.status).toBe(201);

    expect((await api().get(`/api/wanted-items/${item.id}`)).body.pendingOffersCount).toBe(2);
    const received = await api().get('/api/offers').query({ box: 'received' }).set('Authorization', requester.auth);
    expect(received.body).toHaveLength(2);
    const sent = await api().get('/api/offers').query({ box: 'sent' }).set('Authorization', lender.auth);
    expect(sent.body).toHaveLength(1);

    expect((await api().patch(`/api/offers/${o1.body.id}/accept`).set('Authorization', lender.auth)).status).toBe(403);
    const accepted = await api().patch(`/api/offers/${o1.body.id}/accept`).set('Authorization', requester.auth);
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('ACCEPTED');
    expect(accepted.body.wantedItem.status).toBe('CLOSED');
    expect(accepted.body.offerer.phone).toBe(lender.user.phone);
    expect(accepted.body.requester.phone).toBe(requester.user.phone);

    expect((await prisma.offer.findUnique({ where: { id: o2.body.id } }))!.status).toBe('REJECTED');
    const late = await api().post(`/api/wanted-items/${item.id}/offers`).set('Authorization', lender2.auth).send({ message: 'מאוחר', condition: 'USED' });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('WANTED_ITEM_CLOSED');

    const notes = await prisma.notification.findMany({ where: { userId: lender2.user.id } });
    expect(notes.map((n) => n.type)).toContain('OFFER_REJECTED');
  });

  it('דחייה וביטול של הצעה', async () => {
    const { requester, lender, lender2, item } = await setup();
    const o1 = await api().post(`/api/wanted-items/${item.id}/offers`).set('Authorization', lender.auth).send({ message: 'א', condition: 'USED' });
    const o2 = await api().post(`/api/wanted-items/${item.id}/offers`).set('Authorization', lender2.auth).send({ message: 'ב', condition: 'USED' });

    expect((await api().patch(`/api/offers/${o1.body.id}/reject`).set('Authorization', requester.auth)).body.status).toBe('REJECTED');
    expect((await api().patch(`/api/offers/${o2.body.id}/cancel`).set('Authorization', requester.auth)).status).toBe(403);
    expect((await api().patch(`/api/offers/${o2.body.id}/cancel`).set('Authorization', lender2.auth)).body.status).toBe('CANCELLED');
    expect((await api().patch(`/api/offers/${o2.body.id}/cancel`).set('Authorization', lender2.auth)).status).toBe(409);
  });
});
