import { useCallback } from 'react';
import { expenseRequestSchema, type ExpenseRecord, type ExpenseRequest } from '@car-tracker/contracts';
import { addExpense, deleteExpense, getExpenses, updateExpense } from '../api';
import { numberOf, parseRequest } from '../form';
import { formatDate, formatMoney, today } from '../format';
import { Panel } from './Panel';
import { RecordTable, type RecordTableColumn } from './RecordTable';

interface ExpenseForm {
  eventDate: string;
  price: string;
  notes: string;
}

const initial = (): ExpenseForm => ({ eventDate: today(), price: '', notes: '' });
const parse = (form: ExpenseForm) => parseRequest(expenseRequestSchema, { ...form, price: numberOf(form.price) });
const columns: RecordTableColumn<ExpenseRecord>[] = [
  { header: 'Date', render: (record) => formatDate(record.eventDate) },
  { header: 'Price', render: (record) => formatMoney(record.price) },
  { header: 'Notes', render: (record) => record.notes ?? '—' },
];

export function ExpensesPanel({ carId }: { carId: number }) {
  const load = useCallback(() => getExpenses(carId), [carId]);
  const submit = useCallback((value: ExpenseRequest) => addExpense(carId, value), [carId]);
  const update = useCallback((id: number, value: ExpenseRequest) => updateExpense(carId, id, value), [carId]);
  const remove = useCallback((id: number) => deleteExpense(carId, id), [carId]);
  return (
    <Panel
      title="Expenses"
      load={load}
      submit={submit}
      update={update}
      remove={remove}
      toFormValue={(r) => ({ eventDate: r.eventDate, price: String(r.price), notes: r.notes ?? '' })}
      initial={initial}
      parse={parse}
      table={(records, actions) => (
        <RecordTable records={records} columns={columns} actions={{ ...actions, label: 'Expenses' }} />
      )}
    >
      {(v, set) => (
        <>
          <label>
            Date
            <input
              type="date"
              value={v.eventDate}
              onChange={(e) => set({ ...v, eventDate: e.target.value })}
              required
            />
          </label>
          <label>
            Price (HUF)
            <input
              type="text"
              inputMode="numeric"
              value={v.price}
              onChange={(e) => set({ ...v, price: e.target.value })}
              required
            />
          </label>
          <label>
            Notes
            <textarea maxLength={1000} value={v.notes} onChange={(e) => set({ ...v, notes: e.target.value })} />
          </label>
        </>
      )}
    </Panel>
  );
}
