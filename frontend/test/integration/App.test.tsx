import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      message: string,
      readonly field?: string,
      readonly kind: 'network' | 'not-found' | 'rejected' = 'rejected',
    ) {
      super(message);
    }
  }

  return {
    ApiError,
    getCars: vi.fn(),
    addCar: vi.fn(),
    renameCar: vi.fn(),
    getFuel: vi.fn(),
    addFuel: vi.fn(),
    updateFuel: vi.fn(),
    deleteFuel: vi.fn(),
    getAdBlue: vi.fn(),
    addAdBlue: vi.fn(),
    updateAdBlue: vi.fn(),
    deleteAdBlue: vi.fn(),
    getExpenses: vi.fn(),
    addExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
  };
});
vi.mock('../../src/api', () => api);
import { App } from '../../src/App';

const cars = [
  { id: 1, name: 'Golf', createdAt: '' },
  { id: 2, name: 'Polo', createdAt: '' },
];
const fuelRow = (id: number, remark: string) => ({
  id,
  eventDate: '2026-09-18',
  odometerKm: 10 * id,
  liters: '1.000',
  price: '619',
  fullTank: true,
  remark,
});
const panel = (name: string) => within(screen.getByRole('region', { name }));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const defaults = () => {
  api.getCars.mockResolvedValue(cars);
  api.getFuel.mockResolvedValue([]);
  api.getAdBlue.mockResolvedValue([]);
  api.getExpenses.mockResolvedValue([]);
  api.addFuel.mockResolvedValue({});
  api.updateFuel.mockResolvedValue({});
  api.deleteFuel.mockResolvedValue(undefined);
  api.addAdBlue.mockResolvedValue({});
  api.updateAdBlue.mockResolvedValue({});
  api.deleteAdBlue.mockResolvedValue(undefined);
  api.addExpense.mockResolvedValue({});
  api.updateExpense.mockResolvedValue({});
  api.deleteExpense.mockResolvedValue(undefined);
};

