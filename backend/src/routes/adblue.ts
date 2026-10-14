import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { validateAdBlueRequest } from '../validation/adblue.js';
import { parseRecordId } from '../validation/common.js';
import { HttpError } from '../errors.js';

export function createAdBlueRouter(database: CarDatabase): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(database.listAdBlue());
  });

  router.post('/', (request, response) => {
    const input = validateAdBlueRequest(request.body);
    response.status(201).json(database.addAdBlue(input));
  });
  router.put('/:id', (request, response) => {
    const id = parseRecordId(request.params.id!);
    const record = database.updateAdBlue(id, validateAdBlueRequest(request.body));
    if (!record) throw new HttpError(404, 'NOT_FOUND', 'AdBlue record not found', 'id');
    response.status(200).json(record);
  });
  router.delete('/:id', (request, response) => {
    const id = parseRecordId(request.params.id!);
    if (!database.deleteAdBlue(id)) throw new HttpError(404, 'NOT_FOUND', 'AdBlue record not found', 'id');
    response.status(204).send();
  });

  return router;
}
