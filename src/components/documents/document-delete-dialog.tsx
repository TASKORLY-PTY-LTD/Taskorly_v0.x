'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { Trash2, AlertTriangle, FileText, Hash } from 'lucide-react';
import type { AppRouter } from '@/server/api/root';
import type { inferRouterOutputs } from '@trpc/server';

type Document = inferRouterOutputs<AppRouter>['documents']['list'][number];

interface DocumentDeleteDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DocumentDeleteDialog({
  document,
  open,
  onOpenChange,
  onDeleted,
}: DocumentDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const utils = trpc.useUtils();
  const deleteDocument = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      onDeleted?.();
      onOpenChange(false);
    },
    onError: error => {
      console.error('Failed to delete document:', error);
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  const handleDelete = async () => {
    if (!document) return;

    setIsDeleting(true);
    try {
      await deleteDocument.mutateAsync({ documentId: document.id });
    } catch (error) {
      // Error is handled by the mutation's onError
    }
  };

  if (!document) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5' />
            Delete Document
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the
            document and all associated data.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Document Info */}
          <div className='p-4 bg-muted/50 rounded-lg space-y-3'>
            <div className='flex items-center gap-2'>
              <FileText className='h-4 w-4 text-muted-foreground' />
              <span className='font-medium'>{document.title}</span>
            </div>

            <div className='grid grid-cols-2 gap-4 text-sm'>
              <div>
                <p className='text-muted-foreground'>Type</p>
                <Badge variant='outline' className='text-xs'>
                  {document.content_type ? document.content_type.toUpperCase() : 'N/A'}
                </Badge>
              </div>
              <div>
                <p className='text-muted-foreground'>Size</p>
                <p>{formatFileSize(document.content?.length || 0)}</p>
              </div>
            </div>

            {/* Chunks Info */}
            {document.chunk_count && document.chunk_count > 0 && (
              <div className='flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800'>
                <Hash className='h-4 w-4 text-yellow-600 dark:text-yellow-400' />
                <span className='text-sm text-yellow-800 dark:text-yellow-200'>
                  {document.chunk_count} chunks will also be deleted
                </span>
              </div>
            )}

            {/* Vector Embeddings Warning */}
            {document.chunk_count && document.chunk_count > 0 && (
              <div className='flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800'>
                <AlertTriangle className='h-4 w-4 text-red-600 dark:text-red-400' />
                <span className='text-sm text-red-800 dark:text-red-200'>
                  Vector embeddings will be removed from Pinecone
                </span>
              </div>
            )}
            {/* // test comment */}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant='destructive'
            onClick={handleDelete}
            disabled={isDeleting}
            className='flex items-center gap-2'
          >
            {isDeleting ? (
              <>
                <div className='h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent' />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className='h-4 w-4' />
                Delete Document
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
