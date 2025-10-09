import { supabaseAdmin } from '@/lib/supabase';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

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
  // User signup with email/password
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8).max(100),
        fullName: z.string().min(1).max(100),
        tenantName: z.string().min(1).max(50).optional(),
        role: z.enum(['owner', 'admin', 'manager', 'user']).default('user'),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('email', input.email)
          .single();

        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User with this email already exists',
          });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(input.password, 12);

        // Create or get tenant
        let tenant;
        if (input.role === 'owner' && input.tenantName) {
          // Verify we're using the admin client with proper permissions
          console.log(
            'Creating tenant with admin client for:',
            input.tenantName
          );
          // Create new tenant for owner
          const tenantSlug = input.tenantName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .trim();

          const { data: newTenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .insert({
              name: input.tenantName,
              slug: tenantSlug,
            })
            .select()
            .single();

          if (tenantError) {
            console.error('Tenant creation failed:', {
              error: tenantError,
              message: tenantError.message,
              code: tenantError.code,
              details: tenantError.details,
              hint: tenantError.hint,
              tenantName: input.tenantName,
              slug: tenantSlug,
            });
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to create tenant: ${tenantError.message}`,
              cause: tenantError,
            });
          }

          tenant = newTenant;
        } else {
          // For non-owner roles, they should be assigned to an existing tenant
          // This would typically be handled by an admin inviting users
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Non-owner users must be invited to existing tenants',
          });
        }

        // Create user using Supabase Auth
        const { data: authUser, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email: input.email,
            password: input.password,
            email_confirm: true, // Auto-confirm for now
            user_metadata: {
              full_name: input.fullName,
              tenant_id: tenant.id,
              role: input.role,
            },
          });

        if (authError || !authUser.user) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create user account',
          });
        }

        // Create user record in our database
        const { data: dbUser, error: dbError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authUser.user.id,
            email: input.email,
            full_name: input.fullName,
            tenant_id: tenant.id,
            role: input.role,
          })
          .select()
          .single();

        if (dbError) {
          // Rollback: delete the auth user if db insert fails
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create user profile',
          });
        }

        // Create user permissions record
        const permissions =
          ROLE_PERMISSIONS[input.role] || ROLE_PERMISSIONS.user;
        // TODO: Re-enable after database migration
        // try {
        //   await supabaseAdmin
        //     .from('user_permissions')
        //     .insert({
        //       user_id: authUser.user.id,
        //       permissions: permissions
        //     });
        // } catch (permError) {
        //   console.error('Failed to create user permissions:', permError);
        //   // Don't fail the signup, just log the error
        // }

        // Create default tenant configuration for owner
        if (input.role === 'owner') {
          await supabaseAdmin.from('tenant_configurations').insert({
            tenant_id: tenant.id,
            llm_provider: 'openai',
            llm_model: 'gpt-4o',
            llm_api_key: '', // Will be set later
            embedding_model: 'text-embedding-3-small',
            system_prompt: 'You are a helpful AI assistant.',
            temperature: 0.7,
            max_context_length: 4000,
            vector_db_config: {},
          });
        }

        return {
          user: {
            id: dbUser.id,
            email: dbUser.email,
            fullName: dbUser.full_name,
            role: dbUser.role,
            tenantId: dbUser.tenant_id,
            permissions,
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
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

        if (authError || !authData.user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',
          });
        }

        // Get user details from database
        const { data: dbUser, error: dbError } = await supabaseAdmin
          .from('users')
          .select(
            `
            *,
            tenants(*)
          `
          )
          .eq('id', authData.user.id)
          .single();

        if (dbError) {
          console.error('DB Error:', dbError);
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'There has been a db Error!',
          });
        }

        if (!dbUser) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User profile not found',
          });
        }

        // Get user permissions
        // TODO: Re-enable after database migration
        // const { data: userPermissions } = await supabaseAdmin
        //   .from('user_permissions')
        //   .select('permissions')
        //   .eq('user_id', authData.user.id)
        //   .single();

        const permissions =
          ROLE_PERMISSIONS[dbUser.role as keyof typeof ROLE_PERMISSIONS] || [];

        return {
          user: {
            id: dbUser.id,
            email: dbUser.email,
            fullName: dbUser.full_name,
            role: dbUser.role,
            tenantId: dbUser.tenant_id,
            permissions,
          },
          tenant: dbUser.tenants,
          accessToken: authData.session?.access_token,
          refreshToken: authData.session?.refresh_token,
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
    try {
      const { data: dbUser, error } = await ctx.supabaseAdmin
        .from('users')
        .select(
          `
            *,
            tenants!inner(*)
          `
        )
        .eq('id', ctx.user.id)
        .single();

      if (error || !dbUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Get user permissions
      // TODO: Re-enable after database migration
      // const { data: userPermissions } = await ctx.supabaseAdmin
      //   .from('user_permissions')
      //   .select('permissions')
      //   .eq('user_id', ctx.user.id)
      //   .single();

      const permissions =
        ROLE_PERMISSIONS[dbUser.role as keyof typeof ROLE_PERMISSIONS] || [];

      return {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          fullName: dbUser.full_name,
          role: dbUser.role,
          tenantId: dbUser.tenant_id,
          permissions,
        },
        tenant: dbUser.tenants,
      };
    } catch (error) {
      console.error('Get user error:', error);
      if (error instanceof TRPCError) throw error;

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user info',
      });
    }
  }),

  // Update user role (admin only)
  updateUserRole: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(['owner', 'admin', 'manager', 'user', 'guest']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if current user is admin or owner
      if (!['admin', 'owner'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can update user roles',
        });
      }

      try {
        // Update user role
        const { data: updatedUser, error } = await ctx.supabaseAdmin
          .from('users')
          .update({
            role: input.role,
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.userId)
          .eq('tenant_id', ctx.tenant!.id) // Ensure same tenant
          .select()
          .single();

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update user role',
          });
        }

        // Update permissions
        const permissions =
          ROLE_PERMISSIONS[input.role] || ROLE_PERMISSIONS.user;
        // TODO: Re-enable after database migration
        // await ctx.supabaseAdmin
        //   .from('user_permissions')
        //   .upsert({
        //     user_id: input.userId,
        //     permissions: permissions,
        //     updated_at: new Date().toISOString()
        //   });

        return updatedUser;
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
      // Check if current user is admin or owner
      if (!['admin', 'owner'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can list users',
        });
      }

      try {
        const { data: users, error } = await ctx.supabaseAdmin
          .from('users')
          .select('*')
          .eq('tenant_id', ctx.tenant!.id)
          .order('created_at', { ascending: false })
          .range(input.offset, input.offset + input.limit - 1);

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch users',
          });
        }

        return users || [];
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
      // Check if current user is admin or owner
      if (!['admin', 'owner'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can invite users',
        });
      }

      try {
        // Check if user already exists in this tenant
        const { data: existingUser } = await ctx.supabaseAdmin
          .from('users')
          .select('email')
          .eq('email', input.email)
          .eq('tenant_id', ctx.tenant!.id)
          .single();

        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User already exists in this tenant',
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
              tenant_id: ctx.tenant!.id,
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

        // Create user record in our database
        const { data: dbUser, error: dbError } = await ctx.supabaseAdmin
          .from('users')
          .insert({
            id: authUser.user.id,
            email: input.email,
            full_name: input.fullName,
            tenant_id: ctx.tenant!.id,
            role: input.role,
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

        // Create user permissions
        const permissions =
          ROLE_PERMISSIONS[input.role] || ROLE_PERMISSIONS.user;
        // TODO: Re-enable after database migration
        // try {
        //   await ctx.supabaseAdmin
        //     .from('user_permissions')
        //     .insert({
        //       user_id: authUser.user.id,
        //       permissions: permissions
        //     });
        // } catch (permError) {
        //   console.error('Failed to create user permissions:', permError);
        //   // Don't fail the invite, just log the error
        // }

        // TODO: Send invitation email with temporary password
        // This would integrate with your email service

        return {
          user: dbUser,
          temporaryPassword: tempPassword, // Return for now - in production, send via email
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
