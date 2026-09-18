import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { validateFuelRequest } from '../validation/fuel.js';

export function createFuelRouter(database: CarDatabase): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(database.listFuel());
  });

  router.post('/', (request, response) => {
    const input = validateFuelRequest(request.body);
    response.status(201).json(database.addFuel(input));
  });

  return router;
}
