import { apiFetch } from '../../lib/api-client';
import { Course, CreateCourseInput } from './types';

export async function listCourses(): Promise<Course[]> {
  return apiFetch<Course[]>('/courses');
}

export async function getCourse(id: string): Promise<Course> {
  return apiFetch<Course>(`/courses/${id}`);
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  return apiFetch<Course>('/courses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCourse(id: string, input: Partial<CreateCourseInput>): Promise<Course> {
  return apiFetch<Course>(`/courses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteCourse(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/courses/${id}`, {
    method: 'DELETE',
  });
}

export async function publishCourse(id: string): Promise<Course> {
  return apiFetch<Course>(`/courses/${id}/publish`, {
    method: 'POST',
  });
}
