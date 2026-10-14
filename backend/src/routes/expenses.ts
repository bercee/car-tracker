import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { validateExpenseRequest } from '../validation/expense.js';
import { parseRecordId } from '../validation/common.js';
import { HttpError } from '../errors.js';

export function createExpensesRouter(database: CarDatabase): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(database.listExpenses());
  });

  router.post('/', (request, response) => {
    const input = validateExpenseRequest(request.body);
    response.status(201).json(database.addExpense(input));
  });
  router.put('/:id', (request, response) => {
    const id = parseRecordId(request.params.id!);
    const record = database.updateExpense(id, validateExpenseRequest(request.body));
    if (!record) throw new HttpError(404, 'NOT_FOUND', 'Expenses record not found', 'id');
    response.status(200).json(record);
  });
  router.delete('/:id', (request, response) => {
    const id = parseRecordId(request.params.id!);
    if (!database.deleteExpense(id)) throw new HttpError(404, 'NOT_FOUND', 'Expenses record not found', 'id');
    response.status(204).send();
  });

  return router;
}
