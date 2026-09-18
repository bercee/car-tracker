import type { ReactNode } from 'react';

export interface RecordTableColumn<T extends { id: number }> {
  header: string;
  render: (record: T) => ReactNode;
}

export function RecordTable<T extends { id: number }>({
  records,
  columns,
}: {
  records: T[];
  columns: RecordTableColumn<T>[];
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
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              {columns.map((column) => (
                <td key={column.header}>{column.render(record)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
