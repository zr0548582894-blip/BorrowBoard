# מדריך API לכתיבת צד ה-React

המסמך מסביר **מה** ה-React שולח לשרת ו**מה** חוזר ממנו. אין כאן קוד React, אותו את כותבת בעצמך. כל הדוגמאות לקוחות מתשובות אמיתיות של השרת.

לכל Endpoint יש תיעוד מלא, אפשר לנסות אותו בלחיצה, ב-Swagger: `<כתובת השרת>/api-docs`

---

## 1. כתובת השרת (Base URL)

| סביבה | Base URL |
| --- | --- |
| פיתוח במחשב | `http://localhost:3000` |
| בענן (Render) | `https://<שם-השירות>.onrender.com` |

כל הנתיבים מתחילים ב-`/api`, למשל `GET http://localhost:3000/api/products`.

כדאי לשמור את כתובת השרת במשתנה סביבה של פרויקט ה-React (ב-Vite: `VITE_API_URL`), כדי שבענן תצטרכי לשנות רק את הערך.

> **שימי לב:** השרת החינמי ב-Render "נרדם" אחרי 15 דקות. הבקשה הראשונה אחרי זה יכולה לקחת כ-50 שניות, וזו עוד סיבה להציג Loading.

---

## 2. התחברות (Authentication)

