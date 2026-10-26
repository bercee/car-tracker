export type {
  AdBlueRecord,
  AdBlueRequest,
  Car,
  ExpenseRecord,
  ExpenseRequest,
  FuelRecord,
  FuelRequest,
} from '@car-tracker/contracts';

export interface CarInput {
  name: string;
}

export interface FuelInput {
  eventDate: string;
  odometerKm: number;
  litersMilliliters: number;
  priceHuf: number;
  fullTank: boolean;
  remark: string | null;
}

export interface AdBlueInput {
  eventDate: string;
  odometerKm: number;
  litersMilliliters: number;
  priceHuf: number;
}

export interface ExpenseInput {
  eventDate: string;
  amountHuf: number;
  notes: string | null;
}
