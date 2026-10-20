/**
 * נתוני הדגמה (Seed).
 *
 * פיתוח (NODE_ENV שאינו production):
 *   יוצר קטגוריות, מנהל ושלוש משתמשות לדוגמה עם סיסמאות ידועות, מוצרים, בקשות והצעות.
 *
 * Production (בענן):
 *   יוצר רק קטגוריות. חשבונות נוצרים רק אם הוגדרו משתני סביבה:
 *   - SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD  → חשבון מנהל
 *   - SEED_DEMO_PASSWORD                     → משתמשות ונתוני הדגמה, עם הסיסמה הזו
 *
 * אפשר להריץ שוב ושוב - מה שכבר קיים לא נוצר פעם שנייה.
 */
import { config } from 'dotenv';
import zlib from 'node:zlib';
import bcrypt from 'bcryptjs';
import { PrismaClient, type ProductCondition } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL חסר');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const isProduction = process.env.NODE_ENV === 'production';

const CATEGORIES = ['ספרים', 'בגדים', 'כלי מטבח', 'כלי עבודה', 'ציוד לתינוקות', 'ציוד לאירועים', 'משחקים', 'רכב'];

// ---------- יצירת תמונת PNG פשוטה (צבע רקע + פס) בלי ספריות חיצוניות ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function makePng(hex: string, width = 480, height = 360): Buffer {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    const band = y > height * 0.62 && y < height * 0.72; // פס בהיר לקישוט
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 3;
      raw[i] = band ? Math.min(255, r + 60) : r;
      raw[i + 1] = band ? Math.min(255, g + 60) : g;
      raw[i + 2] = band ? Math.min(255, b + 60) : b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- עזרים ----------

