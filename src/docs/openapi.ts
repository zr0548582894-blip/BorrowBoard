/* eslint-disable @typescript-eslint/no-explicit-any */
// תיעוד OpenAPI 3 של כל ה-API. מוצג ב-/api-docs ונשמר גם בקובץ openapi.json (npm run openapi).

type Auth = 'public' | 'user' | 'admin' | 'any' | 'userOrAdmin';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const errRef = (name: string) => ({ $ref: `#/components/responses/${name}` });

const authText: Record<Auth, string> = {
  public: '🌐 ציבורי - ללא Token',
  user: '🔒 משתמש רגיל (USER) בלבד',
  admin: '🔒 מנהל (ADMIN) בלבד',
  any: '🔒 כל משתמש מחובר',
  userOrAdmin: '🔒 USER (בעלים) או ADMIN',
};

interface OpOptions {
  tag: string;
  summary: string;
  description?: string;
  auth: Auth;
  pathId?: string;
  query?: any[];
  body?: { schema: any; example?: any; multipart?: boolean };
  ok: { status?: number; description: string; schema?: any; example?: any; binary?: boolean };
  errors?: number[];
}

function op(o: OpOptions) {
  const params: any[] = [];
  if (o.pathId) {
    params.push({ name: 'id', in: 'path', required: true, description: o.pathId, schema: { type: 'integer', minimum: 1 } });
  }
  if (o.query) params.push(...o.query);

  const responses: Record<string, any> = {};
  const status = String(o.ok.status ?? 200);
  if (status === '204') {
    responses[status] = { description: o.ok.description };
  } else if (o.ok.binary) {
    responses[status] = {
      description: o.ok.description,
      content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } }, 'image/png': { schema: { type: 'string', format: 'binary' } }, 'image/webp': { schema: { type: 'string', format: 'binary' } } },
    };
  } else {
    responses[status] = {
      description: o.ok.description,
      content: { 'application/json': { schema: o.ok.schema, ...(o.ok.example !== undefined && { example: o.ok.example }) } },
    };
  }

  const errors = new Set(o.errors ?? []);
  if (o.body || o.query?.length || o.pathId) errors.add(400);
  if (o.auth !== 'public') {
    errors.add(401);
    errors.add(403);
  }
  if (o.pathId) errors.add(404);
  for (const code of [...errors].sort()) {
    responses[String(code)] = errRef(
      ({ 400: 'BadRequest', 401: 'Unauthorized', 403: 'Forbidden', 404: 'NotFound', 409: 'Conflict', 413: 'TooLarge' } as Record<number, string>)[code],
    );
  }

  return {
    tags: [o.tag],
    summary: o.summary,
    description: `${authText[o.auth]}${o.description ? `\n\n${o.description}` : ''}`,
    ...(o.auth !== 'public' && { security: [{ bearerAuth: [] }] }),
    ...(params.length && { parameters: params }),
    ...(o.body && {
      requestBody: {
        required: true,
        content: o.body.multipart
          ? { 'multipart/form-data': { schema: o.body.schema } }
          : { 'application/json': { schema: o.body.schema, ...(o.body.example !== undefined && { example: o.body.example }) } },
      },
    }),
    responses,
  };
}

const q = (name: string, description: string, schema: any) => ({ name, in: 'query', required: false, description, schema });
const pageParams = [
  q('page', 'מספר עמוד (מתחיל ב-1)', { type: 'integer', minimum: 1, default: 1 }),
  q('limit', 'כמות פריטים בעמוד (עד 50)', { type: 'integer', minimum: 1, maximum: 50, default: 12 }),
];
const sortParam = q('sort', 'מיון: newest (חדש קודם), oldest, name (לפי שם)', { type: 'string', enum: ['newest', 'oldest', 'name'], default: 'newest' });

const date = { type: 'string', format: 'date', example: '2026-11-01' };
const dateTime = { type: 'string', format: 'date-time' };
const condition = { type: 'string', enum: ['NEW', 'LIKE_NEW', 'USED'], description: 'NEW=חדש, LIKE_NEW=כמו חדש, USED=משומש' };
const imageUrl = { type: 'string', nullable: true, maxLength: 500, example: '/api/images/3', description: 'כתובת שהתקבלה מ-POST /api/images, או קישור http/https' };
const pageOf = (item: string) => ({
  type: 'object',
  properties: {
    items: { type: 'array', items: ref(item) },
    total: { type: 'integer', example: 23 },
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 12 },
    totalPages: { type: 'integer', example: 2 },
  },
});
const personPublic = { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, city: { type: 'string', nullable: true } } };
const personContact = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    city: { type: 'string', nullable: true },
    phone: { type: 'string', nullable: true, description: 'מוצג רק אחרי אישור. לפני כן null' },
  },
};

