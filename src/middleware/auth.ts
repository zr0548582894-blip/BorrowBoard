import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { forbidden, unauthorized } from '../utils/http-error';

export interface AuthUser {
  id: number;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload {
  sub: string;
  role: Role;
}

/** יוצר JWT למשתמש. המזהה נשמר ב-sub. */
export function signToken(user: AuthUser): string {
  const options: jwt.SignOptions = { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  return jwt.sign({ role: user.role }, env.JWT_SECRET, { ...options, subject: String(user.id) });
}

/**
 * מוודא שנשלח Bearer Token תקין.
 * המשתמש נטען מחדש ממסד הנתונים בכל בקשה, כך שחסימה או שינוי תפקיד נכנסים לתוקף מיד.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('נדרשת התחברות: חסרה כותרת Authorization: Bearer <token>', 'UNAUTHORIZED');
  }

  const token = header.slice('Bearer '.length).trim();
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as TokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw unauthorized('תוקף ההתחברות פג, יש להתחבר מחדש', 'TOKEN_EXPIRED');
    }
    throw unauthorized('Token לא תקין', 'INVALID_TOKEN');
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) throw unauthorized('Token לא תקין', 'INVALID_TOKEN');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isBlocked: true },
  });
  if (!user) throw unauthorized('המשתמש לא קיים', 'INVALID_TOKEN');
  if (user.isBlocked) throw forbidden('המשתמש חסום. יש לפנות למנהל המערכת', 'USER_BLOCKED');

  req.user = { id: user.id, role: user.role };
  next();
}

/** מאפשר גישה רק לתפקידים שצוינו. חייב לבוא אחרי requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) {
      throw forbidden('הפעולה מותרת רק ל: ' + roles.join(', '));
    }
    next();
  };
}

/** מחזיר את המשתמש המחובר (לשימוש בתוך Controllers שמוגנים ב-requireAuth) */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
