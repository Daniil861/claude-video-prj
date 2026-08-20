import { ApiError, apiFetch } from '@/lib/api';
import type { MeetingsPage, User } from '@/lib/types';

export const RECENT_MEETINGS_LIMIT = 3;

export type DashboardResult =
  | { status: 'ok'; user: User; meetings: MeetingsPage }
  | { status: 'unauthorized' }
  | { status: 'unavailable'; message: string };

/** Loads everything the home page needs in one round of parallel requests. */
export async function loadDashboard(token: string): Promise<DashboardResult> {
  try {
    const [user, meetings] = await Promise.all([
      apiFetch<User>('/auth/me', { token }),
      apiFetch<MeetingsPage>(`/meetings?limit=${RECENT_MEETINGS_LIMIT}`, { token }),
    ]);

    return { status: 'ok', user, meetings };
  } catch (error) {
    if (error instanceof ApiError) {
      return error.status === 401
        ? { status: 'unauthorized' }
        : { status: 'unavailable', message: error.message };
    }

    throw error;
  }
}
