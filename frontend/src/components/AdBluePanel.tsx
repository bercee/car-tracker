import { useCallback } from 'react';
import { addAdBlue, deleteAdBlue, getAdBlue, updateAdBlue } from '../api';
import { formatDate, formatLiters, formatMoney, today } from '../format';
import { isHuf, validateCommon } from '../validation';
import type { AdBlueRecord, AdBlueRequest } from '@car-tracker/contracts';
import type { UndoHistory } from '../undoHistory';
import { Panel } from './Panel';
import { RecordTable, type RecordTableColumn } from './RecordTable';

const initial = (): AdBlueRequest => ({ eventDate: today(), odometerKm: 0, liters: '', price: '' });
const columns: RecordTableColumn<AdBlueRecord>[] = [
  { header: 'Date', render: (record) => formatDate(record.eventDate) },
  { header: 'Odometer', render: (record) => record.odometerKm.toLocaleString() },
  { header: 'Liters', render: (record) => formatLiters(record.liters) },
  { header: 'Amount', render: (record) => formatMoney(record.price) },
];

export function AdBluePanel({ carId, history, visible }: { carId: number; history: UndoHistory; visible: boolean }) {
  const load = useCallback(() => getAdBlue(carId), [carId]);
  const submit = useCallback((value: AdBlueRequest) => addAdBlue(carId, value), [carId]);
  const update = useCallback((id: number, value: AdBlueRequest) => updateAdBlue(carId, id, value), [carId]);
  const remove = useCallback((id: number) => deleteAdBlue(carId, id), [carId]);
  return (
    <Panel
      title="AdBlue"
      history={history}
      visible={visible}
      load={load}
      submit={submit}
      update={update}
      remove={remove}
      toFormValue={(r) => ({ eventDate: r.eventDate, odometerKm: r.odometerKm, liters: r.liters, price: r.price })}
      initial={initial}
      validate={(v) =>
        validateCommon(v.eventDate, String(v.odometerKm), v.liters) ??
        (!isHuf(v.price) ? 'Enter a whole HUF amount.' : undefined)
      }
      table={(records, actions) => (
        <RecordTable records={records} columns={columns} actions={{ ...actions, label: 'AdBlue' }} />
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
            Odometer (km)
            <input
              type="number"
              min="0"
              max="9999999"
              value={v.odometerKm}
              onChange={(e) => set({ ...v, odometerKm: Number(e.target.value) })}
              required
            />
          </label>
          <label>
            Liters
            <input
              type="text"
              inputMode="decimal"
              value={v.liters}
              onChange={(e) => set({ ...v, liters: e.target.value })}
              required
            />
          </label>
          <label>
            Total price (HUF)
            <input
              type="text"
              inputMode="numeric"
              value={v.price}
              onChange={(e) => set({ ...v, price: e.target.value })}
              required
            />
          </label>
        </>
      )}
    </Panel>
  );
}
