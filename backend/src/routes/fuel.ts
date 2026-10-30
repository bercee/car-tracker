import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { fuelRequestSchema } from '@car-tracker/contracts';
import { HttpError } from '../errors.js';
import { carIdOf } from './carScope.js';
import { recordParams } from './params.js';

export function createFuelRouter(database: CarDatabase): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (_request, response) => {
    response.status(200).json(await database.listFuel(carIdOf(response)));
  });

  router.post('/', async (request, response) => {
    const input = fuelRequestSchema.parse(request.body);
    response.status(201).json(await database.addFuel(carIdOf(response), input));
  });

  router.put('/:id', async (request, response) => {
    const { id } = recordParams.parse(request.params);
    const record = await database.updateFuel(carIdOf(response), id, fuelRequestSchema.parse(request.body));
    if (!record) throw new HttpError(404, 'NOT_FOUND', 'Fuel record not found', 'id');
    response.status(200).json(record);
  });
  router.delete('/:id', async (request, response) => {
    const { id } = recordParams.parse(request.params);
    if (!(await database.deleteFuel(carIdOf(response), id)))
      throw new HttpError(404, 'NOT_FOUND', 'Fuel record not found', 'id');
    response.status(204).send();
  });

  return router;
}
