import { z } from 'zod';

import {
  createdAtSchema,
  eventDateSchema,
  hufSchema,
  idSchema,
  odometerSchema,
  optionalTextSchema,
  scaledDecimalSchema,
} from '@car-tracker/contracts/validation';

export const fuelRequestSchema = z
  .strictObject({
    eventDate: eventDateSchema,
    odometerKm: odometerSchema,
    liters: scaledDecimalSchema(3),
    price: hufSchema,
    fullTank: z.boolean(),
    remark: optionalTextSchema(500),
  })
  .meta({ id: 'FuelRequest' });

export const fuelRecordSchema = fuelRequestSchema
  .omit({ remark: true })
  .extend({
    id: idSchema,
    createdAt: createdAtSchema,
    remark: z.string().max(500).nullable(),
  })
  .meta({ id: 'FuelRecord' });

export type FuelRequest = z.infer<typeof fuelRequestSchema>;
export type FuelRecord = z.infer<typeof fuelRecordSchema>;
