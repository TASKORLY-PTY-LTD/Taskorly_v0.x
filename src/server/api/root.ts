import { createTRPCRouter } from '../trpc';
import { authRouter } from '../routers/auth';
import { chatRouter } from '../routers/chat';
import { documentsRouter } from '../routers/documents';
import { mcpRouter } from '../routers/mcp';
import { configRouter } from '../routers/config';
import { settingsRouter } from '../routers/settings';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  chat: chatRouter,
  documents: documentsRouter,
  mcp: mcpRouter,
  config: configRouter,
  settings: settingsRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
