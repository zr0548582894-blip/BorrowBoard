// עזרים לתאריכים. כל התאריכים במערכת הם "תאריך בלבד" (YYYY-MM-DD) לפי שעון ישראל.

const ISRAEL_TZ = 'Asia/Jerusalem';

/** התאריך של היום בישראל, בפורמט YYYY-MM-DD */
export function todayString(now: Date = new Date()): string {
  // en-CA מחזיר תאריך בפורמט YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** הופך מחרוזת YYYY-MM-DD לאובייקט Date בחצות UTC (כך Prisma שומר עמודת DATE) */
export function toDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

/** היום כ-Date בחצות UTC, להשוואה מול עמודות DATE */
export function today(): Date {
  return toDate(todayString());
}

/** הופך Date (מעמודת DATE) חזרה למחרוזת YYYY-MM-DD */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** מספר הימים בטווח, כולל היום הראשון והאחרון */
export function daysInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}
