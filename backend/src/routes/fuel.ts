import { fuelRecordSchema, fuelRequestSchema } from '@car-tracker/contracts';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

import type { CarDatabase } from '../database/index.js';
import { jsonResponse, limitJsonBodySize, postErrorResponses, requireJson, standardErrorResponses } from './openapi.js';

const listFuelRoute = createRoute({
  method: 'get',
  path: '/api/fuel',
  tags: ['Fuel'],
  summary: 'List fuel records',
  responses: {
    200: jsonResponse(z.array(fuelRecordSchema), 'Fuel records, newest first'),
    ...standardErrorResponses,
  },
});

const addFuelRoute = createRoute({
  method: 'post',
  path: '/api/fuel',
  tags: ['Fuel'],
  summary: 'Add a fuel record',
  middleware: [requireJson, limitJsonBodySize] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: fuelRequestSchema },
      },
    },
  },
  responses: {
    201: jsonResponse(fuelRecordSchema, 'The new fuel record'),
    ...postErrorResponses,
  },
});

export function registerFuelRoutes(app: OpenAPIHono, database: CarDatabase): void {
  app.openapi(listFuelRoute, (context) => context.json(database.listFuel(), 200));
  app.openapi(addFuelRoute, (context) => context.json(database.addFuel(context.req.valid('json')), 201));
}
