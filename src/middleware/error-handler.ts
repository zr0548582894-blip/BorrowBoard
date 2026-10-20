import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { HttpError } from '../utils/http-error';
import { env } from '../config/env';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function send(res: Response, status: number, code: string, message: string, details?: unknown) {
  const body: ErrorBody = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  res.status(status).json(body);
}

/** נתיב שלא קיים */
export function notFoundHandler(req: Request, res: Response) {
  send(res, 404, 'ROUTE_NOT_FOUND', `הנתיב ${req.method} ${req.path} לא קיים`);
}

/** טיפול מרוכז בכל השגיאות - כל תשובת שגיאה נראית אותו דבר */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return send(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message }));
    return send(res, 400, 'VALIDATION_ERROR', 'הנתונים שנשלחו אינם תקינים', details);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return send(res, 413, 'FILE_TOO_LARGE', 'הקובץ גדול מדי (מקסימום 2MB)');
    }
    return send(res, 400, 'UPLOAD_ERROR', `שגיאה בהעלאת הקובץ: ${err.message}`);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return send(res, 409, 'ALREADY_EXISTS', 'ערך זה כבר קיים במערכת');
    if (err.code === 'P2003') return send(res, 409, 'IN_USE', 'לא ניתן לבצע את הפעולה כי הרשומה קשורה לרשומות אחרות');
    if (err.code === 'P2025') return send(res, 404, 'NOT_FOUND', 'הפריט לא נמצא');
  }

  // גוף בקשה שאינו JSON תקין
  if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed') {
    return send(res, 400, 'INVALID_JSON', 'גוף הבקשה אינו JSON תקין');
  }
  if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.too.large') {
    return send(res, 413, 'BODY_TOO_LARGE', 'גוף הבקשה גדול מדי');
  }

  if (env.NODE_ENV !== 'test') console.error(err);
  return send(res, 500, 'INTERNAL_ERROR', 'אירעה שגיאה בשרת');
}
