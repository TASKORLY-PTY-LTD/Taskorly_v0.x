'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DocumentTable } from '@/components/documents/document-table';
import { UploadDialog } from '@/components/documents/upload-dialog';
import { trpc } from '@/utils/trpc';
import { Upload, FileText, Database } from 'lucide-react';

export default function DocumentsPage() {
  const { data: documents = [] } = trpc.documents.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const totalDocuments = documents.length;
  const readyDocuments = documents.filter(doc =>
    doc.chunk_count ? doc.chunk_count > 0 : false
  ).length;
  const processingDocuments = documents.filter(doc => !doc.chunk_count).length;
  const totalSize = documents.reduce(
    (acc, doc) => acc + (doc.content?.length || 0),
    0
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className='flex-1 space-y-4 p-4 md:p-6 pt-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Documents</h1>
          <p className='text-muted-foreground'>
            Manage your knowledge base and document collection.
          </p>
        </div>
        <UploadDialog>
          <Button>
            <Upload className='mr-2 h-4 w-4' />
            Upload Documents
          </Button>
        </UploadDialog>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Documents
            </CardTitle>
            <FileText className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalDocuments}</div>
            <p className='text-xs text-muted-foreground'>
              Documents in knowledge base
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Ready</CardTitle>
            <Database className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{readyDocuments}</div>
            <p className='text-xs text-muted-foreground'>
              Available for search
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Processing</CardTitle>
            <Upload className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{processingDocuments}</div>
            <p className='text-xs text-muted-foreground'>Being indexed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Size</CardTitle>
            <FileText className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {formatFileSize(totalSize)}
            </div>
            <p className='text-xs text-muted-foreground'>Storage used</p>
          </CardContent>
        </Card>
      </div>

      {/* Document Table */}
      <Card>
        <CardHeader>
          <CardTitle>Document Library</CardTitle>
          <CardDescription>
            View and manage all documents in your knowledge base.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentTable />
        </CardContent>
      </Card>
    </div>
  );
}
