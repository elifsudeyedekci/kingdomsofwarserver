export function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-4 w-4' : 'h-8 w-8';
  return (
    <div className={`${s} animate-spin rounded-full border-2 border-gray-600 border-t-amber-500`} />
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <Spinner size="md" />
    </div>
  );
}
