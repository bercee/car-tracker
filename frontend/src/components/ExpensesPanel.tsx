import { useCallback } from 'react';
import { addExpense, deleteExpense, getExpenses, updateExpense } from '../api';
import { formatDate, formatMoney, today } from '../format';
import { isHuf } from '../validation';
import type { ExpenseRecord, ExpenseRequest } from '@car-tracker/contracts';
import type { UndoHistory } from '../undoHistory';
import { Panel } from './Panel';
import { RecordTable, type RecordTableColumn } from './RecordTable';

const initial = (): ExpenseRequest => ({ eventDate: today(), amount: '', notes: '' });
const columns: RecordTableColumn<ExpenseRecord>[] = [
  { header: 'Date', render: (record) => formatDate(record.eventDate) },
  { header: 'Amount', render: (record) => formatMoney(record.amount) },
  { header: 'Notes', render: (record) => record.notes ?? '—' },
];

export function ExpensesPanel({ carId, history }: { carId: number; history: UndoHistory }) {
  const load = useCallback(() => getExpenses(carId), [carId]);
  const submit = useCallback((value: ExpenseRequest) => addExpense(carId, value), [carId]);
  const update = useCallback((id: number, value: ExpenseRequest) => updateExpense(carId, id, value), [carId]);
  const remove = useCallback((id: number) => deleteExpense(carId, id), [carId]);
  return (
    <Panel
      title="Expenses"
      history={history}
      load={load}
      submit={submit}
      update={update}
      remove={remove}
      toFormValue={(r) => ({ eventDate: r.eventDate, amount: r.amount, notes: r.notes ?? '' })}
      initial={initial}
      validate={(v) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(v.eventDate)
          ? 'Enter a valid date.'
          : !isHuf(v.amount)
            ? 'Enter a whole HUF amount.'
            : undefined
      }
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
            Amount (HUF)
            <input
              type="text"
              inputMode="numeric"
              value={v.amount}
              onChange={(e) => set({ ...v, amount: e.target.value })}
              required
            />
          </label>
          <label>
            Notes
            <textarea maxLength={1000} value={v.notes ?? ''} onChange={(e) => set({ ...v, notes: e.target.value })} />
          </label>
        </>
      )}
    </Panel>
  );
}
