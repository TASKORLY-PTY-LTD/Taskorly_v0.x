import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TRPCProvider } from '@/providers/trpc-provider';
import { DevModeProvider } from '@/providers/dev-mode-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { MainLayout } from '@/components/layout/main-layout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Taskorly RAG Chat',
  description: 'AI-powered document chat with RAG capabilities',
  icons: {
    icon: [
      // 16x16 = standard broswer tabs, 32x32 = high DPI displays
      {
        url: '/Brandmark_Reverse-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/Brandmark_Reverse-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
    ],
    shortcut: '/Brandmark_Reverse-32x32.png',
    apple: '/Brandmark_Reverse-32x32.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <body className={inter.className}>
        <TRPCProvider>
          <AuthProvider>
            <DevModeProvider>
              <MainLayout>{children}</MainLayout>
            </DevModeProvider>
          </AuthProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
