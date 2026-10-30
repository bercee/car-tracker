import { Router } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { DuplicateCarNameError } from '../database/errors.js';
import { HttpError } from '../errors.js';
import { validateCarRequest } from '../validation/car.js';
import { parseCarId } from '../validation/common.js';

export function createCarsRouter(database: CarDatabase): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    response.status(200).json(await database.listCars());
  });

  router.post('/', async (request, response) => {
    const input = validateCarRequest(request.body);
    response.status(201).json(await withDuplicateNameConflict(() => database.addCar(input)));
  });

  router.put('/:carId', async (request, response) => {
    const id = parseCarId(request.params.carId);
    const input = validateCarRequest(request.body);
    const car = await withDuplicateNameConflict(() => database.renameCar(id, input));
    if (!car) throw new HttpError(404, 'NOT_FOUND', 'Car not found', 'carId');
    response.status(200).json(car);
  });

  return router;
}

async function withDuplicateNameConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DuplicateCarNameError) {
      throw new HttpError(409, 'CONFLICT', 'A car with this name already exists', 'name');
    }
    throw error;
  }
}