describe('App', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('defaults to Fuel and provides accessible tabs', async () => {
    defaults();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Car Tracker' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Fuel' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('No records yet.');
    expect(screen.getByLabelText('Full tank')).toBeChecked();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New name')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AdBlue' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Expenses' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Cars' }));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('New name')).toHaveValue('Golf');
    await user.click(screen.getByRole('tab', { name: 'Fuel' }));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).not.toBeVisible();
  });
  it('loads each panel when activated and displays records', async () => {
    defaults();
    api.getFuel.mockResolvedValue([
      {
        id: 1,
        eventDate: '2026-09-18',
        odometerKm: 1,
        liters: '1.000',
        price: '619',
        fullTank: true,
        remark: null,
      },
      {
        id: 2,
        eventDate: '2026-09-17',
        odometerKm: 2,
        liters: '2.000',
        price: '620',
        fullTank: false,
        remark: 'Station',
      },
    ]);
    api.getAdBlue.mockResolvedValue([{ id: 1, eventDate: '2026-09-18', odometerKm: 2, liters: '2.000', price: '500' }]);
    api.getExpenses.mockResolvedValue([
      { id: 1, eventDate: '2026-09-18', amount: '1000', notes: 'Service' },
      { id: 2, eventDate: '2026-09-17', amount: '500', notes: null },
    ]);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Yes');
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'AdBlue' }));
    await screen.findAllByText('2.000 L');
    await user.click(screen.getByRole('tab', { name: 'Expenses' }));
    await screen.findByText('Service');
    expect(screen.getAllByText('—')).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: 'Fuel' }));
    expect(api.getFuel).toHaveBeenCalledTimes(1);
  });
  it('blocks invalid fuel input', async () => {
    defaults();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.type(screen.getByLabelText('Liters'), '1.9999');
    await user.type(screen.getByLabelText('Total price (HUF)'), '619');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    expect((await screen.findAllByRole('alert')).at(-1)).toHaveTextContent('up to three decimal');
    expect(api.addFuel).not.toHaveBeenCalled();
  });

  it('validates whole-HUF prices and amounts for every panel', async () => {
    defaults();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');

    await user.type(screen.getByLabelText('Liters'), '1');
    await user.type(screen.getByLabelText('Total price (HUF)'), '619.5');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    expect((await screen.findAllByRole('alert')).at(-1)).toHaveTextContent('whole HUF amount');

    await user.click(screen.getByRole('tab', { name: 'AdBlue' }));
    await screen.findAllByLabelText('Total price (HUF)');
    await user.type(screen.getAllByLabelText('Liters').at(-1)!, '1');
    await user.type(screen.getAllByLabelText('Total price (HUF)').at(-1)!, '500.5');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    expect((await screen.findAllByRole('alert')).at(-1)).toHaveTextContent('whole HUF amount');

    await user.click(screen.getByRole('tab', { name: 'Expenses' }));
    await screen.findByLabelText('Amount (HUF)');
    await user.type(screen.getByLabelText('Amount (HUF)'), '100.5');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    expect((await screen.findAllByRole('alert')).at(-1)).toHaveTextContent('whole HUF amount');
  });
  it('submits fuel and refreshes', async () => {
    defaults();
    let resolve: (() => void) | undefined;
    api.addFuel.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.type(screen.getByLabelText('Liters'), '47.300');
    await user.type(screen.getByLabelText('Total price (HUF)'), '29284');
    await user.click(screen.getByLabelText('Full tank'));
    await user.type(screen.getByLabelText('Remark'), 'Shell');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(api.addFuel).toHaveBeenCalledWith(1, expect.objectContaining({ liters: '47.300', price: '29284' }));
    resolve?.();
    await waitFor(() => expect(panel('Fuel').getByRole('status')).toHaveTextContent('Fuel record saved.'));
    expect(screen.getByLabelText('Liters')).toHaveValue('');
  });
  it('preserves input after a save failure', async () => {
    defaults();
    api.addExpense.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.click(screen.getByRole('tab', { name: 'Expenses' }));
    await screen.findByLabelText('Amount (HUF)');
    await user.type(screen.getByLabelText('Amount (HUF)'), '1000');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    expect((await screen.findAllByRole('alert')).at(-1)).toHaveTextContent('Unable to save');
    expect(screen.getByLabelText('Amount (HUF)')).toHaveValue('1000');
  });

  it('shows API failures and load fallbacks', async () => {
    defaults();
    api.getFuel.mockRejectedValue('offline');
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('Could not load records.')).toBeInTheDocument();

    api.addExpense.mockRejectedValue(new api.ApiError('Amount was rejected.'));
    await user.click(screen.getByRole('tab', { name: 'Expenses' }));
    await screen.findByLabelText('Amount (HUF)');
    await user.type(screen.getByLabelText('Amount (HUF)'), '1000');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    expect((await screen.findAllByRole('alert')).at(-1)).toHaveTextContent('Amount was rejected.');
  });
  it('submits AdBlue and Expenses values', async () => {
    defaults();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.click(screen.getByRole('tab', { name: 'AdBlue' }));
    await screen.findAllByLabelText('Total price (HUF)');
    await user.type(screen.getAllByLabelText('Liters').at(-1)!, '2.5');
    await user.type(screen.getAllByLabelText('Total price (HUF)').at(-1)!, '500');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(api.addAdBlue).toHaveBeenCalled());
    await user.click(screen.getByRole('tab', { name: 'Expenses' }));
    await screen.findByLabelText('Notes');
    await user.type(screen.getByLabelText('Amount (HUF)'), '1000');
    await user.type(screen.getByLabelText('Notes'), 'Service');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(api.addExpense).toHaveBeenCalled());
  });

  it('loads a fuel row into the shared form, updates it, and deletes it without confirmation', async () => {
    defaults();
    api.getFuel.mockResolvedValue([
      {
        id: 8,
        eventDate: '2026-09-18',
        odometerKm: 123,
        liters: '12.300',
        price: '4567',
        fullTank: false,
        remark: 'Station',
      },
    ]);
    const confirm = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: 'Edit Fuel record 8' });
    await user.click(screen.getByRole('button', { name: 'Edit Fuel record 8' }));
    expect(panel('Fuel').getByRole('group')).toHaveTextContent('Edit fuel record');
    expect(screen.getByLabelText('Odometer (km)')).toHaveValue(123);
    expect(screen.getByLabelText('Liters')).toHaveValue('12.300');
    expect(screen.getByLabelText('Total price (HUF)')).toHaveValue('4567');
    expect(screen.getByLabelText('Full tank')).not.toBeChecked();
    expect(screen.getByLabelText('Remark')).toHaveValue('Station');
    await user.clear(screen.getByLabelText('Remark'));
    await user.type(screen.getByLabelText('Remark'), 'Updated');
    await user.click(screen.getByRole('button', { name: 'Update record' }));
    await waitFor(() =>
      expect(api.updateFuel).toHaveBeenCalledWith(1, 8, expect.objectContaining({ remark: 'Updated' })),
    );
    expect(await panel('Fuel').findByRole('status')).toHaveTextContent('Fuel record updated.');
    expect(screen.getByRole('button', { name: 'Save record' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Fuel record 8' }));
    await user.click(screen.getByRole('button', { name: 'Delete Fuel record 8' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(api.deleteFuel).toHaveBeenCalledWith(1, 8);
    expect(await panel('Fuel').findByRole('status')).toHaveTextContent('Fuel record deleted.');
  });

  it('cancels an edit without calling the API', async () => {
    defaults();
    api.getExpenses.mockResolvedValue([{ id: 3, eventDate: '2026-09-18', amount: '1000', notes: null }]);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('tab', { name: 'Expenses' }));
    await screen.findByRole('button', { name: 'Edit Expenses record 3' });
    await user.click(screen.getByRole('button', { name: 'Edit Expenses record 3' }));
    expect(screen.getByLabelText('Notes')).toHaveValue('');
    await user.type(screen.getByLabelText('Notes'), 'draft');
    await user.click(screen.getByRole('button', { name: 'Cancel edit' }));
    expect(screen.getByRole('button', { name: 'Save record' })).toBeInTheDocument();
    expect(api.updateExpense).not.toHaveBeenCalled();
  });

  it('maps AdBlue and expense records into their existing edit forms', async () => {
    defaults();
    api.getAdBlue.mockResolvedValue([
      { id: 2, eventDate: '2026-09-17', odometerKm: 456, liters: '3.400', price: '789', createdAt: '' },
    ]);
    api.getExpenses.mockResolvedValue([{ id: 4, eventDate: '2026-09-16', amount: '1200', notes: null, createdAt: '' }]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('tab', { name: 'AdBlue' }));
    await user.click(await screen.findByRole('button', { name: 'Edit AdBlue record 2' }));
    expect(screen.getAllByLabelText('Date').at(-1)).toHaveValue('2026-09-17');
    expect(screen.getAllByLabelText('Odometer (km)').at(-1)).toHaveValue(456);
    expect(screen.getAllByLabelText('Liters').at(-1)).toHaveValue('3.400');
    expect(screen.getAllByLabelText('Total price (HUF)').at(-1)).toHaveValue('789');
    await user.click(screen.getByRole('button', { name: 'Update record' }));
    await waitFor(() =>
      expect(api.updateAdBlue).toHaveBeenCalledWith(1, 2, expect.objectContaining({ liters: '3.400' })),
    );

    await user.click(screen.getByRole('tab', { name: 'Expenses' }));
    await user.click(await screen.findByRole('button', { name: 'Edit Expenses record 4' }));
    expect(screen.getByLabelText('Notes')).toHaveValue('');
    expect(screen.getByLabelText('Amount (HUF)')).toHaveValue('1200');
    api.updateExpense.mockRejectedValueOnce(new api.ApiError('Update rejected.'));
    await user.click(screen.getByRole('button', { name: 'Update record' }));
    expect(await panel('Expenses').findByRole('alert')).toHaveTextContent('Update rejected.');
    expect(screen.getByRole('button', { name: 'Update record' })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (HUF)')).toHaveValue('1200');
  });
  it('lists cars in a labelled selector and loads the first car by default', async () => {
    defaults();
    render(<App />);
    const select = await screen.findByLabelText('Car');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Golf', 'Polo']);
    expect(select).toHaveValue('1');
    await screen.findByText('No records yet.');
    expect(api.getFuel).toHaveBeenCalledWith(1);
  });
  it('restores the stored car and persists a new selection', async () => {
    defaults();
    window.localStorage.setItem('car-tracker.activeCarId', '2');
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByLabelText('Car')).toHaveValue('2');
    await waitFor(() => expect(api.getFuel).toHaveBeenCalledWith(2));
    await user.selectOptions(screen.getByLabelText('Car'), 'Golf');
    expect(window.localStorage.getItem('car-tracker.activeCarId')).toBe('1');
  });
  it('loads the other car records on switch and keeps the selected tab', async () => {
    defaults();
    api.getFuel.mockImplementation((id: number) => Promise.resolve([fuelRow(id, `Remark ${id}`)]));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Remark 1');
    await user.selectOptions(screen.getByLabelText('Car'), 'Polo');
    await screen.findByText('Remark 2');
    expect(screen.queryByText('Remark 1')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Fuel' })).toHaveAttribute('aria-selected', 'true');
    expect(api.getFuel).toHaveBeenCalledTimes(2);
  });
  it('keeps the tab and scopes visited panels and mutations to the active car', async () => {
    defaults();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.click(screen.getByRole('tab', { name: 'Expenses' }));
    await screen.findByLabelText('Amount (HUF)');
    await user.selectOptions(screen.getByLabelText('Car'), 'Polo');
    await waitFor(() => expect(api.getExpenses).toHaveBeenCalledWith(2));
    expect(screen.getByRole('tab', { name: 'Expenses' })).toHaveAttribute('aria-selected', 'true');
    await user.type(screen.getByLabelText('Amount (HUF)'), '1000');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(api.addExpense).toHaveBeenCalledWith(2, expect.objectContaining({ amount: '1000' })));
  });
  it('resets half-filled forms and edits in progress when the car changes', async () => {
    defaults();
    api.getFuel.mockImplementation((id: number) => Promise.resolve([fuelRow(id, `Remark ${id}`)]));
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Liters'), '12');
    await user.selectOptions(screen.getByLabelText('Car'), 'Polo');
    await screen.findByText('Remark 2');
    expect(screen.getByLabelText('Liters')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Edit Fuel record 2' }));
    expect(panel('Fuel').getByRole('group')).toHaveTextContent('Edit fuel record');
    await user.selectOptions(screen.getByLabelText('Car'), 'Golf');
    await screen.findByText('Remark 1');
    expect(panel('Fuel').getByRole('group')).toHaveTextContent('Add fuel record');
    expect(screen.getByLabelText('Remark')).toHaveValue('');
  });
  // Covers the key-remount / effect-cancel path; it cannot detect removal of Panel's isMounted guard.
  it('ignores a slow list response from the previous car', async () => {
    defaults();
    const slowA = deferred<ReturnType<typeof fuelRow>[]>();
    api.getFuel.mockImplementation((id: number) =>
      id === 1 ? slowA.promise : Promise.resolve([fuelRow(2, 'Remark B')]),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText('Car');
    await user.selectOptions(screen.getByLabelText('Car'), 'Polo');
    await screen.findByText('Remark B');
    slowA.resolve([fuelRow(1, 'Remark A')]);
    await act(async () => {
      await slowA.promise;
    });
    expect(screen.queryByText('Remark A')).not.toBeInTheDocument();
    expect(screen.getByText('Remark B')).toBeInTheDocument();
  });
  it('does not show the result of a save started on the previous car', async () => {
    defaults();
    const pendingSave = deferred<unknown>();
    api.addFuel.mockReturnValue(pendingSave.promise);
    api.getFuel.mockImplementation((id: number) => Promise.resolve(id === 1 ? [fuelRow(1, 'Remark A')] : []));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Remark A');
    await user.type(screen.getByLabelText('Liters'), '5');
    await user.type(screen.getByLabelText('Total price (HUF)'), '100');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(api.addFuel).toHaveBeenCalledWith(1, expect.anything()));
    await user.selectOptions(screen.getByLabelText('Car'), 'Polo');
    await screen.findByText('No records yet.');
    const fuelCalls = api.getFuel.mock.calls.length;
    await act(async () => {
      pendingSave.resolve({});
      await pendingSave.promise;
    });
    expect(screen.queryByText('Fuel record saved.')).not.toBeInTheDocument();
    expect(screen.queryByText('Remark A')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save record' })).toBeEnabled();
    expect(api.getFuel).toHaveBeenCalledTimes(fuelCalls);
  });
  it('does not refetch or show the result of a delete started on the previous car', async () => {
    defaults();
    const pendingDelete = deferred<undefined>();
    api.deleteFuel.mockReturnValue(pendingDelete.promise);
    api.getFuel.mockImplementation((id: number) => Promise.resolve(id === 1 ? [fuelRow(1, 'Remark A')] : []));
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Delete Fuel record 1' }));
    await waitFor(() => expect(api.deleteFuel).toHaveBeenCalledWith(1, 1));
    await user.selectOptions(screen.getByLabelText('Car'), 'Polo');
    await screen.findByText('No records yet.');
    const fuelCalls = api.getFuel.mock.calls.length;
    await act(async () => {
      pendingDelete.resolve(undefined);
      await pendingDelete.promise;
    });
    expect(screen.queryByText('Fuel record deleted.')).not.toBeInTheDocument();
    expect(screen.queryByText('Remark A')).not.toBeInTheDocument();
    expect(api.getFuel).toHaveBeenCalledTimes(fuelCalls);
  });
  it('keeps working with the first car when localStorage throws', async () => {
    defaults();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByLabelText('Car')).toHaveValue('1');
    await user.selectOptions(screen.getByLabelText('Car'), 'Polo');
    await waitFor(() => expect(api.getFuel).toHaveBeenCalledWith(2));
  });
  it('shows an empty state when there are no cars', async () => {
    defaults();
    api.getCars.mockResolvedValue([]);
    render(<App />);
    expect(await screen.findByText('No cars yet. Add a car to start tracking.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Cars' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Fuel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'AdBlue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Expenses' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Car')).not.toBeInTheDocument();
    expect(api.getFuel).not.toHaveBeenCalled();
  });
  it('adds the first car from the empty state and makes it active', async () => {
    defaults();
    api.getCars.mockResolvedValue([]);
    api.addCar.mockResolvedValue({ id: 5, name: 'Octavia', createdAt: '' });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No cars yet. Add a car to start tracking.');
    expect(screen.getByRole('tab', { name: 'Cars' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Rename car' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), '  Octavia ');
    await user.click(screen.getByRole('button', { name: 'Add car' }));
    expect(api.addCar).toHaveBeenCalledWith({ name: 'Octavia' });
    expect(await screen.findByRole('tab', { name: 'Fuel' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Cars' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Car')).toHaveValue('5');
    expect(api.getFuel).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('car-tracker.activeCarId')).toBe('5');
    expect(screen.queryByText('No cars yet. Add a car to start tracking.')).not.toBeInTheDocument();
  });
  it('switches to a newly added car and keeps the list sorted', async () => {
    defaults();
    api.addCar.mockResolvedValue({ id: 3, name: 'astra', createdAt: '' });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.click(screen.getByRole('tab', { name: 'Cars' }));
    await user.type(screen.getByLabelText('Name'), 'astra');
    await user.click(screen.getByRole('button', { name: 'Add car' }));
    expect(await screen.findByText('Car added.')).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['astra', 'Golf', 'Polo']);
    expect(screen.getByLabelText('Car')).toHaveValue('3');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    await waitFor(() => expect(api.getFuel).toHaveBeenCalledWith(3));
    expect(window.localStorage.getItem('car-tracker.activeCarId')).toBe('3');
  });
  it('shows the server error for a duplicate car name and leaves the list unchanged', async () => {
    defaults();
    api.addCar.mockRejectedValue(new api.ApiError('A car with this name already exists.'));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.click(screen.getByRole('tab', { name: 'Cars' }));
    await user.type(screen.getByLabelText('Name'), 'Golf');
    await user.click(screen.getByRole('button', { name: 'Add car' }));
    expect(await screen.findByText('A car with this name already exists.')).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Golf', 'Polo']);
    expect(screen.getByLabelText('Car')).toHaveValue('1');
    expect(screen.getByLabelText('Name')).toHaveValue('Golf');
  });
  it('rejects a whitespace-only car name without a request', async () => {
    defaults();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.click(screen.getByRole('tab', { name: 'Cars' }));
    await user.type(screen.getByLabelText('Name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Add car' }));
    expect(await screen.findByText('Enter a car name.')).toBeInTheDocument();
    expect(api.addCar).not.toHaveBeenCalled();
  });
  it('renames the active car without reloading its records', async () => {
    defaults();
    api.renameCar.mockResolvedValue({ id: 1, name: 'Beetle', createdAt: '' });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.click(screen.getByRole('tab', { name: 'Cars' }));
    expect(screen.getByLabelText('New name')).toHaveValue('Golf');
    await user.type(screen.getByLabelText('Liters'), '12');
    await user.clear(screen.getByLabelText('New name'));
    await user.type(screen.getByLabelText('New name'), 'Beetle');
    await user.click(screen.getByRole('button', { name: 'Rename car' }));
    expect(api.renameCar).toHaveBeenCalledWith(1, { name: 'Beetle' });
    expect(await screen.findByText('Car renamed.')).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Beetle', 'Polo']);
    expect(screen.getByLabelText('Car')).toHaveValue('1');
    expect(screen.getByLabelText('Liters')).toHaveValue('12');
    expect(api.getFuel).toHaveBeenCalledTimes(1);
  });
  it('shows the server error when renaming to a duplicate name', async () => {
    defaults();
    api.renameCar.mockRejectedValue(new api.ApiError('A car with this name already exists.'));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.click(screen.getByRole('tab', { name: 'Cars' }));
    await user.clear(screen.getByLabelText('New name'));
    await user.type(screen.getByLabelText('New name'), 'Polo');
    await user.click(screen.getByRole('button', { name: 'Rename car' }));
    expect(await screen.findByText('A car with this name already exists.')).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Golf', 'Polo']);
  });
  it('prefills the rename form with the car selected after a switch', async () => {
    defaults();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No records yet.');
    await user.click(screen.getByRole('tab', { name: 'Cars' }));
    await user.type(screen.getByLabelText('New name'), 'x');
    await user.selectOptions(screen.getByLabelText('Car'), 'Polo');
    expect(screen.getByLabelText('New name')).toHaveValue('Polo');
  });
  it('shows loading and error states for the car list', async () => {
    defaults();
    api.getCars.mockRejectedValue(new api.ApiError('Cars are down.'));
    render(<App />);
    expect(screen.getByText('Loading cars…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cars are down.');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
  describe('undo and redo of edits', () => {
    const undoName = 'Undo edit of Fuel record from 2026-09-18';
    const redoName = 'Redo edit of Fuel record from 2026-09-18';
    const editRemark = async (user: ReturnType<typeof userEvent.setup>, id: number, remark: string) => {
      await user.click(await screen.findByRole('button', { name: `Edit Fuel record ${id}` }));
      await user.clear(screen.getByLabelText('Remark'));
      await user.type(screen.getByLabelText('Remark'), remark);
      await user.click(screen.getByRole('button', { name: 'Update record' }));
      await panel('Fuel').findByText('Fuel record updated.');
    };

    it('undoes and redoes an edit with the original and edited values', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 8, 'Edited');
      const fuelCalls = api.getFuel.mock.calls.length;

      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      await waitFor(() =>
        expect(api.updateFuel).toHaveBeenLastCalledWith(
          1,
          8,
          expect.objectContaining({ remark: 'Original', odometerKm: 80, liters: '1.000', price: '619' }),
        ),
      );
      expect(await panel('Fuel').findByRole('status')).toHaveTextContent('Undid edit of Fuel record.');
      await waitFor(() => expect(api.getFuel.mock.calls.length).toBeGreaterThan(fuelCalls));

      await user.click(panel('Fuel').getByRole('button', { name: redoName }));
      await waitFor(() =>
        expect(api.updateFuel).toHaveBeenLastCalledWith(1, 8, expect.objectContaining({ remark: 'Edited' })),
      );
      expect(await panel('Fuel').findByRole('status')).toHaveTextContent('Redid edit of Fuel record.');
    });

    it('disables the controls with nothing to undo or redo and while a save is pending', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      const user = userEvent.setup();
      render(<App />);
      await screen.findByRole('button', { name: 'Edit Fuel record 8' });
      expect(panel('Fuel').getByRole('button', { name: 'Undo' })).toBeDisabled();
      expect(panel('Fuel').getByRole('button', { name: 'Redo' })).toBeDisabled();

      await editRemark(user, 8, 'Edited');
      expect(panel('Fuel').getByRole('button', { name: undoName })).toBeEnabled();
      expect(panel('Fuel').getByRole('button', { name: 'Redo' })).toBeDisabled();

      const pendingSave = deferred<unknown>();
      api.updateFuel.mockReturnValue(pendingSave.promise);
      await user.click(screen.getByRole('button', { name: 'Edit Fuel record 8' }));
      await user.click(screen.getByRole('button', { name: 'Update record' }));
      expect(panel('Fuel').getByRole('button', { name: undoName })).toBeDisabled();
      await act(async () => {
        pendingSave.resolve({});
        await pendingSave.promise;
      });
      await waitFor(() => expect(panel('Fuel').getByRole('button', { name: undoName })).toBeEnabled());
    });

    it('describes the next action with the record type and event date', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 8, 'Edited');
      expect(panel('Fuel').getByRole('button', { name: undoName })).toBeInTheDocument();
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      expect(await panel('Fuel').findByRole('button', { name: redoName })).toBeInTheDocument();
    });

    it('keeps the history across car and section switches', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 8, 'Edited');

      await user.selectOptions(screen.getByLabelText('Car'), 'Polo');
      await waitFor(() => expect(api.getFuel).toHaveBeenCalledWith(2));
      expect(await panel('Fuel').findByRole('button', { name: 'Undo' })).toBeDisabled();
      await user.selectOptions(screen.getByLabelText('Car'), 'Golf');
      await user.click(await panel('Fuel').findByRole('button', { name: undoName }));
      await waitFor(() =>
        expect(api.updateFuel).toHaveBeenLastCalledWith(1, 8, expect.objectContaining({ remark: 'Original' })),
      );
      await panel('Fuel').findByText('Undid edit of Fuel record.');

      await user.click(screen.getByRole('tab', { name: 'Cars' }));
      await user.click(screen.getByRole('tab', { name: 'Fuel' }));
      await user.click(panel('Fuel').getByRole('button', { name: redoName }));
      await waitFor(() =>
        expect(api.updateFuel).toHaveBeenLastCalledWith(1, 8, expect.objectContaining({ remark: 'Edited' })),
      );
    });

    it('keeps a separate history per panel', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 8, 'Edited');
      await user.click(screen.getByRole('tab', { name: 'AdBlue' }));
      expect(await panel('AdBlue').findByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    it('undoes and redoes edits in the AdBlue and Expenses panels', async () => {
      defaults();
      api.getAdBlue.mockResolvedValue([
        { id: 2, eventDate: '2026-09-18', odometerKm: 5, liters: '2.000', price: '500' },
      ]);
      api.getExpenses.mockResolvedValue([{ id: 4, eventDate: '2026-09-17', amount: '1000', notes: 'Service' }]);
      const user = userEvent.setup();
      render(<App />);

      await user.click(await screen.findByRole('tab', { name: 'AdBlue' }));
      await user.click(await screen.findByRole('button', { name: 'Edit AdBlue record 2' }));
      await user.clear(panel('AdBlue').getByLabelText('Odometer (km)'));
      await user.type(panel('AdBlue').getByLabelText('Odometer (km)'), '9');
      await user.click(screen.getByRole('button', { name: 'Update record' }));
      await panel('AdBlue').findByText('AdBlue record updated.');
      await user.click(panel('AdBlue').getByRole('button', { name: 'Undo edit of AdBlue record from 2026-09-18' }));
      await waitFor(() =>
        expect(api.updateAdBlue).toHaveBeenLastCalledWith(1, 2, expect.objectContaining({ odometerKm: 5 })),
      );
      expect(await panel('AdBlue').findByRole('status')).toHaveTextContent('Undid edit of AdBlue record.');

      await user.click(screen.getByRole('tab', { name: 'Expenses' }));
      await user.click(await screen.findByRole('button', { name: 'Edit Expenses record 4' }));
      await user.clear(screen.getByLabelText('Notes'));
      await user.type(screen.getByLabelText('Notes'), 'Tyres');
      await user.click(screen.getByRole('button', { name: 'Update record' }));
      await panel('Expenses').findByText('Expenses record updated.');
      await user.click(panel('Expenses').getByRole('button', { name: 'Undo edit of Expenses record from 2026-09-17' }));
      await waitFor(() =>
        expect(api.updateExpense).toHaveBeenLastCalledWith(1, 4, expect.objectContaining({ notes: 'Service' })),
      );
      await panel('Expenses').findByText('Undid edit of Expenses record.');
      await user.click(
        await panel('Expenses').findByRole('button', { name: 'Redo edit of Expenses record from 2026-09-17' }),
      );
      await waitFor(() =>
        expect(api.updateExpense).toHaveBeenLastCalledWith(1, 4, expect.objectContaining({ notes: 'Tyres' })),
      );
    });

    it('ignores an undo result that arrives after the car changed', async () => {
      defaults();
      api.getFuel.mockImplementation((id: number) => Promise.resolve(id === 1 ? [fuelRow(8, 'Original')] : []));
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 8, 'Edited');
      const pendingUndo = deferred<unknown>();
      api.updateFuel.mockReturnValue(pendingUndo.promise);
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      await waitFor(() => expect(api.updateFuel).toHaveBeenCalledTimes(2));
      await user.selectOptions(screen.getByLabelText('Car'), 'Polo');
      await screen.findByText('No records yet.');
      const fuelCalls = api.getFuel.mock.calls.length;
      await act(async () => {
        pendingUndo.resolve({});
        await pendingUndo.promise;
      });
      expect(screen.queryByText('Undid edit of Fuel record.')).not.toBeInTheDocument();
      expect(api.getFuel).toHaveBeenCalledTimes(fuelCalls);
    });

    it('cancels the edit form when the loaded record is undone, but not another record', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original'), fuelRow(9, 'Other')]);
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 8, 'Edited');

      await user.click(screen.getByRole('button', { name: 'Edit Fuel record 9' }));
      await user.type(screen.getByLabelText('Remark'), ' typed');
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      await panel('Fuel').findByText('Undid edit of Fuel record.');
      expect(panel('Fuel').getByRole('group')).toHaveTextContent('Edit fuel record');
      expect(screen.getByLabelText('Remark')).toHaveValue('Other typed');

      await user.click(screen.getByRole('button', { name: 'Edit Fuel record 8' }));
      await user.click(panel('Fuel').getByRole('button', { name: redoName }));
      await panel('Fuel').findByText('Redid edit of Fuel record.');
      expect(panel('Fuel').getByRole('group')).toHaveTextContent('Add fuel record');
      expect(screen.getByLabelText('Remark')).toHaveValue('');
    });

    it('leaves unsaved typing in the add form alone', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 8, 'Edited');
      await user.type(screen.getByLabelText('Liters'), '7');
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      await panel('Fuel').findByText('Undid edit of Fuel record.');
      expect(screen.getByLabelText('Liters')).toHaveValue('7');
    });

    it('shows the error and keeps the entry when an undo fails', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 8, 'Edited');
      api.updateFuel.mockRejectedValueOnce(new Error('down'));
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      expect(await panel('Fuel').findByRole('alert')).toHaveTextContent('Unable to undo edit of Fuel record.');
      expect(panel('Fuel').getByRole('button', { name: undoName })).toBeEnabled();
      expect(panel('Fuel').getByRole('button', { name: 'Redo' })).toBeDisabled();
    });
  });

  describe('undo and redo of add and delete', () => {
    const undoDelete = 'Undo delete of Fuel record from 2026-09-18';
    const redoDelete = 'Redo delete of Fuel record from 2026-09-18';
    const undoAdd = /^Undo add of Fuel record from \d{4}-\d{2}-\d{2}$/;
    const redoAdd = /^Redo add of Fuel record from \d{4}-\d{2}-\d{2}$/;
    const fillAndSave = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText('Liters'), '47.300');
      await user.type(screen.getByLabelText('Total price (HUF)'), '29284');
      await user.click(screen.getByRole('button', { name: 'Save record' }));
      await panel('Fuel').findByText('Fuel record saved.');
    };

    it('deletes immediately without a confirmation and undoes it by re-creating the record', async () => {
      defaults();
      const confirm = vi.spyOn(window, 'confirm');
      api.getFuel.mockResolvedValue([fuelRow(8, 'Station')]);
      api.addFuel.mockResolvedValue(fuelRow(9, 'Station'));
      const user = userEvent.setup();
      render(<App />);
      await user.click(await screen.findByRole('button', { name: 'Delete Fuel record 8' }));
      await waitFor(() => expect(api.deleteFuel).toHaveBeenCalledWith(1, 8));
      expect(confirm).not.toHaveBeenCalled();
      await panel('Fuel').findByText('Fuel record deleted.');
      const fuelCalls = api.getFuel.mock.calls.length;

      await user.click(panel('Fuel').getByRole('button', { name: undoDelete }));
      await waitFor(() =>
        expect(api.addFuel).toHaveBeenCalledWith(1, {
          eventDate: '2026-09-18',
          odometerKm: 80,
          liters: '1.000',
          price: '619',
          fullTank: true,
          remark: 'Station',
        }),
      );
      expect(await panel('Fuel').findByRole('status')).toHaveTextContent('Undid delete of Fuel record.');
      await waitFor(() => expect(api.getFuel.mock.calls.length).toBeGreaterThan(fuelCalls));

      await user.click(panel('Fuel').getByRole('button', { name: redoDelete }));
      await waitFor(() => expect(api.deleteFuel).toHaveBeenLastCalledWith(1, 9));
      expect(await panel('Fuel').findByRole('status')).toHaveTextContent('Redid delete of Fuel record.');
    });

    it('undoes an add by deleting the id the create returned and redoes it by creating again', async () => {
      defaults();
      api.addFuel.mockResolvedValueOnce(fuelRow(20, '')).mockResolvedValueOnce(fuelRow(21, ''));
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText('No records yet.');
      await fillAndSave(user);

      await user.click(panel('Fuel').getByRole('button', { name: undoAdd }));
      await waitFor(() => expect(api.deleteFuel).toHaveBeenCalledWith(1, 20));
      expect(await panel('Fuel').findByRole('status')).toHaveTextContent('Undid add of Fuel record.');

      await user.click(panel('Fuel').getByRole('button', { name: redoAdd }));
      await waitFor(() => expect(api.addFuel).toHaveBeenCalledTimes(2));
      expect(api.addFuel).toHaveBeenLastCalledWith(1, expect.objectContaining({ liters: '47.300', price: '29284' }));
      expect(await panel('Fuel').findByRole('status')).toHaveTextContent('Redid add of Fuel record.');

      await user.click(panel('Fuel').getByRole('button', { name: undoAdd }));
      await waitFor(() => expect(api.deleteFuel).toHaveBeenLastCalledWith(1, 21));
    });

    it('undoes an edit on the new id after the record was deleted and re-created', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(5, 'Original')]);
      api.addFuel.mockResolvedValue(fuelRow(9, 'Edited'));
      const user = userEvent.setup();
      render(<App />);
      await user.click(await screen.findByRole('button', { name: 'Edit Fuel record 5' }));
      await user.clear(screen.getByLabelText('Remark'));
      await user.type(screen.getByLabelText('Remark'), 'Edited');
      await user.click(screen.getByRole('button', { name: 'Update record' }));
      await panel('Fuel').findByText('Fuel record updated.');
      await user.click(screen.getByRole('button', { name: 'Delete Fuel record 5' }));
      await panel('Fuel').findByText('Fuel record deleted.');

      await user.click(panel('Fuel').getByRole('button', { name: undoDelete }));
      await panel('Fuel').findByText('Undid delete of Fuel record.');
      await user.click(panel('Fuel').getByRole('button', { name: 'Undo edit of Fuel record from 2026-09-18' }));
      await waitFor(() =>
        expect(api.updateFuel).toHaveBeenLastCalledWith(1, 9, expect.objectContaining({ remark: 'Original' })),
      );
    });

    it('cancels the edit form when undoing an add deletes the loaded record', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(20, '')]);
      api.addFuel.mockResolvedValue(fuelRow(20, ''));
      const user = userEvent.setup();
      render(<App />);
      await screen.findByRole('button', { name: 'Edit Fuel record 20' });
      await fillAndSave(user);

      await user.click(screen.getByRole('button', { name: 'Edit Fuel record 20' }));
      expect(panel('Fuel').getByRole('group')).toHaveTextContent('Edit fuel record');
      await user.click(panel('Fuel').getByRole('button', { name: undoAdd }));
      await panel('Fuel').findByText('Undid add of Fuel record.');
      expect(panel('Fuel').getByRole('group')).toHaveTextContent('Add fuel record');
    });

    it('cancels the edit form when redoing a delete removes the loaded record', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Station')]);
      api.addFuel.mockResolvedValue(fuelRow(9, 'Station'));
      const user = userEvent.setup();
      render(<App />);
      await user.click(await screen.findByRole('button', { name: 'Delete Fuel record 8' }));
      await panel('Fuel').findByText('Fuel record deleted.');
      api.getFuel.mockResolvedValue([fuelRow(9, 'Station')]);
      await user.click(panel('Fuel').getByRole('button', { name: undoDelete }));
      await panel('Fuel').findByText('Undid delete of Fuel record.');

      await user.click(await screen.findByRole('button', { name: 'Edit Fuel record 9' }));
      expect(panel('Fuel').getByRole('group')).toHaveTextContent('Edit fuel record');
      await user.click(panel('Fuel').getByRole('button', { name: redoDelete }));
      await panel('Fuel').findByText('Redid delete of Fuel record.');
      expect(panel('Fuel').getByRole('group')).toHaveTextContent('Add fuel record');
    });
  });

  describe('undo and redo failure policy', () => {
    const undoName = 'Undo edit of Fuel record from 2026-09-18';
    const redoName = 'Redo edit of Fuel record from 2026-09-18';
    const editRemark = async (user: ReturnType<typeof userEvent.setup>, remark: string) => {
      await user.click(await screen.findByRole('button', { name: 'Edit Fuel record 8' }));
      await user.clear(screen.getByLabelText('Remark'));
      await user.type(screen.getByLabelText('Remark'), remark);
      await user.click(screen.getByRole('button', { name: 'Update record' }));
      await panel('Fuel').findByText('Fuel record updated.');
    };
    // Two edits, so there is an older action under the newest one.
    const twoEdits = async (user: ReturnType<typeof userEvent.setup>) => {
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      render(<App />);
      await editRemark(user, 'First');
      await editRemark(user, 'Second');
    };

    it('keeps the entry after a network failure and applies it on retry', async () => {
      defaults();
      const user = userEvent.setup();
      await twoEdits(user);
      api.updateFuel.mockRejectedValueOnce(new api.ApiError('Unable to reach the server.', undefined, 'network'));
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      expect(await panel('Fuel').findByRole('alert')).toHaveTextContent('Unable to reach the server.');
      expect(panel('Fuel').getByRole('button', { name: undoName })).toBeEnabled();

      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      await waitFor(() =>
        expect(api.updateFuel).toHaveBeenLastCalledWith(1, 8, expect.objectContaining({ remark: 'Original' })),
      );
      expect(await panel('Fuel').findByRole('status')).toHaveTextContent('Undid edit of Fuel record.');
    });

    it.each([
      ['not found', 'not-found'],
      ['rejected', 'rejected'],
    ] as const)('drops the entry after an undo fails as %s', async (_label, kind) => {
      defaults();
      const user = userEvent.setup();
      await twoEdits(user);
      api.updateFuel.mockRejectedValueOnce(new api.ApiError('Record no longer exists.', undefined, kind));
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      expect(await panel('Fuel').findByRole('alert')).toHaveTextContent('Record no longer exists.');
      expect(panel('Fuel').getByRole('button', { name: 'Redo' })).toBeDisabled();

      // The next older action is now offered: undoing it writes the original values back.
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      await waitFor(() =>
        expect(api.updateFuel).toHaveBeenLastCalledWith(1, 8, expect.objectContaining({ remark: 'Original' })),
      );
      await panel('Fuel').findByText('Undid edit of Fuel record.');
      expect(panel('Fuel').getByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    it('disables Undo after dropping the only entry', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 'First');
      api.updateFuel.mockRejectedValueOnce(new api.ApiError('Gone.', undefined, 'not-found'));
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      expect(await panel('Fuel').findByRole('alert')).toHaveTextContent('Gone.');
      expect(panel('Fuel').getByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    it('keeps a redo after a network failure and applies it on retry', async () => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 'First');
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      await panel('Fuel').findByText('Undid edit of Fuel record.');
      api.updateFuel.mockRejectedValueOnce(new api.ApiError('Unable to reach the server.', undefined, 'network'));
      await user.click(panel('Fuel').getByRole('button', { name: redoName }));
      expect(await panel('Fuel').findByRole('alert')).toHaveTextContent('Unable to reach the server.');
      expect(panel('Fuel').getByRole('button', { name: redoName })).toBeEnabled();

      await user.click(panel('Fuel').getByRole('button', { name: redoName }));
      expect(await panel('Fuel').findByRole('status')).toHaveTextContent('Redid edit of Fuel record.');
    });

    it.each([
      ['not found', 'not-found'],
      ['rejected', 'rejected'],
    ] as const)('drops the entry after a redo fails as %s', async (_label, kind) => {
      defaults();
      api.getFuel.mockResolvedValue([fuelRow(8, 'Original')]);
      const user = userEvent.setup();
      render(<App />);
      await editRemark(user, 'First');
      await user.click(panel('Fuel').getByRole('button', { name: undoName }));
      await panel('Fuel').findByText('Undid edit of Fuel record.');
      api.updateFuel.mockRejectedValueOnce(new api.ApiError('Redo refused.', undefined, kind));
      await user.click(panel('Fuel').getByRole('button', { name: redoName }));
      expect(await panel('Fuel').findByRole('alert')).toHaveTextContent('Redo refused.');
      expect(panel('Fuel').getByRole('button', { name: 'Redo' })).toBeDisabled();
      expect(panel('Fuel').getByRole('button', { name: 'Undo' })).toBeDisabled();
    });
  });
});
