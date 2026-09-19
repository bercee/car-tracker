import { addFuel, getFuel } from '../api';
import { formatDate, formatLiters, formatMoney, today } from '../format';
import { isHuf, validateCommon } from '../validation';
import type { FuelRecord, FuelRequest } from '@car-tracker/contracts';
import { Panel } from './Panel';
import { RecordTable, type RecordTableColumn } from './RecordTable';

const initial = (): FuelRequest => ({
  eventDate: today(),
  odometerKm: 0,
  liters: '',
  pricePerLiter: '',
  fullTank: true,
  remark: '',
});
const columns: RecordTableColumn<FuelRecord>[] = [
  { header: 'Date', render: (record) => formatDate(record.eventDate) },
  { header: 'Odometer', render: (record) => record.odometerKm.toLocaleString() },
  { header: 'Liters', render: (record) => formatLiters(record.liters) },
  { header: 'Price/L', render: (record) => formatMoney(record.pricePerLiter) },
  { header: 'Full tank', render: (record) => (record.fullTank ? 'Yes' : 'No') },
  { header: 'Remark', render: (record) => record.remark ?? '—' },
];

export function FuelPanel() {
  return (
    <Panel
      title="Fuel"
      load={getFuel}
      submit={addFuel}
      initial={initial}
      validate={(v) =>
        validateCommon(v.eventDate, String(v.odometerKm), v.liters) ??
        (!isHuf(v.pricePerLiter) ? 'Enter a whole HUF price.' : undefined)
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
              step="1"
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
            Price per liter (HUF)
            <input
              type="text"
              inputMode="numeric"
              value={v.pricePerLiter}
              onChange={(e) => set({ ...v, pricePerLiter: e.target.value })}
              required
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={v.fullTank} onChange={(e) => set({ ...v, fullTank: e.target.checked })} />{' '}
            Full tank
          </label>
          <label>
            Remark
            <textarea maxLength={500} value={v.remark ?? ''} onChange={(e) => set({ ...v, remark: e.target.value })} />
          </label>
        </>
      )}
    </Panel>
  );
}