function dateFromToday(days: number) {
  const d = new Date();
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
  const base = new Date(`${s}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

async function ensureUser(data: { name: string; email: string; password: string; phone: string; city: string; role: 'USER' | 'ADMIN' }) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return { user: existing, created: false };
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      role: data.role,
      passwordHash: await bcrypt.hash(data.password, 10),
    },
  });
  return { user, created: true };
}

async function image(uploaderId: number, color: string) {
  const img = await prisma.image.create({ data: { uploaderId, mimeType: 'image/png', data: new Uint8Array(makePng(color)) } });
  return `/api/images/${img.id}`;
}

// ---------- נתוני הדגמה ----------

async function seedDemoData(password: string) {
  const cat = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.name, c.id]));

  const yael = await ensureUser({ name: 'יעל כהן', email: 'user@borrowboard.dev', password, phone: '0501234567', city: 'בני ברק', role: 'USER' });
  const miriam = await ensureUser({ name: 'מרים לוי', email: 'user2@borrowboard.dev', password, phone: '0527654321', city: 'ירושלים', role: 'USER' });
  const sara = await ensureUser({ name: 'שרה פרידמן', email: 'user3@borrowboard.dev', password, phone: '0533332211', city: 'אלעד', role: 'USER' });

  // נתוני ההדגמה נוצרים רק פעם אחת
  if (!yael.created) {
    console.log('ℹ️  נתוני ההדגמה כבר קיימים - מדלג');
    return;
  }
  void sara;

  type P = { name: string; description: string; category: string; condition: ProductCondition; maxDays: number | null; color: string };
  const yaelProducts: P[] = [
    { name: 'סיר לחץ 6 ליטר', description: 'סיר לחץ נירוסטה במצב מצוין, כולל מכסה וגומייה חדשה.', category: 'כלי מטבח', condition: 'LIKE_NEW', maxDays: 14, color: '#C0784A' },
    { name: 'מקדחה חשמלית', description: 'מקדחה רוטטת עם סט מקדחים לבטון ולעץ.', category: 'כלי עבודה', condition: 'USED', maxDays: 7, color: '#4A6FA5' },
    { name: 'סט משניות מבואר', description: 'סט מלא בכריכה קשה, שמור היטב.', category: 'ספרים', condition: 'LIKE_NEW', maxDays: 30, color: '#6B8E5A' },
    { name: 'מיחם לשבת 40 כוסות', description: 'מיחם חשמלי גדול, מתאים לאירועים ולשבתות.', category: 'ציוד לאירועים', condition: 'USED', maxDays: 7, color: '#8A6BB0' },
  ];
  const miriamProducts: P[] = [
    { name: 'עגלת תינוק', description: 'עגלה מתקפלת עם גגון ושק שינה.', category: 'ציוד לתינוקות', condition: 'USED', maxDays: 30, color: '#D08AA0' },
    { name: 'מפות לבנות לאירוע (10 יחידות)', description: 'מפות מלבניות לשולחנות של 1.80 מטר.', category: 'ציוד לאירועים', condition: 'LIKE_NEW', maxDays: 10, color: '#7AA6A6' },
    { name: 'משחק קופסה משפחתי', description: 'משחק אסטרטגיה לכל המשפחה, כל החלקים במקום.', category: 'משחקים', condition: 'LIKE_NEW', maxDays: 14, color: '#C9A33B' },
    { name: 'מסור אנכי', description: 'מסור חשמלי לחיתוך עץ, כולל להבים.', category: 'כלי עבודה', condition: 'USED', maxDays: null, color: '#5C5C7A' },
  ];

  const created: Record<string, number> = {};
  for (const [owner, list, city] of [
    [yael.user, yaelProducts, 'בני ברק'],
    [miriam.user, miriamProducts, 'ירושלים'],
  ] as const) {
    for (const p of list) {
      const prod = await prisma.product.create({
        data: {
          ownerId: owner.id,
          name: p.name,
          description: p.description,
          categoryId: cat[p.category],
          condition: p.condition,
          city,
          maxDays: p.maxDays,
          imageUrl: await image(owner.id, p.color),
        },
      });
      created[p.name] = prod.id;
    }
  }

  // השאלה פעילה: המיחם של יעל מושאל כרגע למרים
  await prisma.borrowRequest.create({
    data: { productId: created['מיחם לשבת 40 כוסות'], borrowerId: miriam.user.id, startDate: dateFromToday(-2), endDate: dateFromToday(3), message: 'לשמחה משפחתית', status: 'APPROVED' },
  });
  // השאלה עתידית מאושרת של המיחם - מדגימה תאריכים תפוסים
  await prisma.borrowRequest.create({
    data: { productId: created['מיחם לשבת 40 כוסות'], borrowerId: sara.user.id, startDate: dateFromToday(10), endDate: dateFromToday(12), status: 'APPROVED' },
  });
  // בקשה ממתינה של מרים לסיר הלחץ של יעל
  await prisma.borrowRequest.create({
    data: { productId: created['סיר לחץ 6 ליטר'], borrowerId: miriam.user.id, startDate: dateFromToday(5), endDate: dateFromToday(8), message: 'אשמח לשבת הקרובה', status: 'PENDING' },
  });
  // בקשה ממתינה של יעל לעגלה של מרים
  await prisma.borrowRequest.create({
    data: { productId: created['עגלת תינוק'], borrowerId: yael.user.id, startDate: dateFromToday(3), endDate: dateFromToday(17), message: 'לביקור של הנכדים', status: 'PENDING' },
  });
  // השאלה שהסתיימה
  await prisma.borrowRequest.create({
    data: { productId: created['מפות לבנות לאירוע (10 יחידות)'], borrowerId: yael.user.id, startDate: dateFromToday(-20), endDate: dateFromToday(-15), status: 'RETURNED' },
  });

  // דף הבקשות
  const projector = await prisma.wantedItem.create({
    data: { requesterId: miriam.user.id, title: 'מקרן לשיעור', description: 'צריכה מקרן להצגה בערב אחד.', categoryId: cat['ציוד לאירועים'], city: 'ירושלים', neededFrom: dateFromToday(7), neededUntil: dateFromToday(8) },
  });
  await prisma.wantedItem.create({
    data: { requesterId: yael.user.id, title: 'מטחנת בשר ידנית', description: 'לשבוע אחד לקראת החג.', categoryId: cat['כלי מטבח'], city: 'בני ברק' },
  });
  await prisma.wantedItem.create({
    data: { requesterId: sara.user.id, title: 'כסא תינוק לרכב', description: 'לנסיעה משפחתית של יומיים.', categoryId: cat['רכב'], city: 'אלעד', neededFrom: dateFromToday(14), neededUntil: dateFromToday(15) },
  });
  await prisma.offer.create({
    data: { wantedItemId: projector.id, offererId: yael.user.id, message: 'יש לי מקרן ישן שעובד טוב, כולל כבל HDMI.', condition: 'USED' },
  });

  // הודעות
  await prisma.notification.createMany({
    data: [
      { userId: yael.user.id, type: 'BORROW_REQUESTED', text: 'מרים לוי מבקשת להשאיל את "סיר לחץ 6 ליטר"', link: `/products/${created['סיר לחץ 6 ליטר']}` },
      { userId: miriam.user.id, type: 'BORROW_REQUESTED', text: 'יעל כהן מבקשת להשאיל את "עגלת תינוק"', link: `/products/${created['עגלת תינוק']}` },
      { userId: miriam.user.id, type: 'OFFER_RECEIVED', text: 'יעל כהן מציעה לך את "מקרן לשיעור"', link: `/wanted/${projector.id}` },
      { userId: miriam.user.id, type: 'BORROW_APPROVED', text: 'הבקשה שלך להשאיל את "מיחם לשבת 40 כוסות" אושרה', link: `/products/${created['מיחם לשבת 40 כוסות']}`, isRead: true },
    ],
  });

  console.log('✅ נוצרו נתוני הדגמה: 3 משתמשות, 8 מוצרים, 5 בקשות השאלה, 3 בקשות למוצרים, הצעה אחת');
}

async function main() {
  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`✅ קטגוריות: ${CATEGORIES.length}`);

  if (!isProduction) {
    const admin = await ensureUser({ name: 'מנהל המערכת', email: 'admin@borrowboard.dev', password: 'Admin1234!', phone: '0500000000', city: 'בני ברק', role: 'ADMIN' });
    if (admin.created) console.log('✅ מנהל: admin@borrowboard.dev / Admin1234!');
    await seedDemoData('User1234!');
    console.log('ℹ️  משתמשות לדוגמה: user@borrowboard.dev, user2@borrowboard.dev, user3@borrowboard.dev / User1234!');
    return;
  }

  // ----- Production: רק לפי משתני סביבה -----
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_DEMO_PASSWORD } = process.env;
  if (SEED_ADMIN_EMAIL && SEED_ADMIN_PASSWORD) {
    if (SEED_ADMIN_PASSWORD.length < 10) {
      console.warn('⚠️  SEED_ADMIN_PASSWORD קצרה מ-10 תווים - המנהל לא נוצר');
    } else {
      const admin = await ensureUser({
        name: process.env.SEED_ADMIN_NAME || 'מנהל המערכת',
        email: SEED_ADMIN_EMAIL.toLowerCase().trim(),
        password: SEED_ADMIN_PASSWORD,
        phone: process.env.SEED_ADMIN_PHONE || '0500000000',
        city: 'בני ברק',
        role: 'ADMIN',
      });
      console.log(admin.created ? `✅ נוצר מנהל: ${admin.user.email}` : `ℹ️  המנהל ${admin.user.email} כבר קיים`);
    }
  } else {
    console.log('ℹ️  לא הוגדרו SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD - לא נוצר מנהל');
  }

  if (SEED_DEMO_PASSWORD) {
    if (SEED_DEMO_PASSWORD.length < 8) console.warn('⚠️  SEED_DEMO_PASSWORD קצרה מ-8 תווים - נתוני הדגמה לא נוצרו');
    else await seedDemoData(SEED_DEMO_PASSWORD);
  }
}

main()
  .catch((err) => {
    console.error('❌ Seed נכשל:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
