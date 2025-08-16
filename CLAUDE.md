# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Project Overview

**Taskorly** is a multi-tenant RAG (Retrieval Augmented Generation) chat system built with Next.js
15, featuring:

- **Multi-tenant Architecture**: Complete workspace isolation with Supabase RLS
- **RAG Pipeline**: LangChain.js integration with vector embeddings and semantic search
- **MCP Integration**: Model Context Protocol for vendor API integrations
- **Type-safe APIs**: tRPC for end-to-end type safety
- **Real-time Chat**: Streaming responses with context retrieval

## Development Commands

### Essential Commands

```bash
# Development
npm run dev                 # Start development server (runs dependency validation first)

# Quality & Testing
npm run quality            # Run all quality checks (type-check + lint + format)
npm run quality:fix        # Auto-fix linting and formatting issues
npm run type-check         # TypeScript type checking
npm run type-check:watch   # Watch mode for type checking
npm run lint:strict        # Strict ESLint checking (max 0 warnings)
npm run format             # Format code with Prettier
npm run test              # Run test suite (placeholder - tests not implemented)
npm run validate          # Full validation pipeline (quality + test + build)

# Build & Deployment
npm run build             # Production build (runs type-check first)
npm run start             # Start production server
npm run clean             # Clean build artifacts
npm run clean:deps        # Clean and reinstall dependencies

# Database Operations
npm run db:generate       # Generate TypeScript types from Supabase schema
npm run db:migrate        # Push migrations to Supabase
npm run db:reset          # Reset database to initial state

# Dependency Management
npm run validate-deps     # Validate package dependencies
npm run fix-deps          # Fix dependency issues automatically
```

### Single Test Execution

Tests are not yet implemented. When available, use standard Jest patterns:

```bash
npm test -- --testNamePattern="specific test"
npm test -- path/to/test-file.test.ts
```

## Architecture Overview

### Core Technology Stack

- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS
- **Backend**: tRPC for API layer, Supabase for database/auth
- **AI/ML**: LangChain.js for RAG pipeline, OpenAI/Anthropic/Google AI
- **Vector Database**: Supabase with pgvector extension
- **Type System**: TypeScript with strict configuration
- **UI Components**: Radix UI primitives with custom design system

### Key Architecture Components

#### 1. RAG Pipeline (`src/lib/rag/pipeline.ts`)

Central processing engine for document retrieval and AI responses:

- **Document Processing**: Chunking, embedding generation, vector storage
- **Semantic Search**: Similarity-based document retrieval
- **Streaming Responses**: Real-time AI response generation
- **Multi-Provider Support**: OpenAI, Anthropic, Google AI models

#### 2. MCP Manager (`src/lib/mcp/manager.ts`)

Model Context Protocol integration for external tool access:

- **Server Management**: Dynamic MCP server connections
- **Tool Discovery**: Automatic tool enumeration and caching
- **Client Management**: Per-tenant MCP client isolation
- **Health Monitoring**: Connection status and error recovery

#### 3. tRPC API Layer (`src/server/`)

Type-safe API with four main routers:

- **Chat Router** (`routers/chat.ts`): Message processing, conversation management
- **Documents Router** (`routers/documents.ts`): Document upload, RAG processing
- **MCP Router** (`routers/mcp.ts`): Tool execution, server management
- **Config Router** (`routers/config.ts`): Tenant configuration, API key management

#### 4. Multi-Tenant Security

- **Row Level Security**: Database-level tenant isolation
- **API Key Encryption**: AES-256-GCM for sensitive data
- **Authentication Context**: JWT-based user sessions with tenant association
- **Role-Based Access**: Owner/Admin/User permissions

### Database Schema Structure

```sql
-- Core multi-tenancy
tenants → users → tenant_configurations

-- Document management with RAG
documents → document_chunks (with vector embeddings)

-- Chat system
conversations → messages

-- MCP integration
mcp_servers → api_keys (encrypted)

-- Usage tracking
usage_logs
```

