# RAG Chat System Backend

A multi-tenant RAG (Retrieval Augmented Generation) based chat system with MCP (Model Context Protocol) integrations built on Next.js 14+.

## Features

- **Multi-tenant Architecture**: Complete workspace isolation with RLS policies
- **RAG Pipeline**: LangChain.js integration with vector embeddings and semantic search
- **MCP Integration**: Model Context Protocol for vendor API integrations
- **Type-safe APIs**: tRPC for end-to-end type safety
- **Real-time Chat**: Streaming responses with context retrieval
- **Document Management**: Upload, process, and search documents
- **Secure API Key Management**: Encrypted storage and management
- **Usage Tracking**: Comprehensive logging and statistics
- **Multiple LLM Providers**: OpenAI, Anthropic, Google AI support

## Architecture

### Core Components

- **RAG Pipeline** (`src/lib/rag/pipeline.ts`): Document processing, embedding, and retrieval
- **MCP Manager** (`src/lib/mcp/manager.ts`): Model Context Protocol integrations
- **tRPC Routers**: Type-safe API endpoints for chat, documents, MCP, and configuration
- **Database Schema**: Supabase with multi-tenant support and vector storage

### API Endpoints

#### Chat Router (`/api/trpc/chat`)
- `sendMessage`: Process messages with RAG context and MCP tools
- `getConversation`: Retrieve conversation history
- `createConversation`: Start new conversations
- `listConversations`: List user conversations
- `updateConversation`: Update conversation settings
- `deleteConversation`: Remove conversations
- `searchDocuments`: Semantic search across documents

#### Documents Router (`/api/trpc/documents`)
- `upload`: Single document upload with RAG processing
- `bulkUpload`: Batch document processing
- `list`: List documents with search and filtering
- `get`: Retrieve document with chunks
- `update`: Update document content (reprocesses for RAG)
- `delete`: Remove document and embeddings
- `getStats`: Document statistics

#### MCP Router (`/api/trpc/mcp`)
- `listTools`: Available MCP tools
- `executeTool`: Execute MCP tool calls
- `listServers`: MCP server configurations
- `addServer`: Add new MCP server (admin)
- `updateServer`: Update server configuration (admin)
- `removeServer`: Remove MCP server (admin)
- `getServerHealth`: Server status monitoring
- `initializeServers`: Connect to tenant servers
- API key management endpoints

#### Configuration Router (`/api/trpc/config`)
- `getConfig`: Tenant configuration
- `updateConfig`: Update LLM/embedding settings (admin)
- `getDecryptedApiKey`: Internal API key access
- `testConfig`: Validate API connections
- `getUsageStats`: Usage analytics

## Setup

### Prerequisites

- Node.js 18+
- Supabase project
- LLM provider API keys (OpenAI/Anthropic/Google)

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ENCRYPTION_KEY=your-32-character-key-here-exactly
NEXTAUTH_SECRET=your-nextauth-secret

# Optional (can be configured per tenant)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up database:
```bash
# Run Supabase migrations
supabase db reset
```

3. Start development server:
```bash
npm run dev
```

## Database Schema

### Core Tables

- **tenants**: Multi-tenant isolation
- **users**: User management with tenant association
- **tenant_configurations**: LLM and RAG settings per tenant
- **conversations**: Chat conversations
- **messages**: Individual chat messages
- **documents**: Document metadata
- **document_chunks**: Vector embeddings for RAG
- **mcp_servers**: MCP server configurations
- **api_keys**: Encrypted API key storage
- **usage_logs**: Comprehensive usage tracking

### Row Level Security

All tables implement RLS policies for tenant isolation:
- Users can only access data from their tenant
- Service role bypasses RLS for admin operations

## Usage Examples

### Basic Chat with RAG

```typescript
// Send message with context retrieval
const response = await trpc.chat.sendMessage.mutate({
  conversationId: 'conv-123',
  message: 'What does our privacy policy say about data retention?',
  includeContext: true,
});

// Response includes:
// - Generated text
// - Retrieved documents
// - MCP tool calls
// - Token usage
```

### Document Upload

```typescript
// Upload document for RAG
const document = await trpc.documents.upload.mutate({
  title: 'Privacy Policy',
  content: 'Our privacy policy states...',
  contentType: 'text/plain',
  metadata: { department: 'legal' },
});

// Document is automatically:
// - Chunked into smaller pieces
// - Embedded using configured model
// - Stored in vector database
```

### MCP Tool Execution

```typescript
// Execute MCP tool
const result = await trpc.mcp.executeTool.mutate({
  toolName: 'web_search',
  args: { query: 'latest industry news' },
});
```

### Configuration Management

```typescript
// Update tenant configuration
await trpc.config.updateConfig.mutate({
  llm_provider: 'openai',
  llm_model: 'gpt-4',
  llm_api_key: 'sk-...',
  temperature: 0.7,
  system_prompt: 'You are a helpful assistant...',
});
```

## Security Features

- **API Key Encryption**: AES-256-GCM encryption for sensitive data
- **Row Level Security**: Database-level tenant isolation
- **Request Validation**: Zod schema validation on all inputs
- **Rate Limiting**: Built-in protection against abuse
- **Secure Headers**: XSS and CSRF protection
- **Authentication**: Supabase Auth integration

## Monitoring

### Health Check
```
GET /api/health
```

Returns database and MCP manager status.

### Usage Analytics
- Token consumption tracking
- API call monitoring
- Error rate analysis
- Cost estimation

## Development

### Project Structure

```
src/
├── app/api/          # Next.js API routes
├── lib/              # Core libraries
│   ├── rag/          # RAG pipeline
│   ├── mcp/          # MCP manager
│   └── ...
├── server/           # tRPC server
│   ├── routers/      # API route handlers
│   └── trpc.ts       # tRPC setup
├── types/            # TypeScript definitions
└── ...
```

### Key Dependencies

- **@trpc/server**: Type-safe API framework
- **@langchain/**: RAG pipeline and LLM integrations
- **@modelcontextprotocol/sdk**: MCP integrations
- **@supabase/supabase-js**: Database and auth
- **zod**: Runtime validation

## Deployment

1. Set up production Supabase project
2. Configure environment variables
3. Deploy to Vercel/similar platform
4. Run database migrations
5. Configure domain and SSL

## API Documentation

Full API documentation is available via tRPC's built-in introspection. Start the dev server and visit the tRPC panel for interactive API exploration.

## Contributing

1. Follow existing code patterns
2. Add appropriate TypeScript types
3. Include error handling
4. Update tests and documentation
5. Ensure security best practices

## License

[Your License Here]