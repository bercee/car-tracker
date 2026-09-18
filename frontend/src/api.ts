import type {
  AdBlueRecord,
  AdBlueRequest,
  ErrorEnvelope,
  ExpenseRecord,
  ExpenseRequest,
  FuelRecord,
  FuelRequest,
} from './types';

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
export const getFuel = () => get<FuelRecord[]>('/api/fuel');
export const addFuel = (body: FuelRequest) => post<FuelRecord>('/api/fuel', body);
export const getAdBlue = () => get<AdBlueRecord[]>('/api/adblue');
export const addAdBlue = (body: AdBlueRequest) => post<AdBlueRecord>('/api/adblue', body);
export const getExpenses = () => get<ExpenseRecord[]>('/api/expenses');
export const addExpense = (body: ExpenseRequest) => post<ExpenseRecord>('/api/expenses', body);
