import { Router } from 'express';

import type { CarDatabase } from '../database/index.js';

export function createExpensesRouter(database: CarDatabase): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(database.listExpenses());
  });

  router.post('/', (request, response) => {
    response.status(201).json(database.addExpense(request.body));
  });

  return router;
}