## Key File Locations

### Configuration Files

- `tsconfig.json` - Strict TypeScript configuration with path mapping
- `.eslintrc.json` - ESLint rules with TypeScript support
- `package.json` - Scripts, dependencies, and git hooks
- `next.config.js` - Next.js configuration with webpack fallbacks
- `.env.example` - Environment variable template

### Core Libraries

- `src/lib/rag/pipeline.ts` - RAG processing and LangChain integration
- `src/lib/mcp/manager.ts` - MCP server management and tool execution
- `src/lib/supabase.ts` - Database client configuration
- `src/lib/encryption.ts` - API key encryption utilities
- `src/lib/env.ts` - Environment variable validation with T3 env

### API Routes

- `src/app/api/trpc/[trpc]/route.ts` - tRPC endpoint handler
- `src/app/api/health/route.ts` - Health check endpoint
- `src/server/trpc.ts` - tRPC context and middleware setup

### Frontend Pages

- `src/app/page.tsx` - Landing page
- `src/app/chat/page.tsx` - Main chat interface
- `src/app/documents/page.tsx` - Document management
- `src/app/servers/page.tsx` - MCP server configuration
- `src/app/settings/page.tsx` - Tenant settings

## Development Patterns

### Component Architecture

```typescript
// UI components use Radix UI + Tailwind
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

// Feature components organized by domain
import { ChatInput } from '@/components/chat/chat-input';
import { DocumentTable } from '@/components/documents/document-table';
```

### tRPC Usage Patterns

```typescript
// Client-side API calls
const { data, isLoading } = trpc.chat.getConversation.useQuery({ id: '...' });
const sendMessage = trpc.chat.sendMessage.useMutation();

// Server-side procedures with authentication
export const chatRouter = createTRPCRouter({
  sendMessage: protectedProcedure
    .input(z.object({ message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Access authenticated user: ctx.user
      // Access tenant: ctx.tenant
    }),
});
```

### RAG Integration Pattern

```typescript
// Initialize RAG pipeline with tenant config
const ragPipeline = new RAGPipeline(tenantConfig);

// Process documents for RAG
await ragPipeline.processDocument(document);

// Generate responses with context
for await (const chunk of ragPipeline.processMessage(message, conversationId)) {
  // Handle streaming response chunks
}
```

### MCP Tool Integration

```typescript
// Get available tools for tenant
const tools = await mcpManager.getAvailableTools(tenantId);

// Execute MCP tool
const result = await mcpManager.executeTool(tenantId, toolName, args);
```

## Environment Setup

### Required Environment Variables

```bash
# Database (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security (Required)
ENCRYPTION_KEY=your-32-character-key-here-exactly # Must be exactly 32 characters
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# AI Providers (Optional - configurable per tenant)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
```

### Database Setup

```bash
# Initialize Supabase locally
supabase start

# Apply migrations
npm run db:migrate

# Generate TypeScript types
npm run db:generate
```

## Quality Standards

The project enforces strict quality standards:

- **TypeScript**: Strict mode with enhanced type checking
- **ESLint**: Zero warnings policy with security plugin
- **Prettier**: Consistent code formatting
- **Git Hooks**: Pre-commit quality checks with husky + lint-staged
- **Build Validation**: Type checking before build

Use `npm run quality:check` to run comprehensive quality analysis.

## Multi-Tenant Considerations

When working with this codebase:

- All database operations must respect tenant isolation
- API endpoints require tenant context from authenticated user
- Configuration and API keys are tenant-specific
- RAG pipeline instances are created per tenant
- MCP connections are isolated per tenant

## Performance Notes

- RAG pipeline uses streaming responses for better UX
- Vector search operations are optimized with similarity thresholds
- MCP connections are cached and reused within tenant contexts
- Database queries use RLS for automatic tenant filtering
- Next.js build optimizations include webpack fallbacks for Node.js modules
