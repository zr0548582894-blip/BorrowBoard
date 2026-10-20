# 🚀 מתחילים כאן: העלאת השרת לאינטרנט

המדריך הזה מיועד למי שמעולם לא העלתה שרת לאינטרנט. עברי עליו לפי הסדר, שלב אחרי שלב.

**מה נעשה:**
1. **GitHub**: נשמור שם את קבצי הפרויקט.
2. **Neon**: ניצור מסד נתונים PostgreSQL חינמי.
3. **Render**: נריץ את השרת עצמו, והוא יתחבר ל-GitHub ול-Neon.
4. נבדוק שהכול עובד.

**כמה זמן זה לוקח:** בערך 30–45 דקות בפעם הראשונה.

> ⚠️ **חשוב לדעת:** אתרי האינטרנט של GitHub, Neon ו-Render מתעדכנים מדי פעם, ולכן יכול להיות ששם של כפתור או מיקום של מסך יהיו קצת שונים ממה שכתוב כאן. אם לא מוצאים כפתור, חפשי מילה דומה באותו מסך. **הערכים שצריך להזין** (הפקודות, שמות המשתנים, הכתובות) **הם המדויקים**, והם לא משתנים.

> 🔒 **כלל זהב:** הקובץ `.env`, סיסמאות ו-Connection String לא עולים ל-GitHub בשום מקרה. מקומם הוא רק בהגדרות של Render.

---

## חלק א: GitHub

### 1. פתיחת חשבון
1. היכנסי ל-https://github.com
2. לחצי **Sign up** והירשמי עם אימייל, סיסמה ושם משתמש.
3. אשרי את האימייל לפי ההודעה שתקבלי.

### 2. יצירת Repository (מאגר קבצים)
1. אחרי ההתחברות, לחצי על **+** בפינה העליונה ובחרי **New repository**.
2. **Repository name:** `borrowboard-backend`
3. בחרי **Private** (פרטי) או **Public** (ציבורי). אם המורה צריכה לראות את הקוד, אפשר Public, או Private ולהוסיף אותה כ-Collaborator.
4. **אל תסמני** Add a README file, .gitignore או license, כי הם כבר קיימים בפרויקט.
5. לחצי **Create repository**.

### 3. חילוץ קובץ ה-ZIP
1. מצאי את הקובץ `backend-project.zip` במחשב (בדרך כלל בתיקיית ההורדות).
2. **Windows:** קליק ימני ← **Extract All** (חלץ הכל) ← **Extract**.
   **Mac:** לחיצה כפולה על הקובץ.
3. תיווצר תיקייה בשם `backend-project`. בתוכה אמורים להיות `package.json`, `src`, `prisma` וקבצים נוספים.

### 4. העלאת הקבצים דרך הדפדפן
1. בעמוד ה-Repository החדש, לחצי על הקישור **uploading an existing file**. אם הוא לא מופיע: **Add file** ← **Upload files**.
2. פתחי את התיקייה `backend-project` במחשב, סמני **את כל מה שבתוכה** (Ctrl+A ב-Windows, ‏Cmd+A ב-Mac) וגררי לחלון הדפדפן.
   - ❗ גוררים את **התוכן** של התיקייה, לא את התיקייה עצמה. הקובץ `package.json` צריך להיות בשורש ה-Repository.
   - ❗ ודאי שגם הקבצים שמתחילים בנקודה עלו: `.gitignore`, `.env.example`, `.node-version`. ב-Mac הם מוסתרים כברירת מחדל. ב-Finder לחצי **Cmd+Shift+.** כדי להציג אותם.
3. חכי שכל הקבצים יסיימו להיטען.
4. למטה, ב-**Commit changes**, כתבי למשל `העלאה ראשונה` ולחצי **Commit changes**.

### 5. בדיקה שהקבצים נמצאים ב-GitHub
בעמוד הראשי של ה-Repository אמורים לראות:
- התיקיות `src`, `prisma`, `tests`, `docs`, `scripts`
- הקבצים `package.json`, `package-lock.json`, `render.yaml`, `README.md`, `START-HERE.md`
- **לא** אמורות להופיע התיקיות `node_modules` ו-`dist`, ולא קובץ `.env`.

