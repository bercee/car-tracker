import { useEffect, useState, type ComponentType } from 'react';
import type { Car } from '@car-tracker/contracts';
import { ApiError, checkHealth, getCars } from './api';
import { pickActiveCar, readStoredCarId, storeCarId } from './carSelection';
import { AdBluePanel } from './components/AdBluePanel';
import { CarManager } from './components/CarManager';
import { ExpensesPanel } from './components/ExpensesPanel';
import { FuelPanel } from './components/FuelPanel';
import type { RecordPanelProps } from './components/Panel';
import { StatusMessage } from './components/StatusMessage';

enum Section {
  Fuel = 'Fuel',
  AdBlue = 'AdBlue',
  Expenses = 'Expenses',
  Cars = 'Cars',
}

const recordPanels: [Section, ComponentType<RecordPanelProps>][] = [
  [Section.Fuel, FuelPanel],
  [Section.AdBlue, AdBluePanel],
  [Section.Expenses, ExpensesPanel],
];
const recordSections = recordPanels.map(([section]) => section);

// Folds only ASCII A-Z, matching the backend's car ordering (ADR 0006).
const foldAscii = (name: string) => name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
const byName = (a: Car, b: Car) => {
  const left = foldAscii(a.name);
  const right = foldAscii(b.name);
  return left < right ? -1 : left > right ? 1 : a.id - b.id;
};

export function App() {
  const [activeSection, setActiveSection] = useState<Section>(Section.Fuel);
  const [visitedSections, setVisitedSections] = useState<Set<Section>>(() => new Set([Section.Fuel]));

  const [cars, setCars] = useState<Car[]>([]);
  const [carId, setCarId] = useState<number>();
  const [loadingCars, setLoadingCars] = useState(true);
  const [databaseUnavailable, setDatabaseUnavailable] = useState(false);
  const [carsError, setCarsError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Runs alongside getCars because the probe is time-limited: getCars can hang on an unreachable host.
    void checkHealth().catch((error: unknown) => {
      if (!cancelled && error instanceof ApiError && error.kind === 'database-unavailable') {
        setDatabaseUnavailable(true);
      }
    });

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
        if (!cancelled) {
          if (cause instanceof ApiError && cause.kind === 'database-unavailable') {
            setDatabaseUnavailable(true);
          } else {
            setCarsError(cause instanceof Error ? cause.message : 'Unable to load cars.');
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCars(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const retryLoad = () => {
    setDatabaseUnavailable(false);
    setCarsError(undefined);
    setLoadingCars(true);
    setLoadAttempt((attempt) => attempt + 1);
  };
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

  if (databaseUnavailable) {
    return (
      <main>
        {header}
        <div className="database-warning" aria-live="assertive" role="alert">
          <strong>⚠️ Database Unavailable</strong>
          <p>
            The database connection could not be established. The application will not function correctly until the
            database is available.
          </p>
          <p>Please check that the database server is running and accessible.</p>
          <button type="button" onClick={retryLoad}>
            Try again
          </button>
        </div>
      </main>
    );
  }

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
      {carId !== undefined &&
        recordPanels.map(
          ([section, RecordPanel]) =>
            visitedSections.has(section) && (
              <div key={section} hidden={activeSection !== section}>
                <RecordPanel key={carId} carId={carId} visible={activeSection === section} />
              </div>
            ),
        )}
    </main>
  );
}
