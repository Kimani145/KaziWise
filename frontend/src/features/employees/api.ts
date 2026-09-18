import { apiFetch } from '../../lib/api-client';
import {
  CreateEmployeeInput,
  Department,
  Employee,
  ImportReconciliationResult,
} from './types';

export async function listEmployees(params?: {
  search?: string;
  departmentId?: string;
  role?: string;
}): Promise<Employee[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.departmentId) query.set('departmentId', params.departmentId);
  if (params?.role) query.set('role', params.role);
  const qStr = query.toString();
  return apiFetch<Employee[]>(`/employees${qStr ? `?${qStr}` : ''}`);
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  return apiFetch<Employee>('/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deactivateEmployee(id: string): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${id}/deactivate`, {
    method: 'PATCH',
  });
}

export async function importEmployeesCsv(csvContent: string): Promise<ImportReconciliationResult> {
  return apiFetch<ImportReconciliationResult>('/employees/import', {
    method: 'POST',
    body: JSON.stringify({ csvContent }),
  });
}

export async function importEmployeesXlsx(base64Data: string): Promise<ImportReconciliationResult> {
  return apiFetch<ImportReconciliationResult>('/employees/import', {
    method: 'POST',
    body: JSON.stringify({ format: 'xlsx', base64Data }),
  });
}

export async function listDepartments(): Promise<Department[]> {
  return apiFetch<Department[]>('/departments');
}
