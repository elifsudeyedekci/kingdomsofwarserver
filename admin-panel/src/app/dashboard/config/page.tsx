'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Section } from '@/components/ui/section';
import { Badge } from '@/components/ui/badge';
import { PageSpinner, Spinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

type FlagType = 'bool' | 'string' | 'number' | 'json';

interface FeatureFlag {
  key: string;
  description: string;
  value: string;
  type: FlagType;
  updatedAt: string;
  updatedBy: string;
}

interface MasterDataEntity {
  entity: string;
  label: string;
  version: number;
  lastPublished: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeBadgeVariant(t: FlagType): 'blue' | 'green' | 'amber' | 'gray' {
  if (t === 'bool')   return 'green';
  if (t === 'number') return 'blue';
  if (t === 'string') return 'amber';
  return 'gray';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${checked ? 'bg-amber-600' : 'bg-gray-700'}`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

// ─── Inline value editor ──────────────────────────────────────────────────────

function ValueEditor({
  flag,
  onCommit,
}: {
  flag: FeatureFlag;
  onCommit: (key: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(flag.value);

  if (flag.type === 'bool') {
    return (
      <Toggle
        checked={flag.value === 'true'}
        onChange={(v) => onCommit(flag.key, String(v))}
      />
    );
  }

  function handleBlur() {
    if (draft !== flag.value) onCommit(flag.key, draft);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') (e.target as HTMLElement).blur();
    if (e.key === 'Escape') { setDraft(flag.value); (e.target as HTMLElement).blur(); }
  }

  if (flag.type === 'number') {
    return (
      <input
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono text-right focus:outline-none focus:border-amber-500"
      />
    );
  }

  // string / json
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={flag.type === 'json' ? '{}' : '—'}
      className="w-36 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
    />
  );
}

// ─── Feature Flags table ──────────────────────────────────────────────────────

function FeatureFlagsTable({
  flags,
  onCommit,
}: {
  flags: FeatureFlag[];
  onCommit: (key: string, value: string) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-5 -mb-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
            <th className="text-left px-5 py-2">Key</th>
            <th className="text-left px-3 py-2 hidden md:table-cell">Description</th>
            <th className="text-center px-3 py-2">Type</th>
            <th className="text-right px-3 py-2">Value</th>
            <th className="text-right px-3 py-2 hidden lg:table-cell">Updated by</th>
            <th className="text-right px-5 py-2 hidden lg:table-cell">Updated at</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => (
            <tr key={f.key} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors group">
              <td className="px-5 py-3">
                <span className="font-mono text-xs text-amber-300">{f.key}</span>
              </td>
              <td className="px-3 py-3 text-gray-400 text-xs hidden md:table-cell max-w-xs">
                {f.description || <span className="text-gray-600">—</span>}
              </td>
              <td className="px-3 py-3 text-center">
                <Badge variant={typeBadgeVariant(f.type)}>{f.type}</Badge>
              </td>
              <td className="px-3 py-3 text-right">
                <div className="flex justify-end">
                  <ValueEditor flag={f} onCommit={onCommit} />
                </div>
              </td>
              <td className="px-3 py-3 text-right hidden lg:table-cell">
                <span className="text-xs text-gray-500">{f.updatedBy}</span>
              </td>
              <td className="px-5 py-3 text-right hidden lg:table-cell">
                <span className="text-xs text-gray-500">{fmtDate(f.updatedAt)}</span>
              </td>
            </tr>
          ))}
          {flags.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-gray-600 text-xs">
                No feature flags configured
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Master Data table ────────────────────────────────────────────────────────

function MasterDataTable({ entities }: { entities: MasterDataEntity[] }) {
  const [publishing, setPublishing] = useState<string | null>(null);
  const [published, setPublished]   = useState<Record<string, boolean>>({});

  async function handlePublish(entity: string) {
    setPublishing(entity);
    try {
      await api.post('/master-data/versions/latest/publish', { entity }).catch(() => null);
      setPublished((prev) => ({ ...prev, [entity]: true }));
      setTimeout(() => setPublished((prev) => { const next = { ...prev }; delete next[entity]; return next; }), 3000);
    } finally {
      setPublishing(null);
    }
  }

  return (
    <div className="overflow-x-auto -mx-5 -mb-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
            <th className="text-left px-5 py-2">Entity</th>
            <th className="text-center px-3 py-2">Version</th>
            <th className="text-right px-3 py-2 hidden sm:table-cell">Last published</th>
            <th className="text-right px-5 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((e) => (
            <tr key={e.entity} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
              <td className="px-5 py-3">
                <span className="text-white font-medium">{e.label}</span>
              </td>
              <td className="px-3 py-3 text-center">
                <span className="font-mono text-xs text-gray-300">v{e.version}</span>
              </td>
              <td className="px-3 py-3 text-right hidden sm:table-cell">
                <span className="text-xs text-gray-500">{fmtDate(e.lastPublished)}</span>
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => handlePublish(e.entity)}
                  disabled={publishing === e.entity}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {publishing === e.entity && <Spinner />}
                  {published[e.entity] ? '✓ Published' : 'Publish'}
                </button>
              </td>
            </tr>
          ))}
          {entities.length === 0 && (
            <tr>
              <td colSpan={4} className="px-5 py-8 text-center text-gray-600 text-xs">
                No master data entities configured
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RemoteConfigPage() {
  const qc = useQueryClient();

  // Optimistic local state for feature flags
  const [localFlags, setLocalFlags] = useState<FeatureFlag[] | null>(null);

  const flagsQuery = useQuery<FeatureFlag[]>({
    queryKey: ['config-feature-flags'],
    queryFn: () =>
      api.get('/admin/config/feature-flags').then((r) => r.data).catch(() => []),
  });

  const masterDataQuery = useQuery<MasterDataEntity[]>({
    queryKey: ['config-master-data'],
    queryFn: () =>
      api.get('/master-data/balance').then((r) => r.data).catch(() => []),
  });

  const patchFlag = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.patch(`/admin/config/feature-flags/${key}`, { value }).catch(() => null),
    onMutate: ({ key, value }) => {
      // Optimistic update
      setLocalFlags((prev) =>
        (prev ?? flagsQuery.data ?? []).map((f) =>
          f.key === key ? { ...f, value } : f,
        ),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['config-feature-flags'] });
    },
  });

  const displayFlags       = localFlags ?? flagsQuery.data ?? [];
  const displayMasterData  = masterDataQuery.data ?? [];

  const enabledCount = displayFlags.filter(
    (f) => f.type === 'bool' && f.value === 'true',
  ).length;
  const boolCount = displayFlags.filter((f) => f.type === 'bool').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Remote Config</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Feature flags and master data versioning — changes take effect immediately
        </p>
      </div>

      {/* Section 1: Feature Flags */}
      <Section
        title="Feature Flags"
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {enabledCount}/{boolCount} booleans enabled
            </span>
            {patchFlag.isPending && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <Spinner />
                Saving…
              </div>
            )}
            {patchFlag.isSuccess && !patchFlag.isPending && (
              <span className="text-xs text-green-400">Saved</span>
            )}
          </div>
        }
      >
        {flagsQuery.isLoading ? (
          <PageSpinner />
        ) : (
          <FeatureFlagsTable
            flags={displayFlags}
            onCommit={(key, value) => patchFlag.mutate({ key, value })}
          />
        )}
      </Section>

      {/* Section 2: Master Data Versions */}
      <Section
        title="Master Data Versions"
        action={
          <span className="text-xs text-gray-500">
            POST /admin/master-data/publish per entity
          </span>
        }
      >
        {masterDataQuery.isLoading ? (
          <PageSpinner />
        ) : (
          <MasterDataTable entities={displayMasterData} />
        )}
      </Section>
    </div>
  );
}
