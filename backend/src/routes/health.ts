import { Router } from 'express';

import type { CarDatabase } from '../database/index.js';

export function createHealthRouter(database: Pick<CarDatabase, 'checkHealth'>): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    try {
      database.checkHealth();
      response.status(200).json({ status: 'ok' });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });

  return router;
}
