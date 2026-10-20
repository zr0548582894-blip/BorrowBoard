import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { signToken } from '../middleware/auth';
import type { LoginInput, RegisterInput, UpdateMeInput } from '../schemas/auth.schema';
import { conflict, forbidden, notFound, unauthorized } from '../utils/http-error';
import { toSafeUser } from '../utils/serialize';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function register(input: RegisterInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw conflict('כתובת האימייל כבר רשומה במערכת', 'EMAIL_TAKEN');

  // תפקיד תמיד USER - אי אפשר להירשם כמנהל
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      city: input.city,
      passwordHash: await hashPassword(input.password),
      role: 'USER',
    },
  });
  return { token: signToken(user), user: { ...toSafeUser(user), productCount: 0 } };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // אותה הודעה גם לאימייל שלא קיים וגם לסיסמה שגויה - כדי לא לחשוף אילו אימיילים רשומים
  const ok = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !ok) throw unauthorized('אימייל או סיסמה שגויים', 'INVALID_CREDENTIALS');
  if (user.isBlocked) throw forbidden('המשתמש חסום. יש לפנות למנהל המערכת', 'USER_BLOCKED');

  const productCount = await prisma.product.count({ where: { ownerId: user.id } });
  return { token: signToken(user), user: { ...toSafeUser(user), productCount } };
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('המשתמש לא נמצא');
  const productCount = await prisma.product.count({ where: { ownerId: userId } });
  return { ...toSafeUser(user), productCount };
}

export async function updateMe(userId: number, input: UpdateMeInput) {
  await prisma.user.update({ where: { id: userId }, data: input });
  return getMe(userId);
}
