import { beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { api, createCategory, createProduct, createUser, resetDb } from './helpers';

beforeEach(resetDb);

describe('הרשמה', () => {
  it('נרשמת בהצלחה, מקבלת Token, ללא חשיפת סיסמה', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'שרה לוי', email: 'Sara@Example.com', password: 'Sara1234', phone: '052-765-4321', city: 'אלעד' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ email: 'sara@example.com', role: 'USER', phone: '0527654321', productCount: 0 });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Sara1234');
  });

  it('אי אפשר להירשם כמנהל גם אם שולחים role', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'ניסיון', email: 'x@example.com', password: 'Abcd1234', phone: '0501111111', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('USER');
  });

  it('אימייל קיים מחזיר 409', async () => {
    const body = { name: 'שרה', email: 'dup@example.com', password: 'Abcd1234', phone: '0501111111' };
    await api().post('/api/auth/register').send(body).expect(201);
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('ולידציה: מחזיר 400 עם פירוט שדות בעברית', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'a', email: 'not-mail', password: 'short', phone: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password', 'phone']));
    expect(res.body.error.details[0].message).toMatch(/[א-ת]/);
  });

  it('JSON לא תקין מחזיר 400 INVALID_JSON', async () => {
    const res = await api().post('/api/auth/register').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('התחברות', () => {
  it('Login תקין מחזיר Token ופרטי משתמש', async () => {
    const { user, password } = await createUser();
    const cat = await createCategory();
    await createProduct(user.id, cat.id);
    const res = await api().post('/api/auth/login').send({ email: user.email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ id: user.id, role: 'USER', productCount: 1 });
    expect(res.body.user.passwordHash).toBeUndefined();
    const decoded = jwt.decode(res.body.token) as jwt.JwtPayload;
    expect(decoded.sub).toBe(String(user.id));
    expect(decoded.exp).toBeGreaterThan(decoded.iat!);
  });

  it('סיסמה שגויה מחזירה 401', async () => {
    const { user } = await createUser();
    const res = await api().post('/api/auth/login').send({ email: user.email, password: 'Wrong999' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('אימייל לא קיים מחזיר 401 עם אותה הודעה', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'nobody@test.dev', password: 'Wrong999' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('משתמש חסום מקבל 403', async () => {
    const { user, password } = await createUser({ isBlocked: true });
    const res = await api().post('/api/auth/login').send({ email: user.email, password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USER_BLOCKED');
  });
});

describe('Token ו-/auth/me', () => {
  it('ללא Token מחזיר 401', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('Token לא תקין מחזיר 401', async () => {
    const res = await api().get('/api/auth/me').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('Token חתום במפתח אחר מחזיר 401', async () => {
    const { user } = await createUser();
    const forged = jwt.sign({ role: 'ADMIN' }, 'some-other-secret-key-that-is-long-enough', { subject: String(user.id) });
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('Token שפג תוקפו מחזיר 401 TOKEN_EXPIRED', async () => {
    const { user } = await createUser();
    const expired = jwt.sign({ role: 'USER', exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET!, { subject: String(user.id) });
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('Token של משתמש שנחסם אחרי ההתחברות מחזיר 403', async () => {
    const { auth } = await createUser({ isBlocked: true });
    const res = await api().get('/api/auth/me').set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  it('מחזיר את פרטי המשתמש המחובר ומעדכן אותם', async () => {
    const { user, auth } = await createUser();
    const me = await api().get('/api/auth/me').set('Authorization', auth);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: user.id, email: user.email, productCount: 0 });
    expect(me.body.passwordHash).toBeUndefined();

    const upd = await api().put('/api/auth/me').set('Authorization', auth).send({ city: 'אלעד', phone: '053-111-2233' });
    expect(upd.status).toBe(200);
    expect(upd.body).toMatchObject({ city: 'אלעד', phone: '0531112233' });

    const empty = await api().put('/api/auth/me').set('Authorization', auth).send({});
    expect(empty.status).toBe(400);
  });
});
