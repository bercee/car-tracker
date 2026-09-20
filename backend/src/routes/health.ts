import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

import type { CarDatabase } from '../database/index.js';
import { jsonResponse } from './openapi.js';

const healthOkSchema = z.strictObject({ status: z.literal('ok') }).meta({ id: 'HealthOk' });
const healthUnavailableSchema = z.strictObject({ status: z.literal('unavailable') }).meta({ id: 'HealthUnavailable' });

const healthRoute = createRoute({
  method: 'get',
  path: '/api/health',
  tags: ['Health'],
  summary: 'Check database health',
  responses: {
    200: jsonResponse(healthOkSchema, 'The database is available'),
    503: jsonResponse(healthUnavailableSchema, 'The database is unavailable'),
  },
});

export function registerHealthRoute(app: OpenAPIHono, database: Pick<CarDatabase, 'checkHealth'>): void {
  app.openapi(healthRoute, (context) => {
    try {
      database.checkHealth();
      return context.json({ status: 'ok' as const }, 200);
    } catch {
      return context.json({ status: 'unavailable' as const }, 503);
    }
  });
}
