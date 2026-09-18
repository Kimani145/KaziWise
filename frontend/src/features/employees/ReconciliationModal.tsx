import React from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { ImportReconciliationResult } from './types';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ImportReconciliationResult | null;
}

export function ReconciliationModal({
  isOpen,
  onClose,
  result,
}: ReconciliationModalProps) {
  if (!result) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Employee Import Reconciliation Report"
      description="Review successfully imported employee records and rejected rows requiring corrections."
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Metric Summaries */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Successfully Imported</p>
              <p className="text-2xl font-bold text-emerald-900">{result.imported.length}</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-700">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wider">Rejected Rows</p>
              <p className="text-2xl font-bold text-red-900">{result.rejected.length}</p>
            </div>
          </div>
        </div>

        {/* Rejected rows breakdown */}
        {result.rejected.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-800">
              Rejected Rows & Actionable Reasons
            </h4>
            <div className="border border-red-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-red-100/75 text-red-900 font-semibold border-b border-red-200">
                  <tr>
                    <th className="p-3 w-16">Row #</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100 bg-red-50/30">
                  {result.rejected.map((item, idx) => (
                    <tr key={idx} className="hover:bg-red-50/70">
                      <td className="p-3 font-semibold text-red-900">{item.row}</td>
                      <td className="p-3 text-slate-700 font-mono text-[11px]">
                        {JSON.stringify(item.data)}
                      </td>
                      <td className="p-3 font-medium text-red-700">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Imported records list */}
        {result.imported.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Successfully Imported Employees
            </h4>
            <div className="border border-emerald-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-emerald-100/75 text-emerald-900 font-semibold border-b border-emerald-200">
                  <tr>
                    <th className="p-3">Emp #</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 bg-white">
                  {result.imported.map((emp) => (
                    <tr key={emp.id} className="hover:bg-emerald-50/40">
                      <td className="p-3 font-mono">{emp.employeeNumber}</td>
                      <td className="p-3 font-medium text-slate-900">{emp.name}</td>
                      <td className="p-3 text-slate-600">{emp.email}</td>
                      <td className="p-3 text-slate-600">{emp.department?.name || 'N/A'}</td>
                      <td className="p-3 font-semibold text-slate-700">{emp.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
