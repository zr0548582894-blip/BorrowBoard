import { beforeEach, describe, expect, it } from 'vitest';
import { PNG_1PX, api, app, createCategory, createUser, prisma, resetDb } from './helpers';
import { openApiDocument } from '../src/docs/openapi';

beforeEach(resetDb);

describe('בריאות ו-CORS', () => {
  it('GET /api/health מחזיר ok ומצב מסד הנתונים', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('נתיב לא קיים מחזיר 404 בפורמט אחיד', async () => {
    const res = await api().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('CORS מאפשר רק את הכתובת שהוגדרה', async () => {
    const ok = await api().get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await api().get('/api/health').set('Origin', 'http://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('תמונות', () => {
  it('העלאה, הצגה ושימוש במוצר', async () => {
    const user = await createUser();
    const cat = await createCategory();
    const up = await api().post('/api/images').set('Authorization', user.auth).attach('image', PNG_1PX, { filename: 'a.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.url).toBe(`/api/images/${up.body.id}`);

    const img = await api().get(up.body.url);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(img.body as Buffer, PNG_1PX)).toBe(0);

    const product = await api()
      .post('/api/products')
      .set('Authorization', user.auth)
      .send({ name: 'עם תמונה', description: 'x', categoryId: cat.id, condition: 'NEW', city: 'אלעד', imageUrl: up.body.url });
    expect(product.status).toBe(201);
    expect(product.body.imageUrl).toBe(up.body.url);
  });

  it('דוחה קובץ שאינו תמונה, קובץ גדול, ללא קובץ, וללא התחברות', async () => {
    const user = await createUser();
    const txt = await api().post('/api/images').set('Authorization', user.auth).attach('image', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(txt.status).toBe(400);
    expect(txt.body.error.code).toBe('INVALID_FILE_TYPE');

    const fake = await api().post('/api/images').set('Authorization', user.auth).attach('image', Buffer.from('not really a png'), { filename: 'a.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);

    const big = Buffer.concat([PNG_1PX, Buffer.alloc(2 * 1024 * 1024 + 10)]);
    const tooBig = await api().post('/api/images').set('Authorization', user.auth).attach('image', big, { filename: 'b.png', contentType: 'image/png' });
    expect(tooBig.status).toBe(413);

    expect((await api().post('/api/images').set('Authorization', user.auth)).body.error.code).toBe('FILE_REQUIRED');
    expect((await api().post('/api/images').attach('image', PNG_1PX, 'a.png')).status).toBe(401);
    expect((await api().get('/api/images/999')).status).toBe(404);
  });
});

describe('הודעות', () => {
  it('כל משתמשת רואה ומסמנת רק את ההודעות שלה', async () => {
    const a = await createUser();
    const b = await createUser();
    await prisma.notification.createMany({
      data: [
        { userId: a.user.id, type: 'BORROW_REQUESTED', text: 'א1' },
        { userId: a.user.id, type: 'OFFER_RECEIVED', text: 'א2' },
        { userId: b.user.id, type: 'OFFER_RECEIVED', text: 'ב1' },
      ],
    });
    const list = await api().get('/api/notifications').set('Authorization', a.auth);
    expect(list.body.unreadCount).toBe(2);
    expect(list.body.items).toHaveLength(2);

    const bNote = await prisma.notification.findFirstOrThrow({ where: { userId: b.user.id } });
    expect((await api().patch(`/api/notifications/${bNote.id}/read`).set('Authorization', a.auth)).status).toBe(404);

    const first = list.body.items[0];
    const read = await api().patch(`/api/notifications/${first.id}/read`).set('Authorization', a.auth);
    expect(read.body.isRead).toBe(true);
    expect((await api().get('/api/notifications').query({ unread: 'true' }).set('Authorization', a.auth)).body.items).toHaveLength(1);

    expect((await api().patch('/api/notifications/read-all').set('Authorization', a.auth)).body.updated).toBe(1);
    expect((await api().get('/api/notifications').set('Authorization', b.auth)).body.unreadCount).toBe(1);
  });
});

describe('Swagger / OpenAPI', () => {
  it('Swagger UI ו-openapi.json זמינים', async () => {
    const ui = await api().get('/api-docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');
    const spec = await api().get('/openapi.json');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toMatch(/^3\./);
    expect(spec.body.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  });

  it('כל נתיב בשרת מתועד ב-Swagger, וכל נתיב מתועד קיים בשרת', () => {
    // אוסף את כל הנתיבים מה-Router של /api
    type Layer = { route?: { path: string; methods: Record<string, boolean> }; name?: string; handle?: { stack?: Layer[] } };
    const root = (app as unknown as { router: { stack: Layer[] } }).router.stack;
    const apiRouter = root.find((l) => l.name === 'router')!;
    const actual = new Set<string>();
    for (const layer of apiRouter.handle!.stack!) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) {
        actual.add(`${method.toUpperCase()} /api${layer.route.path.replace(/:(\w+)/g, '{$1}')}`);
      }
    }
    const documented = new Set<string>();
    for (const [path, ops] of Object.entries(openApiDocument.paths)) {
      for (const method of Object.keys(ops)) documented.add(`${method.toUpperCase()} ${path}`);
    }
    expect([...actual].sort()).toEqual([...documented].sort());
  });

  it('כל נתיב מוגן מוגדר עם Bearer ומתעד 401 ו-403', () => {
    for (const [path, ops] of Object.entries(openApiDocument.paths)) {
      for (const [method, op] of Object.entries(ops as Record<string, { security?: unknown; responses: Record<string, unknown> }>)) {
        if (op.security) {
          expect(op.responses, `${method} ${path}`).toHaveProperty('401');
          expect(op.responses, `${method} ${path}`).toHaveProperty('403');
        }
      }
    }
  });
});
