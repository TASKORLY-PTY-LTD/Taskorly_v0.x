'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/providers/auth-provider';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Always block UI while loading
  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto'></div>
          <p className='mt-2 text-sm text-gray-500'>Loading...</p>
        </div>
      </div>
    );
  }

  // Only show login form if not authenticated AFTER loading
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className='flex flex-1 flex-col gap-4 p-4 pt-0'>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
