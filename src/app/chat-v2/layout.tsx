'use client';

import { DevModeProvider } from '@/providers/dev-mode-provider';
import { trpc } from '@/utils/trpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { useState } from 'react';

interface ChatV2LayoutProps {
  children: React.ReactNode;
}

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

export default function ChatV2Layout({ children }: ChatV2LayoutProps) {
  const [queryClient] = useState(() => new QueryClient());

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers() {
            return {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <DevModeProvider>
          <div className='min-h-screen bg-slate-50'>
            <header className='bg-white shadow-sm border-b'>
              <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                <div className='flex justify-between items-center h-16'>
                  <div className='flex items-center'>
                    <div className='flex-shrink-0'>
                      <h1 className='text-2xl font-bold text-gray-900'>
                        Taskorly Demo
                      </h1>
                    </div>
                    <div className='ml-4'>
                      <p className='text-sm text-gray-500'>
                        AI-powered document chat demo
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center space-x-4'>
                    <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                      Demo Mode
                    </span>
                  </div>
                </div>
              </div>
            </header>
            <main>{children}</main>
          </div>
        </DevModeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
