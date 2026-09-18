import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-keys';
import {
  createEmployee,
  deactivateEmployee,
  importEmployeesCsv,
  importEmployeesXlsx,
  listDepartments,
  listEmployees,
} from './api';
import { CreateEmployeeInput } from './types';

export function useEmployees(params?: {
  search?: string;
  departmentId?: string;
  role?: string;
}) {
  return useQuery({
    queryKey: queryKeys.employees.list(params),
    queryFn: () => listEmployees(params),
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: queryKeys.departments.all,
    queryFn: () => listDepartments(),
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => createEmployee(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
  });
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
  });
}

export function useImportEmployeesCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (csvContent: string) => importEmployeesCsv(csvContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
  });
}

export function useImportEmployeesXlsx() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (base64Data: string) => importEmployeesXlsx(base64Data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
  });
}
