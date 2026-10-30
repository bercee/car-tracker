import { useEffect, useState } from 'react';
import type { Car } from '@car-tracker/contracts';
import { getCars } from './api';
import { pickActiveCar, readStoredCarId, storeCarId } from './carSelection';
import { AdBluePanel } from './components/AdBluePanel';
import { CarManager } from './components/CarManager';
import { ExpensesPanel } from './components/ExpensesPanel';
import { FuelPanel } from './components/FuelPanel';
import { StatusMessage } from './components/StatusMessage';
import { UndoHistory } from './undoHistory';

enum Section {
  Fuel = 'Fuel',
  AdBlue = 'AdBlue',
  Expenses = 'Expenses',
  Cars = 'Cars',
}

const recordSections = [Section.Fuel, Section.AdBlue, Section.Expenses];

// Folds only ASCII A-Z, matching the backend's car ordering (see PostgresCarDatabase.listCars).
const foldAscii = (name: string) => name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
const byName = (a: Car, b: Car) => {
  const left = foldAscii(a.name);
  const right = foldAscii(b.name);
  return left < right ? -1 : left > right ? 1 : a.id - b.id;
};

export function App() {
  // Undo histories outlive the Panels, which remount on every Car switch.
  const [histories] = useState(() => new Map<string, UndoHistory>());
  const historyFor = (car: number, section: Section) => {
    const key = `${car}:${section}`;
    let history = histories.get(key);
    if (!history) {
      history = new UndoHistory();
      histories.set(key, history);
    }
    return history;
  };
  const [activeSection, setActiveSection] = useState<Section>(Section.Fuel);
  const [visitedSections, setVisitedSections] = useState<Set<Section>>(() => new Set([Section.Fuel]));

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
        if (loaded.length === 0) {
          setActiveSection(Section.Cars);
          setVisitedSections(new Set([Section.Cars]));
        }
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
  const selectSection = (section: Section) => {
    setActiveSection(section);
    setVisitedSections((current) => new Set(current).add(section));
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
  const sections = carId === undefined ? [Section.Cars] : [...recordSections, Section.Cars];

  return (
    <main>
      {header}
      <nav aria-label="Sections" role="tablist">
        {sections.map((section) => (
          <button
            key={section}
            role="tab"
            aria-selected={activeSection === section}
            onClick={() => selectSection(section)}
          >
            {section}
          </button>
        ))}
      </nav>
      {visitedSections.has(Section.Cars) && (
        <div hidden={activeSection !== Section.Cars}>
          <CarManager activeCar={cars.find((car) => car.id === carId)} onAdded={onAdded} onRenamed={onRenamed} />
          {carId === undefined && <p>No cars yet. Add a car to start tracking.</p>}
        </div>
      )}
      {carId !== undefined && visitedSections.has(Section.Fuel) && (
        <div hidden={activeSection !== Section.Fuel}>
          <FuelPanel key={carId} carId={carId} history={historyFor(carId, Section.Fuel)} />
        </div>
      )}
      {carId !== undefined && visitedSections.has(Section.AdBlue) && (
        <div hidden={activeSection !== Section.AdBlue}>
          <AdBluePanel key={carId} carId={carId} history={historyFor(carId, Section.AdBlue)} />
        </div>
      )}
      {carId !== undefined && visitedSections.has(Section.Expenses) && (
        <div hidden={activeSection !== Section.Expenses}>
          <ExpensesPanel key={carId} carId={carId} history={historyFor(carId, Section.Expenses)} />
        </div>
      )}
    </main>
  );
}
