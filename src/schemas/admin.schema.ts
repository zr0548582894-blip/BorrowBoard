import { z } from 'zod';
import { booleanQuery, pagination, searchField } from './common';

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(50),
});

export const listUsersQuery = z.object({
  search: searchField,
  isBlocked: booleanQuery,
  ...pagination,
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listNotificationsQuery = z.object({
  unread: booleanQuery,
});

export type ListUsersQuery = z.infer<typeof listUsersQuery>;
