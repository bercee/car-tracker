import type {
  AdBlueRecord,
  AdBlueRequest,
  Car,
  CarRequest,
  ExpenseRecord,
  ExpenseRequest,
  FuelInput,
  FuelRecord,
} from '../domain.js';

export interface CarDatabase {
  listCars(): Promise<Car[]>;
  getCar(id: number): Promise<Car | undefined>;
  addCar(input: CarRequest): Promise<Car>;
  renameCar(id: number, input: CarRequest): Promise<Car | undefined>;
  addFuel(carId: number, input: FuelInput): Promise<FuelRecord>;
  updateFuel(carId: number, id: number, input: FuelInput): Promise<FuelRecord | undefined>;
  deleteFuel(carId: number, id: number): Promise<boolean>;
  listFuel(carId: number): Promise<FuelRecord[]>;
  addAdBlue(carId: number, input: AdBlueRequest): Promise<AdBlueRecord>;
  updateAdBlue(carId: number, id: number, input: AdBlueRequest): Promise<AdBlueRecord | undefined>;
  deleteAdBlue(carId: number, id: number): Promise<boolean>;
  listAdBlue(carId: number): Promise<AdBlueRecord[]>;
  addExpense(carId: number, input: ExpenseRequest): Promise<ExpenseRecord>;
  updateExpense(carId: number, id: number, input: ExpenseRequest): Promise<ExpenseRecord | undefined>;
  deleteExpense(carId: number, id: number): Promise<boolean>;
  listExpenses(carId: number): Promise<ExpenseRecord[]>;
}
