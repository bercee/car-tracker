import type { AdBlueInput, AdBlueRecord, ExpenseInput, ExpenseRecord, FuelInput, FuelRecord } from '../domain.js';

export interface CarDatabase {
  checkHealth(): void;
  addFuel(input: FuelInput): FuelRecord;
  listFuel(): FuelRecord[];
  addAdBlue(input: AdBlueInput): AdBlueRecord;
  listAdBlue(): AdBlueRecord[];
  addExpense(input: ExpenseInput): ExpenseRecord;
  listExpenses(): ExpenseRecord[];
  close(): void;
}
