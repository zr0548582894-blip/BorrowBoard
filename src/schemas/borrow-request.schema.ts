import { z } from 'zod';
import { dateString } from './common';

export const createBorrowRequestSchema = z
  .object({
    startDate: dateString,
    endDate: dateString,
    message: z.string().trim().max(500).optional(),
  })
  .refine((o) => o.endDate >= o.startDate, {
    message: 'תאריך הסיום חייב להיות באותו יום או אחרי תאריך ההתחלה',
    path: ['endDate'],
  });

export const listBorrowRequestsQuery = z.object({
  box: z.enum(['sent', 'received']).default('sent'),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED']).optional(),
});

export type CreateBorrowRequestInput = z.infer<typeof createBorrowRequestSchema>;
export type ListBorrowRequestsQuery = z.infer<typeof listBorrowRequestsQuery>;
