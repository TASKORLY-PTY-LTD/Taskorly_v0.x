import { initTRPC, TRPCError } from '@trpc/server';
import { type NextRequest } from 'next/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Create context for tRPC
export const createTRPCContext = async (opts: { req: NextRequest }) => {
  const { req } = opts;

  // Get auth token from request
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  let user = null;
  let tenant = null;

  if (token) {
    try {
      // Verify the JWT token
      const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
      
      if (authUser && !error) {
        // Get user from our database
        const { data: dbUser } = await supabaseAdmin
          .from('users')
          .select('*, tenants(*)')
          .eq('id', authUser.id)
          .single();

        if (dbUser) {
          user = dbUser;
          tenant = dbUser.tenants;
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  }

  return {
    req,
    user,
    tenant,
    supabase,
    supabaseAdmin,
  };
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
      user: ctx.user,
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