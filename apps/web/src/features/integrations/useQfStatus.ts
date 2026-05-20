import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';

export interface QfStatus {
  connected: boolean;
  expires_at?: string;
  scope?: string | null;
}

export const QF_STATUS_KEY = ['qf-auth-status'] as const;

export function useQfStatus() {
  return useQuery({
    queryKey: QF_STATUS_KEY,
    queryFn: () => apiFetch<QfStatus>('/api/qf-auth/status'),
    staleTime: 60_000,
  });
}

export function useInvalidateQfStatus() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: QF_STATUS_KEY });
}

export async function startQfConnect(): Promise<void> {
  const res = await apiFetch<{ url: string }>('/api/qf-auth/authorize', {
    method: 'POST',
  });
  window.location.href = res.url;
}

export async function disconnectQf(): Promise<void> {
  await apiFetch<{ ok: true }>('/api/qf-auth/disconnect', { method: 'POST' });
}

export function getScopeChips(scope: string | null | undefined): string[] {
  if (!scope) return [];
  const tokens = scope.split(/\s+/).filter(Boolean);
  const friendly: Record<string, string> = {
    bookmark: 'Bookmarks',
    goal: 'Goals',
    'streak.read': 'Streak',
    'reading_session.create': 'Reading Sessions',
    profile: 'Profile',
  };
  const chips = new Set<string>();
  for (const t of tokens) {
    const label = friendly[t];
    if (label) chips.add(label);
  }
  return Array.from(chips);
}
