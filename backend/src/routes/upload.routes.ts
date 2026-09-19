import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { saveImageDataUrl } from '../services/storage.service.js';

export const uploadRouter = Router();

uploadRouter.post('/image', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ dataUrl: z.string().min(30).max(2_000_000) }).parse(request.body);
    response.status(201).json(await saveImageDataUrl(input.dataUrl));
  } catch (error) {
    if (error instanceof Error && ['IMAGE_FORMAT_NOT_SUPPORTED', 'IMAGE_SIZE_INVALID'].includes(error.message)) {
      response.status(400).json({ error: { code: error.message, message: error.message === 'IMAGE_SIZE_INVALID' ? 'Image must be between 1 byte and 1.5 MB' : 'Only JPEG, PNG, and WebP images are supported' } });
      return;
    }
    next(error);
  }
});
