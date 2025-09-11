'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Mail, Shield, Settings, Square, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

// Types for Square integration
interface SquareCredentials {
  appId: string;
  secretKey: string;
}

interface SquareProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  variationName: string;
  isTaxable: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const { user, getCurrentRole } = useAuth();
  
  // State for Square integration
  const [squareCredentials, setSquareCredentials] = useState<SquareCredentials>({
    appId: '',
    secretKey: '',
  });
  const [products, setProducts] = useState<SquareProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get user's first and last name for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle Square credentials input
  const handleCredentialsChange = (field: keyof SquareCredentials, value: string) => {
    setSquareCredentials(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear previous messages when user starts typing
    setError(null);
    setSuccess(null);
  };

  // Mock function for fetching Square products (for frontend demo)
  const handleFetchProducts = async () => {
    if (!squareCredentials.appId || !squareCredentials.secretKey) {
      setError('Please enter both App ID and Secret Key');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    //TODO: Remove this mock data - use the actual API call
    
    // Simulate API call delay
    setTimeout(() => {
      // Mock data based on your Square response
      const mockProducts: SquareProduct[] = [
        {
          id: '36MZNSSHHD7QJ45ARGQS6F4O',
          name: 'garden salad',
          price: 12.00,
          currency: 'AUD',
          variationName: 'Regular',
          isTaxable: true,
          isArchived: false,
          createdAt: '2025-08-30T13:57:07.62Z',
          updatedAt: '2025-08-30T13:57:07.575Z',
        },
        {
          id: 'AIQOT5XOAA3NU4KP5W5H5SAA',
          name: 'coffee shake',
          price: 6.00,
          currency: 'AUD',
          variationName: 'Regular',
          isTaxable: true,
          isArchived: false,
          createdAt: '2025-09-11T00:25:07.105Z',
          updatedAt: '2025-09-11T00:25:07.056Z',
        },
      ];

      setProducts(mockProducts);
      setSuccess(`Successfully fetched ${mockProducts.length} products from Square (Demo Mode)`);
      setIsLoading(false);
    }, 1500); // 1.5 second delay to simulate API call
  };

  // Format currency for display
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className='container mx-auto py-6 space-y-6'>
      {/* Page Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Profile</h1>
          <p className='text-muted-foreground'>
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        {/* User Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <User className='h-5 w-5' />
              Personal Information
            </CardTitle>
            <CardDescription>
              Your basic account information
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center space-x-4'>
              <Avatar className='h-16 w-16'>
                <AvatarFallback className='text-lg'>
                  {user?.name ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className='space-y-1'>
                <h3 className='text-lg font-semibold'>
                  {user?.name || 'User Name'}
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {user?.email || 'user@example.com'}
                </p>
                <Badge variant='secondary' className='capitalize'>
                  {getCurrentRole()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Shield className='h-5 w-5' />
              Account Details
            </CardTitle>
            <CardDescription>
              Your account status and permissions
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Mail className='h-4 w-4 text-muted-foreground' />
                  <span className='text-sm font-medium'>Email</span>
                </div>
                <span className='text-sm text-muted-foreground'>
                  {user?.email || 'Not provided'}
                </span>
              </div>
              
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Shield className='h-4 w-4 text-muted-foreground' />
                  <span className='text-sm font-medium'>Role</span>
                </div>
                <Badge variant='outline' className='capitalize'>
                  {getCurrentRole()}
                </Badge>
              </div>
              

            </div>
          </CardContent>
        </Card>
        </div>

        {/* Square Integration Section */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Square className='h-5 w-5' />
              Square Integration
            </CardTitle>
            <CardDescription>
              Connect your Square account to view and manage your product catalog
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            {/* Square Credentials Form */}
            <div className='space-y-4'>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='square-app-id'>Square App ID</Label>
                  <Input
                    id='square-app-id'
                    type='text'
                    placeholder='sandbox-sq0idb-...'
                    value={squareCredentials.appId}
                    onChange={(e) => handleCredentialsChange('appId', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='square-secret-key'>Secret Key</Label>
                  <Input
                    id='square-secret-key'
                    type='password'
                    placeholder='Enter your secret key'
                    value={squareCredentials.secretKey}
                    onChange={(e) => handleCredentialsChange('secretKey', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleFetchProducts} 
                disabled={isLoading || !squareCredentials.appId || !squareCredentials.secretKey}
                className='w-full md:w-auto'
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Fetching Products...
                  </>
                ) : (
                  <>
                    <Square className='mr-2 h-4 w-4' />
                    Fetch Square Products
                  </>
                )}
              </Button>
            </div>

            {/* Status Messages */}
            {error && (
              <Alert variant='destructive'>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className='border-green-200 bg-green-50 text-green-800'>
                <CheckCircle className='h-4 w-4' />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Products Table */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h3 className='text-lg font-semibold'>Your Square Products</h3>
                {products.length > 0 && (
                  <Badge variant='secondary'>{products.length} products</Badge>
                )}
              </div>
              
              <div className='border rounded-lg overflow-hidden'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Variation</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Taxable</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length > 0 ? (
                      products.map((product, index) => (
                        <TableRow key={`${product.id}-${index}`}>
                          <TableCell className='font-medium'>
                            {product.name}
                          </TableCell>
                          <TableCell>
                            {product.variationName}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(product.price, product.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.isTaxable ? 'default' : 'secondary'}>
                              {product.isTaxable ? 'Yes' : 'No'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.isArchived ? 'destructive' : 'default'}>
                              {product.isArchived ? 'Archived' : 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell className='text-sm text-muted-foreground'>
                            {new Date(product.updatedAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className='text-center text-muted-foreground py-8'>
                          No products found. Enter your Square credentials and click &quot;Fetch Square Products&quot; to load your catalog.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

