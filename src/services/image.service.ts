import { prisma } from '../db/prisma';
import { badRequest, notFound } from '../utils/http-error';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

/** בודק שהקובץ באמת תמונה לפי הבתים הראשונים שלו, ולא רק לפי מה שהדפדפן דיווח */
function detectImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export async function saveImage(uploaderId: number, file: Express.Multer.File | undefined) {
  if (!file) throw badRequest('יש לצרף קובץ תמונה בשדה image', 'FILE_REQUIRED');
  const realType = detectImageType(file.buffer);
  if (!realType) throw badRequest('הקובץ חייב להיות תמונה מסוג JPG, PNG או WEBP', 'INVALID_FILE_TYPE');

  const image = await prisma.image.create({
    data: { uploaderId, mimeType: realType, data: new Uint8Array(file.buffer) },
    select: { id: true, mimeType: true, createdAt: true },
  });
  return { id: image.id, url: `/api/images/${image.id}`, mimeType: image.mimeType, size: file.size };
}

export async function getImage(id: number) {
  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) throw notFound('התמונה לא נמצאה');
  return image;
}

/** אם הכתובת מפנה לתמונה שהועלתה לשרת - מוודא שהתמונה קיימת */
export async function assertImageExists(imageUrl: string) {
  const match = /^\/api\/images\/(\d+)$/.exec(imageUrl);
  if (!match) return; // קישור חיצוני
  const exists = await prisma.image.findUnique({ where: { id: Number(match[1]) }, select: { id: true } });
  if (!exists) throw badRequest('התמונה שצוינה לא קיימת. יש להעלות אותה קודם', 'INVALID_IMAGE');
}
