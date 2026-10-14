import type { ReactNode } from 'react';
import type { PanelActions } from './Panel';

export interface RecordTableColumn<T extends { id: number }> {
  header: string;
  render: (record: T) => ReactNode;
}

export function RecordTable<T extends { id: number }>({
  records,
  columns,
  actions,
}: {
  records: T[];
  columns: RecordTableColumn<T>[];
  actions?: PanelActions<T> & { label: string };
}) {
  if (records.length === 0) return <p>No records yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header}>{column.header}</th>
            ))}
            {actions && <th scope="col">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              {columns.map((column) => (
                <td key={column.header}>{column.render(record)}</td>
              ))}
              {actions && (
                <td className="table-actions">
                  <button
                    type="button"
                    disabled={actions.disabled}
                    aria-label={`Edit ${actions.label} record ${record.id}`}
                    onClick={() => actions.onEdit(record)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={actions.disabled}
                    aria-label={`Delete ${actions.label} record ${record.id}`}
                    onClick={() => actions.onDelete(record)}
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
