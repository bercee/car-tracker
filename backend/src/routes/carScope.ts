import type { RequestHandler, Response } from 'express';

import type { CarDatabase } from '../database/carDatabase.js';
import { HttpError } from '../errors.js';
import { carParams } from './params.js';

export function createCarScope(database: Pick<CarDatabase, 'getCar'>): RequestHandler<{ carId: string }> {
  return async (request, response, next) => {
    const { carId } = carParams.parse(request.params);
    if (!(await database.getCar(carId))) throw new HttpError(404, 'NOT_FOUND', 'Car not found', 'carId');
    response.locals.carId = carId;
    next();
  };
}

export function carIdOf(response: Response): number {
  return response.locals.carId as number;
}
