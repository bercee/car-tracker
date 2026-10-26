import type {
  AdBlueRecord,
  AdBlueRequest,
  Car,
  CarRequest,
  ErrorEnvelope,
  ExpenseRecord,
  ExpenseRequest,
  FuelRecord,
  FuelRequest,
} from '@car-tracker/contracts';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    });
    if (response.status === 204) return undefined as T;
    const body: unknown = await response.json().catch(() => {
      throw new ApiError('The server returned an invalid response.');
    });
    if (!response.ok) {
      const envelope = body as Partial<ErrorEnvelope>;
      throw new ApiError(envelope.error?.message ?? 'The request could not be completed.', envelope.error?.field);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Unable to reach the server. Please try again.');
  }
}
const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const remove = (path: string) => request<void>(path, { method: 'DELETE' });
export const getCars = () => get<Car[]>('/api/cars');
export const addCar = (body: CarRequest) => post<Car>('/api/cars', body);
export const renameCar = (id: number, body: CarRequest) => put<Car>(`/api/cars/${id}`, body);
export const getFuel = (carId: number) => get<FuelRecord[]>(`/api/cars/${carId}/fuel`);
export const addFuel = (carId: number, body: FuelRequest) => post<FuelRecord>(`/api/cars/${carId}/fuel`, body);
export const updateFuel = (carId: number, id: number, body: FuelRequest) =>
  put<FuelRecord>(`/api/cars/${carId}/fuel/${id}`, body);
export const deleteFuel = (carId: number, id: number) => remove(`/api/cars/${carId}/fuel/${id}`);
export const getAdBlue = (carId: number) => get<AdBlueRecord[]>(`/api/cars/${carId}/adblue`);
export const addAdBlue = (carId: number, body: AdBlueRequest) => post<AdBlueRecord>(`/api/cars/${carId}/adblue`, body);
export const updateAdBlue = (carId: number, id: number, body: AdBlueRequest) =>
  put<AdBlueRecord>(`/api/cars/${carId}/adblue/${id}`, body);
export const deleteAdBlue = (carId: number, id: number) => remove(`/api/cars/${carId}/adblue/${id}`);
export const getExpenses = (carId: number) => get<ExpenseRecord[]>(`/api/cars/${carId}/expenses`);
export const addExpense = (carId: number, body: ExpenseRequest) =>
  post<ExpenseRecord>(`/api/cars/${carId}/expenses`, body);
export const updateExpense = (carId: number, id: number, body: ExpenseRequest) =>
  put<ExpenseRecord>(`/api/cars/${carId}/expenses/${id}`, body);
export const deleteExpense = (carId: number, id: number) => remove(`/api/cars/${carId}/expenses/${id}`);
