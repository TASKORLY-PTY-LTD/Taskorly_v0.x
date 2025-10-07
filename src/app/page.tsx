'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDevMode } from '@/providers/dev-mode-provider';
import {
  MessageSquare,
  FileText,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { trpc } from '@/utils/trpc';

const QuickActionItems = [
  {
    title: 'Customer Chat',
    url: '/customer',
    icon: MessageSquare,
    description: 'Begin a new conversation',
  },
  {
    title: 'Documents',
    url: '/documents',
    icon: FileText,
    description: 'Add files to knowledge base',
  },  
];

export default function DashboardPage() {
  const { data: documents = [] } = trpc.documents.list.useQuery({
    limit: 50,
    offset: 0
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const { mockMessages, mockDocuments, mockMCPServers, isDevMode } =
    useDevMode();

  const totalDocuments = documents.length;
  const readyDocuments = documents.filter(
    document => document.processing_status === 'completed'
  ).length;
  const processingDocuments = documents.filter(
    document => document.processing_status === 'processing'
  ).length;

  const recentDocuments = documents.slice(-3);

  return (
    <div className='flex-1 space-y-4 p-4 md:p-6 pt-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Dashboard</h1>
        <p className='text-muted-foreground'>
          Welcome to Taskorly.{' '}
          {isDevMode && ''}
        </p>
      </div>

      {/* Quick Actions */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-row-3'>
              {QuickActionItems.map(item => (
              <Button variant='outline' className='justify-start h-auto p-4' key={item.url} onClick={() => window.location.href = item.url}>
                <item.icon className='mr-3 h-5 w-5'/>
                <div className='text-left'>
                  <div className='font-medium'>{item.title}</div>
                  <div className='text-sm text-muted-foreground'>
                    {item.description}
                  </div>
                </div>
              </Button>
            ))}
            </div>
          </CardContent>
        </Card>

        {/* Document Widgets */}
        <div className='space-y-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Documents</CardTitle>
              <FileText className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{totalDocuments}</div>
              <p className='text-xs text-muted-foreground'>
                {readyDocuments} ready, {processingDocuments} processing
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Recent Documents</CardTitle>
              <CardDescription>Latest uploaded files</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {documents.map((document) => (
                <div key={document.id} className='flex items-start space-x-3'>
                  <div className='mt-1'>
                    {document.processing_status === 'completed' && (
                      <CheckCircle className='h-4 w-4 text-green-500' />
                    )}
                    {document.processing_status === 'processing' && (
                      <Clock className='h-4 w-4 text-yellow-500' />
                    )}
                    {document.processing_status === 'error' && (
                      <XCircle className='h-4 w-4 text-red-500' />
                    )}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium truncate'>
                      {document.title}
                    </p>
                    <div className='flex items-center space-x-2'>
                      <Badge variant='outline' className='text-xs'>
                        {document.content_type}
                      </Badge>
                      <span className='text-xs text-muted-foreground'>
                        {(formatFileSize(document.content.length))}
                      </span>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                       {new Date(document.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
              <Button variant='ghost' size='sm' className='w-full'>
                <FileText className='mr-2 h-4 w-4' />
                Manage Documents
                <ArrowRight className='ml-2 h-4 w-4' />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