היכנסי ל-`prisma/migrations` וודאי שיש שם תיקייה שמתחילה ב-`20261019000000_init` ובתוכה `migration.sql`.

---

## חלק ב: מסד נתונים (Neon, חינמי)

> למה Neon ולא מסד הנתונים של Render? מסד ה-PostgreSQL החינמי של Render **נמחק אחרי 30 יום**. ב-Neon אפשר לעבוד בחינם בלי הגבלת זמן כזו, במגבלות נפח של המסלול החינמי. לפני שמתחילים, כדאי לבדוק באתר שלהם מה המגבלות העדכניות.

### 1. פתיחת חשבון
1. היכנסי ל-https://neon.com ולחצי **Sign up**.
2. אפשר להירשם עם חשבון GitHub. זה הכי פשוט.

### 2. יצירת Database
1. אחרי ההרשמה תתבקשי ליצור Project. אם לא, לחצי **New Project**.
2. **Project name:** `borrowboard`
3. **Postgres version:** השאירי את ברירת המחדל.
4. **Region:** בחרי אזור באירופה, למשל **AWS Europe Central (Frankfurt)**. זה קרוב לשרת שנגדיר ב-Render.
5. לחצי **Create project**.

### 3. קבלת ה-Connection String
1. בעמוד הפרויקט לחצי **Connect**.
2. ודאי שהאפשרות **Connection pooling** **כבויה**. אנחנו צריכים חיבור ישיר, וכתובת ישירה **לא** מכילה את המילה `-pooler`.
3. העתיקי את הכתובת. היא נראית בערך כך:
   ```
   postgresql://neondb_owner:abc123XYZ@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

### 4. שמירה בטוחה
- שמרי את הכתובת במקום פרטי, למשל במנהל סיסמאות או בקובץ במחשב שלא עולה ל-GitHub.
- הכתובת כוללת סיסמה! אל תשלחי אותה בצ'אט, אל תכתבי אותה בקוד ואל תעלי אותה ל-GitHub.

### 5. קישור השרת למסד הנתונים
את הכתובת הזו נכניס ב-Render במשתנה `DATABASE_URL` (חלק ג, שלב 6). השרת יוצר את כל הטבלאות לבד בהפעלה הראשונה.

> **חלופות:** אפשר גם Supabase (כתובת מ-**Connect** ← **Direct connection** / **Session pooler**), או Render Postgres (בחינם ל-30 יום בלבד). בכל מקרה הכתובת נכנסת ל-`DATABASE_URL`.

---

## חלק ג: Render (השרת)

> **מה חשוב לדעת על המסלול החינמי של Render:** השרת "נרדם" אחרי 15 דקות בלי כניסות, והבקשה הראשונה אחרי שהוא נרדם לוקחת בערך דקה. זה תקין. יש גם מכסה של 750 שעות בחודש לכל החשבון.

### 1. פתיחת חשבון
1. היכנסי ל-https://render.com ולחצי **Get Started** (או **Sign up**).
2. בחרי **GitHub** כדי להירשם עם חשבון ה-GitHub שלך.

### 2. חיבור GitHub
בפעם הראשונה Render יבקש הרשאה לגשת ל-GitHub. אפשר לבחור **Only select repositories** ולסמן את `borrowboard-backend`.

### 3. יצירת השירות
יש שתי דרכים. **דרך א' פשוטה יותר**, כי הקובץ `render.yaml` כבר מכיל את כל ההגדרות.

#### דרך א' (מומלצת): Blueprint
1. בלוח הבקרה לחצי **New +** ← **Blueprint**.
2. בחרי את ה-Repository ‏`borrowboard-backend` ולחצי **Connect**.
3. **Blueprint Name:** `borrowboard`
4. Render יקרא את `render.yaml` ויבקש למלא את הערכים שמסומנים כסודיים (ראי שלב 6 למטה).
5. לחצי **Apply** (או **Deploy Blueprint**).

#### דרך ב': Web Service ידני
1. **New +** ← **Web Service** ← בחרי את ה-Repository.
2. מלאי:

| שדה | ערך |
| --- | --- |
| Name | `borrowboard-api` |
| Region | Frankfurt (EU Central) |
| Branch | `main` |
| Runtime / Language | `Node` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start:prod` |
| Instance Type | **Free** |

