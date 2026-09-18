import { addAdBlue, getAdBlue } from '../api';
import { formatDate, formatLiters, formatMoney, today } from '../format';
import { isHuf, validateCommon } from '../validation';
import type { AdBlueRecord, AdBlueRequest } from '../types';
import { Panel } from './Panel';
import { RecordTable, type RecordTableColumn } from './RecordTable';

const initial = (): AdBlueRequest => ({ eventDate: today(), odometerKm: 0, liters: '', price: '' });
const columns: RecordTableColumn<AdBlueRecord>[] = [
  { header: 'Date', render: (record) => formatDate(record.eventDate) },
  { header: 'Odometer', render: (record) => record.odometerKm.toLocaleString() },
  { header: 'Liters', render: (record) => formatLiters(record.liters) },
  { header: 'Amount', render: (record) => formatMoney(record.price) },
];

export function AdBluePanel() {
  return (
    <Panel
      title="AdBlue"
      load={getAdBlue}
      submit={addAdBlue}
      initial={initial}
      validate={(v) =>
        validateCommon(v.eventDate, String(v.odometerKm), v.liters) ??
        (!isHuf(v.price) ? 'Enter a whole HUF amount.' : undefined)
      }
      table={(records) => <RecordTable records={records} columns={columns} />}
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
