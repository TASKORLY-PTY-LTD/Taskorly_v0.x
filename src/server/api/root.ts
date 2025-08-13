import { createTRPCRouter } from '../trpc';
import { chatRouter } from '../routers/chat';
import { documentsRouter } from '../routers/documents';
import { mcpRouter } from '../routers/mcp';
import { configRouter } from '../routers/config';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  chat: chatRouter,
  documents: documentsRouter,
  mcp: mcpRouter,
  config: configRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;