import type { AdBlueInput, AdBlueRecord, ExpenseInput, ExpenseRecord, FuelInput, FuelRecord } from '../domain.js';

export interface DatabaseDiagnostics {
  journalMode: string;
  foreignKeys: boolean;
  busyTimeout: number;
}

export interface CarDatabase {
  addFuel(input: FuelInput): FuelRecord;
  listFuel(): FuelRecord[];
  addAdBlue(input: AdBlueInput): AdBlueRecord;
  listAdBlue(): AdBlueRecord[];
  addExpense(input: ExpenseInput): ExpenseRecord;
  listExpenses(): ExpenseRecord[];
  diagnostics(): DatabaseDiagnostics;
  close(): void;
}
