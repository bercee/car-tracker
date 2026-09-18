import express, { type RequestHandler } from 'express';

import type { CarDatabase } from './database/carDatabase.js';
import { createErrorHandler, HttpError, toErrorEnvelope } from './errors.js';
import { createAdBlueRouter } from './routes/adblue.js';
import { createExpensesRouter } from './routes/expenses.js';
import { createFuelRouter } from './routes/fuel.js';
import { createHealthRouter } from './routes/health.js';

export function createApp(database: CarDatabase, logger: Pick<Console, 'error'> = console): express.Express {
  const app = express();
  app.disable('x-powered-by');

  const limitJsonBodySize = express.json({ limit: '16kb' });
  app.post(['/api/fuel', '/api/adblue', '/api/expenses'], requireJsonForPost, limitJsonBodySize);
  app.use('/api/health', createHealthRouter(database));
  app.use('/api/fuel', createFuelRouter(database));
  app.use('/api/adblue', createAdBlueRouter(database));
  app.use('/api/expenses', createExpensesRouter(database));

  app.use('/api', (_request, response) => {
    const error = new HttpError(404, 'NOT_FOUND', 'API endpoint not found');
    response.status(error.status).json(toErrorEnvelope(error));
  });

  app.use(createErrorHandler(logger));
  return app;
}

export const requireJsonForPost: RequestHandler = (request, _response, next) => {
  if (request.method === 'POST' && request.is('application/json') !== 'application/json') {
    next(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json'));
    return;
  }

  next();
};
