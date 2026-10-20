import { z } from 'zod';
import { cityField, conditionEnum, dateString, imageUrlField, pagination, searchField, sortOrder } from './common';

const wantedFields = {
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().min(1).max(1000),
  categoryId: z.number().int().positive(),
  city: cityField,
  imageUrl: imageUrlField.nullable().optional(),
  neededFrom: dateString.nullable().optional(),
  neededUntil: dateString.nullable().optional(),
};

const datesInOrder = (o: { neededFrom?: string | null; neededUntil?: string | null }) =>
  !o.neededFrom || !o.neededUntil || o.neededUntil >= o.neededFrom;
const datesMessage = { message: 'תאריך "עד" חייב להיות אחרי תאריך "מ-"', path: ['neededUntil'] };

export const createWantedItemSchema = z.object(wantedFields).refine(datesInOrder, datesMessage);

export const updateWantedItemSchema = z
  .object({ ...wantedFields, status: z.enum(['OPEN', 'CLOSED']) })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'יש לשלוח לפחות שדה אחד לעדכון' })
  .refine(datesInOrder, datesMessage);

export const listWantedItemsQuery = z.object({
  search: searchField,
  categoryId: z.coerce.number().int().positive().optional(),
  city: z.string().trim().max(50).optional(),
  status: z.enum(['OPEN', 'CLOSED']).default('OPEN'),
  sort: sortOrder,
  ...pagination,
});

export const createOfferSchema = z.object({
  message: z.string().trim().min(1).max(500),
  condition: conditionEnum,
  imageUrl: imageUrlField.nullable().optional(),
});

export const listOffersQuery = z.object({
  box: z.enum(['sent', 'received']).default('sent'),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED']).optional(),
});

export type CreateWantedItemInput = z.infer<typeof createWantedItemSchema>;
export type UpdateWantedItemInput = z.infer<typeof updateWantedItemSchema>;
export type ListWantedItemsQuery = z.infer<typeof listWantedItemsQuery>;
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type ListOffersQuery = z.infer<typeof listOffersQuery>;
