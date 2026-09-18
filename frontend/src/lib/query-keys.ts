export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  employees: {
    all: ['employees'] as const,
    list: (params?: Record<string, any>) => ['employees', 'list', params] as const,
    detail: (id: string) => ['employees', 'detail', id] as const,
  },
  departments: {
    all: ['departments'] as const,
  },
  courses: {
    all: ['courses'] as const,
    list: ['courses', 'list'] as const,
    detail: (id: string) => ['courses', 'detail', id] as const,
  },
  campaigns: {
    all: ['campaigns'] as const,
    list: ['campaigns', 'list'] as const,
    detail: (id: string) => ['campaigns', 'detail', id] as const,
  },
  assignments: {
    all: ['assignments'] as const,
    myList: ['assignments', 'my-list'] as const,
    detail: (assignmentId: string) => ['assignments', 'detail', assignmentId] as const,
    assessment: (assignmentId: string) => ['assignments', 'assessment', assignmentId] as const,
    blockUrl: (assignmentId: string, blockId: string) => ['assignments', 'blockUrl', assignmentId, blockId] as const,
  },
  certificates: {
    all: ['certificates'] as const,
    myList: ['certificates', 'my-list'] as const,
    verify: (code: string) => ['certificates', 'verify', code] as const,
  },
  reports: {
    all: ['reports'] as const,
    assignments: (filters?: Record<string, any>) => ['reports', 'assignments', filters] as const,
  },
  audit: {
    all: ['audit'] as const,
    list: (limit?: number) => ['audit', 'list', limit] as const,
  },
} as const;
