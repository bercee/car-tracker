import { adBlueRecordSchema, adBlueRequestSchema } from '@car-tracker/contracts';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

import type { CarDatabase } from '../database/index.js';
import { jsonResponse, limitJsonBodySize, postErrorResponses, requireJson, standardErrorResponses } from './openapi.js';

const listAdBlueRoute = createRoute({
  method: 'get',
  path: '/api/adblue',
  tags: ['AdBlue'],
  summary: 'List AdBlue records',
  responses: {
    200: jsonResponse(z.array(adBlueRecordSchema), 'AdBlue records, newest first'),
    ...standardErrorResponses,
  },
});

const addAdBlueRoute = createRoute({
  method: 'post',
  path: '/api/adblue',
  tags: ['AdBlue'],
  summary: 'Add an AdBlue record',
  middleware: [requireJson, limitJsonBodySize] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: adBlueRequestSchema },
      },
    },
  },
  responses: {
    201: jsonResponse(adBlueRecordSchema, 'The new AdBlue record'),
    ...postErrorResponses,
  },
});

export function registerAdBlueRoutes(app: OpenAPIHono, database: CarDatabase): void {
  app.openapi(listAdBlueRoute, (context) => context.json(database.listAdBlue(), 200));
  app.openapi(addAdBlueRoute, (context) => context.json(database.addAdBlue(context.req.valid('json')), 201));
}
