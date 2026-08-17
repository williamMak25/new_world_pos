"use client";

import { SelectHTMLAttributes, forwardRef, useId } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className = "", id, children, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-xs font-medium text-gray-600">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-9 text-sm text-gray-900 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 ${
            error
              ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/30"
              : "border-gray-300 focus:border-brand-500 focus:ring-brand-500/30"
          }`}
          {...props}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
});
