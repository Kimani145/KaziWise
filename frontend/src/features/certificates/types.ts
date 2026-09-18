export interface Certificate {
  id: string;
  assignmentId: string;
  userId: string;
  courseId: string;
  courseTitle?: string;
  courseVersion: number;
  score: number;
  certificateNumber: string;
  verificationCode: string;
  completionDate: string;
  completedLate: boolean;
  assignment?: {
    campaign?: {
      name: string;
      course?: {
        title: string;
        description: string;
      };
    };
  };
}

export interface PublicVerificationResult {
  valid: boolean;
  certificateNumber: string;
  learnerName: string;
  courseTitle: string;
  completionDate: string;
  completedLate: boolean;
  message?: string;
}
