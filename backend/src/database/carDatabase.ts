import type {
  AdBlueInput,
  AdBlueRecord,
  Car,
  CarInput,
  ExpenseInput,
  ExpenseRecord,
  FuelInput,
  FuelRecord,
} from '../domain.js';

export interface CarDatabase {
  checkHealth(): void;
  listCars(): Car[];
  getCar(id: number): Car | undefined;
  addCar(input: CarInput): Car;
  renameCar(id: number, input: CarInput): Car | undefined;
  addFuel(carId: number, input: FuelInput): FuelRecord;
  updateFuel(carId: number, id: number, input: FuelInput): FuelRecord | undefined;
  deleteFuel(carId: number, id: number): boolean;
  listFuel(carId: number): FuelRecord[];
  addAdBlue(carId: number, input: AdBlueInput): AdBlueRecord;
  updateAdBlue(carId: number, id: number, input: AdBlueInput): AdBlueRecord | undefined;
  deleteAdBlue(carId: number, id: number): boolean;
  listAdBlue(carId: number): AdBlueRecord[];
  addExpense(carId: number, input: ExpenseInput): ExpenseRecord;
  updateExpense(carId: number, id: number, input: ExpenseInput): ExpenseRecord | undefined;
  deleteExpense(carId: number, id: number): boolean;
  listExpenses(carId: number): ExpenseRecord[];
  close(): void;
}
