type BadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'amber';

const variantMap: Record<BadgeVariant, string> = {
  green:  'bg-green-900/50 text-green-400 border-green-800',
  red:    'bg-red-900/50 text-red-400 border-red-800',
  yellow: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  blue:   'bg-blue-900/50 text-blue-400 border-blue-800',
  gray:   'bg-gray-800 text-gray-400 border-gray-700',
  amber:  'bg-amber-900/50 text-amber-400 border-amber-800',
};

export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${variantMap[variant]}`}>
      {children}
    </span>
  );
}
