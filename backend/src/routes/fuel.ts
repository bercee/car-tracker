import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { validateFuelRequest } from '../validation/fuel.js';
import { parseRecordId } from '../validation/common.js';
import { HttpError } from '../errors.js';
import { carIdOf } from './carScope.js';

export function createFuelRouter(database: CarDatabase): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (_request, response) => {
    response.status(200).json(database.listFuel(carIdOf(response)));
  });

  router.post('/', (request, response) => {
    const input = validateFuelRequest(request.body);
    response.status(201).json(database.addFuel(carIdOf(response), input));
  });

  router.put('/:id', (request, response) => {
    const id = parseRecordId(request.params.id!);
    const record = database.updateFuel(carIdOf(response), id, validateFuelRequest(request.body));
    if (!record) throw new HttpError(404, 'NOT_FOUND', 'Fuel record not found', 'id');
    response.status(200).json(record);
  });
  router.delete('/:id', (request, response) => {
    const id = parseRecordId(request.params.id!);
    if (!database.deleteFuel(carIdOf(response), id))
      throw new HttpError(404, 'NOT_FOUND', 'Fuel record not found', 'id');
    response.status(204).send();
  });

  return router;
}
