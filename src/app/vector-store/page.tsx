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
import { Progress } from '@/components/ui/progress';
import { useDevMode } from '@/providers/dev-mode-provider';
import {
  Database,
  HardDrive,
  Zap,
  Activity,
  RefreshCw,
  Settings,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  FileText,
} from 'lucide-react';

export default function VectorStorePage() {
  const { mockDocuments } = useDevMode();

  // Mock vector store data
  const vectorStoreStats = {
    totalVectors: 245672,
    totalSize: '1.2 GB',
    indexedDocuments: mockDocuments.filter(doc => doc.status === 'ready')
      .length,
    pendingDocuments: mockDocuments.filter(doc => doc.status === 'processing')
      .length,
    dimensions: 1536,
    similarity: 'cosine',
    indexType: 'HNSW',
    performance: {
      averageQuery: '12ms',
      throughput: '450 queries/sec',
      uptime: '99.94%',
    },
  };

  const collections = [
    {
      name: 'documents',
      description: 'Main document collection',
      vectors: 189432,
      size: '892 MB',
      status: 'active',
      lastUpdated: '2 minutes ago',
    },
    {
      name: 'metadata',
      description: 'Document metadata vectors',
      vectors: 34521,
      size: '156 MB',
      status: 'active',
      lastUpdated: '5 minutes ago',
    },
    {
      name: 'embeddings_cache',
      description: 'Cached embedding results',
      vectors: 21719,
      size: '98 MB',
      status: 'optimizing',
      lastUpdated: '1 hour ago',
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className='h-4 w-4 text-green-500' />;
      case 'optimizing':
        return <Activity className='h-4 w-4 text-yellow-500 animate-pulse' />;
      case 'error':
        return <AlertTriangle className='h-4 w-4 text-red-500' />;
      default:
        return <Database className='h-4 w-4' />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'optimizing':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className='flex-1 space-y-4 p-4 md:p-6 pt-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Vector Store</h1>
        <p className='text-muted-foreground'>
          Manage and monitor your vector database collections and embeddings.
        </p>
      </div>

      {/* Overview Stats */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Vectors</CardTitle>
            <Database className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {vectorStoreStats.totalVectors.toLocaleString()}
            </div>
            <p className='text-xs text-muted-foreground'>
              Across all collections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Storage Used</CardTitle>
            <HardDrive className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {vectorStoreStats.totalSize}
            </div>
            <p className='text-xs text-muted-foreground'>Vector data size</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Query Performance
            </CardTitle>
            <Zap className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {vectorStoreStats.performance.averageQuery}
            </div>
            <p className='text-xs text-muted-foreground'>Average query time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Uptime</CardTitle>
            <Activity className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {vectorStoreStats.performance.uptime}
            </div>
            <p className='text-xs text-muted-foreground'>System availability</p>
          </CardContent>
        </Card>
      </div>

      {/* Index Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Index Configuration</CardTitle>
          <CardDescription>
            Current vector database configuration and settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 md:grid-cols-3'>
            <div className='space-y-2'>
              <div className='text-sm font-medium'>Dimensions</div>
              <div className='text-2xl font-bold'>
                {vectorStoreStats.dimensions}
              </div>
              <div className='text-xs text-muted-foreground'>Vector size</div>
            </div>
            <div className='space-y-2'>
              <div className='text-sm font-medium'>Similarity Metric</div>
              <Badge variant='outline' className='text-sm capitalize'>
                {vectorStoreStats.similarity}
              </Badge>
              <div className='text-xs text-muted-foreground'>
                Distance function
              </div>
            </div>
            <div className='space-y-2'>
              <div className='text-sm font-medium'>Index Type</div>
              <Badge variant='secondary' className='text-sm'>
                {vectorStoreStats.indexType}
              </Badge>
              <div className='text-xs text-muted-foreground'>Algorithm</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collections */}
      <Card>
        <CardHeader>
          <CardTitle>Vector Collections</CardTitle>
          <CardDescription>
            Manage your vector database collections and monitor their status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {collections.map(collection => (
              <div
                key={collection.name}
                className='flex items-center justify-between p-4 border rounded-lg'
              >
                <div className='flex items-center space-x-4'>
                  {getStatusIcon(collection.status)}
                  <div>
                    <h3 className='font-medium'>{collection.name}</h3>
                    <p className='text-sm text-muted-foreground'>
                      {collection.description}
                    </p>
                    <div className='flex items-center space-x-4 mt-2'>
                      <span className='text-xs text-muted-foreground'>
                        {collection.vectors.toLocaleString()} vectors
                      </span>
                      <span className='text-xs text-muted-foreground'>
                        {collection.size}
                      </span>
                      <span className='text-xs text-muted-foreground'>
                        Updated {collection.lastUpdated}
                      </span>
                    </div>
                  </div>
                </div>

                <div className='flex items-center space-x-2'>
                  <Badge
                    variant={getStatusColor(collection.status) as any}
                    className='text-xs'
                  >
                    {collection.status}
                  </Badge>

                  <Button variant='ghost' size='icon' className='h-8 w-8'>
                    <RefreshCw className='h-4 w-4' />
                  </Button>

                  <Button variant='ghost' size='icon' className='h-8 w-8'>
                    <Settings className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Query Performance</CardTitle>
            <CardDescription>
              Real-time query metrics and throughput
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex justify-between text-sm'>
                <span>Average Query Time</span>
                <span className='font-medium'>
                  {vectorStoreStats.performance.averageQuery}
                </span>
              </div>
              <Progress value={85} className='h-2' />
            </div>

            <div className='space-y-2'>
              <div className='flex justify-between text-sm'>
                <span>Throughput</span>
                <span className='font-medium'>
                  {vectorStoreStats.performance.throughput}
                </span>
              </div>
              <Progress value={92} className='h-2' />
            </div>

            <div className='flex items-center justify-between pt-2'>
              <div className='flex items-center text-sm text-muted-foreground'>
                <TrendingUp className='mr-2 h-4 w-4' />
                Performance trending upward
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Index Status</CardTitle>
            <CardDescription>
              Document indexing and embedding status
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-3'>
              <div className='flex justify-between items-center'>
                <span className='text-sm'>Indexed Documents</span>
                <span className='font-medium'>
                  {vectorStoreStats.indexedDocuments}
                </span>
              </div>

              <div className='flex justify-between items-center'>
                <span className='text-sm'>Pending Documents</span>
                <span className='font-medium text-yellow-600'>
                  {vectorStoreStats.pendingDocuments}
                </span>
              </div>

              <div className='space-y-2'>
                <div className='flex justify-between text-xs text-muted-foreground'>
                  <span>Indexing Progress</span>
                  <span>
                    {Math.round(
                      (vectorStoreStats.indexedDocuments /
                        (vectorStoreStats.indexedDocuments +
                          vectorStoreStats.pendingDocuments)) *
                        100
                    )}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    (vectorStoreStats.indexedDocuments /
                      (vectorStoreStats.indexedDocuments +
                        vectorStoreStats.pendingDocuments)) *
                    100
                  }
                  className='h-2'
                />
              </div>
            </div>

            <div className='flex items-center justify-between pt-2'>
              <div className='flex items-center text-sm text-muted-foreground'>
                <FileText className='mr-2 h-4 w-4' />
                {vectorStoreStats.pendingDocuments > 0
                  ? 'Indexing in progress'
                  : 'All documents indexed'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
