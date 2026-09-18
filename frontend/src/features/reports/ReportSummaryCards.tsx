import React from 'react';
import { ReportSummary } from './types';
import { Card, CardContent } from '../../components/ui/card';
import {
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  Award,
  TrendingUp,
} from 'lucide-react';

interface ReportSummaryCardsProps {
  summary: ReportSummary;
}

export function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card>
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-slate-900">{summary.totalAssignments}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Passed</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-emerald-700">{summary.passedCount}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Progress</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-blue-700">{summary.inProgressCount}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overdue</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-amber-700">{summary.overdueCount}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pass Rate</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-slate-900">{summary.completionRate}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Score</span>
            <Award className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-purple-700">{summary.averageScore}%</p>
        </CardContent>
      </Card>
    </div>
  );
}
