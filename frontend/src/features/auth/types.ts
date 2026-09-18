import { Role } from '../../lib/permissions';

export interface User {
  id: string;
  organisationId: string;
  name: string;
  email: string;
  employeeNumber: string;
  role: Role;
  departmentId: string;
  managerId?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