const examples = {
  user: { id: 2, name: 'יעל כהן', email: 'user@borrowboard.dev', phone: '0501234567', city: 'בני ברק', role: 'USER', isBlocked: false, createdAt: '2026-10-19T08:00:00.000Z', productCount: 3 },
  product: {
    id: 12, ownerId: 2, name: 'סיר לחץ 6 ליטר', description: 'סיר לחץ במצב מצוין, כולל מכסה.', categoryId: 3, condition: 'LIKE_NEW', city: 'בני ברק',
    imageUrl: '/api/images/3', maxDays: 14, createdAt: '2026-10-19T08:00:00.000Z', updatedAt: '2026-10-19T08:00:00.000Z',
    status: 'AVAILABLE', category: { id: 3, name: 'כלי מטבח' }, owner: { id: 2, name: 'יעל כהן', city: 'בני ברק' },
  },
  borrowRequest: {
    id: 7, status: 'PENDING', startDate: '2026-11-01', endDate: '2026-11-05', message: 'צריכה לשבת', createdAt: '2026-10-19T08:00:00.000Z', updatedAt: '2026-10-19T08:00:00.000Z',
    product: { id: 12, name: 'סיר לחץ 6 ליטר', imageUrl: '/api/images/3' },
    borrower: { id: 3, name: 'מרים לוי', city: 'ירושלים', phone: null },
    owner: { id: 2, name: 'יעל כהן', city: 'בני ברק', phone: null },
  },
  wantedItem: {
    id: 4, requesterId: 3, title: 'עגלת תינוק', description: 'צריכה עגלה לשבועיים', categoryId: 5, city: 'ירושלים', imageUrl: null,
    neededFrom: '2026-11-01', neededUntil: '2026-11-14', status: 'OPEN', createdAt: '2026-10-19T08:00:00.000Z', updatedAt: '2026-10-19T08:00:00.000Z',
    category: { id: 5, name: 'ציוד לתינוקות' }, requester: { id: 3, name: 'מרים לוי', city: 'ירושלים' }, pendingOffersCount: 1,
  },
  offer: {
    id: 9, status: 'PENDING', message: 'יש לי עגלה במצב טוב', condition: 'USED', imageUrl: null, createdAt: '2026-10-19T08:00:00.000Z',
    wantedItem: { id: 4, title: 'עגלת תינוק', status: 'OPEN' },
    offerer: { id: 2, name: 'יעל כהן', city: 'בני ברק', phone: null },
    requester: { id: 3, name: 'מרים לוי', city: 'ירושלים', phone: null },
  },
};

