'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Building2, MapPin } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';

interface SignupFormProps {
  onSignupSuccess?: (data: { user: any; business: any; tenant: any }) => void;
  onSwitchToLogin?: () => void;
  className?: string;
}

export function SignupForm({
  onSignupSuccess,
  onSwitchToLogin,
  className,
}: SignupFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    businessName: '',
    storeName: '',
    location: '',
    industry: '',
    phone: '',
    website: '',
    agreeToTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: data => {
      setErrors({});
      onSignupSuccess?.(data);
    },
    onError: error => {
      setErrors({ submit: error.message });
    },
  });

  const validatePassword = (password: string) => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('One number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
      errors.push('One special character');
    return errors;
  };

  const passwordValidation = validatePassword(formData.password);
  const isPasswordValid =
    passwordValidation.length === 0 && formData.password.length > 0;
  const passwordsMatch =
    formData.password === formData.confirmPassword &&
    formData.confirmPassword.length > 0;

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field-specific errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (passwordValidation.length > 0) {
      newErrors.password = 'Password does not meet requirements';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }

    if (!formData.storeName.trim()) {
      newErrors.storeName = 'Store/Location name is required';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location address is required';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    signupMutation.mutate({
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      businessName: formData.businessName,
      storeName: formData.storeName,
      location: formData.location,
      industry: formData.industry || undefined,
      phone: formData.phone || undefined,
      website: formData.website || undefined,
      role: 'owner',
    });
  };

  return (
    <Card className={`w-full max-w-2xl mx-auto ${className}`}>
      <CardHeader className='space-y-1'>
        <CardTitle className='text-2xl font-bold text-center'>
          Create Your Account
        </CardTitle>
        <CardDescription className='text-center'>
          Set up your business and first location
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* Personal Information Section */}
          <div className='space-y-4'>
            <h3 className='text-lg font-semibold flex items-center gap-2'>
              Personal Information
            </h3>
            
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {/* Full Name */}
              <div className='space-y-2'>
                <Label htmlFor='fullName'>Full Name</Label>
                <Input
                  id='fullName'
                  type='text'
                  placeholder='John Smith'
                  value={formData.fullName}
                  onChange={e => handleInputChange('fullName', e.target.value)}
                  className={errors.fullName ? 'border-red-500' : ''}
                  disabled={signupMutation.isPending}
                />
                {errors.fullName && (
                  <p className='text-sm text-red-500'>{errors.fullName}</p>
                )}
              </div>

              {/* Email */}
              <div className='space-y-2'>
                <Label htmlFor='email'>Email</Label>
                <Input
                  id='email'
                  type='email'
                  placeholder='john@elitesupplements.com'
                  value={formData.email}
                  onChange={e => handleInputChange('email', e.target.value)}
                  className={errors.email ? 'border-red-500' : ''}
                  disabled={signupMutation.isPending}
                />
                {errors.email && (
                  <p className='text-sm text-red-500'>{errors.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Business Information Section */}
          <div className='space-y-4'>
            <h3 className='text-lg font-semibold flex items-center gap-2'>
              <Building2 className='h-5 w-5' />
              Business Information
            </h3>
            
            <div className='grid grid-cols-1 gap-4'>
              {/* Business Name */}
              <div className='space-y-2'>
                <Label htmlFor='businessName'>Business Name</Label>
                <Input
                  id='businessName'
                  type='text'
                  placeholder='Elite Supplements'
                  value={formData.businessName}
                  onChange={e => handleInputChange('businessName', e.target.value)}
                  className={errors.businessName ? 'border-red-500' : ''}
                  disabled={signupMutation.isPending}
                />
                {errors.businessName && (
                  <p className='text-sm text-red-500'>{errors.businessName}</p>
                )}
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {/* Industry (Optional) */}
                <div className='space-y-2'>
                  <Label htmlFor='industry'>Industry (Optional)</Label>
                  <Input
                    id='industry'
                    type='text'
                    placeholder='Retail, Health & Fitness'
                    value={formData.industry}
                    onChange={e => handleInputChange('industry', e.target.value)}
                    disabled={signupMutation.isPending}
                  />
                </div>

                {/* Phone (Optional) */}
                <div className='space-y-2'>
                  <Label htmlFor='phone'>Phone (Optional)</Label>
                  <Input
                    id='phone'
                    type='tel'
                    placeholder='+61 2 1234 5678'
                    value={formData.phone}
                    onChange={e => handleInputChange('phone', e.target.value)}
                    disabled={signupMutation.isPending}
                  />
                </div>
              </div>

              {/* Website (Optional) */}
              <div className='space-y-2'>
                <Label htmlFor='website'>Website (Optional)</Label>
                <Input
                  id='website'
                  type='url'
                  placeholder='https://elitesupplements.com.au'
                  value={formData.website}
                  onChange={e => handleInputChange('website', e.target.value)}
                  disabled={signupMutation.isPending}
                />
              </div>
            </div>
          </div>

          {/* Store/Location Information Section */}
          <div className='space-y-4'>
            <h3 className='text-lg font-semibold flex items-center gap-2'>
              <MapPin className='h-5 w-5' />
              First Store Location
            </h3>
            
            <div className='grid grid-cols-1 gap-4'>
              {/* Store Name */}
              <div className='space-y-2'>
                <Label htmlFor='storeName'>Store/Location Name</Label>
                <Input
                  id='storeName'
                  type='text'
                  placeholder='Chatswood'
                  value={formData.storeName}
                  onChange={e => handleInputChange('storeName', e.target.value)}
                  className={errors.storeName ? 'border-red-500' : ''}
                  disabled={signupMutation.isPending}
                />
                {errors.storeName && (
                  <p className='text-sm text-red-500'>{errors.storeName}</p>
                )}
                <p className='text-xs text-gray-600'>
                  e.g., &ldquo;Chatswood&rdquo;, &ldquo;Sydney CBD&rdquo;, &ldquo;Melbourne Central&rdquo;
                </p>
              </div>

              {/* Location */}
              <div className='space-y-2'>
                <Label htmlFor='location'>Store Address</Label>
                <Input
                  id='location'
                  type='text'
                  placeholder='123 Victoria Ave, Chatswood NSW 2067'
                  value={formData.location}
                  onChange={e => handleInputChange('location', e.target.value)}
                  className={errors.location ? 'border-red-500' : ''}
                  disabled={signupMutation.isPending}
                />
                {errors.location && (
                  <p className='text-sm text-red-500'>{errors.location}</p>
                )}
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className='space-y-4'>
            <h3 className='text-lg font-semibold'>Create Password</h3>
            
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {/* Password */}
              <div className='space-y-2'>
                <Label htmlFor='password'>Password</Label>
                <div className='relative'>
                  <Input
                    id='password'
                    type={showPassword ? 'text' : 'password'}
                    placeholder='Create a password'
                    value={formData.password}
                    onChange={e => handleInputChange('password', e.target.value)}
                    className={`pr-10 ${errors.password ? 'border-red-500' : isPasswordValid ? 'border-green-500' : ''}`}
                    disabled={signupMutation.isPending}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={signupMutation.isPending}
                  >
                    {showPassword ? (
                      <EyeOff className='h-4 w-4' />
                    ) : (
                      <Eye className='h-4 w-4' />
                    )}
                  </Button>
                </div>

                {/* Password Requirements */}
                {formData.password && (
                  <div className='text-xs space-y-1'>
                    {passwordValidation.map((req, index) => (
                      <div
                        key={index}
                        className='flex items-center gap-2 text-red-500'
                      >
                        <XCircle className='h-3 w-3' />
                        {req}
                      </div>
                    ))}
                    {isPasswordValid && (
                      <div className='flex items-center gap-2 text-green-500'>
                        <CheckCircle className='h-3 w-3' />
                        Password meets all requirements
                      </div>
                    )}
                  </div>
                )}
                {errors.password && (
                  <p className='text-sm text-red-500'>{errors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className='space-y-2'>
                <Label htmlFor='confirmPassword'>Confirm Password</Label>
                <div className='relative'>
                  <Input
                    id='confirmPassword'
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder='Confirm your password'
                    value={formData.confirmPassword}
                    onChange={e =>
                      handleInputChange('confirmPassword', e.target.value)
                    }
                    className={`pr-10 ${errors.confirmPassword ? 'border-red-500' : passwordsMatch ? 'border-green-500' : ''}`}
                    disabled={signupMutation.isPending}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={signupMutation.isPending}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className='h-4 w-4' />
                    ) : (
                      <Eye className='h-4 w-4' />
                    )}
                  </Button>
                </div>
                {formData.confirmPassword && passwordsMatch && (
                  <div className='flex items-center gap-2 text-green-500 text-xs'>
                    <CheckCircle className='h-3 w-3' />
                    Passwords match
                  </div>
                )}
                {errors.confirmPassword && (
                  <p className='text-sm text-red-500'>{errors.confirmPassword}</p>
                )}
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className='flex items-start space-x-2'>
            <Checkbox
              id='agreeToTerms'
              checked={formData.agreeToTerms}
              onCheckedChange={checked =>
                handleInputChange('agreeToTerms', checked === true)
              }
              disabled={signupMutation.isPending}
              className={errors.agreeToTerms ? 'border-red-500' : ''}
            />
            <div className='grid gap-1.5 leading-none'>
              <Label
                htmlFor='agreeToTerms'
                className='text-sm font-normal leading-tight cursor-pointer'
              >
                I agree to the{' '}
                <Link href='/terms' className='underline hover:no-underline'>
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href='/privacy' className='underline hover:no-underline'>
                  Privacy Policy
                </Link>
              </Label>
              {errors.agreeToTerms && (
                <p className='text-sm text-red-500'>{errors.agreeToTerms}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type='submit'
            className='w-full'
            disabled={signupMutation.isPending}
          >
            {signupMutation.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Creating Your Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>

          {/* Error Message */}
          {errors.submit && (
            <Alert variant='destructive'>
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>

      <CardFooter className='flex justify-center'>
        <p className='text-sm text-gray-600'>
          Already have an account?{' '}
          <Button
            variant='link'
            className='p-0 h-auto font-normal'
            onClick={onSwitchToLogin}
            disabled={signupMutation.isPending}
          >
            Sign in
          </Button>
        </p>
      </CardFooter>
    </Card>
  );
}