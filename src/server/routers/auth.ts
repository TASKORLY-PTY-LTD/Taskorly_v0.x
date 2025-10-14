import { supabaseAdmin } from '@/lib/Connections/supabase';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';
import { createClient } from '@supabase/supabase-js'; // <-- ADD THIS IMPORT

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
        // This usually means the refresh token is invalid or expired
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Failed to refresh session.' });
      }

      // Return the new tokens
      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };
    }),


  // User signup with email/password (This remains unchanged)
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
      // ... your existing signup logic is correct and remains here ...
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
        // Step 1: Authenticate with Supabase using the admin client
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.signInWithPassword({
            email: input.email,
            password: input.password,
          });

        if (authError || !authData.session) {
          if (authError) {
            console.error('🔴 Supabase Auth Error:', authError.message);
          }
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',
          });
        }

        // --- START: THE FIX ---
        // Step 2: Create a NEW Supabase client authenticated as the logged-in user.
        // This is necessary to respect Row Level Security (RLS) policies.
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

        // Step 3: Fetch the user's profile using the NEW, user-authenticated client.
        const { data: dbUser, error: dbError } = await userSupabase
          .from('users')
          .select(
            `
            *,
            tenants(*)
          `
          )
          .eq('id', authData.user.id)
          .single();
        // --- END: THE FIX ---

        if (dbError) {
          console.error('DB Error:', dbError);
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Failed to find user profile after login.', // More specific message
            cause: dbError,
          });
        }

        if (!dbUser) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User profile not found.',
          });
        }

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
  
  // ... the rest of your file (me, updateUserRole, etc.) remains unchanged ...
  // Get current user info (requires auth)
  me: protectedProcedure.query(async ({ ctx }) => {
    // The 'isAuthed' middleware has already fetched the user and tenant.
    // We can just return it directly from the context.
    if (!ctx.user || !ctx.tenant) {
      // This should ideally never happen if middleware is correct
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Context not populated correctly.' });
    }

    // Get permissions based on the role from the context
    const permissions =
      ROLE_PERMISSIONS[ctx.user.role as keyof typeof ROLE_PERMISSIONS] || [];

    // You will need to fetch the full profile here one last time if you need more fields than what's in ctx.user
    // Or, even better, add more fields to ctx.user in the middleware
    const { data: dbUser } = await ctx.supabase
      .from('users')
      .select('*')
      .eq('id', ctx.user.id)
      .single();

    return {
      user: {
        id: ctx.user.id,
        email: dbUser?.email, // get from the fresh fetch
        fullName: dbUser?.full_name, // get from the fresh fetch
        role: ctx.user.role,
        tenantId: ctx.tenant.id,
        permissions,
      },
      tenant: ctx.tenant,
    };
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
        const { data: updatedUser, error } = await ctx.supabase
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
        const { data: users, error } = await ctx.supabase
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
        const { data: existingUser } = await ctx.supabase
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