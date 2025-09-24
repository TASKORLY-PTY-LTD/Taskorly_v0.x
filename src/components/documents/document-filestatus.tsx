import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import { trpc } from '@/utils/trpc';

const DocumentStatus = ({ 
  processingStatus, 
  chunkCount, 
  documentId 
}: {
  processingStatus: string;
  chunkCount: number;
  documentId: string;
}) => {
  const utils = trpc.useUtils();
  
  // Auto-refresh for processing documents
  useEffect(() => {
  let interval: NodeJS.Timeout | null = null;
  
  if (processingStatus === 'processing' || processingStatus === 'pending') {
    interval = setInterval(() => {
      utils.documents.list.invalidate();
    }, 3000);
  }
  
  return () => {
    if (interval) {
      clearInterval(interval);
    }
  };
}, [processingStatus, utils]);
  
  const getStatusIcon = () => {
    if (processingStatus === 'completed' && chunkCount > 0) {
      return <CheckCircle className='h-4 w-4 text-green-500' />;
    }
    if (processingStatus === 'processing' || processingStatus === 'pending') {
      return <Clock className='h-4 w-4 text-yellow-500 animate-pulse' />;
    }
    if (processingStatus === 'failed') {
      return <XCircle className='h-4 w-4 text-red-500' />;
    }
    return <FileText className='h-4 w-4' />;
  };

  const getStatusColor = () => {
    if (processingStatus === 'completed' && chunkCount > 0) {
      return 'default';
    }
    if (processingStatus === 'processing' || processingStatus === 'pending') {
      return 'secondary';
    }
    if (processingStatus === 'failed') {
      return 'destructive';
    }
    return 'outline';
  };

  const getStatusText = () => {
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
    <div className='flex items-center space-x-2'>
      {getStatusIcon()}
      <Badge variant={getStatusColor() as any} className='text-xs'>
        {getStatusText()}
      </Badge>
    </div>
  );
};

export default DocumentStatus;
