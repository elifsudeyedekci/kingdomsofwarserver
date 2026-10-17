'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/stat-card';
import { Section } from '@/components/ui/section';

interface Friend {
  id: string;
  username: string;
  createdAt: string;
}

interface PendingRequest {
  id: string;
  fromId: string;
  fromUsername: string;
  toId: string;
  toUsername: string;
  sentAt: string;
}

interface ConfirmRemove {
  type: string;
  id: string;
  label: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function FriendshipsPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState<string>('');
  const [committedPlayerId, setCommittedPlayerId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'friends' | 'pending'>('friends');
  const [confirmRemove, setConfirmRemove] = useState<ConfirmRemove | null>(null);

  const isSearchActive = committedPlayerId.trim().length > 0;

  const friendsQuery = useQuery<Friend[]>({
    queryKey: ['friendships-friends', committedPlayerId],
    queryFn: () =>
      api.get(`/friendship/${committedPlayerId}`).then((r) => r.data).catch(() => []),
    enabled: isSearchActive,
  });

  const pendingQuery = useQuery<PendingRequest[]>({
    queryKey: ['friendships-pending', committedPlayerId],
    queryFn: () =>
      api.get(`/friendship/${committedPlayerId}/pending`).then((r) => r.data).catch(() => []),
    enabled: isSearchActive,
  });

  const countQuery = useQuery<number>({
    queryKey: ['friendships-count', committedPlayerId],
    queryFn: () =>
      api.get(`/friendship/${committedPlayerId}/count`).then((r) => r.data).catch(() => 0),
    enabled: isSearchActive,
  });

  const removeFriendMutation = useMutation({
    mutationFn: (friendId: string) =>
      api.delete(`/friendship/${committedPlayerId}/${friendId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships-friends', committedPlayerId] });
      queryClient.invalidateQueries({ queryKey: ['friendships-count', committedPlayerId] });
      setConfirmRemove(null);
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.delete(`/friendship/${committedPlayerId}/pending/${requestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships-pending', committedPlayerId] });
      setConfirmRemove(null);
    },
  });

  function handleSearch() {
    const trimmed = searchInput.trim();
    if (trimmed) {
      setCommittedPlayerId(trimmed);
      setConfirmRemove(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }

  function handleRemoveFriendClick(friend: Friend) {
    if (confirmRemove?.id === friend.id && confirmRemove?.type === 'friend') {
      removeFriendMutation.mutate(friend.id);
    } else {
      setConfirmRemove({ type: 'friend', id: friend.id, label: friend.username });
    }
  }

  function handleCancelRequestClick(request: PendingRequest) {
    if (confirmRemove?.id === request.id && confirmRemove?.type === 'pending') {
      cancelRequestMutation.mutate(request.id);
    } else {
      setConfirmRemove({ type: 'pending', id: request.id, label: `${request.fromUsername} → ${request.toUsername}` });
    }
  }

  const friends = friendsQuery.data ?? [];
  const pendingRequests = pendingQuery.data ?? [];
  const totalCount = countQuery.data ?? 0;

  return (
    <div className="min-h-screen bg-stone-950 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-amber-500">Arkadaşlık Yönetimi</h1>
        <p className="text-gray-400 text-sm mt-1">
          Oyuncu ID ile arayarak arkadaşlık ilişkilerini yönetin.
        </p>
      </div>

      {/* Player Search */}
      <Section title="Arkadaşlıklar">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-300">Oyuncu ID</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Oyuncu ID girin..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            />
            <button
              onClick={handleSearch}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              Ara
            </button>
          </div>
          {committedPlayerId && (
            <p className="text-xs text-gray-500">
              Aktif oyuncu: <span className="text-amber-400 font-mono">{committedPlayerId}</span>
            </p>
          )}
        </div>
      </Section>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Toplam Arkadaş"
          value={isSearchActive ? (countQuery.isLoading ? '...' : String(totalCount)) : '—'}
        />
        <StatCard
          label="Bekleyen İstekler"
          value={isSearchActive ? (pendingQuery.isLoading ? '...' : String(pendingRequests.length)) : '—'}
        />
        <StatCard
          label="Engellenen"
          value="—"
        />
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setActiveTab('friends');
            setConfirmRemove(null);
          }}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'friends'
              ? 'bg-amber-500 text-stone-950'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Arkadaşlar
          {isSearchActive && !friendsQuery.isLoading && (
            <span className="ml-2 text-xs opacity-75">({friends.length})</span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('pending');
            setConfirmRemove(null);
          }}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-stone-950'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Bekleyenler
          {isSearchActive && !pendingQuery.isLoading && pendingRequests.length > 0 && (
            <span className="ml-2 text-xs opacity-75">({pendingRequests.length})</span>
          )}
        </button>
      </div>

      {/* Content Area */}
      {!isSearchActive ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-500">Arkadaşlık verilerini görüntülemek için bir oyuncu ID girin.</p>
        </div>
      ) : (
        <>
          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <Section title="Bekleyen istekler">
              {friendsQuery.isLoading ? (
                <div className="text-center py-10 text-gray-500">Yükleniyor...</div>
              ) : friendsQuery.isError && friends.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Veri alınamadı.</div>
              ) : friends.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Bu oyuncunun arkadaşı yok.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-left">
                        <th className="pb-3 pr-4 font-medium">Kullanıcı Adı</th>
                        <th className="pb-3 pr-4 font-medium">Arkadaşlık Tarihi</th>
                        <th className="pb-3 font-medium">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {friends.map((friend) => (
                        <tr key={friend.id} className="hover:bg-gray-800/40 transition-colors">
                          <td className="py-3 pr-4">
                            <span className="font-medium text-gray-100">{friend.username}</span>
                            <span className="block text-xs text-gray-500 font-mono">{friend.id}</span>
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            {formatDate(friend.createdAt)}
                          </td>
                          <td className="py-3">
                            {confirmRemove?.id === friend.id && confirmRemove?.type === 'friend' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-amber-400 font-medium">Emin misin?</span>
                                <button
                                  onClick={() => handleRemoveFriendClick(friend)}
                                  disabled={removeFriendMutation.isPending}
                                  className="text-xs bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1 rounded transition-colors"
                                >
                                  {removeFriendMutation.isPending ? 'Siliniyor...' : 'Evet, Sil'}
                                </button>
                                <button
                                  onClick={() => setConfirmRemove(null)}
                                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors"
                                >
                                  İptal
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRemoveFriendClick(friend)}
                                className="text-xs bg-gray-800 hover:bg-red-900/50 border border-gray-700 hover:border-red-700 text-gray-300 hover:text-red-300 px-3 py-1 rounded transition-colors"
                              >
                                Arkadaşlıktan Çıkar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {/* Pending Tab */}
          {activeTab === 'pending' && (
            <Section title="Engellenenler">
              {pendingQuery.isLoading ? (
                <div className="text-center py-10 text-gray-500">Yükleniyor...</div>
              ) : pendingQuery.isError && pendingRequests.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Veri alınamadı.</div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Bekleyen arkadaşlık isteği yok.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-left">
                        <th className="pb-3 pr-4 font-medium">Gönderen</th>
                        <th className="pb-3 pr-4 font-medium">Alıcı</th>
                        <th className="pb-3 pr-4 font-medium">Tarih</th>
                        <th className="pb-3 font-medium">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {pendingRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-800/40 transition-colors">
                          <td className="py-3 pr-4">
                            <span className="font-medium text-gray-100">{request.fromUsername}</span>
                            <span className="block text-xs text-gray-500 font-mono">{request.fromId}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="font-medium text-gray-100">{request.toUsername}</span>
                            <span className="block text-xs text-gray-500 font-mono">{request.toId}</span>
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            {formatDate(request.sentAt)}
                          </td>
                          <td className="py-3">
                            {confirmRemove?.id === request.id && confirmRemove?.type === 'pending' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-amber-400 font-medium">Emin misin?</span>
                                <button
                                  onClick={() => handleCancelRequestClick(request)}
                                  disabled={cancelRequestMutation.isPending}
                                  className="text-xs bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1 rounded transition-colors"
                                >
                                  {cancelRequestMutation.isPending ? 'İptal ediliyor...' : 'Evet, İptal Et'}
                                </button>
                                <button
                                  onClick={() => setConfirmRemove(null)}
                                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors"
                                >
                                  Vazgeç
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleCancelRequestClick(request)}
                                className="text-xs bg-gray-800 hover:bg-red-900/50 border border-gray-700 hover:border-red-700 text-gray-300 hover:text-red-300 px-3 py-1 rounded transition-colors"
                              >
                                İsteği İptal Et
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
