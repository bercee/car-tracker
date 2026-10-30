export type {
  AdBlueRecord,
  AdBlueRequest,
  Car,
  CarRequest,
  ExpenseRecord,
  ExpenseRequest,
  FuelRecord,
  FuelRequest,
} from '@car-tracker/contracts';

export interface FuelInput {
  eventDate: string;
  odometerKm: number;
  litersMilliliters: number;
  priceHuf: number;
  fullTank: boolean;
  remark: string | null;
}
