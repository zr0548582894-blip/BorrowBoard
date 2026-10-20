import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/auth';
import * as auth from '../controllers/auth.controller';
import * as categories from '../controllers/category.controller';
import * as products from '../controllers/product.controller';
import * as borrowRequests from '../controllers/borrow-request.controller';
import * as wanted from '../controllers/wanted-item.controller';
import * as misc from '../controllers/misc.controller';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '../services/image.service';
import { badRequest } from '../utils/http-error';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) return cb(null, true);
    cb(badRequest('הקובץ חייב להיות תמונה מסוג JPG, PNG או WEBP', 'INVALID_FILE_TYPE'));
  },
});

const isUser = [requireAuth, requireRole('USER')];
const isAdmin = [requireAuth, requireRole('ADMIN')];
const isOwnerOrAdmin = [requireAuth, requireRole('USER', 'ADMIN')];

export const apiRouter = Router();

// כללי
apiRouter.get('/health', misc.health);

// התחברות
apiRouter.post('/auth/register', auth.register);
apiRouter.post('/auth/login', auth.login);
apiRouter.get('/auth/me', requireAuth, auth.me);
apiRouter.put('/auth/me', requireAuth, auth.updateMe);

// קטגוריות
apiRouter.get('/categories', categories.list);
apiRouter.post('/categories', ...isAdmin, categories.create);
apiRouter.put('/categories/:id', ...isAdmin, categories.update);
apiRouter.delete('/categories/:id', ...isAdmin, categories.remove);

// מוצרים
apiRouter.get('/products', products.list);
apiRouter.get('/products/mine', ...isUser, products.mine);
apiRouter.get('/products/:id', products.getOne);
apiRouter.post('/products', ...isUser, products.create);
apiRouter.put('/products/:id', ...isUser, products.update);
apiRouter.delete('/products/:id', ...isOwnerOrAdmin, products.remove);
apiRouter.post('/products/:id/borrow-requests', ...isUser, products.requestBorrow);

// בקשות השאלה
apiRouter.get('/borrow-requests', ...isUser, borrowRequests.list);
apiRouter.patch('/borrow-requests/:id/approve', ...isUser, borrowRequests.approve);
apiRouter.patch('/borrow-requests/:id/reject', ...isUser, borrowRequests.reject);
apiRouter.patch('/borrow-requests/:id/return', ...isUser, borrowRequests.markReturned);
apiRouter.patch('/borrow-requests/:id/cancel', ...isUser, borrowRequests.cancel);

// דף הבקשות (מוצרים מבוקשים) והצעות
apiRouter.get('/wanted-items', wanted.list);
apiRouter.get('/wanted-items/mine', ...isUser, wanted.mine);
apiRouter.get('/wanted-items/:id', wanted.getOne);
apiRouter.post('/wanted-items', ...isUser, wanted.create);
apiRouter.put('/wanted-items/:id', ...isUser, wanted.update);
apiRouter.delete('/wanted-items/:id', ...isOwnerOrAdmin, wanted.remove);
apiRouter.post('/wanted-items/:id/offers', ...isUser, wanted.createOffer);

apiRouter.get('/offers', ...isUser, wanted.listOffers);
apiRouter.patch('/offers/:id/accept', ...isUser, wanted.acceptOffer);
apiRouter.patch('/offers/:id/reject', ...isUser, wanted.rejectOffer);
apiRouter.patch('/offers/:id/cancel', ...isUser, wanted.cancelOffer);

// הודעות
apiRouter.get('/notifications', requireAuth, misc.listNotifications);
apiRouter.patch('/notifications/read-all', requireAuth, misc.markAllNotificationsRead);
apiRouter.patch('/notifications/:id/read', requireAuth, misc.markNotificationRead);

// תמונות
apiRouter.post('/images', ...isUser, upload.single('image'), misc.uploadImage);
apiRouter.get('/images/:id', misc.getImage);

// מנהל
apiRouter.get('/admin/stats', ...isAdmin, misc.adminStats);
apiRouter.get('/admin/users', ...isAdmin, misc.adminListUsers);
apiRouter.patch('/admin/users/:id/block', ...isAdmin, misc.adminBlockUser);
apiRouter.patch('/admin/users/:id/unblock', ...isAdmin, misc.adminUnblockUser);
