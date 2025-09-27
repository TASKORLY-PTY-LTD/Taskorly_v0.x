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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';

interface SignupFormProps {
  onSignupSuccess?: (data: { user: any; tenant: any }) => void;
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
    tenantName: '',
    role: 'owner' as const,
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

    if (formData.role === 'owner' && !formData.tenantName.trim()) {
      newErrors.tenantName = 'Company/Organization name is required for owners';
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
      tenantName: formData.role === 'owner' ? formData.tenantName : undefined,
      role: formData.role,
    });
  };

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardHeader className='space-y-1'>
        <CardTitle className='text-2xl font-bold text-center'>
          Create Account
        </CardTitle>
        <CardDescription className='text-center'>
          Get started with Taskorly
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Email */}
          <div className='space-y-2'>
            <Label htmlFor='email'>Email</Label>
            <Input
              id='email'
              type='email'
              placeholder='Enter your email'
              value={formData.email}
              onChange={e => handleInputChange('email', e.target.value)}
              className={errors.email ? 'border-red-500' : ''}
              disabled={signupMutation.isPending}
            />
            {errors.email && (
              <p className='text-sm text-red-500'>{errors.email}</p>
            )}
          </div>

          {/* Full Name */}
          <div className='space-y-2'>
            <Label htmlFor='fullName'>Full Name</Label>
            <Input
              id='fullName'
              type='text'
              placeholder='Enter your full name'
              value={formData.fullName}
              onChange={e => handleInputChange('fullName', e.target.value)}
              className={errors.fullName ? 'border-red-500' : ''}
              disabled={signupMutation.isPending}
            />
            {errors.fullName && (
              <p className='text-sm text-red-500'>{errors.fullName}</p>
            )}
          </div>

          {/* Role Selection */}
          <div className='space-y-2'>
            <Label htmlFor='role'>Account Type</Label>
            <Select
              value={formData.role}
              onValueChange={(value: 'owner' | 'admin' | 'manager' | 'user') =>
                handleInputChange('role', value)
              }
              disabled={signupMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='owner'>
                  Business Owner - Create new organization
                </SelectItem>
                <SelectItem value='user' disabled>
                  Team Member - Join existing organization
                </SelectItem>
              </SelectContent>
            </Select>
            <p className='text-xs text-gray-600'>
              Team members must be invited by an administrator
            </p>
          </div>

          {/* Company/Organization Name (for owners) */}
          {formData.role === 'owner' && (
            <div className='space-y-2'>
              <Label htmlFor='tenantName'>Company/Organization Name</Label>
              <Input
                id='tenantName'
                type='text'
                placeholder='Enter your company name'
                value={formData.tenantName}
                onChange={e => handleInputChange('tenantName', e.target.value)}
                className={errors.tenantName ? 'border-red-500' : ''}
                disabled={signupMutation.isPending}
              />
              {errors.tenantName && (
                <p className='text-sm text-red-500'>{errors.tenantName}</p>
              )}
            </div>
          )}

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
                Creating Account...
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
