'use client';

import { Spinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-gray-800/60">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 rounded bg-gray-800 animate-pulse" style={{ width: `${55 + (i * 17) % 35}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'Veri bulunamadı',
  onRowClick,
}: DataTableProps<T>) {
  function getCellValue(row: T, key: keyof T | string): any {
    return (row as any)[key as string];
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {/* Head */}
        <thead>
          <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="px-4 py-2.5 text-left font-medium whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {isLoading ? (
            /* Skeleton rows */
            Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : data.length === 0 ? (
            /* Empty state */
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-gray-500"
              >
                <div className="flex flex-col items-center gap-2">
                  <svg
                    className="w-8 h-8 text-gray-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <span>{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            /* Data rows — zebra striping via odd/even */
            data.map((row, rowIndex) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={[
                  'border-b border-gray-800/60 transition-colors',
                  rowIndex % 2 === 1 ? 'bg-gray-800/20' : '',
                  onRowClick
                    ? 'cursor-pointer hover:bg-amber-500/5 hover:border-gray-700'
                    : 'hover:bg-gray-800/30',
                ].join(' ')}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className="px-4 py-3 text-gray-300 whitespace-nowrap"
                  >
                    {col.render
                      ? col.render(getCellValue(row, col.key), row)
                      : String(getCellValue(row, col.key) ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Loading overlay indicator (for refetch while data visible) */}
      {isLoading && data.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" />
        </div>
      )}
    </div>
  );
}
