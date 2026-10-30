import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { validateAdBlueRequest } from '../validation/adblue.js';
import { HttpError } from '../errors.js';
import { carIdOf } from './carScope.js';
import { recordParams } from './params.js';

export function createAdBlueRouter(database: CarDatabase): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (_request, response) => {
    response.status(200).json(await database.listAdBlue(carIdOf(response)));
  });

  router.post('/', async (request, response) => {
    const input = validateAdBlueRequest(request.body);
    response.status(201).json(await database.addAdBlue(carIdOf(response), input));
  });
  router.put('/:id', async (request, response) => {
    const { id } = recordParams.parse(request.params);
    const record = await database.updateAdBlue(carIdOf(response), id, validateAdBlueRequest(request.body));
    if (!record) throw new HttpError(404, 'NOT_FOUND', 'AdBlue record not found', 'id');
    response.status(200).json(record);
  });
  router.delete('/:id', async (request, response) => {
    const { id } = recordParams.parse(request.params);
    if (!(await database.deleteAdBlue(carIdOf(response), id)))
      throw new HttpError(404, 'NOT_FOUND', 'AdBlue record not found', 'id');
    response.status(204).send();
  });

  return router;
}
