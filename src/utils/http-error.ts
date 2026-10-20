// שגיאה עם קוד HTTP. כל שגיאה כזו מגיעה ל-errorHandler והופכת לתשובת JSON אחידה.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST', details?: unknown) =>
  new HttpError(400, code, message, details);
export const unauthorized = (message = 'נדרשת התחברות', code = 'UNAUTHORIZED') =>
  new HttpError(401, code, message);
export const forbidden = (message = 'אין לך הרשאה לבצע פעולה זו', code = 'FORBIDDEN') =>
  new HttpError(403, code, message);
export const notFound = (message = 'הפריט לא נמצא', code = 'NOT_FOUND') =>
  new HttpError(404, code, message);
export const conflict = (message: string, code = 'CONFLICT') => new HttpError(409, code, message);
