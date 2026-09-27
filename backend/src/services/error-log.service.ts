import { prisma } from '../lib/prisma.js';

type ErrorLogInput = {
  error?: unknown;
  source?: string;
  severity?: string;
  code?: string;
  message?: string;
  details?: unknown;
  request?: { id?: string; method?: string; originalUrl?: string; ip?: string; headers?: Record<string, unknown> };
  userId?: string | null;
  statusCode?: number;
};

function errorDetails(error: unknown) {
  if (error instanceof Error) return { name: error.name, stack: error.stack?.slice(0, 12000) };
  if (typeof error === 'string') return { raw: error.slice(0, 12000) };
  try { return JSON.parse(JSON.stringify(error)).slice?.(0, 12000) ?? JSON.parse(JSON.stringify(error)); } catch { return { raw: 'Unserializable error' }; }
}

export function recordErrorLog(input: ErrorLogInput) {
  const request = input.request;
  const headers = request?.headers || {};
  const details = input.details ?? errorDetails(input.error);
  void prisma.errorLog.create({ data: {
    userId: input.userId || undefined,
    requestId: request?.id,
    severity: input.severity || 'ERROR',
    source: input.source || 'API',
    code: input.code,
    message: (input.message || (input.error instanceof Error ? input.error.message : 'Unexpected application error')).slice(0, 20000),
    details: details as never,
    method: request?.method,
    route: request?.originalUrl,
    statusCode: input.statusCode,
    ipAddress: request?.ip,
    userAgent: typeof headers['user-agent'] === 'string' ? headers['user-agent'].slice(0, 1000) : undefined,
  } }).catch(logError => console.error('Unable to persist error log:', logError));
}
