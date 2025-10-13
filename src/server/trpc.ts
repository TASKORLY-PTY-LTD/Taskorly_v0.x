import { initTRPC, TRPCError } from '@trpc/server';
import { type NextRequest } from 'next/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { supabaseAdmin } from '@/lib/supabase'; // Keep admin for admin tasks
import { createClient } from '@supabase/supabase-js'; // We need this to create user-specific clients

// Create context for tRPC
export const createTRPCContext = async (opts: { req: NextRequest }) => {
  const { req } = opts;

  // Get auth token from request
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  // If there's no token, return a basic context
  if (!token) {
    return {
      req,
      user: null,
      tenant: null,
      supabase: createClient( // Return a basic, unauthenticated client
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
      supabaseAdmin,
    };
  }

  // --- START: THE FIX ---
  // Create a new Supabase client INSTANCE, authenticated as the user
  const userSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  // Now, use this user-specific client to get both the auth user and the db user
  const { data: { user: authUser } } = await userSupabase.auth.getUser();

  if (!authUser) {
    // If the token is invalid, return a null context
    return {
      req,
      user: null,
      tenant: null,
      supabase: userSupabase, // Still return the (failed) user client
      supabaseAdmin,
    };
  }
  
  // Use the SAME user-authenticated client to fetch from the database.
  // This will correctly respect all RLS policies.
  const { data: dbUser, error: dbError } = await userSupabase
    .from('users')
    .select('*, tenants!inner(*)')
    .eq('id', authUser.id)
    .single();

  if (dbError || !dbUser) {
    // This can happen if the user exists in auth but not in your public.users table
    console.error('Could not find DB user for authenticated user:', authUser.id, dbError);
    return {
      req,
      user: null,
      tenant: null,
      supabase: userSupabase,
      supabaseAdmin,
    };
  }

  const tenant = Array.isArray(dbUser.tenants)
    ? dbUser.tenants[0]
    : dbUser.tenants;

  // Return a fully populated context
  return {
    req,
    user: dbUser,
    tenant: tenant,
    supabase: userSupabase, // This is the authenticated client for procedures to use
    supabaseAdmin,
  };
  // --- END: THE FIX ---
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      // The user object is already the full user profile from the DB
      user: ctx.user, 
      tenant: ctx.tenant,
    },
  });
});

// ... the rest of your procedures (tenantProcedure, adminProcedure) are correct and remain the same
// Tenant procedure that requires both user and tenant
export const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.tenant) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Tenant access required',
    });
  }
  return next({
    ctx: {
      ...ctx,
      tenant: ctx.tenant,
    },
  });
});

// Admin procedure that requires admin role
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !['owner', 'admin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({
    ctx,
  });
});

// Admin tenant procedure that requires both admin role and tenant
export const adminTenantProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (!ctx.user || !['owner', 'admin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({
    ctx,
  });
});