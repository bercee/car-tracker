import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { validateFuelRequest } from '../validation/fuel.js';
import { parseRecordId } from '../validation/common.js';
import { HttpError } from '../errors.js';

export function createFuelRouter(database: CarDatabase): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(database.listFuel());
  });

  router.post('/', (request, response) => {
    const input = validateFuelRequest(request.body);
    response.status(201).json(database.addFuel(input));
  });

  router.put('/:id', (request, response) => {
    const id = parseRecordId(request.params.id!);
    const record = database.updateFuel(id, validateFuelRequest(request.body));
    if (!record) throw new HttpError(404, 'NOT_FOUND', 'Fuel record not found', 'id');
    response.status(200).json(record);
  });
  router.delete('/:id', (request, response) => {
    const id = parseRecordId(request.params.id!);
    if (!database.deleteFuel(id)) throw new HttpError(404, 'NOT_FOUND', 'Fuel record not found', 'id');
    response.status(204).send();
  });

  return router;
}