const schemas = {
  Error: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'הנתונים שנשלחו אינם תקינים' },
          details: {
            type: 'array',
            items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } },
          },
        },
        required: ['code', 'message'],
      },
    },
  },
  Health: {
    type: 'object',
    properties: { status: { type: 'string', example: 'ok' }, db: { type: 'string', example: 'up' }, uptimeSeconds: { type: 'integer' }, timestamp: dateTime },
  },
  User: {
    type: 'object',
    properties: {
      id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' },
      city: { type: 'string', nullable: true }, role: { type: 'string', enum: ['USER', 'ADMIN'] }, isBlocked: { type: 'boolean' },
      createdAt: dateTime, productCount: { type: 'integer', description: 'כמה מוצרים המשתמש העלה (לתזכורת "גם לך יש מה להשאיל?")' },
    },
    example: examples.user,
  },
  AuthResponse: {
    type: 'object',
    properties: { token: { type: 'string', description: 'JWT - יש לשלוח בכותרת Authorization: Bearer <token>' }, user: ref('User') },
  },
  RegisterInput: {
    type: 'object',
    required: ['name', 'email', 'password', 'phone'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 50 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8, description: 'לפחות 8 תווים, אות באנגלית וספרה' },
      phone: { type: 'string', example: '050-1234567' },
      city: { type: 'string', minLength: 2, maxLength: 50 },
    },
  },
  LoginInput: {
    type: 'object',
    required: ['email', 'password'],
    properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
  },
  UpdateMeInput: {
    type: 'object',
    properties: { name: { type: 'string' }, phone: { type: 'string' }, city: { type: 'string', nullable: true } },
  },
  Category: { type: 'object', properties: { id: { type: 'integer', example: 3 }, name: { type: 'string', example: 'כלי מטבח' } } },
  CategoryInput: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2, maxLength: 50 } } },
  Product: {
    type: 'object',
    properties: {
      id: { type: 'integer' }, ownerId: { type: 'integer' }, name: { type: 'string' }, description: { type: 'string' },
      categoryId: { type: 'integer' }, condition, city: { type: 'string' }, imageUrl,
      maxDays: { type: 'integer', nullable: true, description: 'מקסימום ימי השאלה' }, createdAt: dateTime, updatedAt: dateTime,
      status: { type: 'string', enum: ['AVAILABLE', 'BORROWED'], description: 'מחושב: BORROWED כשיש השאלה מאושרת שהתחילה ולא הוחזרה' },
      category: ref('Category'), owner: personPublic,
    },
    example: examples.product,
  },
  ProductDetails: {
    allOf: [
      ref('Product'),
      {
        type: 'object',
        properties: {
          bookedPeriods: {
            type: 'array',
            description: 'תקופות תפוסות (השאלות מאושרות שלא הוחזרו). בלי פרטי הלווה',
            items: { type: 'object', properties: { startDate: date, endDate: date } },
          },
        },
      },
    ],
  },
  MyProduct: {
    allOf: [ref('Product'), { type: 'object', properties: { pendingRequestsCount: { type: 'integer', description: 'בקשות ממתינות לאישורך' } } }],
  },
  ProductPage: pageOf('Product'),
  ProductInput: {
    type: 'object',
    required: ['name', 'description', 'categoryId', 'condition', 'city'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 80 }, description: { type: 'string', maxLength: 1000 },
      categoryId: { type: 'integer' }, condition, city: { type: 'string', minLength: 2, maxLength: 50 }, imageUrl,
      maxDays: { type: 'integer', minimum: 1, maximum: 90, nullable: true },
    },
  },
  ProductUpdate: { allOf: [{ description: 'כל השדות אופציונליים - שולחים רק מה שמשתנה' }], type: 'object', properties: {} },
  BorrowRequest: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED'] },
      startDate: date, endDate: date, message: { type: 'string', nullable: true }, createdAt: dateTime, updatedAt: dateTime,
      product: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, imageUrl } },
      borrower: personContact, owner: personContact,
    },
    example: examples.borrowRequest,
  },
  BorrowRequestInput: {
    type: 'object',
    required: ['startDate', 'endDate'],
    properties: { startDate: date, endDate: date, message: { type: 'string', maxLength: 500 } },
  },
  WantedItem: {
    type: 'object',
    properties: {
      id: { type: 'integer' }, requesterId: { type: 'integer' }, title: { type: 'string' }, description: { type: 'string' },
      categoryId: { type: 'integer' }, city: { type: 'string' }, imageUrl,
      neededFrom: { ...date, nullable: true }, neededUntil: { ...date, nullable: true },
      status: { type: 'string', enum: ['OPEN', 'CLOSED'] }, createdAt: dateTime, updatedAt: dateTime,
      category: ref('Category'), requester: personPublic, pendingOffersCount: { type: 'integer' },
    },
    example: examples.wantedItem,
  },
  WantedItemPage: pageOf('WantedItem'),
  WantedItemInput: {
    type: 'object',
    required: ['title', 'description', 'categoryId', 'city'],
    properties: {
      title: { type: 'string', minLength: 2, maxLength: 80 }, description: { type: 'string', maxLength: 1000 },
      categoryId: { type: 'integer' }, city: { type: 'string' }, imageUrl,
      neededFrom: { ...date, nullable: true }, neededUntil: { ...date, nullable: true },
    },
  },
  WantedItemUpdate: {
    type: 'object',
    description: 'כל השדות אופציונליים. אפשר גם לסגור/לפתוח בקשה עם status',
    properties: {
      title: { type: 'string' }, description: { type: 'string' }, categoryId: { type: 'integer' }, city: { type: 'string' }, imageUrl,
      neededFrom: { ...date, nullable: true }, neededUntil: { ...date, nullable: true }, status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
    },
  },
  Offer: {
    type: 'object',
    properties: {
      id: { type: 'integer' }, status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'] },
      message: { type: 'string' }, condition, imageUrl, createdAt: dateTime,
      wantedItem: { type: 'object', properties: { id: { type: 'integer' }, title: { type: 'string' }, status: { type: 'string', enum: ['OPEN', 'CLOSED'] } } },
      offerer: personContact, requester: personContact,
    },
    example: examples.offer,
  },
  OfferInput: {
    type: 'object',
    required: ['message', 'condition'],
    properties: { message: { type: 'string', maxLength: 500 }, condition, imageUrl },
  },
  Notification: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      type: { type: 'string', enum: ['BORROW_REQUESTED', 'BORROW_APPROVED', 'BORROW_REJECTED', 'BORROW_CANCELLED', 'BORROW_RETURNED', 'OFFER_RECEIVED', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'OFFER_CANCELLED'] },
      text: { type: 'string', example: 'מרים לוי מבקשת להשאיל את "סיר לחץ 6 ליטר" (2026-11-01 עד 2026-11-05)' },
      link: { type: 'string', nullable: true, example: '/products/12' },
      isRead: { type: 'boolean' }, createdAt: dateTime, userId: { type: 'integer' },
    },
  },
  NotificationList: {
    type: 'object',
    properties: { items: { type: 'array', items: ref('Notification') }, unreadCount: { type: 'integer', example: 2 } },
  },
  ImageUpload: {
    type: 'object',
    properties: { id: { type: 'integer', example: 3 }, url: { type: 'string', example: '/api/images/3' }, mimeType: { type: 'string', example: 'image/jpeg' }, size: { type: 'integer', example: 154320 } },
  },
  Stats: {
    type: 'object',
    properties: {
      users: { type: 'integer' }, blockedUsers: { type: 'integer' }, products: { type: 'integer' }, available: { type: 'integer' },
      borrowed: { type: 'integer' }, pendingRequests: { type: 'integer' }, activeLoans: { type: 'integer' },
      openWantedItems: { type: 'integer' }, categories: { type: 'integer' },
    },
    example: { users: 3, blockedUsers: 0, products: 8, available: 7, borrowed: 1, pendingRequests: 2, activeLoans: 1, openWantedItems: 3, categories: 6 },
  },
  AdminUser: {
    allOf: [
      ref('User'),
      { type: 'object', properties: { borrowRequestCount: { type: 'integer' }, wantedItemCount: { type: 'integer' } } },
    ],
  },
  AdminUserPage: pageOf('AdminUser'),
};

