import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import { idParam } from '../schemas/common';
import { createProductSchema, listProductsQuery, updateProductSchema } from '../schemas/product.schema';
import { createBorrowRequestSchema } from '../schemas/borrow-request.schema';
import * as productService from '../services/product.service';
import * as borrowService from '../services/borrow-request.service';

export async function list(req: Request, res: Response) {
  const query = listProductsQuery.parse(req.query);
  res.json(await productService.listProducts(query));
}

export async function mine(req: Request, res: Response) {
  res.json(await productService.listMyProducts(currentUser(req).id));
}

export async function getOne(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  res.json(await productService.getProduct(id));
}

export async function create(req: Request, res: Response) {
  const input = createProductSchema.parse(req.body);
  res.status(201).json(await productService.createProduct(currentUser(req).id, input));
}

export async function update(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = updateProductSchema.parse(req.body);
  res.json(await productService.updateProduct(id, currentUser(req).id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  await productService.deleteProduct(id, currentUser(req));
  res.status(204).end();
}

export async function requestBorrow(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = createBorrowRequestSchema.parse(req.body);
  res.status(201).json(await borrowService.createBorrowRequest(id, currentUser(req).id, input));
}
