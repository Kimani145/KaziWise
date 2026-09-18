export type CourseStatus = 'DRAFT' | 'PUBLISHED';
export type ContentType = 'TEXT' | 'VIDEO' | 'IMAGE' | 'PDF';

export interface ContentBlock {
  id: string;
  lessonId: string;
  type: ContentType;
  title: string;
  body: string;
  order: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  required: boolean;
  blocks?: ContentBlock[];
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  order: number;
  lessons?: Lesson[];
}

export interface Option {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  courseId: string;
  text: string;
  order: number;
  options: Option[];
}

export interface Course {
  id: string;
  organisationId: string;
  title: string;
  description: string;
  estimatedDuration?: string | null;
  status: CourseStatus;
  certificateEnabled: boolean;
  courseVersion: number;
  createdAt: string;
  updatedAt: string;
  modules?: Module[];
  questions?: Question[];
  _count?: {
    modules: number;
    campaigns: number;
  };
}

export interface CreateCourseInput {
  title: string;
  description?: string;
  estimatedDuration?: string;
  certificateEnabled?: boolean;
}
