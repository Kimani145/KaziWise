import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-keys';
import { getMyCertificates, verifyCertificate } from './api';

export function useMyCertificates() {
  return useQuery({
    queryKey: queryKeys.certificates.myList,
    queryFn: () => getMyCertificates(),
  });
}

export function useVerifyCertificate(code: string) {
  return useQuery({
    queryKey: queryKeys.certificates.verify(code),
    queryFn: () => verifyCertificate(code),
    enabled: Boolean(code),
  });
}
