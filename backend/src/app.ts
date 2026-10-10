import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';

import type { CarDatabase } from './database/index.js';
import { createErrorHandler, HttpError, toErrorEnvelope } from './errors.js';
import { registerAdBlueRoutes } from './routes/adblue.js';
import { registerExpenseRoutes } from './routes/expenses.js';
import { registerFuelRoutes } from './routes/fuel.js';
import { registerHealthRoute } from './routes/health.js';

export function createApp(database: CarDatabase, logger: Pick<Console, 'error'> = console): OpenAPIHono {
  const app = new OpenAPIHono({
    strict: false,
    defaultHook: (result) => {
      if (!result.success) {
        throw result.error;
      }
    },
  });

  registerHealthRoute(app, database);
  registerFuelRoutes(app, database);
  registerAdBlueRoutes(app, database);
  registerExpenseRoutes(app, database);

  app.doc31('/api/doc', {
    openapi: '3.1.0',
    info: {
      title: 'Car Tracker API',
      version: '0.1.0',
    },
  });
  app.get('/api/ui', swaggerUI({ url: '/api/doc' }));

  const apiNotFound = new HttpError(404, 'NOT_FOUND', 'API endpoint not found');
  app.all('/api', (context) => context.json(toErrorEnvelope(apiNotFound), 404));
  app.all('/api/*', (context) => context.json(toErrorEnvelope(apiNotFound), 404));
  app.onError(createErrorHandler(logger));

  return app;
}