1. המשתמשת נרשמת (`POST /api/auth/register`) או מתחברת (`POST /api/auth/login`).
2. התשובה מכילה `token` (JWT) ו-`user`.
3. שומרים את ה-`token` ואת ה-`user` בצד הלקוח, למשל ב-Context או ב-Redux, ואם רוצים להישאר מחוברים אחרי רענון, גם ב-`localStorage`.
4. בכל קריאה **מוגנת** שולחים כותרת:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   ```
5. ה-Token תקף יום אחד (ברירת מחדל). אחרי זה השרת מחזיר `401` עם `TOKEN_EXPIRED`, ואז מנתקים ומעבירים למסך ההתחברות.
6. **התנתקות** = מוחקים את ה-Token בצד הלקוח. אין קריאה לשרת.
7. אחרי רענון דף: קוראים ל-`GET /api/auth/me` עם ה-Token השמור, כדי לוודא שהוא עדיין תקף ולקבל פרטים עדכניים.

**מה ה-React עושה עם `user.role`:** מציג תפריט של מנהל (`ADMIN`) או של משתמשת (`USER`), ומגן על נתיבים ב-React Router. ההגנה האמיתית נמצאת בשרת, אבל הממשק לא צריך להציג כפתורים שיחזירו 403.

### דוגמה: התחברות
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@borrowboard.dev", "password": "User1234!" }
```
תשובה `200`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 2,
    "name": "יעל כהן",
    "email": "user@borrowboard.dev",
    "phone": "0501234567",
    "city": "בני ברק",
    "role": "USER",
    "isBlocked": false,
    "createdAt": "2026-10-18T23:29:39.922Z",
    "productCount": 4
  }
}
```

`productCount` מגיע מהשרת כדי שתוכלי להציג את התזכורת **"גם לך יש מה להשאיל? הוסיפי מוצר"** כשהוא `0`. כדאי להציג אותה באזור האישי ובטופס בקשת ההשאלה.

### חשבונות לבדיקה (בפיתוח)
| תפקיד | אימייל | סיסמה |
| --- | --- | --- |
| מנהל | admin@borrowboard.dev | Admin1234! |
| יעל (4 מוצרים) | user@borrowboard.dev | User1234! |
| מרים (4 מוצרים) | user2@borrowboard.dev | User1234! |
| שרה (בלי מוצרים, לבדיקת התזכורת) | user3@borrowboard.dev | User1234! |

---

## 3. כל ה-Endpoints

🌐 = ציבורי (בלי Token) · 🔒U = משתמשת רגילה · 🔒A = מנהל · 🔒 = כל מחובר

| Method | URL | הרשאה | מה עושה |
| --- | --- | --- | --- |
| GET | `/api/health` | 🌐 | בדיקת שרת |
| POST | `/api/auth/register` | 🌐 | הרשמה |
| POST | `/api/auth/login` | 🌐 | התחברות |
| GET | `/api/auth/me` | 🔒 | המשתמש המחובר |
| PUT | `/api/auth/me` | 🔒 | עדכון שם / טלפון / עיר |
| GET | `/api/categories` | 🌐 | כל הקטגוריות |
| POST | `/api/categories` | 🔒A | הוספת קטגוריה |
| PUT | `/api/categories/:id` | 🔒A | עריכת קטגוריה |
| DELETE | `/api/categories/:id` | 🔒A | מחיקת קטגוריה |
| GET | `/api/products` | 🌐 | רשימת מוצרים + חיפוש/סינון/מיון/עמודים |
| GET | `/api/products/mine` | 🔒U | המוצרים שלי |
| GET | `/api/products/:id` | 🌐 | מוצר בודד + תאריכים תפוסים |
| POST | `/api/products` | 🔒U | הוספת מוצר |
| PUT | `/api/products/:id` | 🔒U (בעלים) | עריכת מוצר |
| DELETE | `/api/products/:id` | 🔒U (בעלים) / 🔒A | מחיקת מוצר |
| POST | `/api/products/:id/borrow-requests` | 🔒U | בקשת השאלה |
| GET | `/api/borrow-requests?box=sent\|received` | 🔒U | בקשות ששלחתי / שקיבלתי |
| PATCH | `/api/borrow-requests/:id/approve` | 🔒U (בעלת המוצר) | אישור |
| PATCH | `/api/borrow-requests/:id/reject` | 🔒U (בעלת המוצר) | דחייה |
| PATCH | `/api/borrow-requests/:id/return` | 🔒U (בעלת המוצר) | סימון "הוחזר" |
| PATCH | `/api/borrow-requests/:id/cancel` | 🔒U (הלווה) | ביטול בקשה ממתינה |
| GET | `/api/wanted-items` | 🌐 | דף הבקשות + חיפוש/סינון |
| GET | `/api/wanted-items/mine` | 🔒U | הבקשות שפרסמתי |
| GET | `/api/wanted-items/:id` | 🌐 | בקשה בודדת |
| POST | `/api/wanted-items` | 🔒U | פרסום בקשה |
| PUT | `/api/wanted-items/:id` | 🔒U (מפרסמת) | עריכה / סגירה |
| DELETE | `/api/wanted-items/:id` | 🔒U (מפרסמת) / 🔒A | מחיקה |
| POST | `/api/wanted-items/:id/offers` | 🔒U | הצעת מוצר לבקשה |
| GET | `/api/offers?box=sent\|received` | 🔒U | הצעות ששלחתי / שקיבלתי |
| PATCH | `/api/offers/:id/accept` | 🔒U (מפרסמת הבקשה) | אישור הצעה |
| PATCH | `/api/offers/:id/reject` | 🔒U (מפרסמת הבקשה) | דחיית הצעה |
| PATCH | `/api/offers/:id/cancel` | 🔒U (מציעה) | ביטול הצעה |
| GET | `/api/notifications` | 🔒 | ההודעות שלי + מספר שלא נקראו |
| PATCH | `/api/notifications/:id/read` | 🔒 | סימון כנקראה |
| PATCH | `/api/notifications/read-all` | 🔒 | סימון הכול כנקרא |
| POST | `/api/images` | 🔒U | העלאת תמונה (קובץ) |
| GET | `/api/images/:id` | 🌐 | הצגת תמונה |
| GET | `/api/admin/stats` | 🔒A | נתונים ללוח המנהל |
| GET | `/api/admin/users` | 🔒A | רשימת משתמשים |
| PATCH | `/api/admin/users/:id/block` | 🔒A | חסימה |
| PATCH | `/api/admin/users/:id/unblock` | 🔒A | ביטול חסימה |

---

## 4. אילו Endpoints צריך בכל מסך

| מסך | קריאות לשרת |
| --- | --- |
| **Login** | `POST /api/auth/login` |
| **Register** | `POST /api/auth/register` |
| **Header** | מהמשתמש השמור. מונה הודעות: `GET /api/notifications` (משתמשים ב-`unreadCount`) |
| **Products (דף הבית)** | `GET /api/products?search=&categoryId=&city=&condition=&status=&sort=&page=` + `GET /api/categories` (לרשימת הסינון). **כשהתוצאה ריקה (`total: 0`)**: כפתור "לא מצאת? פרסמי בקשה" שמעביר לטופס הבקשה עם מילת החיפוש והקטגוריה |
| **Product Details** | `GET /api/products/:id`. הכפתור "בקשת השאלה" מוצג רק למחוברת שאינה הבעלים (`owner.id !== user.id`). לבעלים: כפתורי עריכה ומחיקה |
| **Borrow Request Form** | `POST /api/products/:id/borrow-requests`. כדאי להציג את `bookedPeriods` ואת `maxDays` |
| **Product Form (הוספה/עריכה)** | `GET /api/categories`, ‏`POST /api/images` (אם נבחר קובץ), ואז `POST /api/products` או `PUT /api/products/:id`. בעריכה טוענים קודם `GET /api/products/:id` |
| **Wanted Items (דף הבקשות)** | `GET /api/wanted-items?...` + `GET /api/categories` |
| **Wanted Item Details** | `GET /api/wanted-items/:id`. כפתור "הצעת מוצר" ← `POST /api/wanted-items/:id/offers` |
| **Wanted Item Form** | `POST /api/wanted-items` או `PUT /api/wanted-items/:id`, ואם יש תמונה, קודם `POST /api/images` |
| **אזור אישי** | `GET /api/products/mine`, ‏`GET /api/wanted-items/mine`, ‏`GET /api/borrow-requests?box=sent` / `received`, ‏`GET /api/offers?box=sent` / `received`, ‏`GET /api/notifications`. פעולות: approve / reject / return / cancel / accept, ו-`PATCH .../read` |
| **Admin Dashboard** | `GET /api/admin/stats` |
| **Admin Products** | `GET /api/products?...`, ‏`GET /api/wanted-items?...`, ‏`DELETE /api/products/:id`, ‏`DELETE /api/wanted-items/:id`. קטגוריות: `GET` / `POST` / `PUT` / `DELETE /api/categories` |
| **Admin Users** | `GET /api/admin/users?search=&isBlocked=&page=`, ‏`PATCH /api/admin/users/:id/block` / `unblock` |

**אחרי פעולה שמשנה נתונים** (הוספה, אישור, מחיקה וכו') צריך לרענן את הרשימות שמושפעות ממנה. ב-React Query עושים את זה עם invalidation של המפתחות המתאימים. לדוגמה: אחרי אישור בקשה משתנים "בקשות שקיבלתי", המוצר עצמו (הסטטוס ו-`bookedPeriods`) ומונה ההודעות.

---

## 5. מבני הנתונים

### Product (מוצר)
```json
{
  "id": 4,
  "ownerId": 2,
  "name": "מיחם לשבת 40 כוסות",
  "description": "מיחם חשמלי גדול, מתאים לאירועים ולשבתות.",
  "categoryId": 6,
  "condition": "USED",
  "city": "בני ברק",
  "imageUrl": "/api/images/4",
  "maxDays": 7,
  "createdAt": "2026-10-18T23:29:40.150Z",
  "updatedAt": "2026-10-18T23:29:40.150Z",
  "category": { "id": 6, "name": "ציוד לאירועים" },
  "owner": { "id": 2, "name": "יעל כהן", "city": "בני ברק" },
  "status": "BORROWED",
  "bookedPeriods": [
    { "startDate": "2026-10-17", "endDate": "2026-10-22" },
    { "startDate": "2026-10-29", "endDate": "2026-10-31" }
  ]
}
```
- `bookedPeriods` מופיע רק במוצר בודד (`GET /api/products/:id`).
- `/api/products/mine` מוסיף `pendingRequestsCount`, כלומר כמה בקשות מחכות לאישורך.
- `status`: ‏`AVAILABLE` = זמין עכשיו, `BORROWED` = מושאל עכשיו. השרת מחשב אותו לבד, ואי אפשר לשלוח אותו.
- `condition`: ‏`NEW` חדש · `LIKE_NEW` כמו חדש · `USED` משומש.
- **הצגת תמונה:** `imageUrl` הוא נתיב יחסי. מחברים אותו לכתובת השרת: `<Base URL>/api/images/4`. אם `imageUrl` הוא `null`, מציגים תמונת ברירת מחדל.

### רשימה עם עמודים (מוצרים, דף הבקשות, משתמשים)
```json
{ "items": [ ... ], "total": 8, "page": 1, "limit": 12, "totalPages": 1 }
```

### BorrowRequest (בקשת השאלה)
```json
{
  "id": 3,
  "status": "PENDING",
  "startDate": "2026-10-24",
  "endDate": "2026-10-27",
  "message": "אשמח לשבת הקרובה",
  "createdAt": "2026-10-18T23:29:40.205Z",
  "updatedAt": "2026-10-18T23:29:40.205Z",
  "product": { "id": 1, "name": "סיר לחץ 6 ליטר", "imageUrl": "/api/images/1" },
  "borrower": { "id": 3, "name": "מרים לוי", "city": "ירושלים", "phone": null },
  "owner": { "id": 2, "name": "יעל כהן", "city": "בני ברק", "phone": null }
}
```
- `status`: ‏`PENDING` ממתינה · `APPROVED` אושרה · `REJECTED` נדחתה · `RETURNED` הוחזרה · `CANCELLED` בוטלה.
- **הטלפון** (`phone`) הוא `null` עד שהבקשה מאושרת. בסטטוס `APPROVED` או `RETURNED` הוא מכיל את המספר. כך מציגים "פרטי קשר" רק אחרי אישור.
- בתיבת `received` את הבעלים (`owner`), ובתיבת `sent` את הלווה (`borrower`).

### WantedItem (בקשה בדף הבקשות)
```json
{
  "id": 3,
  "requesterId": 4,
  "title": "כסא תינוק לרכב",
  "description": "לנסיעה משפחתית של יומיים.",
  "categoryId": 8,
  "city": "אלעד",
  "imageUrl": null,
  "status": "OPEN",
  "createdAt": "2026-10-18T23:29:40.220Z",
  "updatedAt": "2026-10-18T23:29:40.220Z",
  "category": { "id": 8, "name": "רכב" },
  "requester": { "id": 4, "name": "שרה פרידמן", "city": "אלעד" },
  "neededFrom": "2026-11-02",
  "neededUntil": "2026-11-03",
  "pendingOffersCount": 0
}
```
`status`: ‏`OPEN` פתוחה · `CLOSED` נסגרה. נסגרת אוטומטית כשמאשרים הצעה, או ידנית ב-PUT.

### Offer (הצעה)
```json
{
  "id": 1,
  "status": "PENDING",
  "message": "יש לי מקרן ישן שעובד טוב, כולל כבל HDMI.",
  "condition": "USED",
  "imageUrl": null,
  "createdAt": "2026-10-18T23:29:40.222Z",
  "wantedItem": { "id": 1, "title": "מקרן לשיעור", "status": "OPEN" },
  "offerer": { "id": 2, "name": "יעל כהן", "city": "בני ברק", "phone": null },
  "requester": { "id": 3, "name": "מרים לוי", "city": "ירושלים", "phone": null }
}
```
`status`: ‏`PENDING` · `ACCEPTED` · `REJECTED` · `CANCELLED`. הטלפונים נחשפים רק ב-`ACCEPTED`.

### Notification (הודעה)
```json
{
  "items": [
    {
      "id": 1,
      "userId": 2,
      "type": "BORROW_REQUESTED",
      "text": "מרים לוי מבקשת להשאיל את \"סיר לחץ 6 ליטר\"",
      "link": "/products/1",
      "isRead": false,
      "createdAt": "2026-10-18T23:29:40.226Z"
    }
  ],
  "unreadCount": 1
}
```
- `link` הוא נתיב **במסכי ה-React**: ‏`/products/:id` או `/wanted/:id`. אפשר לנווט אליו בלחיצה על ההודעה. מומלץ להגדיר נתיבים בשמות האלה, או לשנות את הקישור בצד שלך.
- סינון "חדש": ‏`GET /api/notifications?unread=true`. סינון "שלחתי לעומת קיבלתי" בבקשות ובהצעות: הפרמטר `box`.

---

## 6. שדות חובה בטפסים

| טופס | שדות חובה | שדות רשות | חוקים |
| --- | --- | --- | --- |
| הרשמה | `name`, ‏`email`, ‏`password`, ‏`phone` | `city` | שם 2–50 תווים · סיסמה 8+ תווים עם אות באנגלית וספרה · טלפון ישראלי (`05X-XXXXXXX`, מקפים ורווחים מותרים) |
| התחברות | `email`, ‏`password` | | |
| עדכון פרטים | לפחות שדה אחד | `name`, ‏`phone`, ‏`city` | |
| מוצר | `name`, ‏`description`, ‏`categoryId` (מספר), ‏`condition`, ‏`city` | `imageUrl`, ‏`maxDays` | שם 2–80 · תיאור עד 1000 · `maxDays` מ-1 עד 90 או `null` |
| בקשת השאלה | `startDate`, ‏`endDate` | `message` | תאריכים בפורמט `YYYY-MM-DD` · התחלה לא בעבר · סיום ≥ התחלה · לא יותר מ-`maxDays` ימים (כולל יום ההתחלה והסיום) · לא חופף להשאלה מאושרת |
| בקשה בדף הבקשות | `title`, ‏`description`, ‏`categoryId`, ‏`city` | `imageUrl`, ‏`neededFrom`, ‏`neededUntil` | `neededUntil` ≥ `neededFrom` |
| הצעה | `message`, ‏`condition` | `imageUrl` | הודעה עד 500 תווים |
| קטגוריה (מנהל) | `name` | | 2–50 תווים, לא כפול |

**בעריכה (PUT)** שולחים רק את השדות שהשתנו. כדי לנקות שדה רשות, למשל להסיר תמונה, שולחים `null`.

> `<input type="date">` בדפדפן כבר מחזיר תאריך בפורמט `YYYY-MM-DD`, בדיוק מה שהשרת מצפה לו.

---

## 7. העלאת תמונה, שני שלבים

1. **העלאת הקובץ:**
   ```http
   POST /api/images
   Authorization: Bearer <token>
   Content-Type: multipart/form-data

   (שדה בשם image עם הקובץ)
   ```
   תשובה `201`:
   ```json
   { "id": 9, "url": "/api/images/9", "mimeType": "image/jpeg", "size": 154320 }
   ```
   - שולחים `FormData` עם שדה בשם **`image`**. **לא** מגדירים בעצמך `Content-Type`, הדפדפן מגדיר אותו לבד.
   - מותר רק JPG, PNG או WEBP, עד 2MB. קובץ גדול יותר מחזיר `413 FILE_TOO_LARGE`, וסוג אחר מחזיר `400 INVALID_FILE_TYPE`.
2. **שמירת המוצר** עם הכתובת שהתקבלה:
   ```json
   { "name": "...", "imageUrl": "/api/images/9", ... }
   ```

אפשר גם `imageUrl` של קישור חיצוני (`https://...`), אבל לפי ההחלטה בפרויקט מעלים קובץ מהמחשב.

