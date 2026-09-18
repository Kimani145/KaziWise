'use client';

import React, { useState, useRef } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import {
  useEmployees,
  useDepartments,
  useDeactivateEmployee,
  useImportEmployeesCsv,
} from '../../features/employees/hooks';
import { EmployeeModal } from '../../features/employees/EmployeeModal';
import { ReconciliationModal } from '../../features/employees/ReconciliationModal';
import { ImportReconciliationResult } from '../../features/employees/types';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { EmptyState } from '../../components/feedback/EmptyState';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import {
  UserPlus,
  Upload,
  Search,
  Users,
  UserX,
  Building,
} from 'lucide-react';

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reconciliationResult, setReconciliationResult] =
    useState<ImportReconciliationResult | null>(null);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const employeesQuery = useEmployees({
    search: searchTerm || undefined,
    departmentId: selectedDept || undefined,
  });

  const departmentsQuery = useDepartments();
  const deactivateMutation = useDeactivateEmployee();
  const importMutation = useImportEmployeesCsv();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const res = await importMutation.mutateAsync(text);
          setReconciliationResult(res);
          setIsReconciliationOpen(true);
        } catch (err: any) {
          alert(err.message || 'Import failed');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const employees = employeesQuery.data || [];
  const departments = departmentsQuery.data || [];

  return (
    <AppShell requiredAction="manageEmployees">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Employee Directory
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage organization workforce, departmental assignments, and RBAC roles.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />
            <Button
              variant="outline"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              isLoading={importMutation.isPending}
              className="min-h-[44px]"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddModalOpen(true)}
              className="min-h-[44px]"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by name, email, or employee number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 min-h-[44px]"
            />
          </div>

          <div className="w-full sm:w-64">
            <Select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              options={[
                { value: '', label: 'All Departments' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
              className="min-h-[44px]"
            />
          </div>
        </div>

        {/* Data View */}
        {employeesQuery.isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : employeesQuery.isError ? (
          <ErrorState
            title="Failed to load employee directory"
            message="Could not load employees from the server."
            onRetry={() => employeesQuery.refetch()}
          />
        ) : employees.length === 0 ? (
          <EmptyState
            title="No employees found"
            description={
              searchTerm || selectedDept
                ? 'No employee records match your search criteria.'
                : 'No employees have been added to your organization yet.'
            }
            icon={<Users className="w-8 h-8 text-slate-400" />}
            action={
              searchTerm || selectedDept
                ? {
                    label: 'Clear Filters',
                    onClick: () => {
                      setSearchTerm('');
                      setSelectedDept('');
                    },
                  }
                : {
                    label: 'Add First Employee',
                    onClick: () => setIsAddModalOpen(true),
                  }
            }
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">ID Number</th>
                    <th className="p-4">Department</th>
                    <th className="p-4">System Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900">{emp.name}</p>
                        <p className="text-slate-500 text-[11px]">{emp.email}</p>
                      </td>
                      <td className="p-4 font-mono text-slate-700">
                        {emp.employeeNumber}
                      </td>
                      <td className="p-4 text-slate-700">
                        {emp.department?.name || '—'}
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={
                            emp.role === 'ORG_ADMIN'
                              ? 'primary'
                              : emp.role === 'MANAGER'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {emp.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={emp.employmentStatus === 'ACTIVE' ? 'success' : 'neutral'}
                        >
                          {emp.employmentStatus}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        {emp.employmentStatus === 'ACTIVE' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Deactivate ${emp.name}?`)) {
                                deactivateMutation.mutate(emp.id);
                              }
                            }}
                            isLoading={deactivateMutation.isPending}
                            className="min-h-[44px] text-slate-600 hover:text-red-700"
                          >
                            <UserX className="w-3.5 h-3.5 mr-1" />
                            Deactivate
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Employee Modal */}
        <EmployeeModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />

        {/* Reconciliation Modal */}
        <ReconciliationModal
          isOpen={isReconciliationOpen}
          onClose={() => {
            setIsReconciliationOpen(false);
            setReconciliationResult(null);
          }}
          result={reconciliationResult}
        />
      </div>
    </AppShell>
  );
}
