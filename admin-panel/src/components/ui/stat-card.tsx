interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number; // positive = up, negative = down
  accent?: 'amber' | 'green' | 'red' | 'blue';
}

const accentMap = {
  amber: 'text-amber-400',
  green: 'text-green-400',
  red:   'text-red-400',
  blue:  'text-blue-400',
};

export function StatCard({ label, value, sub, trend, accent = 'amber' }: StatCardProps) {
  const color = accentMap[accent];
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="text-xs text-gray-500">{sub}</span>}
      </div>
    </div>
  );
}
