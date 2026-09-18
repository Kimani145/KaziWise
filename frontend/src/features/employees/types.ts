import { Role } from '../../lib/permissions';

export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  employeeNumber: string;
  role: Role;
  employmentStatus: 'ACTIVE' | 'INVITED' | 'INACTIVE';
  departmentId: string;
  department: Department;
  managerId?: string | null;
  manager?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CreateEmployeeInput {
  name: string;
  email: string;
  employeeNumber: string;
  departmentId: string;
  role: Role;
  managerId?: string | null;
}

export interface ImportRejectedRow {
  row: number;
  data: Record<string, any>;
  reason: string;
}

export interface ImportReconciliationResult {
  imported: Employee[];
  rejected: ImportRejectedRow[];
}
