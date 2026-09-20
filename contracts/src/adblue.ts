import { z } from 'zod';

import {
  createdAtSchema,
  eventDateSchema,
  hufSchema,
  idSchema,
  odometerSchema,
  scaledDecimalSchema,
} from '@car-tracker/contracts/validation';

export const adBlueRequestSchema = z
  .strictObject({
    eventDate: eventDateSchema,
    odometerKm: odometerSchema,
    liters: scaledDecimalSchema(3),
    price: hufSchema,
  })
  .meta({ id: 'AdBlueRequest' });

export const adBlueRecordSchema = adBlueRequestSchema
  .extend({
    id: idSchema,
    createdAt: createdAtSchema,
  })
  .meta({ id: 'AdBlueRecord' });

export type AdBlueRequest = z.infer<typeof adBlueRequestSchema>;
export type AdBlueRecord = z.infer<typeof adBlueRecordSchema>;
