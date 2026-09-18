import { useState } from 'react';
import { AdBluePanel } from './components/AdBluePanel';
import { ExpensesPanel } from './components/ExpensesPanel';
import { FuelPanel } from './components/FuelPanel';

enum Panel {
  Fuel = 'Fuel',
  AdBlue = 'AdBlue',
  Expenses = 'Expenses',
}

const panels = Object.values(Panel);

export function App() {
  const [active, setActive] = useState<Panel>(Panel.Fuel);
  const [visited, setVisited] = useState<Set<Panel>>(() => new Set([Panel.Fuel]));

  const selectPanel = (panel: Panel) => {
    setActive(panel);
    setVisited((current) => new Set(current).add(panel));
  };

  return (
    <main>
      <h1>Car Tracker</h1>
      <nav aria-label="Record types" role="tablist">
        {panels.map((panel) => (
          <button key={panel} role="tab" aria-selected={active === panel} onClick={() => selectPanel(panel)}>
            {panel}
          </button>
        ))}
      </nav>
      {visited.has(Panel.Fuel) && (
        <div hidden={active !== Panel.Fuel}>
          <FuelPanel />
        </div>
      )}
      {visited.has(Panel.AdBlue) && (
        <div hidden={active !== Panel.AdBlue}>
          <AdBluePanel />
        </div>
      )}
      {visited.has(Panel.Expenses) && (
        <div hidden={active !== Panel.Expenses}>
          <ExpensesPanel />
        </div>
      )}
    </main>
  );
}
