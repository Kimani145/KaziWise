export interface ReportSummary {
  totalAssignments: number;
  passedCount: number;
  failedCount: number;
  inProgressCount: number;
  assignedCount: number;
  completedCount: number;
  overdueCount: number;
  completionRate: number;
  averageScore: number;
}

export interface ReportRow {
  id: string;
  learnerId: string;
  learnerName: string;
  learnerEmail: string;
  employeeNumber: string;
  departmentName: string;
  managerName: string | null;
  campaignId: string;
  campaignName: string;
  courseTitle: string;
  status: string;
  deadline: string;
  isOverdue: boolean;
  score: number | null;
  passMark: number;
  attemptsCount: number;
  certificateNumber: string | null;
  completionDate: string | null;
  completedLate: boolean;
}

export interface AssignmentsReportData {
  summary: ReportSummary;
  rows: ReportRow[];
}

export interface ReportFilterParams {
  campaignId?: string;
  departmentId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  isOverdue?: boolean;
}
