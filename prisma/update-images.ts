/**
 * מחליף את התמונות של מוצרי ההדגמה שכבר קיימים במסד הנתונים
 * בתמונות מהתיקייה prisma/seed-images.
 *
 * הרצה: npm run db:images
 * אפשר להריץ שוב ושוב. מוצר שלא נמצא לפי השם מדלגים עליו.
 */
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL חסר');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const dir = path.join(process.cwd(), 'prisma', 'seed-images');

const IMAGES: Record<string, string> = {
  'סיר לחץ 6 ליטר': 'pressure-cooker.png',
  'מקדחה חשמלית': 'drill.png',
  'סט משניות מבואר': 'books.png',
  'מיחם לשבת 40 כוסות': 'urn.png',
  'עגלת תינוק': 'stroller.png',
  'מפות לבנות לאירוע (10 יחידות)': 'tablecloths.png',
  'משחק קופסה משפחתי': 'board-game.png',
  'מסור אנכי': 'jigsaw.png',
};

async function main() {
  let updated = 0;
  for (const [name, file] of Object.entries(IMAGES)) {
    const data = new Uint8Array(fs.readFileSync(path.join(dir, file)));
    const products = await prisma.product.findMany({ where: { name } });
    for (const p of products) {
      const img = await prisma.image.create({ data: { uploaderId: p.ownerId, mimeType: 'image/png', data } });
      await prisma.product.update({ where: { id: p.id }, data: { imageUrl: `/api/images/${img.id}` } });
      updated++;
    }
  }
  console.log(`✅ עודכנו תמונות ל-${updated} מוצרים`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
