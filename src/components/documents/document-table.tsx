'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DocumentViewDialog } from './document-view-dialog';
// import { DocumentDeleteDialog } from './document-delete-dialog'; // Temporarily disabled
import { trpc } from '@/utils/trpc';
import type { AppRouter } from '@/server/api/root';
import type { inferRouterOutputs } from '@trpc/server';
import {
  MoreHorizontal,
  FileText,
  Download,
  Trash2, // Temporarily disabled
  Eye,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { DocumentDeleteDialog } from './document-delete-dialog';

export function DocumentTable() {
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<inferRouterOutputs<AppRouter>['documents']['list'][number] | null>(null);

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

  const getStatusIcon = (processingStatus: string, chunkCount: number) => {
    // If processing is completed and we have chunks, it's ready
    if (processingStatus === 'completed' && chunkCount > 0) {
      return <CheckCircle className='h-4 w-4 text-green-500' />;
    }
    // If processing is in progress or pending
    if (processingStatus === 'processing' || processingStatus === 'pending') {
      return <Clock className='h-4 w-4 text-yellow-500' />;
    }
    // If processing failed
    if (processingStatus === 'failed') {
      return <XCircle className='h-4 w-4 text-red-500' />;
    }
    // Default fallback
    return <FileText className='h-4 w-4' />;
  };

  const getStatusColor = (processingStatus: string, chunkCount: number) => {
    // If processing is completed and we have chunks, it's ready
    if (processingStatus === 'completed' && chunkCount > 0) {
      return 'default';
    }
    // If processing is in progress or pending
    if (processingStatus === 'processing' || processingStatus === 'pending') {
      return 'secondary';
    }
    // If processing failed
    if (processingStatus === 'failed') {
      return 'destructive';
    }
    // Default fallback
    return 'outline';
  };

  const getStatusText = (processingStatus: string, chunkCount: number) => {
    // If processing is completed and we have chunks, it's ready
    if (processingStatus === 'completed' && chunkCount > 0) {
      return `Ready (${chunkCount} chunks)`;
    }
    // If processing is in progress
    if (processingStatus === 'processing') {
      return 'Processing...';
    }
    // If processing is pending
    if (processingStatus === 'pending') {
      return 'Pending';
    }
    // If processing failed
    if (processingStatus === 'failed') {
      return 'Failed';
    }
    // Default fallback
    return 'Unknown';
  };

  const handleViewDocument = (document: inferRouterOutputs<AppRouter>['documents']['list'][number]) => {
    setSelectedDocument(document);
    setViewDialogOpen(true);
  };

  const handleDeleteDocument = (document: inferRouterOutputs<AppRouter>['documents']['list'][number]) => {
    setSelectedDocument(document);
    setDeleteDialogOpen(true);
  };

  const handleDocumentDeleted = () => {
    setDeleteDialogOpen(false);
    setSelectedDocument(null);
  };

  return (
    <div className='border rounded-lg'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className='w-[50px]'></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document: inferRouterOutputs<AppRouter>['documents']['list'][number]) => (
            <TableRow key={document.id}>
              <TableCell>
                <div className='flex items-center space-x-2'>
                  <FileText className='h-4 w-4 text-muted-foreground' />
                  <div className='min-w-0 flex-1'>
                    <p className='font-medium truncate'>{document.title}</p>
                    <p className='text-xs text-muted-foreground truncate'>
                      {document.content.substring(0, 60)}...
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant='outline' className='text-xs'>
                  {document.content_type.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className='text-sm'>
                {formatFileSize(document.content.length)}
              </TableCell>
              <TableCell>
                <div className='flex items-center space-x-2'>
                  {getStatusIcon(document.processing_status || 'pending', document.chunk_count || 0)}
                  <Badge
                    variant={getStatusColor(document.processing_status || 'pending', document.chunk_count || 0) as any}
                    className='text-xs'
                  >
                    {getStatusText(document.processing_status || 'pending', document.chunk_count || 0)}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className='text-sm text-muted-foreground'>
                {new Date(document.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-8 w-8'>
                      <MoreHorizontal className='h-4 w-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align='end' 
                    className='w-48 bg-background/95 backdrop-blur-sm border border-border shadow-lg'
                  >
                    <DropdownMenuItem 
                      onClick={() => handleViewDocument(document)}
                      className='cursor-pointer hover:bg-accent hover:text-accent-foreground'
                    >
                      <Eye className='mr-2 h-4 w-4' />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className='cursor-pointer hover:bg-accent hover:text-accent-foreground'
                    >
                      <Download className='mr-2 h-4 w-4' />
                      Download
                    </DropdownMenuItem>
                    {/* Delete function temporarily disabled */}
                    <DropdownMenuItem 
                      onClick={() => {handleDeleteDocument(document)}}
                      className='text-destructive cursor-pointer hover:bg-destructive hover:text-destructive-foreground'
                    >
                      <Trash2 className='mr-2 h-4 w-4' />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {documents.length === 0 && (
        <div className='text-center py-8'>
          <FileText className='mx-auto h-12 w-12 text-muted-foreground/50' />
          <h3 className='mt-4 text-lg font-semibold'>No documents</h3>
          <p className='text-muted-foreground'>
            Upload your first document to get started.
          </p>
        </div>
      )}

      {/* Dialogs */}
      <DocumentViewDialog
        document={selectedDocument}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />
      
      {/* Delete dialog temporarily disabled */}
      <DocumentDeleteDialog
        document={selectedDocument}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={handleDocumentDeleted}
      />
    </div>
  );
}
