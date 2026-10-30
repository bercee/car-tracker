import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { validateExpenseRequest } from '../validation/expense.js';
import { parseRecordId } from '../validation/common.js';
import { HttpError } from '../errors.js';
import { carIdOf } from './carScope.js';

export function createExpensesRouter(database: CarDatabase): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (_request, response) => {
    response.status(200).json(await database.listExpenses(carIdOf(response)));
  });

  router.post('/', async (request, response) => {
    const input = validateExpenseRequest(request.body);
    response.status(201).json(await database.addExpense(carIdOf(response), input));
  });
  router.put('/:id', async (request, response) => {
    const id = parseRecordId(request.params.id!);
    const record = await database.updateExpense(carIdOf(response), id, validateExpenseRequest(request.body));
    if (!record) throw new HttpError(404, 'NOT_FOUND', 'Expenses record not found', 'id');
    response.status(200).json(record);
  });
  router.delete('/:id', async (request, response) => {
    const id = parseRecordId(request.params.id!);
    if (!(await database.deleteExpense(carIdOf(response), id)))
      throw new HttpError(404, 'NOT_FOUND', 'Expenses record not found', 'id');
    response.status(204).send();
  });

  return router;
}
