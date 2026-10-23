import { useEffect, useState } from 'react';
import type { Car } from '@car-tracker/contracts';
import { getCars } from './api';
import { pickActiveCar, readStoredCarId, storeCarId } from './carSelection';
import { AdBluePanel } from './components/AdBluePanel';
import { CarManager } from './components/CarManager';
import { ExpensesPanel } from './components/ExpensesPanel';
import { FuelPanel } from './components/FuelPanel';
import { StatusMessage } from './components/StatusMessage';

enum Panel {
  Fuel = 'Fuel',
  AdBlue = 'AdBlue',
  Expenses = 'Expenses',
}

const panels = Object.values(Panel);

// Folds only ASCII A-Z, matching SQLite's NOCASE collation used by the backend.
const foldAscii = (name: string) => name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
const byName = (a: Car, b: Car) => {
  const left = foldAscii(a.name);
  const right = foldAscii(b.name);
  return left < right ? -1 : left > right ? 1 : a.id - b.id;
};

export function App() {
  const [active, setActive] = useState<Panel>(Panel.Fuel);
  const [visited, setVisited] = useState<Set<Panel>>(() => new Set([Panel.Fuel]));

  const [cars, setCars] = useState<Car[]>([]);
  const [carId, setCarId] = useState<number>();
  const [loadingCars, setLoadingCars] = useState(true);
  const [carsError, setCarsError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void getCars()
      .then((loaded) => {
        if (cancelled) return;
        setCars(loaded);
        setCarId(pickActiveCar(loaded, readStoredCarId()));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setCarsError(cause instanceof Error ? cause.message : 'Unable to load cars.');
      })
      .finally(() => {
        if (!cancelled) setLoadingCars(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectCar = (id: number) => {
    setCarId(id);
    storeCarId(id);
  };
  const onAdded = (car: Car) => {
    setCars((current) => [...current, car].sort(byName));
    selectCar(car.id);
  };
  const onRenamed = (car: Car) => {
    setCars((current) => current.map((existing) => (existing.id === car.id ? car : existing)).sort(byName));
  };
  const selectPanel = (panel: Panel) => {
    setActive(panel);
    setVisited((current) => new Set(current).add(panel));
  };

  const header = (
    <header>
      <h1>Car Tracker</h1>
      {cars.length > 0 && (
        <label>
          Car
          <select value={carId ?? ''} onChange={(event) => selectCar(Number(event.target.value))}>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </header>
  );

  if (loadingCars) {
    return (
      <main>
        {header}
        <p aria-live="polite">Loading cars…</p>
      </main>
    );
  }
  if (carsError !== undefined) {
    return (
      <main>
        {header}
        <StatusMessage message={carsError} error />
      </main>
    );
  }
  const manager = (
    <CarManager activeCar={cars.find((car) => car.id === carId)} onAdded={onAdded} onRenamed={onRenamed} />
  );
  if (carId === undefined) {
    return (
      <main>
        {header}
        {manager}
        <p>No cars yet. Add a car to start tracking.</p>
      </main>
    );
  }

  return (
    <main>
      {header}
      {manager}
      <nav aria-label="Record types" role="tablist">
        {panels.map((panel) => (
          <button key={panel} role="tab" aria-selected={active === panel} onClick={() => selectPanel(panel)}>
            {panel}
          </button>
        ))}
      </nav>
      {visited.has(Panel.Fuel) && (
        <div hidden={active !== Panel.Fuel}>
          <FuelPanel key={carId} carId={carId} />
        </div>
      )}
      {visited.has(Panel.AdBlue) && (
        <div hidden={active !== Panel.AdBlue}>
          <AdBluePanel key={carId} carId={carId} />
        </div>
      )}
      {visited.has(Panel.Expenses) && (
        <div hidden={active !== Panel.Expenses}>
          <ExpensesPanel key={carId} carId={carId} />
        </div>
      )}
    </main>
  );
}
