'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';
import NextAuthProvider from '@/components/providers/session-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
      </QueryClientProvider>
    </NextAuthProvider>
  );
}
