import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { homeRouter } from './routes/home.routes.js';
import { sellerRouter } from './routes/seller.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { apartmentRouter } from './routes/apartment.routes.js';
import { sellerApplicationRouter } from './routes/seller-application.routes.js';
import { commerceRouter } from './routes/commerce.routes.js';
import { deliveryRouter } from './routes/delivery.routes.js';
import { advertisementRouter } from './routes/advertisement.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { customerRouter } from './routes/customer.routes.js';
import { sellerManagementRouter } from './routes/seller-management.routes.js';
import { adminMonitoringRouter } from './routes/admin-monitoring.routes.js';
import { exportRouter } from './routes/export.routes.js';
import { adminResourcesRouter } from './routes/admin-resources.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { openapi } from './openapi.js';
import path from 'node:path';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get('/', (_request, response) => {
  response.json({ name: 'Apartment Marketplace API', version: 'v1', status: 'running' });
});
app.get('/api/v1', (_request, response) => {
  response.json({ name: 'Apartment Marketplace API', version: 'v1', status: 'running' });
});
app.get('/api-docs', (_request, response) => response.json({ message: 'OpenAPI specification', specification: '/api-docs/openapi.json' }));
app.get('/api-docs/openapi.json', (_request, response) => response.json(openapi));

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/home', homeRouter);
app.use('/api/v1/sellers', sellerRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/apartments', apartmentRouter);
app.use('/api/v1/sellers', sellerApplicationRouter);
app.use('/api/v1', commerceRouter);
app.use('/api/v1/delivery', deliveryRouter);
app.use('/api/v1/advertisements', advertisementRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1', customerRouter);
app.use('/api/v1/seller', sellerManagementRouter);
app.use('/api/v1/admin', adminMonitoringRouter);
app.use('/api/v1/admin', adminResourcesRouter);
app.use('/api/v1/exports', exportRouter);
app.use('/api/v1/uploads', uploadRouter);
app.use('/api/v1/search', searchRouter);
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.use((_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.flatten() } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    response.status(error.code === 'P2025' ? 404 : 409).json({ error: { code: error.code, message: 'The requested database operation could not be completed' } });
    return;
  }
  response.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } });
};

app.use(errorHandler);
