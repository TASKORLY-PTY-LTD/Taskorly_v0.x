'use client';

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
import { useDevMode } from '@/providers/dev-mode-provider';
import {
  MoreHorizontal,
  FileText,
  Download,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';

export function DocumentTable() {
  const { mockDocuments } = useDevMode();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className='h-4 w-4 text-green-500' />;
      case 'processing':
        return <Clock className='h-4 w-4 text-yellow-500' />;
      case 'error':
        return <XCircle className='h-4 w-4 text-red-500' />;
      default:
        return <FileText className='h-4 w-4' />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
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
          {mockDocuments.map(document => (
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
                  {document.type.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className='text-sm'>
                {formatFileSize(document.size)}
              </TableCell>
              <TableCell>
                <div className='flex items-center space-x-2'>
                  {getStatusIcon(document.status)}
                  <Badge
                    variant={getStatusColor(document.status) as any}
                    className='text-xs'
                  >
                    {document.status}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className='text-sm text-muted-foreground'>
                {document.uploadedAt.toLocaleDateString()}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-8 w-8'>
                      <MoreHorizontal className='h-4 w-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem>
                      <Eye className='mr-2 h-4 w-4' />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className='mr-2 h-4 w-4' />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem className='text-destructive'>
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

      {mockDocuments.length === 0 && (
        <div className='text-center py-8'>
          <FileText className='mx-auto h-12 w-12 text-muted-foreground/50' />
          <h3 className='mt-4 text-lg font-semibold'>No documents</h3>
          <p className='text-muted-foreground'>
            Upload your first document to get started.
          </p>
        </div>
      )}
    </div>
  );
}
