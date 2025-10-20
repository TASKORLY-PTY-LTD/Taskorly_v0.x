import { supabaseAdmin } from '@/lib/Connections/supabase';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';
import { createClient } from '@supabase/supabase-js';

// Permission definitions for different roles
const ROLE_PERMISSIONS = {
  owner: [
    'admin:*',
    'manager:*',
    'user:*',
    'servers:*',
    'settings:*',
    'analytics:*',
    'vector-store:*',
    'billing:*',
    'tenant:*',
  ],
  admin: [
    'admin:*',
    'manager:*',
    'user:*',
    'servers:*',
    'settings:*',
    'analytics:*',
    'vector-store:*',
  ],
  manager: [
    'manager:*',
    'user:*',
    'servers:read',
    'settings:read',
    'analytics:read',
    'documents:*',
    'chat:*',
  ],
  user: ['user:read', 'chat:*', 'documents:read'],
  guest: ['user:read', 'chat:read'],
} as const;

export const authRouter = createTRPCRouter({

  refreshToken: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input }) => {
      if (!input.refreshToken) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No refresh token provided.' });
      }

      const { data, error } = await supabaseAdmin.auth.refreshSession({
        refresh_token: input.refreshToken,
      });

      if (error || !data.session) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Failed to refresh session.' });
      }

      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };
    }),

  // User signup with email/password
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8).max(100),
        fullName: z.string().min(1).max(100),
        businessName: z.string().min(1).max(100),
        storeName: z.string().min(1).max(100),
        location: z.string().min(1).max(200),
        industry: z.string().optional(),
        businessType: z.string().optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        role: z.enum(['owner', 'admin', 'manager', 'user']).default('owner'),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Check if user already exists in auth
        const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
        const authUserExists = existingAuthUser?.users.find(u => u.email === input.email);

        if (authUserExists) {
          // Check if they have an employee record
          const { data: existingEmployee } = await supabaseAdmin
            .from('employees')
            .select('employee_id, user_id')
            .eq('user_id', authUserExists.id)
            .maybeSingle();
          
          if (existingEmployee) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'User with this email already exists',
            });
          } else {
            // Auth user exists but no employee record - this is an orphaned user
            console.log('Found orphaned auth user, cleaning up...');
            await supabaseAdmin.auth.admin.deleteUser(authUserExists.id);
            console.log('✅ Cleaned up orphaned auth user');
          }
        }

        // Also check for orphaned employee records (employee without auth user)
        const { data: orphanedEmployees } = await supabaseAdmin
          .from('employees')
          .select('employee_id, user_id')
          .is('user_id', null)
          .limit(100);

        if (orphanedEmployees && orphanedEmployees.length > 0) {
          console.log(`Found ${orphanedEmployees.length} orphaned employee records, cleaning up...`);
          for (const emp of orphanedEmployees) {
            await supabaseAdmin
              .from('employees')
              .delete()
              .eq('employee_id', emp.employee_id);
          }
          console.log('✅ Cleaned up orphaned employee records');
        }

        let business;
        let tenant;

        if (input.role === 'owner') {
          // Step 1: Create the business (the organization/company)
          const { data: newBusiness, error: businessError } = await supabaseAdmin
            .from('businesses')
            .insert({
              business_name: input.businessName,
              industry: input.industry,
              type: input.businessType,
              phone: input.phone,
              website: input.website,
              email: input.email,
            })
            .select()
            .single();

          if (businessError) {
            console.error('Business creation failed:', businessError);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to create business: ${businessError.message}`,
              cause: businessError,
            });
          }

          business = newBusiness;

          // Step 2: Create the tenant (the store/location)
          const tenantSlug = `${input.businessName}-${input.storeName}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .trim();

          const { data: newTenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .insert({
              name: input.storeName,
              slug: tenantSlug,
              location: input.location,
              business_id: business.business_id,
            })
            .select()
            .single();

          if (tenantError) {
            console.error('Tenant creation failed:', tenantError);
            // Rollback: delete the business if tenant creation fails
            await supabaseAdmin
              .from('businesses')
              .delete()
              .eq('business_id', business.business_id);
            
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to create store location: ${tenantError.message}`,
              cause: tenantError,
            });
          }

          tenant = newTenant;
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Non-owner users must be invited to existing stores',
          });
        }

        // Step 3: Create user using Supabase Auth
        console.log('Creating auth user for:', input.email);
        const { data: authUser, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email: input.email,
            password: input.password,
            email_confirm: true,
            user_metadata: {
              full_name: input.fullName,
              tenant_id: tenant.tenant_id,
              business_id: business.business_id,
              role: input.role,
            },
          });

        if (authError || !authUser.user) {
          console.error('Auth user creation failed:', authError);
          // Rollback: delete tenant and business
          await supabaseAdmin
            .from('tenants')
            .delete()
            .eq('tenant_id', tenant.tenant_id);
          await supabaseAdmin
            .from('businesses')
            .delete()
            .eq('business_id', business.business_id);
          
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create user account',
          });
        }

        console.log('✅ Auth user created:', authUser.user.id);

        // Check if employee record already exists (might be created by database trigger)
        const { data: existingEmp } = await supabaseAdmin
          .from('employees')
          .select('employee_id, user_id, tenant_id, role')
          .eq('user_id', authUser.user.id)
          .maybeSingle();

        let dbEmployee;

        if (existingEmp) {
          console.log('⚠️ Employee record already exists (likely from database trigger), updating it...');
          // Update the existing employee record with correct data
          const { data: updatedEmployee, error: updateError } = await supabaseAdmin
            .from('employees')
            .update({
              tenant_id: tenant.tenant_id,
              role: input.role,
              active: 'active',
            })
            .eq('user_id', authUser.user.id)
            .select()
            .single();

          if (updateError) {
            console.error('Failed to update employee record:', updateError);
            // Rollback
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            await supabaseAdmin
              .from('tenants')
              .delete()
              .eq('tenant_id', tenant.tenant_id);
            await supabaseAdmin
              .from('businesses')
              .delete()
              .eq('business_id', business.business_id);
            
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to update employee profile',
            });
          }

          dbEmployee = updatedEmployee;
          console.log('✅ Employee record updated');
        } else {
          // Step 4: Create employee record in database (if trigger didn't create it)
          console.log('Creating employee record for user_id:', authUser.user.id);
          const { data: newEmployee, error: dbError } = await supabaseAdmin
            .from('employees')
            .insert({
              user_id: authUser.user.id,
              tenant_id: tenant.tenant_id,
              role: input.role,
              active: 'active',
            })
            .select()
            .single();

          if (dbError) {
            console.error('Database error creating employee:', dbError);
            console.error('Error code:', dbError.code);
            console.error('Error message:', dbError.message);
            console.error('Error details:', dbError.details);
            console.error('Error hint:', dbError.hint);
            
            // Rollback: delete everything in reverse order
            try {
              await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
              console.log('✅ Rolled back auth user');
            } catch (authDeleteError) {
              console.error('Failed to delete auth user during rollback:', authDeleteError);
            }
            
            try {
              await supabaseAdmin
                .from('tenants')
                .delete()
                .eq('tenant_id', tenant.tenant_id);
              console.log('✅ Rolled back tenant');
            } catch (tenantDeleteError) {
              console.error('Failed to delete tenant during rollback:', tenantDeleteError);
            }
            
            try {
              await supabaseAdmin
                .from('businesses')
                .delete()
                .eq('business_id', business.business_id);
              console.log('✅ Rolled back business');
            } catch (businessDeleteError) {
              console.error('Failed to delete business during rollback:', businessDeleteError);
            }
            
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to create user profile: ${dbError.message}`,
              cause: dbError,
            });
          }

          dbEmployee = newEmployee;
          console.log('✅ Employee record created');
        }

        // Step 5: Create default tenant configuration for owner
        if (input.role === 'owner') {
          const { error: settingsError } = await supabaseAdmin.from('settings').insert({
            tenant_id: tenant.tenant_id,
            description: `Settings for ${input.storeName}`,
            industry: input.industry,
          });
          
          if (settingsError) {
            console.error('Failed to create tenant settings:', settingsError);
            // Don't fail signup for this
          }
        }

        return {
          user: {
            id: authUser.user.id,
            employeeId: dbEmployee.employee_id,
            email: input.email,
            fullName: input.fullName,
            role: dbEmployee.role,
            tenantId: dbEmployee.tenant_id,
            permissions: ROLE_PERMISSIONS[input.role],
          },
          business: {
            id: business.business_id,
            name: business.business_name,
            industry: business.industry,
            type: business.type,
          },
          tenant: {
            id: tenant.tenant_id,
            name: tenant.name,
            slug: tenant.slug,
            location: tenant.location,
          },
        };
      } catch (error) {
        console.error('Signup error:', error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create user account',
        });
      }
    }),

  // User login with email/password
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Authenticate with Supabase
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.signInWithPassword({
            email: input.email,
            password: input.password,
          });

        if (authError || !authData.session) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',
          });
        }

        // Create user-authenticated client for RLS
        const userSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${authData.session.access_token}`,
              },
            },
          }
        );

        // Fetch employee record with tenant and business info
        const { data: dbEmployee, error: dbError } = await userSupabase
          .from('employees')
          .select(`
            *,
            tenants (
              *,
              businesses (*)
            )
          `)
          .eq('user_id', authData.user.id)
          .single();

        if (dbError || !dbEmployee) {
          console.error('DB Error:', dbError);
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Failed to find user profile after login.',
            cause: dbError,
          });
        }

        const permissions =
          ROLE_PERMISSIONS[dbEmployee.role as keyof typeof ROLE_PERMISSIONS] || [];

        return {
          user: {
            id: authData.user.id,
            employeeId: dbEmployee.employee_id,
            email: authData.user.email || input.email,
            fullName: authData.user.user_metadata?.full_name || '',
            role: dbEmployee.role,
            tenantId: dbEmployee.tenant_id,
            permissions,
          },
          tenant: dbEmployee.tenants,
          business: dbEmployee.tenants?.businesses,
          accessToken: authData.session.access_token,
          refreshToken: authData.session.refresh_token,
        };
      } catch (error) {
        console.error('Login error:', error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Login failed',
        });
      }
    }),

  // Get current user info (requires auth)
  me: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user || !ctx.tenant) {
      throw new TRPCError({ 
        code: 'INTERNAL_SERVER_ERROR', 
        message: 'Context not populated correctly.' 
      });
    }

    const permissions =
      ROLE_PERMISSIONS[ctx.user.role as keyof typeof ROLE_PERMISSIONS] || [];

    // Fetch full employee data with tenant and business
    const { data: dbEmployee } = await ctx.supabase
      .from('employees')
      .select(`
        *,
        tenants (
          *,
          businesses (*)
        )
      `)
      .eq('user_id', ctx.user.id)
      .single();

    return {
      user: {
        id: ctx.user.id,
        employeeId: dbEmployee?.employee_id,
        email: ctx.user.email,
        fullName: ctx.user.user_metadata?.full_name || '',
        role: ctx.user.role,
        tenantId: ctx.tenant.tenant_id,
        permissions,
      },
      tenant: dbEmployee?.tenants,
      business: dbEmployee?.tenants?.businesses,
    };
  }),

  // Update user role (admin only)
  updateUserRole: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        role: z.enum(['owner', 'admin', 'manager', 'user', 'guest']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!['admin', 'owner'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can update user roles',
        });
      }

      try {
        const { data: updatedEmployee, error } = await ctx.supabase
          .from('employees')
          .update({
            role: input.role,
            updated_at: new Date().toISOString(),
          })
          .eq('employee_id', input.employeeId)
          .eq('tenant_id', ctx.tenant!.tenant_id)
          .select()
          .single();

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update user role',
          });
        }

        return updatedEmployee;
      } catch (error) {
        console.error('Update role error:', error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user role',
        });
      }
    }),

  // List users in tenant (admin only)
  listUsers: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!['admin', 'owner'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can list users',
        });
      }

      try {
        const { data: employees, error } = await ctx.supabase
          .from('employees')
          .select('*')
          .eq('tenant_id', ctx.tenant!.tenant_id)
          .order('created_at', { ascending: false })
          .range(input.offset, input.offset + input.limit - 1);

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch users',
          });
        }

        return employees || [];
      } catch (error) {
        console.error('List users error:', error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list users',
        });
      }
    }),

  // Invite user to tenant (admin only)
  inviteUser: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        fullName: z.string().min(1).max(100),
        role: z.enum(['admin', 'manager', 'user']).default('user'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!['admin', 'owner'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can invite users',
        });
      }

      try {
        // Check if user already exists in this tenant
        const { data: existingEmployee } = await ctx.supabase
          .from('employees')
          .select('user_id')
          .eq('tenant_id', ctx.tenant!.tenant_id)
          .single();

        // Also check auth users by email
        const { data: authUsers } = await ctx.supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = authUsers?.users.find(u => u.email === input.email);

        if (existingAuthUser && existingEmployee) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User already exists in this store',
          });
        }

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

        // Create user using Supabase Auth
        const { data: authUser, error: authError } =
          await ctx.supabaseAdmin.auth.admin.createUser({
            email: input.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: input.fullName,
              tenant_id: ctx.tenant!.tenant_id,
              role: input.role,
              invited_by: ctx.user.id,
              requires_password_reset: true,
            },
          });

        if (authError || !authUser.user) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create user account',
          });
        }

        // Create employee record
        const { data: dbEmployee, error: dbError } = await ctx.supabaseAdmin
          .from('employees')
          .insert({
            user_id: authUser.user.id,
            tenant_id: ctx.tenant!.tenant_id,
            role: input.role,
            active: 'active', // Using 'active' instead of 'true'
          })
          .select()
          .single();

        if (dbError) {
          // Rollback: delete the auth user if db insert fails
          await ctx.supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create user profile',
          });
        }

        return {
          employee: dbEmployee,
          temporaryPassword: tempPassword,
        };
      } catch (error) {
        console.error('Invite user error:', error);
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to invite user',
        });
      }
    }),
});