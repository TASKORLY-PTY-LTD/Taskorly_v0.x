'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, TRPCClientError } from '@trpc/client';
import { trpc } from '@/utils/trpc';
import superjson from 'superjson';
import type { AppRouter } from '@/server/api/root';

interface TRPCProviderProps {
  children: React.ReactNode;
}

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3001}`; // dev SSR should use localhost
};

export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(() => 
    new QueryClient({
      defaultOptions: {
        queries: {
          // With SSR, we usually want to set some default staleTime
          // above 0 to avoid refetching immediately on the client
          staleTime: 60 * 1000,
          retry: (failureCount, error) => {
            // Don't retry on 4xx errors (client errors)
            if (error instanceof TRPCClientError && error.data?.httpStatus >= 400 && error.data?.httpStatus < 500) {
              return false;
            }
            // Retry up to 3 times for other errors
            return failureCount < 3;
          },
        },
        mutations: {
          retry: false, // Don't retry mutations by default
        },
      },
    })
  );
  
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers() {
            // Get auth token from localStorage if available
            const authData = typeof window !== 'undefined' 
              ? localStorage.getItem('auth-data') 
              : null;
            
            if (authData) {
              try {
                const parsed = JSON.parse(authData);
                if (parsed.accessToken) {
                  return {
                    authorization: `Bearer ${parsed.accessToken}`,
                    'content-type': 'application/json',
                  };
                }
              } catch (error) {
                console.error('Error parsing auth data:', error);
                // Clear invalid auth data
                localStorage.removeItem('auth-data');
              }
            }
            
            return {
              'content-type': 'application/json',
            };
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}