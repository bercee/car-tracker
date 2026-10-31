import { pathIdSchema } from '@car-tracker/contracts';
import { z } from 'zod';

export const carParams = z.object({ carId: pathIdSchema });
export const recordParams = z.object({ id: pathIdSchema });
