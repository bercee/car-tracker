import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => {
  class ApiError extends Error {}

  return {
    ApiError,
    getFuel: vi.fn(),
    addFuel: vi.fn(),
    getAdBlue: vi.fn(),
    addAdBlue: vi.fn(),
    getExpenses: vi.fn(),
    addExpense: vi.fn(),
  };
});
vi.mock('../../src/api', () => api);
import { App } from '../../src/App';

const defaults = () => {
  api.getFuel.mockResolvedValue([]);
  api.getAdBlue.mockResolvedValue([]);
  api.getExpenses.mockResolvedValue([]);
  api.addFuel.mockResolvedValue({});
  api.addAdBlue.mockResolvedValue({});
  api.addExpense.mockResolvedValue({});
};

describe('App', () => {
  beforeEach(() => vi.clearAllMocks());

  it('defaults to Fuel and provides accessible tabs', async () => {
    defaults();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Car Tracker' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Fuel' })).toHaveAttribute('aria-selected', 'true');
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
    expect(api.addFuel).toHaveBeenCalledWith(expect.objectContaining({ liters: '47.300', price: '29284' }));
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
});
