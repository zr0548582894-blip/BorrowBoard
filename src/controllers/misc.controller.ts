import type { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { currentUser } from '../middleware/auth';
import { listNotificationsQuery, listUsersQuery } from '../schemas/admin.schema';
import { idParam } from '../schemas/common';
import * as adminService from '../services/admin.service';
import * as imageService from '../services/image.service';
import * as notificationService from '../services/notification.service';

// ---------- בדיקת בריאות ----------

export async function health(_req: Request, res: Response) {
  let db: 'up' | 'down' = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'down';
  }
  res.status(db === 'up' ? 200 : 503).json({
    status: db === 'up' ? 'ok' : 'error',
    db,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

// ---------- הודעות ----------

export async function listNotifications(req: Request, res: Response) {
  const { unread } = listNotificationsQuery.parse(req.query);
  res.json(await notificationService.listNotifications(currentUser(req).id, unread));
}

export async function markNotificationRead(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await notificationService.markRead(currentUser(req).id, id));
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  res.json(await notificationService.markAllRead(currentUser(req).id));
}

// ---------- תמונות ----------

export async function uploadImage(req: Request, res: Response) {
  res.status(201).json(await imageService.saveImage(currentUser(req).id, req.file));
}

export async function getImage(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const image = await imageService.getImage(id);
  res.setHeader('Content-Type', image.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(image.data));
}

// ---------- מנהל ----------

export async function adminStats(_req: Request, res: Response) {
  res.json(await adminService.getStats());
}

export async function adminListUsers(req: Request, res: Response) {
  const query = listUsersQuery.parse(req.query);
  res.json(await adminService.listUsers(query));
}

export async function adminBlockUser(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await adminService.setBlocked(currentUser(req).id, id, true));
}

export async function adminUnblockUser(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await adminService.setBlocked(currentUser(req).id, id, false));
}
