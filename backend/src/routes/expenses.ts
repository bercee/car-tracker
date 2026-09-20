import { expenseRecordSchema, expenseRequestSchema } from '@car-tracker/contracts';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';

import type { CarDatabase } from '../database/index.js';
import { jsonResponse, limitJsonBodySize, postErrorResponses, requireJson, standardErrorResponses } from './openapi.js';

const listExpensesRoute = createRoute({
  method: 'get',
  path: '/api/expenses',
  tags: ['Expenses'],
  summary: 'List expense records',
  responses: {
    200: jsonResponse(z.array(expenseRecordSchema), 'Expense records, newest first'),
    ...standardErrorResponses,
  },
});

const addExpenseRoute = createRoute({
  method: 'post',
  path: '/api/expenses',
  tags: ['Expenses'],
  summary: 'Add an expense record',
  middleware: [requireJson, limitJsonBodySize] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: expenseRequestSchema },
      },
    },
  },
  responses: {
    201: jsonResponse(expenseRecordSchema, 'The new expense record'),
    ...postErrorResponses,
  },
});

export function registerExpenseRoutes(app: OpenAPIHono, database: CarDatabase): void {
  app.openapi(listExpensesRoute, (context) => context.json(database.listExpenses(), 200));
  app.openapi(addExpenseRoute, (context) => context.json(database.addExpense(context.req.valid('json')), 201));
}
