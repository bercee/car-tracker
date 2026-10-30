import { useCallback } from 'react';
import { addAdBlue, deleteAdBlue, getAdBlue, updateAdBlue } from '../api';
import { formatDate, formatLiters, formatMoney, today } from '../format';
import { numberOf, parseRequest } from '../form';
import { adBlueRequestSchema, type AdBlueRecord, type AdBlueRequest } from '@car-tracker/contracts';
import { Panel } from './Panel';
import { RecordTable, type RecordTableColumn } from './RecordTable';

interface AdBlueForm {
  eventDate: string;
  odometerKm: string;
  liters: string;
  price: string;
}

const initial = (): AdBlueForm => ({ eventDate: today(), odometerKm: '0', liters: '', price: '' });
const parse = (form: AdBlueForm) =>
  parseRequest(adBlueRequestSchema, {
    eventDate: form.eventDate,
    odometerKm: numberOf(form.odometerKm),
    liters: numberOf(form.liters),
    price: numberOf(form.price),
  });
const columns: RecordTableColumn<AdBlueRecord>[] = [
  { header: 'Date', render: (record) => formatDate(record.eventDate) },
  { header: 'Odometer', render: (record) => record.odometerKm.toLocaleString() },
  { header: 'Liters', render: (record) => formatLiters(record.liters) },
  { header: 'Price', render: (record) => formatMoney(record.price) },
];

export function AdBluePanel({ carId }: { carId: number }) {
  const load = useCallback(() => getAdBlue(carId), [carId]);
  const submit = useCallback((value: AdBlueRequest) => addAdBlue(carId, value), [carId]);
  const update = useCallback((id: number, value: AdBlueRequest) => updateAdBlue(carId, id, value), [carId]);
  const remove = useCallback((id: number) => deleteAdBlue(carId, id), [carId]);
  return (
    <Panel
      title="AdBlue"
      load={load}
      submit={submit}
      update={update}
      remove={remove}
      toFormValue={(r) => ({
        eventDate: r.eventDate,
        odometerKm: String(r.odometerKm),
        liters: String(r.liters),
        price: String(r.price),
      })}
      initial={initial}
      parse={parse}
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
              onChange={(e) => set({ ...v, odometerKm: e.target.value })}
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
