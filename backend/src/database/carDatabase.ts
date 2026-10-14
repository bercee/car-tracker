import type { AdBlueInput, AdBlueRecord, ExpenseInput, ExpenseRecord, FuelInput, FuelRecord } from '../domain.js';

export interface CarDatabase {
  checkHealth(): void;
  addFuel(input: FuelInput): FuelRecord;
  updateFuel(id: number, input: FuelInput): FuelRecord | undefined;
  deleteFuel(id: number): boolean;
  listFuel(): FuelRecord[];
  addAdBlue(input: AdBlueInput): AdBlueRecord;
  updateAdBlue(id: number, input: AdBlueInput): AdBlueRecord | undefined;
  deleteAdBlue(id: number): boolean;
  listAdBlue(): AdBlueRecord[];
  addExpense(input: ExpenseInput): ExpenseRecord;
  updateExpense(id: number, input: ExpenseInput): ExpenseRecord | undefined;
  deleteExpense(id: number): boolean;
  listExpenses(): ExpenseRecord[];
  close(): void;
}
