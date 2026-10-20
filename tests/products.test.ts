import { beforeEach, describe, expect, it } from 'vitest';
import { api, createCategory, createProduct, createUser, day, prisma, resetDb } from './helpers';

beforeEach(resetDb);

const validProduct = (categoryId: number) => ({
  name: 'סיר לחץ',
  description: 'במצב מצוין',
  categoryId,
  condition: 'LIKE_NEW',
  city: 'בני ברק',
  maxDays: 14,
});

describe('הוספת מוצר', () => {
  it('משתמשת מחוברת מוסיפה מוצר, הבעלים נקבע לפי ה-Token', async () => {
    const owner = await createUser();
    const other = await createUser();
    const cat = await createCategory();
    const res = await api()
      .post('/api/products')
      .set('Authorization', owner.auth)
      .send({ ...validProduct(cat.id), ownerId: other.user.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'סיר לחץ', ownerId: owner.user.id, status: 'AVAILABLE', category: { id: cat.id } });
    expect(res.body.owner.phone).toBeUndefined();
  });

  it('אורח מקבל 401, מנהל מקבל 403', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const cat = await createCategory();
    expect((await api().post('/api/products').send(validProduct(cat.id))).status).toBe(401);
    expect((await api().post('/api/products').set('Authorization', admin.auth).send(validProduct(cat.id))).status).toBe(403);
  });

  it('ולידציה: שדות חסרים ומצב לא חוקי', async () => {
    const owner = await createUser();
    const res = await api().post('/api/products').set('Authorization', owner.auth).send({ name: 'x', condition: 'BROKEN' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'description', 'categoryId', 'condition', 'city']));
  });

  it('קטגוריה לא קיימת מחזירה 400', async () => {
    const owner = await createUser();
    const res = await api().post('/api/products').set('Authorization', owner.auth).send(validProduct(999));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CATEGORY');
  });

  it('imageUrl לא תקין או תמונה שלא קיימת נדחים', async () => {
    const owner = await createUser();
    const cat = await createCategory();
    const bad = await api().post('/api/products').set('Authorization', owner.auth).send({ ...validProduct(cat.id), imageUrl: 'javascript:alert(1)' });
    expect(bad.status).toBe(400);
    const missing = await api().post('/api/products').set('Authorization', owner.auth).send({ ...validProduct(cat.id), imageUrl: '/api/images/999' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('INVALID_IMAGE');
  });
});

