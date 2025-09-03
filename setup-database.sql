-- IMMEDIATE DATABASE SETUP
-- Run this SQL in your Supabase SQL Editor to create the required tables
 
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
 
-- Create tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'manager', 'user', 'guest')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Create tenant configurations
CREATE TABLE IF NOT EXISTS public.tenant_configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    llm_provider TEXT DEFAULT 'openai',
    llm_model TEXT DEFAULT 'gpt-4o',
    llm_api_key TEXT DEFAULT '',
    embedding_model TEXT DEFAULT 'text-embedding-3-small',
    system_prompt TEXT DEFAULT 'You are a helpful AI assistant.',
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_context_length INTEGER DEFAULT 4000,
    vector_db_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    content_type TEXT DEFAULT 'text/plain',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Create document chunks for RAG
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embedding dimension
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Create MCP servers table
CREATE TABLE IF NOT EXISTS public.mcp_servers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    args JSONB DEFAULT '[]',
    env JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Create encrypted API keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, key_name)
);
 
-- Create usage logs table
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    operation TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Enable Row Level Security on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
 
-- Create RLS policies for tenants
CREATE POLICY "Service role can manage all tenants" ON tenants
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
 
CREATE POLICY "Users can read their tenant data" ON tenants
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.tenant_id = tenants.id
  ));
 
-- Create RLS policies for users table
CREATE POLICY "Tenant isolation policy" ON users
  FOR ALL TO authenticated
  USING (id = auth.uid()
  );
 
CREATE POLICY "Service role full access" ON users
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
 
-- Create RLS policies for tables with direct tenant_id
CREATE POLICY "Tenant isolation policy" ON tenant_configurations
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));
 
CREATE POLICY "Service role full access" ON tenant_configurations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
 
CREATE POLICY "Tenant isolation policy" ON conversations
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));
 
CREATE POLICY "Service role full access" ON conversations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
 
CREATE POLICY "Tenant isolation policy" ON documents
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));
 
CREATE POLICY "Service role full access" ON documents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
 
CREATE POLICY "Tenant isolation policy" ON mcp_servers
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));
 
CREATE POLICY "Service role full access" ON mcp_servers
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
 
CREATE POLICY "Tenant isolation policy" ON api_keys
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));
 
CREATE POLICY "Service role full access" ON api_keys
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
 
CREATE POLICY "Tenant isolation policy" ON usage_logs
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));
 
CREATE POLICY "Service role full access" ON usage_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
 
-- Create RLS policies for messages (indirect tenant relationship via conversation)
CREATE POLICY "Messages tenant isolation" ON messages
  FOR ALL TO authenticated
  USING (conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN users u ON u.id = auth.uid()
    WHERE c.tenant_id = u.tenant_id
  ));
 
CREATE POLICY "Service role full access" ON messages
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
 
-- Create RLS policies for document_chunks (indirect tenant relationship via document)
CREATE POLICY "Document chunks tenant isolation" ON document_chunks
  FOR ALL TO authenticated
  USING (document_id IN (
    SELECT d.id FROM documents d
    JOIN users u ON u.id = auth.uid()
    WHERE d.tenant_id = u.tenant_id
  ));
 
CREATE POLICY "Service role full access" ON document_chunks
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
 
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_tenant_id ON mcp_servers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_id ON usage_logs(tenant_id);
 
-- Create vector index for similarity search on document chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 
-- Insert a sample tenant and user for testing (optional)
-- Uncomment the lines below if you want sample data
 
-- INSERT INTO tenants (name, slug) VALUES ('Demo Restaurant', 'demo-restaurant');
 
-- Note: To create a user, you'll need to use Supabase Auth signup first,
-- then insert into the users table with the returned user ID