3. תחת **Advanced** ← **Health Check Path** הזיני: `/api/health`

### 4. ‏Build ו-Start: מה הן עושות
- **Build:** מתקינה את החבילות, יוצרת את Prisma Client ומקמפלת את ה-TypeScript.
- **Start:** ‏`npm run start:prod` מריצה שלושה דברים לפי הסדר:
  1. `prisma migrate deploy`: יוצרת או מעדכנת את הטבלאות במסד הנתונים (Prisma Migrations).
  2. `node dist/prisma/seed.js`: מוסיפה קטגוריות, ומנהל אם הגדרת. היא לא מכפילה נתונים.
  3. `node dist/src/server.js`: מפעילה את השרת.

### 5. ‏Prisma Migrations
לא צריך להפעיל שום דבר ידנית. המיגרציות רצות אוטומטית בכל הפעלה דרך Start Command. בהפעלה הראשונה נוצרות כל הטבלאות.

### 6. משתני סביבה (Environment Variables)
בדרך א' Render ישאל עליהם. בדרך ב': בעמוד השירות ← **Environment** ← **Add Environment Variable**.

| Key | Value | הסבר |
| --- | --- | --- |
| `DATABASE_URL` | הכתובת מ-Neon | חובה |
| `JWT_SECRET` | ב-Blueprint נוצר אוטומטית. ידנית: לחצי **Generate** אם יש, או הדביקי 40+ תווים אקראיים | חובה |
| `NODE_ENV` | `production` | |
| `NODE_VERSION` | `22` | |
| `JWT_EXPIRES_IN` | `1d` | |
| `CORS_ORIGIN` | כתובת אתר ה-React, למשל `https://borrowboard.onrender.com`. עד שיש אתר: `*` | בלי `/` בסוף |
| `SEED_ADMIN_EMAIL` | האימייל שלך, למשל `admin@myproject.com` | יוצר חשבון מנהל |
| `SEED_ADMIN_PASSWORD` | סיסמה חזקה, **10 תווים לפחות** | זכרי אותה! |
| `SEED_DEMO_PASSWORD` | אופציונלי: סיסמה ל-3 משתמשות הדגמה | ראי הסבר למטה |

**על `SEED_DEMO_PASSWORD`:** אם תגדירי אותו, ייווצרו גם משתמשות לדוגמה (`user@borrowboard.dev`, `user2@borrowboard.dev`, `user3@borrowboard.dev`), עם הסיסמה שבחרת ועם מוצרים, בקשות והצעות. זה נוח להצגת הפרויקט.

אחרי שמשנים משתנים לוחצים **Save Changes**. ב-Render זה מפעיל Deploy מחדש.

### 7. ‏Deploy
- ב-Blueprint, ה-Deploy מתחיל לבד. בשירות ידני לחצי **Create Web Service**.
- אפשר לעקוב בלשונית **Logs**. בסיום תופיע השורה `✅ BorrowBoard API פועל על פורט ...`
- הפעם הראשונה לוקחת כמה דקות.

### 8. בדיקה שהשרת פעיל
- למעלה בעמוד השירות מופיעה הכתובת שלו, למשל `https://borrowboard-api.onrender.com`. זו **כתובת השרת** שלך.
- הסטטוס צריך להיות **Live** (ירוק).

---

## חלק ד: בדיקה שהכול עובד

בכל הדוגמאות החליפי את `https://borrowboard-api.onrender.com` בכתובת השרת שלך.

### 1. בדיקת בריאות
פתחי בדפדפן: `https://borrowboard-api.onrender.com/api/health`
התשובה אמורה להיות:
```json
{ "status": "ok", "db": "up", ... }
```
אם יש `"db": "down"`, החיבור למסד הנתונים לא תקין. ראי את חלק ה.