// ProductUpdate = ProductInput כשכל השדות אופציונליים
schemas.ProductUpdate = { ...schemas.ProductInput, required: undefined, description: 'כל השדות אופציונליים - שולחים רק מה שמשתנה' } as any;

const errorResponse = (description: string, code: string, message: string) => ({
  description,
  content: { 'application/json': { schema: ref('Error'), example: { error: { code, message } } } },
});

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'BorrowBoard API',
    version: '1.0.0',
    description: [
      'שרת למערכת השאלת מוצרים בחינם.',
      '',
      '**איך בודקים קריאות מוגנות:**',
      '1. הריצו `POST /api/auth/login` (למשל user@borrowboard.dev / User1234!).',
      '2. העתיקו את הערך `token` מהתשובה.',
      '3. לחצו על **Authorize** למעלה, הדביקו את ה-Token (בלי המילה Bearer) ולחצו Authorize.',
      '4. מעכשיו כל קריאה מוגנת תישלח עם ה-Token.',
      '',
      'כל השגיאות מוחזרות בפורמט `{ "error": { "code", "message", "details?" } }`.',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'השרת הנוכחי' }],
  tags: [
    { name: 'General', description: 'בדיקת בריאות' },
    { name: 'Auth', description: 'הרשמה, התחברות ופרטים אישיים' },
    { name: 'Categories', description: 'קטגוריות' },
    { name: 'Products', description: 'מוצרים להשאלה' },
    { name: 'Borrow Requests', description: 'בקשות השאלה' },
    { name: 'Wanted Items', description: 'דף הבקשות - מוצרים שמחפשים' },
    { name: 'Offers', description: 'הצעות של מלווים לבקשות' },
    { name: 'Notifications', description: 'הודעות' },
    { name: 'Images', description: 'העלאת תמונות' },
    { name: 'Admin', description: 'ניהול (מנהל בלבד)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'הדביקו את ה-Token שהתקבל מ-login' },
    },
    schemas,
    responses: {
      BadRequest: {
        description: 'נתונים לא תקינים',
        content: {
          'application/json': {
            schema: ref('Error'),
            example: { error: { code: 'VALIDATION_ERROR', message: 'הנתונים שנשלחו אינם תקינים', details: [{ field: 'name', message: 'קצר מדי: המחרוזת צריכה להכיל 2 תווים או יותר' }] } },
          },
        },
      },
      Unauthorized: errorResponse('לא מחובר, או Token לא תקין / פג תוקף', 'UNAUTHORIZED', 'נדרשת התחברות: חסרה כותרת Authorization: Bearer <token>'),
      Forbidden: errorResponse('אין הרשאה לפעולה (תפקיד שגוי, לא הבעלים, או משתמש חסום)', 'FORBIDDEN', 'אין לך הרשאה לבצע פעולה זו'),
      NotFound: errorResponse('הפריט לא נמצא', 'NOT_FOUND', 'הפריט לא נמצא'),
      Conflict: errorResponse('התנגשות במצב הנתונים', 'DATES_TAKEN', 'המוצר כבר מושאל בחלק מהתאריכים שביקשת'),
      TooLarge: errorResponse('קובץ גדול מדי', 'FILE_TOO_LARGE', 'הקובץ גדול מדי (מקסימום 2MB)'),
    },
  },
  paths: {
    '/api/health': {
      get: op({ tag: 'General', summary: 'בדיקת בריאות השרת ומסד הנתונים', auth: 'public', ok: { description: 'השרת פעיל', schema: ref('Health') } }),
    },
    '/api/auth/register': {
      post: op({
        tag: 'Auth', summary: 'הרשמה (תמיד בתפקיד USER)', auth: 'public',
        body: { schema: ref('RegisterInput'), example: { name: 'שרה לוי', email: 'sara@example.com', password: 'Sara1234', phone: '052-7654321', city: 'אלעד' } },
        ok: { status: 201, description: 'נרשמה בהצלחה - מוחזר Token', schema: ref('AuthResponse') }, errors: [409],
      }),
    },
    '/api/auth/login': {
      post: op({
        tag: 'Auth', summary: 'התחברות', auth: 'public',
        description: 'משתמש חסום יקבל 403 USER_BLOCKED. אימייל או סיסמה שגויים: 401 INVALID_CREDENTIALS.',
        body: { schema: ref('LoginInput'), example: { email: 'user@borrowboard.dev', password: 'User1234!' } },
        ok: { description: 'התחברות הצליחה', schema: ref('AuthResponse'), example: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', user: examples.user } },
        errors: [401, 403],
      }),
    },
    '/api/auth/me': {
      get: op({ tag: 'Auth', summary: 'פרטי המשתמש המחובר', auth: 'any', ok: { description: 'פרטי המשתמש', schema: ref('User') } }),
      put: op({
        tag: 'Auth', summary: 'עדכון פרטים אישיים', auth: 'any',
        body: { schema: ref('UpdateMeInput'), example: { phone: '053-1112233', city: 'בית שמש' } },
        ok: { description: 'הפרטים המעודכנים', schema: ref('User') },
      }),
    },
    '/api/categories': {
      get: op({ tag: 'Categories', summary: 'כל הקטגוריות', auth: 'public', ok: { description: 'רשימה', schema: { type: 'array', items: ref('Category') } } }),
      post: op({
        tag: 'Categories', summary: 'הוספת קטגוריה', auth: 'admin',
        body: { schema: ref('CategoryInput'), example: { name: 'משחקים' } },
        ok: { status: 201, description: 'נוצרה', schema: ref('Category') }, errors: [409],
      }),
    },
    '/api/categories/{id}': {
      put: op({
        tag: 'Categories', summary: 'עריכת קטגוריה', auth: 'admin', pathId: 'מזהה הקטגוריה',
        body: { schema: ref('CategoryInput'), example: { name: 'משחקים וצעצועים' } },
        ok: { description: 'עודכנה', schema: ref('Category') }, errors: [409],
      }),
      delete: op({
        tag: 'Categories', summary: 'מחיקת קטגוריה (רק כשאין בה מוצרים או בקשות)', auth: 'admin', pathId: 'מזהה הקטגוריה',
        ok: { status: 204, description: 'נמחקה' }, errors: [409],
      }),
    },
    '/api/products': {
      get: op({
        tag: 'Products', summary: 'רשימת מוצרים עם חיפוש, סינון, מיון ועמודים', auth: 'public',
        query: [
          q('search', 'חיפוש בשם ובתיאור', { type: 'string' }),
          q('categoryId', 'סינון לפי קטגוריה', { type: 'integer' }),
          q('city', 'סינון לפי עיר (חיפוש חלקי)', { type: 'string' }),
          q('condition', 'מצב המוצר', condition),
          q('status', 'זמינות כרגע', { type: 'string', enum: ['AVAILABLE', 'BORROWED'] }),
          q('ownerId', 'מוצרים של משתמש מסוים', { type: 'integer' }),
          sortParam, ...pageParams,
        ],
        ok: { description: 'עמוד של מוצרים', schema: ref('ProductPage') },
      }),
      post: op({
        tag: 'Products', summary: 'הוספת מוצר להשאלה', auth: 'user',
        description: 'את התמונה מעלים קודם ב-POST /api/images ושולחים כאן את ה-url שהתקבל.',
        body: { schema: ref('ProductInput'), example: { name: 'מקדחה חשמלית', description: 'מקדחה עם סט מקדחים', categoryId: 4, condition: 'USED', city: 'בני ברק', imageUrl: '/api/images/3', maxDays: 7 } },
        ok: { status: 201, description: 'המוצר נוסף', schema: ref('Product') },
      }),
    },
    '/api/products/mine': {
      get: op({ tag: 'Products', summary: 'המוצרים שלי (לאזור האישי)', auth: 'user', ok: { description: 'רשימה', schema: { type: 'array', items: ref('MyProduct') } } }),
    },
    '/api/products/{id}': {
      get: op({ tag: 'Products', summary: 'מוצר בודד, כולל תקופות תפוסות', auth: 'public', pathId: 'מזהה המוצר', ok: { description: 'המוצר', schema: ref('ProductDetails') } }),
      put: op({
        tag: 'Products', summary: 'עריכת מוצר (בעלת המוצר בלבד)', auth: 'user', pathId: 'מזהה המוצר',
        body: { schema: ref('ProductUpdate'), example: { description: 'תיאור מעודכן', maxDays: 10 } },
        ok: { description: 'המוצר המעודכן', schema: ref('Product') },
      }),
      delete: op({
        tag: 'Products', summary: 'מחיקת מוצר', auth: 'userOrAdmin', pathId: 'מזהה המוצר',
        description: 'בעלת המוצר: רק כשאין השאלה מאושרת שלא הוחזרה (אחרת 409 PRODUCT_BORROWED). מנהל: תמיד.',
        ok: { status: 204, description: 'נמחק' }, errors: [409],
      }),
    },
    '/api/products/{id}/borrow-requests': {
      post: op({
        tag: 'Borrow Requests', summary: 'שליחת בקשת השאלה למוצר', auth: 'user', pathId: 'מזהה המוצר',
        description: 'לא על מוצר של עצמך (403 OWN_PRODUCT). תאריך התחלה לא בעבר. 409 DATES_TAKEN אם חופף להשאלה מאושרת, 409 DUPLICATE_REQUEST אם כבר יש לך בקשה ממתינה.',
        body: { schema: ref('BorrowRequestInput'), example: { startDate: '2026-11-01', endDate: '2026-11-05', message: 'אשמח להשאיל לשבת' } },
        ok: { status: 201, description: 'הבקשה נשלחה', schema: ref('BorrowRequest') }, errors: [409],
      }),
    },
    '/api/borrow-requests': {
      get: op({
        tag: 'Borrow Requests', summary: 'בקשות ההשאלה שלי', auth: 'user',
        description: 'box=sent - בקשות ששלחתי (אני הלווה). box=received - בקשות שקיבלתי על המוצרים שלי. הטלפון של הצד השני מוצג רק בסטטוס APPROVED/RETURNED.',
        query: [
          q('box', 'sent או received', { type: 'string', enum: ['sent', 'received'], default: 'sent' }),
          q('status', 'סינון לפי סטטוס', { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED'] }),
        ],
        ok: { description: 'רשימה', schema: { type: 'array', items: ref('BorrowRequest') } },
      }),
    },
    '/api/borrow-requests/{id}/approve': {
      patch: op({
        tag: 'Borrow Requests', summary: 'אישור בקשה (בעלת המוצר)', auth: 'user', pathId: 'מזהה הבקשה',
        description: 'בקשות ממתינות אחרות עם תאריכים חופפים נדחות אוטומטית. בקשות לתאריכים אחרים נשארות ממתינות.',
        ok: { description: 'הבקשה אושרה', schema: ref('BorrowRequest') }, errors: [409],
      }),
    },
    '/api/borrow-requests/{id}/reject': {
      patch: op({ tag: 'Borrow Requests', summary: 'דחיית בקשה (בעלת המוצר)', auth: 'user', pathId: 'מזהה הבקשה', ok: { description: 'נדחתה', schema: ref('BorrowRequest') }, errors: [409] }),
    },
    '/api/borrow-requests/{id}/return': {
      patch: op({ tag: 'Borrow Requests', summary: 'סימון "הוחזר" (בעלת המוצר)', auth: 'user', pathId: 'מזהה הבקשה', ok: { description: 'סומן כמוחזר', schema: ref('BorrowRequest') }, errors: [409] }),
    },
    '/api/borrow-requests/{id}/cancel': {
      patch: op({ tag: 'Borrow Requests', summary: 'ביטול בקשה ממתינה (הלווה)', auth: 'user', pathId: 'מזהה הבקשה', ok: { description: 'בוטלה', schema: ref('BorrowRequest') }, errors: [409] }),
    },
    '/api/wanted-items': {
      get: op({
        tag: 'Wanted Items', summary: 'דף הבקשות - חיפוש וסינון', auth: 'public',
        query: [
          q('search', 'חיפוש בכותרת ובתיאור', { type: 'string' }),
          q('categoryId', 'סינון לפי קטגוריה', { type: 'integer' }),
          q('city', 'סינון לפי עיר', { type: 'string' }),
          q('status', 'ברירת מחדל OPEN', { type: 'string', enum: ['OPEN', 'CLOSED'], default: 'OPEN' }),
          sortParam, ...pageParams,
        ],
        ok: { description: 'עמוד של בקשות', schema: ref('WantedItemPage') },
      }),
      post: op({
        tag: 'Wanted Items', summary: 'פרסום בקשה למוצר שלא נמצא', auth: 'user',
        body: { schema: ref('WantedItemInput'), example: { title: 'עגלת תינוק', description: 'צריכה עגלה לשבועיים', categoryId: 5, city: 'ירושלים', neededFrom: '2026-11-01', neededUntil: '2026-11-14' } },
        ok: { status: 201, description: 'הבקשה פורסמה', schema: ref('WantedItem') },
      }),
    },
    '/api/wanted-items/mine': {
      get: op({ tag: 'Wanted Items', summary: 'הבקשות שפרסמתי', auth: 'user', ok: { description: 'רשימה', schema: { type: 'array', items: ref('WantedItem') } } }),
    },
    '/api/wanted-items/{id}': {
      get: op({ tag: 'Wanted Items', summary: 'בקשה בודדת', auth: 'public', pathId: 'מזהה הבקשה', ok: { description: 'הבקשה', schema: ref('WantedItem') } }),
      put: op({
        tag: 'Wanted Items', summary: 'עריכת בקשה (מי שפרסמה)', auth: 'user', pathId: 'מזהה הבקשה',
        body: { schema: ref('WantedItemUpdate'), example: { status: 'CLOSED' } },
        ok: { description: 'עודכנה', schema: ref('WantedItem') }, errors: [409],
      }),
      delete: op({ tag: 'Wanted Items', summary: 'מחיקת בקשה (מי שפרסמה, או מנהל)', auth: 'userOrAdmin', pathId: 'מזהה הבקשה', ok: { status: 204, description: 'נמחקה' } }),
    },
    '/api/wanted-items/{id}/offers': {
      post: op({
        tag: 'Offers', summary: 'הצעת מוצר לבקשה', auth: 'user', pathId: 'מזהה הבקשה',
        description: 'לא לבקשה של עצמך (403). הבקשה חייבת להיות OPEN (אחרת 409). הצעה ממתינה אחת לכל בקשה.',
        body: { schema: ref('OfferInput'), example: { message: 'יש לי עגלה במצב טוב', condition: 'USED', imageUrl: '/api/images/4' } },
        ok: { status: 201, description: 'ההצעה נשלחה', schema: ref('Offer') }, errors: [409],
      }),
    },
    '/api/offers': {
      get: op({
        tag: 'Offers', summary: 'ההצעות שלי', auth: 'user',
        description: 'box=sent - הצעות ששלחתי. box=received - הצעות לבקשות שלי. הטלפון מוצג רק בסטטוס ACCEPTED.',
        query: [
          q('box', 'sent או received', { type: 'string', enum: ['sent', 'received'], default: 'sent' }),
          q('status', 'סינון לפי סטטוס', { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'] }),
        ],
        ok: { description: 'רשימה', schema: { type: 'array', items: ref('Offer') } },
      }),
    },
    '/api/offers/{id}/accept': {
      patch: op({
        tag: 'Offers', summary: 'אישור הצעה (מי שפרסמה את הבקשה)', auth: 'user', pathId: 'מזהה ההצעה',
        description: 'הבקשה נסגרת (CLOSED) ושאר ההצעות הממתינות נדחות.',
        ok: { description: 'אושרה', schema: ref('Offer') }, errors: [409],
      }),
    },
    '/api/offers/{id}/reject': {
      patch: op({ tag: 'Offers', summary: 'דחיית הצעה (מי שפרסמה את הבקשה)', auth: 'user', pathId: 'מזהה ההצעה', ok: { description: 'נדחתה', schema: ref('Offer') }, errors: [409] }),
    },
    '/api/offers/{id}/cancel': {
      patch: op({ tag: 'Offers', summary: 'ביטול הצעה ממתינה (מי ששלחה)', auth: 'user', pathId: 'מזהה ההצעה', ok: { description: 'בוטלה', schema: ref('Offer') }, errors: [409] }),
    },
    '/api/notifications': {
      get: op({
        tag: 'Notifications', summary: 'ההודעות שלי (חדשות קודם, עד 100)', auth: 'any',
        query: [q('unread', 'true - רק שלא נקראו, false - רק שנקראו', { type: 'string', enum: ['true', 'false'] })],
        ok: { description: 'הודעות ומספר שלא נקראו', schema: ref('NotificationList') },
      }),
    },
    '/api/notifications/read-all': {
      patch: op({ tag: 'Notifications', summary: 'סימון כל ההודעות כנקראו', auth: 'any', ok: { description: 'כמה עודכנו', schema: { type: 'object', properties: { updated: { type: 'integer' } } } } }),
    },
    '/api/notifications/{id}/read': {
      patch: op({ tag: 'Notifications', summary: 'סימון הודעה כנקראה', auth: 'any', pathId: 'מזהה ההודעה', ok: { description: 'ההודעה', schema: ref('Notification') } }),
    },
    '/api/images': {
      post: op({
        tag: 'Images', summary: 'העלאת תמונה מהמחשב', auth: 'user',
        description: 'שולחים multipart/form-data עם שדה בשם image. JPG / PNG / WEBP עד 2MB. התשובה מכילה url לשמירה ב-imageUrl.',
        body: { multipart: true, schema: { type: 'object', required: ['image'], properties: { image: { type: 'string', format: 'binary' } } } },
        ok: { status: 201, description: 'התמונה נשמרה', schema: ref('ImageUpload') }, errors: [413],
      }),
    },
    '/api/images/{id}': {
      get: op({ tag: 'Images', summary: 'הצגת תמונה', auth: 'public', pathId: 'מזהה התמונה', ok: { description: 'קובץ התמונה', binary: true } }),
    },
    '/api/admin/stats': {
      get: op({ tag: 'Admin', summary: 'תמונת מצב ללוח המנהל', auth: 'admin', ok: { description: 'סטטיסטיקות', schema: ref('Stats') } }),
    },
    '/api/admin/users': {
      get: op({
        tag: 'Admin', summary: 'רשימת משתמשים', auth: 'admin',
        query: [
          q('search', 'חיפוש בשם או אימייל', { type: 'string' }),
          q('isBlocked', 'סינון חסומים', { type: 'string', enum: ['true', 'false'] }),
          q('page', 'עמוד', { type: 'integer', default: 1 }),
          q('limit', 'כמות בעמוד (עד 100)', { type: 'integer', default: 20 }),
        ],
        ok: { description: 'עמוד של משתמשים', schema: ref('AdminUserPage') },
      }),
    },
    '/api/admin/users/{id}/block': {
      patch: op({ tag: 'Admin', summary: 'חסימת משתמש', auth: 'admin', pathId: 'מזהה המשתמש', description: 'לא ניתן לחסום את עצמך או מנהל אחר (400).', ok: { description: 'המשתמש', schema: ref('User') } }),
    },
    '/api/admin/users/{id}/unblock': {
      patch: op({ tag: 'Admin', summary: 'ביטול חסימה', auth: 'admin', pathId: 'מזהה המשתמש', ok: { description: 'המשתמש', schema: ref('User') } }),
    },
  },
};
