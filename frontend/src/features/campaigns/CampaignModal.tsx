import React, { useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { FormField } from '../../components/forms/FormField';
import { AudienceType } from './types';
import { useCreateCampaign, useLaunchCampaign } from './hooks';
import { useCourses } from '../courses/hooks';
import { useDepartments, useEmployees } from '../employees/hooks';
import { AlertCircle, Rocket, FileText } from 'lucide-react';

interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CampaignModal({ isOpen, onClose }: CampaignModalProps) {
  const [courseId, setCourseId] = useState('');
  const [name, setName] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceType>('ALL_EMPLOYEES');
  const [departmentId, setDepartmentId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [passMark, setPassMark] = useState<number>(80);
  const [certificateEnabled, setCertificateEnabled] = useState(false);
  const [formError, setFormError] = useState('');

  const { data: courses = [] } = useCourses();
  const { data: departments = [] } = useDepartments();
  const { data: employees = [] } = useEmployees();

  const createMutation = useCreateCampaign();
  const launchMutation = useLaunchCampaign();

  // Minimum allowed date is today (FR-012: cannot be in the past)
  const todayDate = new Date().toISOString().split('T')[0];

  const handleCourseChange = (selectedId: string) => {
    setCourseId(selectedId);
    const chosen = courses.find((c) => c.id === selectedId);
    if (chosen) {
      setCertificateEnabled(chosen.certificateEnabled);
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const validate = (): boolean => {
    if (!courseId) {
      setFormError('Please select a course.');
      return false;
    }
    const chosen = courses.find((c) => c.id === courseId);
    if (chosen && chosen.status !== 'PUBLISHED') {
      setFormError('This course must be published before it can be assigned.');
      return false;
    }
    if (!name.trim()) {
      setFormError('Please provide a campaign name.');
      return false;
    }
    if (!deadline) {
      setFormError('Please select a valid deadline date.');
      return false;
    }
    if (new Date(deadline) < new Date(new Date().setHours(0, 0, 0, 0))) {
      setFormError('The campaign deadline cannot be in the past.');
      return false;
    }
    if (isNaN(passMark) || passMark < 1 || passMark > 100) {
      setFormError('Pass mark must be a valid percentage between 1 and 100.');
      return false;
    }
    if (audienceType === 'DEPARTMENT' && !departmentId) {
      setFormError('Please select a target department.');
      return false;
    }
    if (audienceType === 'SELECTED_EMPLOYEES' && selectedUserIds.length === 0) {
      setFormError('Please select at least one employee for this targeted campaign.');
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    setFormError('');
    if (!validate()) return;

    try {
      await createMutation.mutateAsync({
        courseId,
        name,
        audienceType,
        departmentId: audienceType === 'DEPARTMENT' ? departmentId : undefined,
        selectedUserIds: audienceType === 'SELECTED_EMPLOYEES' ? selectedUserIds : undefined,
        deadline: new Date(deadline).toISOString(),
        passMark: Number(passMark),
        certificateEnabled,
      });
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save campaign draft');
    }
  };

  const handleLaunchImmediately = async () => {
    setFormError('');
    if (!validate()) return;

    try {
      // 1. Create campaign
      const created = await createMutation.mutateAsync({
        courseId,
        name,
        audienceType,
        departmentId: audienceType === 'DEPARTMENT' ? departmentId : undefined,
        selectedUserIds: audienceType === 'SELECTED_EMPLOYEES' ? selectedUserIds : undefined,
        deadline: new Date(deadline).toISOString(),
        passMark: Number(passMark),
        certificateEnabled,
      });

      // 2. Launch campaign immediately (generates assignments for eligible learners)
      const launchResult = await launchMutation.mutateAsync(created.id);
      alert(`Campaign launched successfully! Created ${launchResult.assignmentsCreated} learner assignments.`);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to launch campaign');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create Training Campaign"
      description="Define course eligibility, target audience, deadline, and pass mark."
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <FormField label="Select Course" htmlFor="camp-course" required>
          <Select
            id="camp-course"
            value={courseId}
            onChange={(e) => handleCourseChange(e.target.value)}
            required
          >
            <option value="">Choose course...</option>
            {courses.map((c) => (
              <option
                key={c.id}
                value={c.id}
                disabled={c.status !== 'PUBLISHED'}
              >
                {c.title} ({c.status})
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Campaign Name" htmlFor="camp-name" required>
          <Input
            id="camp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 2026 Mandatory Security Refresh"
            required
          />
        </FormField>

        <FormField label="Target Audience Type" htmlFor="camp-audience" required>
          <Select
            id="camp-audience"
            value={audienceType}
            onChange={(e) => setAudienceType(e.target.value as AudienceType)}
            required
          >
            <option value="ALL_EMPLOYEES">All Employees in Organisation</option>
            <option value="DEPARTMENT">Specific Department</option>
            <option value="SELECTED_EMPLOYEES">Specific Selected Employees</option>
          </Select>
        </FormField>

        {/* Dynamic Audience Field: DEPARTMENT */}
        {audienceType === 'DEPARTMENT' && (
          <FormField label="Target Department" htmlFor="camp-dept" required>
            <Select
              id="camp-dept"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              required
            >
              <option value="">Select target department...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        {/* Dynamic Audience Field: SELECTED_EMPLOYEES */}
        {audienceType === 'SELECTED_EMPLOYEES' && (
          <FormField
            label="Select Eligible Employees"
            hint={`${selectedUserIds.length} selected`}
            required
          >
            <div className="border border-slate-200 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/50">
              {employees.length === 0 ? (
                <p className="text-xs text-slate-400 p-2">No active employees found.</p>
              ) : (
                employees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 p-2 rounded bg-white border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(emp.id)}
                      onChange={() => handleToggleUser(emp.id)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{emp.name}</p>
                      <p className="text-slate-500">{emp.email} • {emp.department?.name || 'N/A'}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </FormField>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Deadline Date" htmlFor="camp-deadline" required>
            <Input
              id="camp-deadline"
              type="date"
              min={todayDate}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Pass Mark (1–100 %)" htmlFor="camp-passmark" required>
            <Input
              id="camp-passmark"
              type="number"
              min={1}
              max={100}
              value={passMark}
              onChange={(e) => setPassMark(Number(e.target.value))}
              required
            />
          </FormField>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={certificateEnabled}
              onChange={(e) => setCertificateEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">Issue Certificates upon Passing</p>
              <p className="text-xs text-slate-500">
                Learners who score above the pass mark will be issued an immutable digital certificate with a verification code.
              </p>
            </div>
          </label>
        </div>

        {/* Clear Notice about Draft vs Launch */}
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
          <p className="font-bold">Draft vs. Launch:</p>
          <p>
            <strong>Save as Draft:</strong> Saves campaign parameters. <em>Zero learner assignments are created.</em>
          </p>
          <p>
            <strong>Launch Campaign:</strong> Immediately creates active assignments for all matching learners and notifies them.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveDraft}
            isLoading={createMutation.isPending && !launchMutation.isPending}
          >
            <FileText className="w-4 h-4 mr-2" />
            Save as Draft (0 assignments)
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleLaunchImmediately}
            isLoading={createMutation.isPending || launchMutation.isPending}
          >
            <Rocket className="w-4 h-4 mr-2" />
            Launch Immediately
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
