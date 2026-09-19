import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getHomeData } from '../services/home.service.js';

export const homeRouter = Router();

homeRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    response.json(await getHomeData(request.auth!.userId));
  } catch (error) {
    next(error);
  }
});