describe('רשימה, חיפוש וסינון', () => {
  it('מחפש, מסנן, ממיין ומחלק לעמודים', async () => {
    const a = await createUser();
    const b = await createUser();
    const kitchen = await createCategory('כלי מטבח');
    const tools = await createCategory('כלי עבודה');
    await createProduct(a.user.id, kitchen.id, { name: 'סיר לחץ', city: 'בני ברק', condition: 'NEW' });
    await createProduct(a.user.id, tools.id, { name: 'מקדחה', city: 'בני ברק', description: 'מקדחה רוטטת' });
    const borrowed = await createProduct(b.user.id, kitchen.id, { name: 'מיחם', city: 'ירושלים' });
    await prisma.borrowRequest.create({
      data: { productId: borrowed.id, borrowerId: a.user.id, startDate: new Date(`${day(0)}T00:00:00Z`), endDate: new Date(`${day(2)}T00:00:00Z`), status: 'APPROVED' },
    });

    const all = await api().get('/api/products');
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);

    const search = await api().get('/api/products').query({ search: 'רוטטת' });
    expect(search.body.items.map((p: { name: string }) => p.name)).toEqual(['מקדחה']);

    const byCat = await api().get('/api/products').query({ categoryId: kitchen.id });
    expect(byCat.body.total).toBe(2);

    const byCity = await api().get('/api/products').query({ city: 'ירושלים' });
    expect(byCity.body.items).toHaveLength(1);

    const byCondition = await api().get('/api/products').query({ condition: 'NEW' });
    expect(byCondition.body.items[0].name).toBe('סיר לחץ');

    const borrowedNow = await api().get('/api/products').query({ status: 'BORROWED' });
    expect(borrowedNow.body.items.map((p: { name: string; status: string }) => [p.name, p.status])).toEqual([['מיחם', 'BORROWED']]);

    const available = await api().get('/api/products').query({ status: 'AVAILABLE' });
    expect(available.body.total).toBe(2);

    const byName = await api().get('/api/products').query({ sort: 'name' });
    expect(byName.body.items.map((p: { name: string }) => p.name)).toEqual(['מיחם', 'מקדחה', 'סיר לחץ']);

    const paged = await api().get('/api/products').query({ limit: 2, page: 2 });
    expect(paged.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(paged.body.items).toHaveLength(1);

    const badQuery = await api().get('/api/products').query({ limit: 500 });
    expect(badQuery.status).toBe(400);
  });

  it('מוצר בודד כולל תקופות תפוסות, ו-404 למוצר שלא קיים', async () => {
    const a = await createUser();
    const b = await createUser();
    const cat = await createCategory();
    const p = await createProduct(a.user.id, cat.id);
    await prisma.borrowRequest.create({
      data: { productId: p.id, borrowerId: b.user.id, startDate: new Date(`${day(5)}T00:00:00Z`), endDate: new Date(`${day(7)}T00:00:00Z`), status: 'APPROVED' },
    });
    const res = await api().get(`/api/products/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('AVAILABLE');
    expect(res.body.bookedPeriods).toEqual([{ startDate: day(5), endDate: day(7) }]);
    expect(JSON.stringify(res.body.bookedPeriods)).not.toContain(b.user.name);

    expect((await api().get('/api/products/9999')).status).toBe(404);
    expect((await api().get('/api/products/abc')).status).toBe(400);
  });

  it('/products/mine מחזיר רק את המוצרים שלי עם מספר בקשות ממתינות', async () => {
    const a = await createUser();
    const b = await createUser();
    const cat = await createCategory();
    const mine = await createProduct(a.user.id, cat.id, { name: 'שלי' });
    await createProduct(b.user.id, cat.id, { name: 'לא שלי' });
    await prisma.borrowRequest.create({
      data: { productId: mine.id, borrowerId: b.user.id, startDate: new Date(`${day(1)}T00:00:00Z`), endDate: new Date(`${day(2)}T00:00:00Z`) },
    });
    const res = await api().get('/api/products/mine').set('Authorization', a.auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: 'שלי', pendingRequestsCount: 1 });
  });
});

describe('עריכה ומחיקה', () => {
  it('רק הבעלים יכולה לערוך; מנהל לא יכול לערוך', async () => {
    const owner = await createUser();
    const other = await createUser();
    const admin = await createUser({ role: 'ADMIN' });
    const cat = await createCategory();
    const p = await createProduct(owner.user.id, cat.id);

    const ok = await api().put(`/api/products/${p.id}`).set('Authorization', owner.auth).send({ name: 'שם חדש', maxDays: null });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ name: 'שם חדש', maxDays: null });

    const forbidden = await api().put(`/api/products/${p.id}`).set('Authorization', other.auth).send({ name: 'פריצה' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('NOT_OWNER');

    expect((await api().put(`/api/products/${p.id}`).set('Authorization', admin.auth).send({ name: 'מנהל' })).status).toBe(403);
    expect((await api().put(`/api/products/${p.id}`).set('Authorization', owner.auth).send({})).status).toBe(400);
    expect((await prisma.product.findUnique({ where: { id: p.id } }))!.name).toBe('שם חדש');
  });

  it('הבעלים מוחקת מוצר; לא כשיש השאלה מאושרת; מנהל מוחק תמיד', async () => {
    const owner = await createUser();
    const borrower = await createUser();
    const admin = await createUser({ role: 'ADMIN' });
    const cat = await createCategory();
    const free = await createProduct(owner.user.id, cat.id);
    const lent = await createProduct(owner.user.id, cat.id);
    await prisma.borrowRequest.create({
      data: { productId: lent.id, borrowerId: borrower.user.id, startDate: new Date(`${day(3)}T00:00:00Z`), endDate: new Date(`${day(4)}T00:00:00Z`), status: 'APPROVED' },
    });

    expect((await api().delete(`/api/products/${free.id}`).set('Authorization', borrower.auth)).status).toBe(403);
    expect((await api().delete(`/api/products/${free.id}`).set('Authorization', owner.auth)).status).toBe(204);

    const blocked = await api().delete(`/api/products/${lent.id}`).set('Authorization', owner.auth);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('PRODUCT_BORROWED');

    expect((await api().delete(`/api/products/${lent.id}`).set('Authorization', admin.auth)).status).toBe(204);
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.borrowRequest.count()).toBe(0);
  });
});
