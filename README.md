# Taskorly - Multi-Tenant RAG Chat System

A production-ready multi-tenant RAG (Retrieval Augmented Generation) chat system built with Next.js 15, featuring document processing, vector search, and MCP integrations.

## Features

- **Multi-tenant Architecture**: Complete workspace isolation with Supabase RLS
- **RAG Pipeline**: LangChain.js integration with vector embeddings and semantic search
- **MCP Integration**: Model Context Protocol for vendor API integrations
- **Type-safe APIs**: tRPC for end-to-end type safety
- **Real-time Chat**: Streaming responses with context retrieval
- **Document Management**: Upload, process, and search documents
- **Secure API Key Management**: AES-256-GCM encrypted storage
- **Usage Tracking**: Comprehensive logging and analytics
- **Multiple LLM Providers**: OpenAI, Anthropic, Google AI support

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase project
- LLM provider API keys (optional)

### Setup Sequence

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. **Set up database**:
   ```bash
   # Option A: Run the provided SQL setup
   # Copy setup-database.sql contents into Supabase SQL Editor and run
   
   # Option B: Use Supabase CLI (if available)
   supabase db reset
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

> **For non-technical users**: See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed step-by-step instructions.

### Required Environment Variables

```bash
# Database (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security (Required)
ENCRYPTION_KEY=your-32-character-key-here-exactly # Must be exactly 32 chars
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# AI Providers (Optional - configurable per tenant)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
```

## Architecture Overview

### Core Components

- **RAG Pipeline** (`src/lib/rag/pipeline.ts`): Document processing, embedding generation, retrieval
- **MCP Manager** (`src/lib/mcp/manager.ts`): Model Context Protocol integrations
- **tRPC Routers**: Type-safe API layer with four main routers
- **Database Schema**: Multi-tenant Supabase setup with RLS policies

### API Endpoints

- **Chat Router**: Message processing, conversation management, RAG context
- **Documents Router**: Upload, processing, semantic search, chunking
- **MCP Router**: Tool execution, server management, health monitoring  
- **Config Router**: Tenant settings, API key management, usage analytics

## Development Commands

```bash
# Development
npm run dev                 # Start dev server with dependency validation
npm run build              # Production build with type checking
npm run type-check         # TypeScript validation
npm run lint:strict        # ESLint with zero warnings policy

# Database
npm run db:generate        # Generate TypeScript types from Supabase
npm run db:migrate         # Push migrations to Supabase
npm run db:reset           # Reset database to initial state

# Quality & Testing
npm run quality            # Run type-check + lint + format
npm run quality:fix        # Auto-fix linting and formatting
npm run validate          # Full validation pipeline
```

## Troubleshooting

### PGRST106 Schema Error
**Root Cause**: Database tables don't exist  
**Solution**: Run `setup-database.sql` in Supabase SQL Editor

### "Failed to create tenant" 
**Root Cause**: RLS policy blocking admin operations  
**Solution**: Ensure service role permissions and RLS policies are correct

### tRPC Context Errors
**Root Cause**: Provider hierarchy issues  
**Solution**: Verify TRPCProvider wraps AuthProvider in `app/layout.tsx`

## Database Schema

### Multi-Tenant Tables
- `tenants` - Workspace isolation
- `users` - User management with tenant association  
- `tenant_configurations` - LLM/RAG settings per tenant

### RAG Components
- `documents` - Document metadata and content
- `document_chunks` - Vector embeddings for semantic search
- `conversations` + `messages` - Chat history

### Security & Monitoring
- `api_keys` - Encrypted API key storage
- `usage_logs` - Token consumption and cost tracking
- `mcp_servers` - Model Context Protocol configurations

### Row Level Security
All tables implement RLS policies for tenant isolation:
- Users access only their tenant's data
- Service role bypasses RLS for admin operations
- Authenticated users verified through JWT claims

## Security Features

- **API Key Encryption**: AES-256-GCM for sensitive data
- **Database Security**: RLS policies + JWT verification  
- **Request Validation**: Zod schemas on all inputs
- **Type Safety**: End-to-end TypeScript with strict mode
- **Environment Validation**: T3 Env for runtime checks

## Deployment

1. Set up production Supabase project
2. Configure environment variables in deployment platform
3. Run database setup: Copy `setup-database.sql` to Supabase SQL Editor
4. Deploy application (Vercel recommended)
5. Configure custom domain and SSL

## Documentation

- **[CLAUDE.md](./CLAUDE.md)**: Complete technical documentation for Claude Code
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**: Step-by-step setup for non-technical users
- **API Documentation**: Available via tRPC introspection at `/api/trpc`

## Contributing

1. Follow existing patterns and conventions
2. Maintain strict TypeScript compliance
3. Add comprehensive error handling
4. Update documentation for changes
5. Ensure security best practices
