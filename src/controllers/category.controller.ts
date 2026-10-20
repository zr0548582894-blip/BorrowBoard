import type { Request, Response } from 'express';
import { categorySchema } from '../schemas/admin.schema';
import { idParam } from '../schemas/common';
import * as categoryService from '../services/category.service';

export async function list(_req: Request, res: Response) {
  res.json(await categoryService.listCategories());
}

export async function create(req: Request, res: Response) {
  const { name } = categorySchema.parse(req.body);
  res.status(201).json(await categoryService.createCategory(name));
}

export async function update(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const { name } = categorySchema.parse(req.body);
  res.json(await categoryService.updateCategory(id, name));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  await categoryService.deleteCategory(id);
  res.status(204).end();
}
