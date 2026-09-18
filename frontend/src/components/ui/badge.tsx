import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'neutral'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'purple';
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    primary: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'PASSED':
      return <Badge variant="success">Passed</Badge>;
    case 'COMPLETED':
      return <Badge variant="info">Completed</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="warning">In Progress</Badge>;
    case 'STARTED':
      return <Badge variant="purple">Started</Badge>;
    case 'ASSIGNED':
      return <Badge variant="default">Assigned</Badge>;
    case 'FAILED':
      return <Badge variant="danger">Failed</Badge>;
    case 'PUBLISHED':
      return <Badge variant="success">Published</Badge>;
    case 'DRAFT':
      return <Badge variant="default">Draft</Badge>;
    case 'ACTIVE':
      return <Badge variant="success">Active</Badge>;
    case 'INVITED':
      return <Badge variant="warning">Invited</Badge>;
    case 'INACTIVE':
      return <Badge variant="danger">Inactive</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}
