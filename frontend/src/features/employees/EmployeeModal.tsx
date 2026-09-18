import React, { useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { FormField } from '../../components/forms/FormField';
import { useCreateEmployee, useDepartments } from './hooks';
import { Role } from '../../lib/permissions';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmployeeModal({ isOpen, onClose }: EmployeeModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [role, setRole] = useState<Role>('LEARNER');
  const [formError, setFormError] = useState('');

  const { data: departments = [] } = useDepartments();
  const createMutation = useCreateEmployee();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name || !email || !employeeNumber || !departmentId) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        name,
        email,
        employeeNumber,
        departmentId,
        role,
      });
      // Reset & close
      setName('');
      setEmail('');
      setEmployeeNumber('');
      setDepartmentId('');
      setRole('LEARNER');
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create employee');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Employee"
      description="Create a new employee profile with initial organizational department and assigned role."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium" role="alert">
            {formError}
          </div>
        )}

        <FormField label="Full Name" htmlFor="emp-name" required>
          <Input
            id="emp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Doe"
            required
          />
        </FormField>

        <FormField label="Work Email" htmlFor="emp-email" required>
          <Input
            id="emp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane.doe@company.com"
            required
          />
        </FormField>

        <FormField label="Employee Number" htmlFor="emp-num" required>
          <Input
            id="emp-num"
            value={employeeNumber}
            onChange={(e) => setEmployeeNumber(e.target.value)}
            placeholder="e.g. EMP-1049"
            required
          />
        </FormField>

        <FormField label="Department" htmlFor="emp-dept" required>
          <Select
            id="emp-dept"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            required
          >
            <option value="">Select department...</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Role Assignment" htmlFor="emp-role" required>
          <Select
            id="emp-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            required
          >
            <option value="LEARNER">Learner</option>
            <option value="MANAGER">Manager</option>
            <option value="ORG_ADMIN">Organisation Admin</option>
          </Select>
        </FormField>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
            Create Employee
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