### 2. פתיחת Swagger
פתחי: `https://borrowboard-api.onrender.com/api-docs`
יופיע מסך עם כל ה-API מחולק לפי נושאים.

### 3. התחברות מתוך Swagger
1. פתחי את **Auth** ← `POST /api/auth/login`.
2. לחצי **Try it out**.
3. בתיבה כתבי את המנהל שהגדרת:
   ```json
   { "email": "admin@myproject.com", "password": "הסיסמה-שבחרת" }
   ```
4. לחצי **Execute**.

### 4. קבלת JWT
בתשובה (Response body, קוד 200) יופיע `"token": "eyJ..."`. העתיקי את הערך **בלי המירכאות**.

### 5. שימוש ב-Authorize
1. גללי למעלה ולחצי על הכפתור **Authorize** 🔓.
2. הדביקי את ה-Token בשדה **Value**. בלי המילה Bearer, Swagger מוסיף אותה לבד.
3. לחצי **Authorize** ואז **Close**. המנעולים יופיעו סגורים 🔒.

### 6. קריאה ל-Endpoint מוגן
- `GET /api/auth/me` ← **Try it out** ← **Execute**. צריך לחזור 200 עם הפרטים שלך.
- `GET /api/admin/stats` אמור להחזיר 200, כי את מנהלת.
- **בדיקת 401:** לחצי **Authorize** ← **Logout**, והריצי שוב את `/api/auth/me`. צריך לחזור 401.

### 7. הוספת רשומה
מוצרים מוסיפה משתמשת רגילה, לא מנהל:
1. `POST /api/auth/register` ← Try it out:
   ```json
   { "name": "שרה לוי", "email": "sara@example.com", "password": "Sara1234", "phone": "052-7654321", "city": "אלעד" }
   ```
2. העתיקי את ה-`token` מהתשובה והכניסי אותו ב-**Authorize** (קודם Logout מהמנהל).
3. `GET /api/categories`: רשמי `id` של קטגוריה כלשהי, למשל 3.
4. `POST /api/products`:
   ```json
   { "name": "סיר לחץ", "description": "במצב מצוין", "categoryId": 3, "condition": "LIKE_NEW", "city": "אלעד", "maxDays": 7 }
   ```
   צריך לחזור **201**, עם `"id"` של המוצר החדש.
5. **בדיקת 403:** התחברי שוב כמנהל, הכניסי את ה-Token שלו ב-Authorize והריצי את אותו `POST /api/products`. צריך לחזור 403, כי מנהל לא מוסיף מוצרים.

### 8. שליפת הרשומה ממסד הנתונים
- `GET /api/products/{id}` עם ה-id מהשלב הקודם. אפשר גם בלי Token.
- או `GET /api/products?search=סיר`.
המוצר חוזר מהשרת, וזה אומר שהוא נשמר ב-PostgreSQL. 🎉

---

## חלק ה: פתרון תקלות

