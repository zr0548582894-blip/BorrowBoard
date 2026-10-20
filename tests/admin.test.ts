import { beforeEach, describe, expect, it } from 'vitest';
import { api, createCategory, createProduct, createUser, prisma, resetDb } from './helpers';

beforeEach(resetDb);

describe('הרשאות מנהל', () => {
  it('משתמשת רגילה מקבלת 403 בנתיבי מנהל, אורח 401', async () => {
    const user = await createUser();
    for (const path of ['/api/admin/stats', '/api/admin/users']) {
      expect((await api().get(path).set('Authorization', user.auth)).status).toBe(403);
      expect((await api().get(path)).status).toBe(401);
    }
  });

  it('לוח מנהל מחזיר סטטיסטיקות', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const user = await createUser();
    const cat = await createCategory();
    await createProduct(user.user.id, cat.id);
    const res = await api().get('/api/admin/stats').set('Authorization', admin.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ users: 2, products: 1, available: 1, borrowed: 0, pendingRequests: 0, categories: 1 });
  });

  it('רשימת משתמשים עם חיפוש, ללא סיסמאות', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    await createUser({ name: 'רבקה' });
    const res = await api().get('/api/admin/users').query({ search: 'רבקה' }).set('Authorization', admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].passwordHash).toBeUndefined();
    expect(res.body.items[0]).toHaveProperty('productCount', 0);
  });

  it('חסימה וביטול חסימה', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const otherAdmin = await createUser({ role: 'ADMIN' });
    const user = await createUser();

    const blocked = await api().patch(`/api/admin/users/${user.user.id}/block`).set('Authorization', admin.auth);
    expect(blocked.status).toBe(200);
    expect(blocked.body.isBlocked).toBe(true);
    // ה-Token הקיים של המשתמשת החסומה מפסיק לעבוד מיד
    expect((await api().get('/api/auth/me').set('Authorization', user.auth)).status).toBe(403);
    expect((await api().post('/api/auth/login').send({ email: user.user.email, password: user.password })).status).toBe(403);

    const unblocked = await api().patch(`/api/admin/users/${user.user.id}/unblock`).set('Authorization', admin.auth);
    expect(unblocked.body.isBlocked).toBe(false);
    expect((await api().get('/api/auth/me').set('Authorization', user.auth)).status).toBe(200);

    expect((await api().patch(`/api/admin/users/${admin.user.id}/block`).set('Authorization', admin.auth)).body.error.code).toBe('CANNOT_BLOCK_SELF');
    expect((await api().patch(`/api/admin/users/${otherAdmin.user.id}/block`).set('Authorization', admin.auth)).body.error.code).toBe('CANNOT_BLOCK_ADMIN');
    expect((await api().patch('/api/admin/users/9999/block').set('Authorization', admin.auth)).status).toBe(404);
    expect((await api().patch(`/api/admin/users/${admin.user.id}/block`).set('Authorization', user.auth)).status).toBe(403);
  });
});

describe('קטגוריות', () => {
  it('כולם רואים, רק מנהל מוסיף/עורך/מוחק', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const user = await createUser();

    expect((await api().post('/api/categories').set('Authorization', user.auth).send({ name: 'ספרים' })).status).toBe(403);
    const created = await api().post('/api/categories').set('Authorization', admin.auth).send({ name: 'ספרים' });
    expect(created.status).toBe(201);
    expect((await api().post('/api/categories').set('Authorization', admin.auth).send({ name: 'ספרים' })).status).toBe(409);

    const list = await api().get('/api/categories');
    expect(list.body).toEqual([{ id: created.body.id, name: 'ספרים' }]);

    const renamed = await api().put(`/api/categories/${created.body.id}`).set('Authorization', admin.auth).send({ name: 'ספרי קודש' });
    expect(renamed.body.name).toBe('ספרי קודש');

    await createProduct(user.user.id, created.body.id);
    const inUse = await api().delete(`/api/categories/${created.body.id}`).set('Authorization', admin.auth);
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.code).toBe('CATEGORY_IN_USE');

    const empty = await createCategory('ריקה');
    expect((await api().delete(`/api/categories/${empty.id}`).set('Authorization', admin.auth)).status).toBe(204);
    expect(await prisma.category.count()).toBe(1);
  });
});
