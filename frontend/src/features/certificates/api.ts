import { apiFetch } from '../../lib/api-client';
import { Certificate, PublicVerificationResult } from './types';

export async function getMyCertificates(): Promise<Certificate[]> {
  return apiFetch<Certificate[]>('/me/certificates');
}

export async function verifyCertificate(code: string): Promise<PublicVerificationResult> {
  return apiFetch<PublicVerificationResult>(`/certificates/${code}/verify`);
}
