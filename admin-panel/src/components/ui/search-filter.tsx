'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export interface SearchFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: FilterConfig[];
  placeholder?: string;
  debounceMs?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchFilter({
  searchValue,
  onSearchChange,
  filters = [],
  placeholder = 'Ara...',
  debounceMs = 300,
}: SearchFilterProps) {
  // Internal raw value for the input (debounced before surfacing to parent)
  const [raw, setRaw] = useState(searchValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync upward after debounce
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearchChange(raw);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  // Keep internal value in sync if parent resets (e.g. after clear)
  useEffect(() => {
    if (searchValue === '' && raw !== '') setRaw('');
    // Only sync on external reset, not on every parent change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  // Escape key clears the input
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setRaw('');
      onSearchChange('');
      inputRef.current?.blur();
    }
  }

  // Checks whether any filter or search has a non-empty value
  const hasActiveFilters =
    raw.trim() !== '' || filters.some((f) => f.value !== '');

  function clearAll() {
    setRaw('');
    onSearchChange('');
    filters.forEach((f) => f.onChange(''));
  }

  const inputClass =
    'bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm ' +
    'focus:outline-none focus:border-amber-500 transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 min-w-48">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-10 pr-9 py-2.5 ${inputClass}`}
          aria-label="Arama"
        />
        {/* Inline clear button (X) */}
        {raw && (
          <button
            onClick={() => {
              setRaw('');
              onSearchChange('');
              inputRef.current?.focus();
            }}
            aria-label="Aramayı temizle"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown filters */}
      {filters.map((filter) => (
        <div key={filter.key} className="flex-shrink-0">
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            aria-label={filter.label}
            className={`py-2.5 pl-3 pr-8 ${inputClass} appearance-none cursor-pointer`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.6rem center',
            }}
          >
            <option value="">{filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Clear all button — only visible when something is active */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-xs font-medium transition-colors flex-shrink-0"
          aria-label="Tum filtreleri temizle"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Temizle
        </button>
      )}
    </div>
  );
}
