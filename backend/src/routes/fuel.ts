import { Router } from 'express';

import type { CarDatabase } from '../database/index.js';

export function createFuelRouter(database: CarDatabase): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(database.listFuel());
  });

  router.post('/', (request, response) => {
    response.status(201).json(database.addFuel(request.body));
  });

  return router;
}
