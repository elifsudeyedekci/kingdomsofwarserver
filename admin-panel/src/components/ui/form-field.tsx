// No 'use client' needed — this is a pure presentational wrapper with no hooks.
// The consuming page/component that holds form state will have 'use client'.

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  /** Optional id passed to the wrapping <div>; useful for aria-describedby */
  id?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Wraps any form input (input, select, textarea, custom) with:
 *  - A styled label
 *  - Optional required asterisk
 *  - Optional hint text
 *  - Error message with red styling
 *
 * The error state is communicated to the child via a CSS data attribute on the
 * wrapper so that child elements can target it with Tailwind's group-* utilities
 * if needed:  <div data-error="true" ...>
 *
 * Usage example:
 *   <FormField label="E-posta" required error={errors.email} hint="Admin hesabı için kurumsal e-posta girin">
 *     <input ... />
 *   </FormField>
 */
export function FormField({
  label,
  error,
  required,
  children,
  hint,
  id,
}: FormFieldProps) {
  const hasError = Boolean(error);

  return (
    <div
      className="flex flex-col gap-1.5"
      id={id}
      data-error={hasError ? 'true' : undefined}
    >
      {/* Label row */}
      <label className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
        {label}
        {required && (
          <span className="text-red-400 leading-none" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {/*
       * Child wrapper — applies a red ring when there is an error.
       * We use a <div> with CSS custom-property overrides so the actual input
       * inside can keep its own `focus:border-amber-500` rule; the red ring
       * sits one layer outside it.
       */}
      <div
        className={[
          'rounded-xl transition-shadow',
          hasError
            ? 'ring-1 ring-red-500/70 ring-offset-0'
            : '',
        ].join(' ')}
      >
        {children}
      </div>

      {/* Hint text — only shown when there is no error (error replaces it) */}
      {hint && !hasError && (
        <p className="text-xs text-gray-500 leading-snug">{hint}</p>
      )}

      {/* Error message */}
      {hasError && (
        <p className="flex items-center gap-1 text-xs text-red-400 leading-snug" role="alert">
          <svg
            className="w-3 h-3 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