---

## 8. חיפוש, סינון ומיון

### מוצרים: `GET /api/products`
| פרמטר | ערכים | דוגמה |
| --- | --- | --- |
| `search` | טקסט, מחפש בשם ובתיאור | `search=סיר` |
| `categoryId` | מספר | `categoryId=3` |
| `city` | טקסט (חיפוש חלקי) | `city=בני ברק` |
| `condition` | `NEW` / `LIKE_NEW` / `USED` | |
| `status` | `AVAILABLE` / `BORROWED` | `status=AVAILABLE` |
| `ownerId` | מספר | |
| `sort` | `newest` (ברירת מחדל) / `oldest` / `name` | |
| `page`, ‏`limit` | עמוד (מ-1), כמות בעמוד (1–50, ברירת מחדל 12) | `page=2&limit=12` |

שילוב: `/api/products?search=סיר&city=בני ברק&status=AVAILABLE&sort=name&page=1`
(טקסט עברי ורווחים צריך לקודד ב-URL. `URLSearchParams` עושה את זה לבד.)

### דף הבקשות: `GET /api/wanted-items`
`search`, ‏`categoryId`, ‏`city`, ‏`status` (`OPEN` כברירת מחדל, או `CLOSED`), ‏`sort`, ‏`page`, ‏`limit`.

