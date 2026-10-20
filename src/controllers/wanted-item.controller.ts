import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import { idParam } from '../schemas/common';
import {
  createOfferSchema,
  createWantedItemSchema,
  listOffersQuery,
  listWantedItemsQuery,
  updateWantedItemSchema,
} from '../schemas/wanted-item.schema';
import * as wantedService from '../services/wanted-item.service';

export async function list(req: Request, res: Response) {
  const query = listWantedItemsQuery.parse(req.query);
  res.json(await wantedService.listWantedItems(query));
}

export async function mine(req: Request, res: Response) {
  res.json(await wantedService.listMyWantedItems(currentUser(req).id));
}

export async function getOne(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await wantedService.getWantedItem(id));
}

export async function create(req: Request, res: Response) {
  const input = createWantedItemSchema.parse(req.body);
  res.status(201).json(await wantedService.createWantedItem(currentUser(req).id, input));
}

export async function update(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = updateWantedItemSchema.parse(req.body);
  res.json(await wantedService.updateWantedItem(id, currentUser(req).id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  await wantedService.deleteWantedItem(id, currentUser(req));
  res.status(204).end();
}

export async function createOffer(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = createOfferSchema.parse(req.body);
  res.status(201).json(await wantedService.createOffer(id, currentUser(req).id, input));
}

// ---------- /api/offers ----------

export async function listOffers(req: Request, res: Response) {
  const query = listOffersQuery.parse(req.query);
  res.json(await wantedService.listOffers(currentUser(req).id, query));
}

export async function acceptOffer(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await wantedService.acceptOffer(id, currentUser(req).id));
}

export async function rejectOffer(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await wantedService.rejectOffer(id, currentUser(req).id));
}

export async function cancelOffer(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await wantedService.cancelOffer(id, currentUser(req).id));
}
