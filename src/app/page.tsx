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
  Server,
  Activity,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

export default function DashboardPage() {
  const { mockMessages, mockDocuments, mockMCPServers, isDevMode } =
    useDevMode();

  const totalMessages = mockMessages.length;
  const totalDocuments = mockDocuments.length;
  const readyDocuments = mockDocuments.filter(
    doc => doc.status === 'ready'
  ).length;
  const processingDocuments = mockDocuments.filter(
    doc => doc.status === 'processing'
  ).length;
  const connectedServers = mockMCPServers.filter(
    server => server.status === 'connected'
  ).length;

  const recentMessages = mockMessages.slice(-3);
  const recentDocuments = mockDocuments.slice(-3);

  return (
    <div className='flex-1 space-y-4 p-4 md:p-6 pt-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Dashboard</h1>
        <p className='text-muted-foreground'>
          Welcome to your RAG Chat System.{' '}
          {isDevMode && 'Running in development mode with mock data.'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Messages
            </CardTitle>
            <MessageSquare className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalMessages}</div>
            <p className='text-xs text-muted-foreground'>Chat conversations</p>
          </CardContent>
        </Card>

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
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>MCP Servers</CardTitle>
            <Server className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {connectedServers}/{mockMCPServers.length}
            </div>
            <p className='text-xs text-muted-foreground'>Connected servers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>System Status</CardTitle>
            <Activity className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              <Badge variant={connectedServers > 0 ? 'default' : 'destructive'}>
                {connectedServers > 0 ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <p className='text-xs text-muted-foreground'>System operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className='grid gap-6 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Recent Messages</CardTitle>
            <CardDescription>Latest chat interactions</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {recentMessages.map(message => (
              <div key={message.id} className='flex items-start space-x-3'>
                <div
                  className={`w-2 h-2 rounded-full mt-2 ${
                    message.role === 'user'
                      ? 'bg-blue-500'
                      : message.role === 'assistant'
                        ? 'bg-green-500'
                        : 'bg-gray-500'
                  }`}
                />
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium capitalize'>
                    {message.role}
                  </p>
                  <p className='text-sm text-muted-foreground truncate'>
                    {message.content}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <Button variant='ghost' size='sm' className='w-full'>
              <MessageSquare className='mr-2 h-4 w-4' />
              Go to Chat
              <ArrowRight className='ml-2 h-4 w-4' />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Recent Documents</CardTitle>
            <CardDescription>Latest uploaded files</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {recentDocuments.map(document => (
              <div key={document.id} className='flex items-start space-x-3'>
                <div className='mt-1'>
                  {document.status === 'ready' && (
                    <CheckCircle className='h-4 w-4 text-green-500' />
                  )}
                  {document.status === 'processing' && (
                    <Clock className='h-4 w-4 text-yellow-500' />
                  )}
                  {document.status === 'error' && (
                    <XCircle className='h-4 w-4 text-red-500' />
                  )}
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium truncate'>
                    {document.title}
                  </p>
                  <div className='flex items-center space-x-2'>
                    <Badge variant='outline' className='text-xs'>
                      {document.type.toUpperCase()}
                    </Badge>
                    <span className='text-xs text-muted-foreground'>
                      {(document.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {document.uploadedAt.toLocaleDateString()}
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

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 md:grid-cols-3'>
            <Button variant='outline' className='justify-start h-auto p-4'>
              <MessageSquare className='mr-3 h-5 w-5' />
              <div className='text-left'>
                <div className='font-medium'>Start Chat</div>
                <div className='text-sm text-muted-foreground'>
                  Begin a new conversation
                </div>
              </div>
            </Button>

            <Button variant='outline' className='justify-start h-auto p-4'>
              <FileText className='mr-3 h-5 w-5' />
              <div className='text-left'>
                <div className='font-medium'>Upload Document</div>
                <div className='text-sm text-muted-foreground'>
                  Add files to knowledge base
                </div>
              </div>
            </Button>

            <Button variant='outline' className='justify-start h-auto p-4'>
              <Server className='mr-3 h-5 w-5' />
              <div className='text-left'>
                <div className='font-medium'>Server Status</div>
                <div className='text-sm text-muted-foreground'>
                  Check MCP connections
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
