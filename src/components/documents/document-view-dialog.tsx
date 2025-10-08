'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import {
  Eye,
  FileText,
  Calendar,
  Hash,
  Clock,
  CheckCircle,
} from 'lucide-react';
import type { AppRouter } from '@/server/api/root';
import type { inferRouterOutputs } from '@trpc/server';

type Document = inferRouterOutputs<AppRouter>['documents']['list'][number];

interface DocumentViewDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentViewDialog({
  document,
  open,
  onOpenChange,
}: DocumentViewDialogProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'chunks'>('content');

  // Fetch full document with chunks when dialog opens
  const { data: fullDocument, isLoading } = trpc.documents.get.useQuery(
    { documentId: document?.id || '' },
    {
      enabled: !!document && open,
      refetchOnWindowFocus: false,
    }
  );

  if (!document) return null;

  // Use full document data if available, otherwise fall back to basic document
  const displayDocument = fullDocument || document;

  // Type assertion to handle the chunks property
  const documentWithChunks = displayDocument as typeof displayDocument & {
    document_chunks?: Array<{
      id: string;
      content: string;
      chunk_index: number;
      metadata: any;
    }>;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (processingStatus: string, chunkCount: number) => {
    if (processingStatus === 'completed' && chunkCount > 0) {
      return <CheckCircle className='h-4 w-4 text-green-500' />;
    }
    if (processingStatus === 'processing' || processingStatus === 'pending') {
      return <Clock className='h-4 w-4 text-yellow-500' />;
    }
    return <FileText className='h-4 w-4 text-red-500' />;
  };

  const getStatusText = (processingStatus: string, chunkCount: number) => {
    if (processingStatus === 'completed' && chunkCount > 0) {
      return `Ready (${chunkCount} chunks)`;
    }
    if (processingStatus === 'processing') {
      return 'Processing...';
    }
    if (processingStatus === 'pending') {
      return 'Pending';
    }
    if (processingStatus === 'failed') {
      return 'Failed';
    }
    return 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[80vh]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Eye className='h-5 w-5' />
            {displayDocument.title}
          </DialogTitle>
          <DialogDescription>
            View document content and processing details
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Document Info */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg'>
            <div className='space-y-1'>
              <p className='text-sm font-medium text-muted-foreground'>Type</p>
              <Badge variant='outline' className='text-xs'>
                {displayDocument.content_type
                  ? displayDocument.content_type.toUpperCase()
                  : 'N/A'}
              </Badge>
            </div>
            <div className='space-y-1'>
              <p className='text-sm font-medium text-muted-foreground'>Size</p>
              <p className='text-sm'>
                {formatFileSize(displayDocument.content?.length || 0)}
              </p>
            </div>
            <div className='space-y-1'>
              <p className='text-sm font-medium text-muted-foreground'>
                Status
              </p>
              <div className='flex items-center gap-2'>
                {getStatusIcon(
                  displayDocument.processing_status || 'pending',
                  displayDocument.chunk_count || 0
                )}
                <span className='text-sm'>
                  {getStatusText(
                    displayDocument.processing_status || 'pending',
                    displayDocument.chunk_count || 0
                  )}
                </span>
              </div>
            </div>
            <div className='space-y-1'>
              <p className='text-sm font-medium text-muted-foreground'>
                Uploaded
              </p>
              <p className='text-sm flex items-center gap-1'>
                <Calendar className='h-3 w-3' />
                {displayDocument.created_at
                  ? new Date(displayDocument.created_at).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className='flex space-x-1 bg-muted p-1 rounded-lg'>
            <Button
              variant={activeTab === 'content' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setActiveTab('content')}
              className='flex-1'
            >
              <FileText className='mr-2 h-4 w-4' />
              Full Content
            </Button>
            <Button
              variant={activeTab === 'chunks' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setActiveTab('chunks')}
              className='flex-1'
            >
              <Hash className='mr-2 h-4 w-4' />
              Chunks ({documentWithChunks.document_chunks?.length || 0})
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className='h-96 w-full border rounded-lg'>
            {isLoading ? (
              <div className='p-8 text-center'>
                <div className='h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4' />
                <p className='text-muted-foreground'>
                  Loading document details...
                </p>
              </div>
            ) : activeTab === 'content' ? (
              <div className='p-4'>
                <pre className='whitespace-pre-wrap text-sm font-mono'>
                  {displayDocument.content}
                </pre>
              </div>
            ) : (
              <div className='p-4 space-y-4'>
                {documentWithChunks.document_chunks?.map((chunk, index) => (
                  <div key={chunk.id} className='border rounded-lg p-4'>
                    <div className='flex items-center justify-between mb-2'>
                      <h4 className='font-medium text-sm'>
                        Chunk {chunk.chunk_index}
                      </h4>
                      <Badge variant='outline' className='text-xs'>
                        {chunk.content.length} chars
                      </Badge>
                    </div>
                    <div className='text-sm text-muted-foreground mb-2'>
                      {chunk.metadata &&
                        Object.keys(chunk.metadata).length > 0 && (
                          <div className='flex flex-wrap gap-1'>
                            {Object.entries(chunk.metadata).map(
                              ([key, value]) => (
                                <Badge
                                  key={key}
                                  variant='secondary'
                                  className='text-xs'
                                >
                                  {key}: {String(value)}
                                </Badge>
                              )
                            )}
                          </div>
                        )}
                    </div>
                    <Separator className='my-2' />
                    <pre className='whitespace-pre-wrap text-sm font-mono'>
                      {chunk.content}
                    </pre>
                  </div>
                )) || (
                  <div className='text-center py-8 text-muted-foreground'>
                    <Hash className='mx-auto h-12 w-12 mb-4 opacity-50' />
                    <p>No chunks available</p>
                    <p className='text-sm'>Document may still be processing</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
