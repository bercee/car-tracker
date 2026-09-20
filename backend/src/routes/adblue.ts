import { Router } from 'express';

import type { CarDatabase } from '../database/index.js';

export function createAdBlueRouter(database: CarDatabase): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(database.listAdBlue());
  });

  router.post('/', (request, response) => {
    response.status(201).json(database.addAdBlue(request.body));
  });

  return router;
}
