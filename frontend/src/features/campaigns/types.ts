export type AudienceType = 'ALL_EMPLOYEES' | 'DEPARTMENT' | 'SELECTED_EMPLOYEES';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';

export interface Campaign {
  id: string;
  organisationId: string;
  courseId: string;
  course: {
    id: string;
    title: string;
    courseVersion: number;
    status: string;
  };
  name: string;
  audienceType: AudienceType;
  departmentId?: string | null;
  status: CampaignStatus;
  deadline: string;
  passMark: number;
  certificateEnabled: boolean;
  createdAt: string;
  _count?: {
    assignments: number;
  };
}

export interface CreateCampaignInput {
  courseId: string;
  name: string;
  audienceType: AudienceType;
  departmentId?: string;
  selectedUserIds?: string[];
  deadline: string;
  passMark: number;
  certificateEnabled?: boolean;
}
