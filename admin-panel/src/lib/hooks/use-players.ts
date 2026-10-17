'use client';
import { useState, useEffect } from 'react';
import { apiGet } from '../api-client';
import { useSession } from 'next-auth/react';

export interface Player {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  isBanned: boolean;
  createdAt: string;
  profile?: { mmr: number; level: number; gems: number; gold: number };
}

export interface PlayersResponse {
  data: Player[];
  total: number;
  page: number;
  limit: number;
}

export function usePlayers(page = 1, limit = 20, search = '') {
  const { data: session } = useSession();
  const [players, setPlayers] = useState<PlayersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    const token = (session as { accessToken?: string }).accessToken;
    apiGet<PlayersResponse>(`/players?page=${page}&limit=${limit}&search=${search}`, token)
      .then(setPlayers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session, page, limit, search]);

  return { players, loading, error };
}
