export const ERROR_MESSAGES: Record<string, string> = {
  ASSIGNMENT_ALREADY_PASSED:
    'This training is already complete — no further action needed.',
  COURSE_NOT_PUBLISHED:
    'This course must be published before it can be assigned.',
  INVALID_PASS_MARK:
    'Pass mark must be a valid percentage between 1 and 100.',
  DEADLINE_IN_PAST:
    'The campaign deadline cannot be in the past.',
  NO_ELIGIBLE_LEARNERS:
    "No eligible learners match this campaign's audience — check the department or employee selection.",
  INVALID_CREDENTIALS:
    'The email or password you entered is incorrect.',
  FORBIDDEN:
    'You do not have permission to perform this action.',
  UNAUTHORIZED:
    'Your session has expired. Please sign in again.',
  NOT_FOUND:
    'The requested resource could not be found.',
  CONFLICT:
    'A conflict occurred with the current state of the resource.',
};

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

let accessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('kaziwise_token', token);
    } else {
      localStorage.removeItem('kaziwise_token');
    }
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('kaziwise_token');
  }
  return accessToken;
}

export function clearAuth() {
  setAccessToken(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kaziwise_user');
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  const url = endpoint.startsWith('http') ? endpoint : `/api/v1${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: options.credentials || 'include',
    });
  } catch (netErr: any) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network connection failure. Please check your connection.');
  }

  // Handle 401 with single refresh-and-retry
  if (res.status === 401) {
    if (!isRetry && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const newToken = data.accessToken;
            setAccessToken(newToken);
            isRefreshing = false;
            refreshSubscribers.forEach((cb) => cb(newToken));
            refreshSubscribers = [];
            return apiFetch<T>(endpoint, options, true);
          } else {
            isRefreshing = false;
            refreshSubscribers = [];
            clearAuth();
            if (typeof window !== 'undefined') {
              window.location.href = '/login?expired=1';
            }
            throw new ApiError(401, 'UNAUTHORIZED', ERROR_MESSAGES.UNAUTHORIZED);
          }
        } catch (e) {
          isRefreshing = false;
          refreshSubscribers = [];
          clearAuth();
          if (typeof window !== 'undefined') {
            window.location.href = '/login?expired=1';
          }
          throw new ApiError(401, 'UNAUTHORIZED', ERROR_MESSAGES.UNAUTHORIZED);
        }
      } else {
        // Wait for active refresh
        return new Promise<T>((resolve, reject) => {
          refreshSubscribers.push((newToken: string) => {
            const retryHeaders = new Headers(options.headers || {});
            retryHeaders.set('Authorization', `Bearer ${newToken}`);
            apiFetch<T>(endpoint, { ...options, headers: retryHeaders }, true)
              .then(resolve)
              .catch(reject);
          });
        });
      }
    } else {
      clearAuth();
      throw new ApiError(401, 'UNAUTHORIZED', ERROR_MESSAGES.UNAUTHORIZED);
    }
  }

  // If response is not ok (4xx, 5xx)
  if (!res.ok) {
    let errBody: any = {};
    try {
      errBody = await res.json();
    } catch {
      errBody = { error: 'HTTP_ERROR', message: res.statusText };
    }

    const code = errBody.error || 'SERVER_ERROR';
    const mappedMessage = ERROR_MESSAGES[code] || errBody.message || 'An unexpected error occurred.';
    throw new ApiError(res.status, code, mappedMessage, errBody.details);
  }

  // Content-Type handling
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }

  if (contentType.includes('application/pdf') || contentType.includes('spreadsheetml') || contentType.includes('csv')) {
    return (await res.blob()) as unknown as T;
  }

  return (await res.text()) as unknown as T;
}
