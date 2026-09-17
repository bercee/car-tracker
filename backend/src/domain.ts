export interface FuelRequest {
  eventDate: string;
  odometerKm: number;
  liters: string;
  pricePerLiter: string;
  fullTank: boolean;
  remark?: string | null;
}

export interface AdBlueRequest {
  eventDate: string;
  odometerKm: number;
  liters: string;
  price: string;
}

export interface ExpenseRequest {
  eventDate: string;
  amount: string;
  notes?: string | null;
}

export interface FuelInput {
  eventDate: string;
  odometerKm: number;
  litersMilliliters: number;
  pricePerLiterHuf: number;
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

export interface FuelRecord extends FuelRequest {
  id: number;
  createdAt: string;
  remark: string | null;
}

export interface AdBlueRecord extends AdBlueRequest {
  id: number;
  createdAt: string;
}

export interface ExpenseRecord extends ExpenseRequest {
  id: number;
  createdAt: string;
  notes: string | null;
}
