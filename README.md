# BorrowBoard – שרת (Backend)

שרת למערכת השאלת מוצרים בחינם. משתמשות מפרסמות מוצרים להשאלה, מבקשות להשאיל, ומפרסמות בקשות למוצרים שלא מצאו. מלוות יכולות להציע מוצרים לבקשות האלה, ומנהל מפקח על המערכת.

> **מתחילה מאפס?** קראי קודם את [START-HERE.md](START-HERE.md). שם יש הדרכה צעד אחר צעד להעלאת השרת לאינטרנט.
> **כותבת את ה-React?** כל מה שצריך לדעת על ה-API נמצא ב-[FRONTEND-API-GUIDE.md](FRONTEND-API-GUIDE.md).

## טכנולוגיות

| תחום | כלי |
| --- | --- |
| שפה | TypeScript במצב strict |
| שרת | Node.js 22 + Express 5 |
| מסד נתונים | PostgreSQL + Prisma ORM 6 (Prisma Client ללא מנוע Rust, מחובר דרך `@prisma/adapter-pg`) |
| ולידציה | Zod 4 (הודעות שגיאה בעברית) |
| התחברות | JWT (jsonwebtoken) + bcrypt (bcryptjs) |
| תיעוד | Swagger UI / OpenAPI 3 בכתובת `/api-docs` |
| בדיקות | Vitest + Supertest מול PostgreSQL אמיתי |
| העלאת תמונות | multer, התמונות נשמרות במסד הנתונים |

## מבנה התיקיות

```
backend-project/
├── src/
│   ├── app.ts              # בניית אפליקציית Express (CORS, Helmet, Swagger, Routes)
│   ├── server.ts           # הפעלת השרת
│   ├── config/env.ts       # קריאה ובדיקה של משתני הסביבה
│   ├── db/prisma.ts        # חיבור למסד הנתונים
│   ├── routes/index.ts     # כל הנתיבים + הרשאות לכל נתיב
│   ├── controllers/        # מקבלים בקשה, מפעילים ולידציה וקוראים ל-Service
│   ├── services/           # הלוגיקה העסקית ועבודה מול מסד הנתונים
│   ├── schemas/            # סכמות Zod לולידציה
│   ├── middleware/         # אימות JWT, הרשאות, טיפול בשגיאות
│   ├── docs/openapi.ts     # תיעוד Swagger
│   └── utils/              # תאריכים, שגיאות HTTP, עזרים
├── prisma/
│   ├── schema.prisma       # מבנה הטבלאות
│   ├── migrations/         # מיגרציות SQL
│   └── seed.ts             # נתוני הדגמה
├── tests/                  # בדיקות אוטומטיות
├── docs/openapi.json       # קובץ OpenAPI מוכן
├── scripts/                # סקריפט ליצירת openapi.json
├── render.yaml             # הגדרות פריסה ל-Render
├── START-HERE.md           # מדריך העלאה לענן
└── FRONTEND-API-GUIDE.md   # מדריך API לכתיבת ה-React
```

## הרצה מקומית

דרישות: Node.js 20.19 ומעלה (מומלץ 22), ו-PostgreSQL מקומי או בענן.

```bash
npm install
cp .env.example .env          # ולמלא DATABASE_URL ו-JWT_SECRET
npx prisma migrate deploy     # יוצר את הטבלאות
npm run db:seed               # נתוני הדגמה
npm run dev                   # http://localhost:3000/api-docs
```

### חשבונות לדוגמה (רק בסביבת פיתוח)

| תפקיד | אימייל | סיסמה |
| --- | --- | --- |
| מנהל | admin@borrowboard.dev | Admin1234! |
| משתמשת (יעל, בני ברק) | user@borrowboard.dev | User1234! |
| משתמשת (מרים, ירושלים) | user2@borrowboard.dev | User1234! |
| משתמשת בלי מוצרים (שרה, אלעד) | user3@borrowboard.dev | User1234! |

ב-production החשבונות האלה **לא** נוצרים. מנהל נוצר רק אם מגדירים `SEED_ADMIN_EMAIL` ו-`SEED_ADMIN_PASSWORD`, ונתוני הדגמה נוצרים רק אם מגדירים `SEED_DEMO_PASSWORD`.

## פקודות

| פקודה | מה היא עושה |
| --- | --- |
| `npm run dev` | הרצה בפיתוח עם רענון אוטומטי |
| `npm run build` | `prisma generate` + קומפילציה לתיקיית `dist` |
| `npm start` | הרצת הגרסה המקומפלת |
| `npm run start:prod` | מיגרציות + seed + הרצה (הפקודה של Render) |
| `npm run typecheck` | בדיקת TypeScript |
| `npm test` | בדיקות אוטומטיות (דורש `TEST_DATABASE_URL`, **מסד נפרד שנמחק בכל הרצה**) |
| `npm run db:migrate -- --name <שם>` | יצירת מיגרציה חדשה אחרי שינוי ב-schema.prisma |
| `npm run db:seed` | הוספת נתוני הדגמה |
| `npm run openapi` | עדכון `docs/openapi.json` |

## משתני סביבה

| משתנה | חובה | תיאור |
| --- | --- | --- |
| `DATABASE_URL` | כן | כתובת PostgreSQL |
| `JWT_SECRET` | כן | לפחות 32 תווים אקראיים |
| `JWT_EXPIRES_IN` | לא | ברירת מחדל `1d` |
| `CORS_ORIGIN` | לא | כתובות האתר המורשות, מופרדות בפסיק. ברירת מחדל `*` |
| `PORT` | לא | ברירת מחדל 3000. Render מגדיר לבד |
| `NODE_ENV` | לא | `development` / `production` / `test` |
| `TEST_DATABASE_URL` | לבדיקות | מסד נפרד לבדיקות |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | לא | יצירת מנהל ב-production (סיסמה של 10 תווים לפחות) |
| `SEED_DEMO_PASSWORD` | לא | נתוני הדגמה ב-production |

## אבטחה בקצרה

- סיסמאות נשמרות רק כ-Hash של bcrypt, ולא מוחזרות באף תשובה.
- המשתמש המחובר נקבע רק לפי ה-JWT. מזהה משתמש שנשלח בגוף הבקשה מתעלמים ממנו.
- המשתמש נטען מחדש בכל בקשה, ולכן חסימה נכנסת לתוקף מיד.
- 401 = לא מחובר או Token לא תקין. 403 = מחובר בלי הרשאה, או משתמש חסום.
- הטלפון של הצד השני נחשף רק אחרי אישור בקשה או הצעה.
- תמונות נבדקות לפי תוכן הקובץ, ולא רק לפי הסיומת. מותר JPG, PNG או WEBP עד 2MB.
- Helmet + CORS שניתן להגדיר.

## חוקים עסקיים עיקריים

- **זמינות לפי תאריכים:** אישור בקשת השאלה דוחה רק בקשות ממתינות שחופפות לה בתאריכים. אפשר לבקש מוצר מושאל לתאריכים מאוחרים יותר.
- **סטטוס המוצר מחושב:** המוצר `BORROWED` כל עוד יש לו השאלה מאושרת שהתחילה ועוד לא סומנה "הוחזר".
- **אישור הצעה** סוגר את הבקשה בדף הבקשות ודוחה את שאר ההצעות.
- **מנהל** מוחק מוצרים ובקשות, מנהל קטגוריות וחוסם משתמשים, אבל לא עורך תוכן של משתמשות.
- **הודעות** נוצרות אוטומטית בכל שלב: בקשה, אישור, דחייה, החזרה, ביטול והצעה.
