import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import { loginSchema, registerSchema, updateMeSchema } from '../schemas/auth.schema';
import * as authService from '../services/auth.service';

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  res.status(201).json(await authService.register(input));
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  res.json(await authService.login(input));
}

export async function me(req: Request, res: Response) {
  res.json(await authService.getMe(currentUser(req).id));
}

export async function updateMe(req: Request, res: Response) {
  const input = updateMeSchema.parse(req.body);
  res.json(await authService.updateMe(currentUser(req).id, input));
}
