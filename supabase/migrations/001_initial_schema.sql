-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Tenant/Workspace management
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User management per tenant
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('owner', 'admin', 'user')) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Configuration per tenant
CREATE TABLE tenant_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants UNIQUE NOT NULL,
  
  -- LLM Configuration
  llm_provider TEXT CHECK (llm_provider IN ('openai', 'anthropic', 'google')) DEFAULT 'openai',
  llm_model TEXT DEFAULT 'gpt-4',
  llm_api_key TEXT NOT NULL, -- Encrypted
  
  -- RAG Configuration
  embedding_model TEXT DEFAULT 'text-embedding-3-large',
  embedding_api_key TEXT, -- Encrypted
  vector_db_config JSONB DEFAULT '{}',
  
  -- Chat Configuration
  system_prompt TEXT DEFAULT 'You are a helpful AI assistant.',
  max_context_length INTEGER DEFAULT 8000,
  temperature DECIMAL DEFAULT 0.7,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MCP server configurations per tenant
CREATE TABLE mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  server_url TEXT,
  server_command TEXT, -- For stdio servers
  server_args TEXT[],
  server_env JSONB DEFAULT '{}', -- Environment variables
  capabilities JSONB DEFAULT '{}', -- tools, resources, prompts
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- API key management for MCP integrations
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants NOT NULL,
  mcp_server_id UUID REFERENCES mcp_servers,
  name TEXT NOT NULL,
  key_name TEXT NOT NULL, -- e.g., 'GITHUB_TOKEN', 'SLACK_API_KEY'
  encrypted_value TEXT NOT NULL, -- Encrypted API key
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, key_name)
);

-- Document management for RAG
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text/plain',
  source_url TEXT,
  metadata JSONB DEFAULT '{}',
  embedding_id TEXT, -- Reference to vector DB
  chunk_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants NOT NULL,
  user_id UUID REFERENCES users NOT NULL,
  title TEXT,
  system_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages with RAG context
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant', 'system', 'tool')) NOT NULL,
  content TEXT NOT NULL,
  
  -- RAG-specific fields
  retrieved_documents JSONB, -- Documents used for context
  tool_calls JSONB, -- MCP tool calls made
  token_count INTEGER,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks for vector search
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding_id TEXT, -- Reference to vector DB
  embedding vector(1536), -- OpenAI embedding dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants NOT NULL,
  user_id UUID REFERENCES users,
  conversation_id UUID REFERENCES conversations,
  event_type TEXT NOT NULL, -- 'message', 'tool_call', 'document_query'
  tokens_used INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX idx_conversations_tenant_user ON conversations(tenant_id, user_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX idx_documents_tenant_created ON documents(tenant_id, created_at);
CREATE INDEX idx_document_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_tenant ON document_chunks(tenant_id);
CREATE INDEX idx_usage_logs_tenant_created ON usage_logs(tenant_id, created_at);
CREATE INDEX idx_mcp_servers_tenant_active ON mcp_servers(tenant_id, is_active);

-- Vector similarity search index
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search indexes
CREATE INDEX idx_documents_content_fts ON documents USING GIN (to_tsvector('english', title || ' ' || content));
CREATE INDEX idx_document_chunks_content_fts ON document_chunks USING GIN (to_tsvector('english', content));

-- Row Level Security policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (will be enhanced with proper auth)
CREATE POLICY "Users can access their tenant data" ON tenants
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can access their tenant users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = users.tenant_id
    )
  );

CREATE POLICY "Users can access their tenant configurations" ON tenant_configurations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = tenant_configurations.tenant_id
    )
  );

CREATE POLICY "Users can access their tenant MCP servers" ON mcp_servers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = mcp_servers.tenant_id
    )
  );

CREATE POLICY "Users can access their tenant API keys" ON api_keys
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = api_keys.tenant_id
    )
  );

CREATE POLICY "Users can access their tenant documents" ON documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = documents.tenant_id
    )
  );

CREATE POLICY "Users can access their conversations" ON conversations
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = conversations.tenant_id
        AND u.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can access conversation messages" ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN users u ON u.tenant_id = c.tenant_id
      WHERE c.id = messages.conversation_id
        AND (c.user_id = auth.uid() OR u.id = auth.uid())
    )
  );

CREATE POLICY "Users can access their tenant document chunks" ON document_chunks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = document_chunks.tenant_id
    )
  );

CREATE POLICY "Users can access their tenant usage logs" ON usage_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = usage_logs.tenant_id
    )
  );