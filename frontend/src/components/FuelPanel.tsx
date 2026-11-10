import { useCallback } from 'react';
import { addFuel, deleteFuel, getFuel, updateFuel } from '../api';
import { formatDate, formatLiters, formatMoney, today } from '../format';
import { numberOf, parseRequest } from '../form';
import { fuelRequestSchema, type FuelRecord, type FuelRequest } from '@car-tracker/contracts';
import { Panel, type RecordPanelProps } from './Panel';
import { RecordTable, type RecordTableColumn } from './RecordTable';

interface FuelForm {
  eventDate: string;
  odometerKm: string;
  liters: string;
  price: string;
  reportedConsumption: string;
  fullTank: boolean;
  remark: string;
}

const initial = (): FuelForm => ({
  eventDate: today(),
  odometerKm: '',
  liters: '',
  price: '',
  reportedConsumption: '',
  fullTank: true,
  remark: '',
});
const parse = (form: FuelForm) =>
  parseRequest(fuelRequestSchema, {
    ...form,
    eventDate: form.eventDate || null,
    odometerKm: numberOf(form.odometerKm) ?? null,
    liters: numberOf(form.liters) ?? null,
    price: numberOf(form.price) ?? null,
    reportedConsumption: numberOf(form.reportedConsumption) ?? null,
  });
const columns: RecordTableColumn<FuelRecord>[] = [
  { header: 'Date', render: (record) => (record.eventDate === null ? '—' : formatDate(record.eventDate)) },
  { header: 'Odometer', render: (record) => record.odometerKm?.toLocaleString() ?? '—' },
  { header: 'Liters', render: (record) => (record.liters === null ? '—' : formatLiters(record.liters)) },
  { header: 'Total price', render: (record) => (record.price === null ? '—' : formatMoney(record.price)) },
  {
    header: 'Reported L/100 km',
    render: (record) => record.reportedConsumption?.toFixed(1) ?? '—',
  },
  { header: 'Full tank', render: (record) => (record.fullTank ? 'Yes' : 'No') },
  { header: 'Remark', render: (record) => record.remark ?? '—' },
];

export function FuelPanel({ carId, visible }: RecordPanelProps) {
  const load = useCallback(() => getFuel(carId), [carId]);
  const submit = useCallback((value: FuelRequest) => addFuel(carId, value), [carId]);
  const update = useCallback((id: number, value: FuelRequest) => updateFuel(carId, id, value), [carId]);
  const remove = useCallback((id: number) => deleteFuel(carId, id), [carId]);
  return (
    <Panel
      title="Fuel"
      visible={visible}
      load={load}
      submit={submit}
      update={update}
      remove={remove}
      toFormValue={(r) => ({
        eventDate: r.eventDate ?? '',
        odometerKm: r.odometerKm === null ? '' : String(r.odometerKm),
        liters: r.liters === null ? '' : String(r.liters),
        price: r.price === null ? '' : String(r.price),
        reportedConsumption: r.reportedConsumption === null ? '' : String(r.reportedConsumption),
        fullTank: r.fullTank,
        remark: r.remark ?? '',
      })}
      toRequest={(r) => ({
        eventDate: r.eventDate,
        odometerKm: r.odometerKm,
        liters: r.liters,
        price: r.price,
        reportedConsumption: r.reportedConsumption,
        fullTank: r.fullTank,
        remark: r.remark,
      })}
      initial={initial}
      parse={parse}
      table={(records, actions) => (
        <RecordTable records={records} columns={columns} actions={{ ...actions, label: 'Fuel' }} />
      )}
    >
      {(v, set) => (
        <>
          <label>
            Date
            <input type="date" value={v.eventDate} onChange={(e) => set({ ...v, eventDate: e.target.value })} />
          </label>
          <label>
            Odometer (km)
            <input
              type="number"
              min="0"
              step="1"
              value={v.odometerKm}
              onChange={(e) => set({ ...v, odometerKm: e.target.value })}
            />
          </label>
          <label>
            Liters
            <input
              type="text"
              inputMode="decimal"
              value={v.liters}
              onChange={(e) => set({ ...v, liters: e.target.value })}
            />
          </label>
          <label>
            Total price (HUF)
            <input
              type="text"
              inputMode="numeric"
              value={v.price}
              onChange={(e) => set({ ...v, price: e.target.value })}
            />
          </label>
          <label>
            Reported consumption (L/100 km)
            <input
              type="text"
              inputMode="decimal"
              value={v.reportedConsumption}
              onChange={(e) => set({ ...v, reportedConsumption: e.target.value })}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={v.fullTank} onChange={(e) => set({ ...v, fullTank: e.target.checked })} />{' '}
            Full tank
          </label>
          <label>
            Remark
            <textarea value={v.remark} onChange={(e) => set({ ...v, remark: e.target.value })} />
          </label>
        </>
      )}
    </Panel>
  );
}