| תקלה | מה רואים | פתרון |
| --- | --- | --- |
| **Build Failed** | הלוג נעצר בשלב Build | ודאי ש-Build Command הוא בדיוק `npm ci --include=dev && npm run build`. ודאי ש-`package.json` ו-`package-lock.json` נמצאים **בשורש** ה-Repository ולא בתוך תיקייה פנימית. ודאי ש-`NODE_VERSION`=`22`. |
| **DATABASE_URL שגוי** | `P1001: Can't reach database server` או `"db":"down"` | העתיקי מחדש את הכתובת מ-Neon (‏**Connect**). ודאי שאין רווח או מירכאות מיותרות, ושהיא מתחילה ב-`postgresql://` ומסתיימת ב-`?sslmode=require`. |
| **בעיית Prisma** | `P3009`, `migrate found failed migrations` או `relation does not exist` | ודאי שהתיקייה `prisma/migrations` עלתה ל-GitHub עם `migration.sql`. אם מיגרציה נכשלה באמצע במסד חדש וריק, הכי פשוט למחוק את ה-Database ב-Neon, ליצור חדש, לעדכן את `DATABASE_URL` ולעשות Deploy שוב. |
| **JWT_SECRET חסר** | בלוג: `❌ הגדרות סביבה שגויות: JWT_SECRET` | הוסיפי `JWT_SECRET` עם 32 תווים לפחות ושמרי. |
| **שגיאת CORS** | בדפדפן של אתר ה-React: `blocked by CORS policy` | ב-`CORS_ORIGIN` שימי את הכתובת **המדויקת** של האתר, כולל `https://` ו**בלי** `/` בסוף. כמה כתובות מפרידים בפסיק, למשל `http://localhost:5173,https://borrowboard.onrender.com`. אחרי השינוי: Save. |
| **401** | `UNAUTHORIZED`, ‏`INVALID_TOKEN` או `TOKEN_EXPIRED` | לא נשלח Token, הוא הודבק לא נכון, או שפג תוקפו (ברירת מחדל: יום). התחברי שוב ועשי Authorize מחדש. |
| **403** | `FORBIDDEN`, ‏`NOT_OWNER` או `USER_BLOCKED` | ה-Token תקין, אבל אין הרשאה לפעולה. למשל מנהל שמנסה להוסיף מוצר, משתמשת שמנסה לערוך מוצר של מישהי אחרת, או משתמש חסום. |
| **Swagger לא נפתח** | דף ריק או 404 | ודאי שהכתובת היא `/api-docs` (בלי `/api` לפני). אם השרת "ישן", חכי דקה ורענני. |
| **השרת לא עולה** | Deploy נכשל אחרי Build | קראי את ה-**Logs**. בדרך כלל חסר משתנה סביבה (מופיעה שורה עם ❌) או ש-`DATABASE_URL` שגוי. |
| **הבקשה הראשונה איטית מאוד** | לוקח כ-50 שניות | זה תקין במסלול החינמי: השרת התעורר משינה. |
| **התחברות המנהל לא עובדת** | 401 | ודאי ש-`SEED_ADMIN_PASSWORD` באורך 10 תווים לפחות, ובדקי בלוג שמופיע `✅ נוצר מנהל`. אם המנהל נוצר עם סיסמה אחרת בעבר, הסיסמה לא מתעדכנת אוטומטית. |

---

## חלק ו: העלאת אתר ה-React (בקצרה)

לפי דרישות הפרויקט צריך להעלות גם את הלקוח. ב-Render עושים את זה כ-**Static Site**:
1. העלי את פרויקט ה-React ל-Repository נפרד ב-GitHub, באותה דרך כמו בחלק א.
2. ב-Render: **New +** ← **Static Site** ← בחרי את ה-Repository.
3. **Build Command:** `npm install && npm run build`
   **Publish Directory:** `dist` (בפרויקט Vite)
4. **Environment:** הוסיפי `VITE_API_URL` עם כתובת השרת, למשל `https://borrowboard-api.onrender.com`. את הקריאה למשתנה הזה בקוד את כותבת בעצמך.
5. כדי ש-React Router יעבוד ברענון דף: בהגדרות ה-Static Site ← **Redirects/Rewrites** ← הוסיפי כלל: Source ‏`/*`, ‏Destination ‏`/index.html`, ‏Action ‏**Rewrite**.
6. אחרי שהאתר עלה, עדכני בשרת את `CORS_ORIGIN` לכתובת האתר.

---

## הרצה מקומית (לפיתוח במחשב)

1. התקיני [Node.js 22](https://nodejs.org) ו-PostgreSQL, או השתמשי ב-Neon גם לפיתוח.
2. בתיקיית הפרויקט:
   ```bash
   npm install
   ```
3. העתיקי את `.env.example` לקובץ חדש בשם `.env`, ומלאי בו `DATABASE_URL` ו-`JWT_SECRET`.
4. ```bash
   npx prisma migrate deploy
   npm run db:seed
   npm run dev
   ```
5. פתחי http://localhost:3000/api-docs. החשבונות לדוגמה מופיעים ב-README.
