import { Router } from 'express';

import { DatabaseUnavailableError } from '../errors.js';

export type HealthCheck = () => Promise<void>;

export function createHealthRouter(checkHealth: HealthCheck): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    try {
      await checkHealth();
      response.status(200).json({ status: 'ok' });
    } catch (error) {
      if (error instanceof DatabaseUnavailableError) {
        response.status(503).json({
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: error.message,
          },
        });
      } else {
        response.status(503).json({ status: 'unavailable' });
      }
    }
  });

  return router;
}
