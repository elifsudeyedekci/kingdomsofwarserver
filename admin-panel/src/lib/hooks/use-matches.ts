'use client';
import { useState, useEffect } from 'react';
import { apiGet } from '../api-client';
import { useSession } from 'next-auth/react';

export interface Match {
  id: string;
  mode: string;
  status: string;
  playerCount: number;
  startedAt: string | null;
  endedAt: string | null;
  durationTicks: number | null;
}

export interface MatchesResponse {
  data: Match[];
  total: number;
  page: number;
  limit: number;
}

export function useMatches(page = 1, limit = 20, status = '') {
  const { data: session } = useSession();
  const [matches, setMatches] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    const token = (session as { accessToken?: string }).accessToken;
    const query = status
      ? `/matches?page=${page}&limit=${limit}&status=${status}`
      : `/matches?page=${page}&limit=${limit}`;
    apiGet<MatchesResponse>(query, token)
      .then(setMatches)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session, page, limit, status]);

  return { matches, loading, error };
}