### משתמשים (מנהל): `GET /api/admin/users`
`search` (שם או אימייל), ‏`isBlocked=true|false`, ‏`page`, ‏`limit` (עד 100).

---

## 9. שגיאות

כל שגיאה חוזרת **באותו מבנה**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "הנתונים שנשלחו אינם תקינים",
    "details": [
      { "field": "endDate", "message": "תאריך חייב להיות בפורמט YYYY-MM-DD" }
    ]
  }
}
```
- `message` כתוב בעברית, ואפשר להציג אותו למשתמשת כמו שהוא.
- `details` מופיע רק בשגיאות ולידציה. `field` הוא שם השדה, וכך אפשר להציג את השגיאה ליד השדה המתאים בטופס.

| קוד HTTP | מתי | קודים נפוצים (`error.code`) |
| --- | --- | --- |
| 400 | נתונים לא תקינים | `VALIDATION_ERROR`, ‏`INVALID_JSON`, ‏`START_IN_PAST`, ‏`TOO_LONG`, ‏`INVALID_CATEGORY`, ‏`INVALID_IMAGE`, ‏`INVALID_FILE_TYPE`, ‏`FILE_REQUIRED`, ‏`CANNOT_BLOCK_SELF`, ‏`CANNOT_BLOCK_ADMIN` |
| 401 | לא מחובר / Token לא תקין / פג תוקף / סיסמה שגויה | `UNAUTHORIZED`, ‏`INVALID_TOKEN`, ‏`TOKEN_EXPIRED`, ‏`INVALID_CREDENTIALS` |
| 403 | מחובר אבל אין הרשאה | `FORBIDDEN`, ‏`NOT_OWNER`, ‏`OWN_PRODUCT`, ‏`OWN_WANTED_ITEM`, ‏`NOT_REQUESTER`, ‏`NOT_OFFERER`, ‏`USER_BLOCKED` |
| 404 | לא נמצא | `NOT_FOUND`, ‏`ROUTE_NOT_FOUND` |
| 409 | התנגשות במצב | `EMAIL_TAKEN`, ‏`DATES_TAKEN`, ‏`DUPLICATE_REQUEST`, ‏`DUPLICATE_OFFER`, ‏`INVALID_STATUS`, ‏`PRODUCT_BORROWED`, ‏`WANTED_ITEM_CLOSED`, ‏`CATEGORY_EXISTS`, ‏`CATEGORY_IN_USE` |
| 413 | קובץ גדול מדי | `FILE_TOO_LARGE` |
| 500 | תקלה בשרת | `INTERNAL_ERROR` |

**המלצה:** בכל תשובת `401` מנתקים את המשתמשת ומעבירים ל-Login. ב-`USER_BLOCKED` מציגים הודעה שהחשבון חסום.

---

## 10. הרשאות, מה מותר לכל אחד

| פעולה | אורח | USER | ADMIN |
| --- | --- | --- | --- |
| צפייה במוצרים ובדף הבקשות, חיפוש וסינון | ✓ | ✓ | ✓ |
| הוספת מוצר / פרסום בקשה | | ✓ | |
| עריכת מוצר / בקשה | | רק שלה | |
| מחיקת מוצר / בקשה | | רק שלה (מוצר: רק כשאינו מושאל) | ✓ הכול |
| בקשת השאלה / הצעה | | ✓ (לא לעצמה) | |
| אישור / דחייה / "הוחזר" | | בעלת המוצר | |
| אישור / דחייה של הצעה | | מפרסמת הבקשה | |
| ביטול בקשה / הצעה ממתינה | | מי ששלחה | |
| הודעות | | שלה | שלו |
| קטגוריות (הוספה/עריכה/מחיקה) | | | ✓ |
| לוח מנהל, משתמשים, חסימה | | | ✓ |

---

## 11. מה מוחזר בהצלחה

| פעולה | קוד | גוף התשובה |
| --- | --- | --- |
| הרשמה | 201 | `{ token, user }` |
| התחברות | 200 | `{ token, user }` |
| יצירה (מוצר, בקשה, הצעה, בקשת השאלה, קטגוריה, תמונה) | 201 | הפריט שנוצר |
| עריכה / PATCH (אישור, דחייה...) | 200 | הפריט המעודכן |
| מחיקה | 204 | ריק, בלי JSON |
| רשימות עם עמודים | 200 | `{ items, total, page, limit, totalPages }` |
| רשימות אישיות (`/mine`, `borrow-requests`, `offers`) | 200 | מערך `[ ... ]` |

---

## 12. זרימות עיקריות, צעד אחר צעד

**השאלת מוצר קיים:**
1. דף הבית: `GET /api/products` ← לחיצה על מוצר ← `GET /api/products/:id`
2. "בקשת השאלה" ← `POST /api/products/:id/borrow-requests` עם `{ startDate, endDate, message }`
3. בעלת המוצר מקבלת הודעה ← באזור האישי `GET /api/borrow-requests?box=received` ← `PATCH .../approve`
4. הלווה רואה `APPROVED` ואת הטלפון של בעלת המוצר. אחרי ההחזרה, בעלת המוצר עושה `PATCH .../return`.

**מוצר שלא נמצא:**
1. חיפוש בדף הבית מחזיר `total: 0` ← "לא מצאת? פרסמי בקשה"
2. `POST /api/wanted-items`
3. מלווה מוצאת את הבקשה בדף הבקשות ← `POST /api/wanted-items/:id/offers`
4. מפרסמת הבקשה: `GET /api/offers?box=received` ← `PATCH /api/offers/:id/accept`. הבקשה נסגרת והטלפונים נחשפים.
