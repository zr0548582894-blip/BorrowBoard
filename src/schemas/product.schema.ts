import { z } from 'zod';
import { cityField, conditionEnum, imageUrlField, pagination, searchField, sortOrder } from './common';

const productFields = {
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(1).max(1000),
  categoryId: z.number().int().positive(),
  condition: conditionEnum,
  city: cityField,
  imageUrl: imageUrlField.nullable().optional(),
  maxDays: z.number().int().min(1).max(90).nullable().optional(),
};

export const createProductSchema = z.object(productFields);

export const updateProductSchema = z
  .object(productFields)
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'יש לשלוח לפחות שדה אחד לעדכון' });

export const listProductsQuery = z.object({
  search: searchField,
  categoryId: z.coerce.number().int().positive().optional(),
  city: z.string().trim().max(50).optional(),
  condition: conditionEnum.optional(),
  status: z.enum(['AVAILABLE', 'BORROWED']).optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  sort: sortOrder,
  ...pagination,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuery>;
