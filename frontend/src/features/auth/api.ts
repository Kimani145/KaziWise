import { apiFetch, clearAuth, setAccessToken } from '../../lib/api-client';
import { AuthResponse, LoginCredentials, User } from './types';

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  setAccessToken(data.accessToken);
  if (typeof window !== 'undefined') {
    localStorage.setItem('kaziwise_user', JSON.stringify(data.user));
  }
  return data;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } finally {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}

export async function getMe(): Promise<User> {
  return apiFetch<User>('/auth/me');
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}
