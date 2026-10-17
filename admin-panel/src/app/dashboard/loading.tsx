function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-gray-800 rounded-lg animate-pulse ${className ?? ''}`} />;
}

function StatCardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <SkeletonBlock className="h-3 w-1/2" />
      <SkeletonBlock className="h-7 w-2/3" />
      <SkeletonBlock className="h-2.5 w-1/3" />
    </div>
  );
}

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-gray-800/50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonBlock className="h-3 w-full" />
        </td>
      ))}
    </tr>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">

      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-32" />
          <SkeletonBlock className="h-3 w-48" />
        </div>
        <SkeletonBlock className="h-7 w-36 rounded-lg" />
      </div>

      {/* Stat cards — row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Stat cards — row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-[200px] w-full" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <SkeletonBlock className="h-4 w-32" />
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {Array.from({ length: 5 }).map((_, i) => (
                  <th key={i} className="px-4 py-2">
                    <SkeletonBlock className="h-3 w-full" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={5} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
