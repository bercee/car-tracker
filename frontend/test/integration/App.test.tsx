import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => {
  class ApiError extends Error {}

  return {
    ApiError,
    getCars: vi.fn(),
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
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Fuel record saved.'));
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

  it('loads a fuel row into the shared form, updates it, and confirms deletion', async () => {
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
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: 'Edit Fuel record 8' });
    await user.click(screen.getByRole('button', { name: 'Edit Fuel record 8' }));
    expect(screen.getByRole('group')).toHaveTextContent('Edit fuel record');
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
    expect(await screen.findByRole('status')).toHaveTextContent('Fuel record updated.');
    expect(screen.getByRole('button', { name: 'Save record' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Fuel record 8' }));
    await user.click(screen.getByRole('button', { name: 'Delete Fuel record 8' }));
    expect(confirm).toHaveBeenCalledWith('Delete this Fuel record? This cannot be undone.');
    expect(api.deleteFuel).toHaveBeenCalledWith(1, 8);
    expect(await screen.findByRole('status')).toHaveTextContent('Fuel record deleted.');
    confirm.mockRestore();
  });

  it('cancels edits and leaves the row untouched when deletion is declined', async () => {
    defaults();
    api.getExpenses.mockResolvedValue([{ id: 3, eventDate: '2026-09-18', amount: '1000', notes: null }]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
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
    await user.click(screen.getByRole('button', { name: 'Delete Expenses record 3' }));
    expect(api.deleteExpense).not.toHaveBeenCalled();
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
    expect(await screen.findByRole('alert')).toHaveTextContent('Update rejected.');
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
    expect(screen.getByRole('group')).toHaveTextContent('Edit fuel record');
    await user.selectOptions(screen.getByLabelText('Car'), 'Golf');
    await screen.findByText('Remark 1');
    expect(screen.getByRole('group')).toHaveTextContent('Add fuel record');
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
    vi.spyOn(window, 'confirm').mockReturnValue(true);
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
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Car')).not.toBeInTheDocument();
    expect(api.getFuel).not.toHaveBeenCalled();
  });
  it('shows loading and error states for the car list', async () => {
    defaults();
    api.getCars.mockRejectedValue(new api.ApiError('Cars are down.'));
    render(<App />);
    expect(screen.getByText('Loading cars…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cars are down.');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
