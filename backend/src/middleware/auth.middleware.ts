import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { RoleCode } from '@prisma/client';
import { env } from '../config/env.js';

type AccessTokenPayload = { sub: string; roles: RoleCode[]; type: 'access' };

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required' } });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (payload.type !== 'access' || !payload.sub) throw new Error('Invalid access token');
    request.auth = { userId: payload.sub, roles: payload.roles ?? [] };
    next();
  } catch {
    response.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'The access token is invalid or expired' } });
  }
}

export function requireRole(...allowedRoles: RoleCode[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.auth || !request.auth.roles.some(role => allowedRoles.includes(role))) {
      response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission for this resource' } });
      return;
    }
    next();
  };
}
