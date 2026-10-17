'use client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the array of page numbers (and '...' ellipsis markers) to display.
 * Always shows first, last, current, and up to 1 neighbour on each side.
 * Maximum 5 visible page numbers at once.
 */
function buildPageWindows(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];

  // Always include page 1
  pages.push(1);

  const rangeStart = Math.max(2, current - 1);
  const rangeEnd = Math.min(total - 1, current + 1);

  if (rangeStart > 2) pages.push('...');

  for (let p = rangeStart; p <= rangeEnd; p++) {
    pages.push(p);
  }

  if (rangeEnd < total - 1) pages.push('...');

  // Always include last page
  pages.push(total);

  return pages;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const windows = buildPageWindows(page, totalPages);

  const btnBase =
    'flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50';
  const btnInactive =
    'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white';
  const btnActive =
    'bg-amber-500 border-amber-500 text-black';
  const btnDisabled =
    'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed opacity-50';

  // "Showing X–Y of Z" range label
  const rangeLabel = (() => {
    if (totalItems === undefined || pageSize === undefined) return null;
    const from = Math.min((page - 1) * pageSize + 1, totalItems);
    const to = Math.min(page * pageSize, totalItems);
    return `${from}–${to} / ${totalItems.toLocaleString()} kayıt`;
  })();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1 select-none">
      {/* Left: range info */}
      <span className="text-xs text-gray-500">
        {rangeLabel ?? `${page}. sayfa / ${totalPages} sayfa`}
      </span>

      {/* Right: controls */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Onceki sayfa"
          className={`${btnBase} ${page <= 1 ? btnDisabled : btnInactive}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Page number windows */}
        {windows.map((w, i) =>
          w === '...' ? (
            <span key={`ellipsis-${i}`} className="text-xs text-gray-600 px-1">
              ...
            </span>
          ) : (
            <button
              key={w}
              onClick={() => onPageChange(w)}
              aria-label={`Sayfa ${w}`}
              aria-current={w === page ? 'page' : undefined}
              className={`${btnBase} ${w === page ? btnActive : btnInactive}`}
            >
              {w}
            </button>
          ),
        )}

        {/* Next */}
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Sonraki sayfa"
          className={`${btnBase} ${page >= totalPages ? btnDisabled : btnInactive}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
