import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { validateExpenseRequest } from '../validation/expense.js';

export function createExpensesRouter(database: CarDatabase): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(database.listExpenses());
  });

  router.post('/', (request, response) => {
    const input = validateExpenseRequest(request.body);
    response.status(201).json(database.addExpense(input));
  });

  return router;
}
