import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          aria-invalid={Boolean(error)}
          className={cn(
            'w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:bg-slate-100 disabled:cursor-not-allowed',
            error
              ? 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500'
              : 'border-slate-300 focus-visible:border-emerald-600 focus-visible:ring-emerald-600',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-600 font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
