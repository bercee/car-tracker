import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const carNameUniqueIndex = 'cars_name_lower_key';

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();
const eventDate = () => date('event_date', { mode: 'string' }).notNull();

export const cars = pgTable(
  'cars',
  {
    id: id(),
    name: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    // COLLATE "C" folds only ASCII, independent of the database locale (matches SQLite NOCASE and the frontend).
    uniqueIndex(carNameUniqueIndex).on(sql`lower(${table.name} COLLATE "C")`),
    check('cars_name_length', sql`char_length(${table.name}) BETWEEN 1 AND 60`),
  ],
);

export const fuel = pgTable(
  'fuel',
  {
    id: id(),
    carId: integer('car_id')
      .notNull()
      .references(() => cars.id, { onDelete: 'restrict' }),
    eventDate: eventDate(),
    createdAt: createdAt(),
    odometerKm: integer('odometer_km').notNull(),
    litersMilliliters: integer('liters_milliliters').notNull(),
    priceHuf: integer('price_huf').notNull(),
    fullTank: boolean('full_tank').notNull(),
    remark: text(),
  },
  (table) => [
    index('idx_fuel_car_event_date').on(table.carId, table.eventDate.desc().nullsFirst(), table.id.desc().nullsFirst()),
    check('fuel_odometer_km_nonnegative', sql`${table.odometerKm} >= 0`),
    check('fuel_liters_milliliters_positive', sql`${table.litersMilliliters} > 0`),
    check('fuel_price_huf_nonnegative', sql`${table.priceHuf} >= 0`),
    check('fuel_remark_length', sql`${table.remark} IS NULL OR char_length(${table.remark}) <= 500`),
  ],
);

export const adblue = pgTable(
  'adblue',
  {
    id: id(),
    carId: integer('car_id')
      .notNull()
      .references(() => cars.id, { onDelete: 'restrict' }),
    eventDate: eventDate(),
    createdAt: createdAt(),
    odometerKm: integer('odometer_km').notNull(),
    litersMilliliters: integer('liters_milliliters').notNull(),
    priceHuf: integer('price_huf').notNull(),
  },
  (table) => [
    index('idx_adblue_car_event_date').on(
      table.carId,
      table.eventDate.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    check('adblue_odometer_km_nonnegative', sql`${table.odometerKm} >= 0`),
    check('adblue_liters_milliliters_positive', sql`${table.litersMilliliters} > 0`),
    check('adblue_price_huf_nonnegative', sql`${table.priceHuf} >= 0`),
  ],
);

export const expenses = pgTable(
  'expenses',
  {
    id: id(),
    carId: integer('car_id')
      .notNull()
      .references(() => cars.id, { onDelete: 'restrict' }),
    eventDate: eventDate(),
    createdAt: createdAt(),
    price: integer().notNull(),
    notes: text(),
  },
  (table) => [
    index('idx_expenses_car_event_date').on(
      table.carId,
      table.eventDate.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    check('expenses_price_nonnegative', sql`${table.price} >= 0`),
    check('expenses_notes_length', sql`${table.notes} IS NULL OR char_length(${table.notes}) <= 1000`),
  ],
);
