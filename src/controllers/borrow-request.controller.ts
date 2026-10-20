import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import { idParam } from '../schemas/common';
import { listBorrowRequestsQuery } from '../schemas/borrow-request.schema';
import * as borrowService from '../services/borrow-request.service';

export async function list(req: Request, res: Response) {
  const query = listBorrowRequestsQuery.parse(req.query);
  res.json(await borrowService.listBorrowRequests(currentUser(req).id, query));
}

export async function approve(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await borrowService.approveBorrowRequest(id, currentUser(req).id));
}

export async function reject(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await borrowService.rejectBorrowRequest(id, currentUser(req).id));
}

export async function markReturned(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await borrowService.markReturned(id, currentUser(req).id));
}

export async function cancel(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await borrowService.cancelBorrowRequest(id, currentUser(req).id));
}
