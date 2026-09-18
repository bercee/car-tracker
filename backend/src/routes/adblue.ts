import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { validateAdBlueRequest } from '../validation/adblue.js';

export function createAdBlueRouter(database: CarDatabase): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(database.listAdBlue());
  });

  router.post('/', (request, response) => {
    const input = validateAdBlueRequest(request.body);
    response.status(201).json(database.addAdBlue(input));
  });

  return router;
}
