-- IMMEDIATE DATABASE SETUP
-- Run this SQL in your Supabase SQL Editor to create the required tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create businesses table
CREATE TABLE IF NOT EXISTS public.businesses (
    business_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_name TEXT NOT NULL,
    type TEXT,
    industry TEXT,
    website TEXT,
    email TEXT,
    phone TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
    tenant_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(business_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create employees table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.employees (
    employee_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user',
    active TEXT NOT NULL DEFAULT 'active' CHECK (active IN ('active', 'inactive', 'suspended', 'pending')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
    setting_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE UNIQUE,
    Industry TEXT,
    Description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create MCP servers table
CREATE TABLE IF NOT EXISTS public.mcp_servers (
    mcp_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    args JSONB DEFAULT '[]',
    env JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    content_type TEXT DEFAULT 'text/plain',
    metadata JSONB DEFAULT '{}',
    chunk_count INTEGER DEFAULT 0,
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create document chunks for RAG
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(1536), -- OpenAI embedding dimension
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    conversation_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(employee_id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    message_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(employee_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create usage logs table
CREATE TABLE IF NOT EXISTS public.usage_logs (
    log_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(employee_id) ON DELETE SET NULL,
    operation TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create API keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
    api_key_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key TEXT NOT NULL UNIQUE,
    employee_id UUID REFERENCES employees(employee_id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    description TEXT,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tenants_business_id ON tenants(business_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_tenant_id ON mcp_servers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_employee_id ON conversations(employee_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_employee_id ON messages(employee_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_id ON usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_employee_id ON usage_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_employee_id ON api_keys(employee_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON api_keys(api_key);

-- Create vector index for similarity search on document chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function to automatically create employee record after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.employees (user_id, tenant_id, role)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'tenant_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create employee record on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at on relevant tables
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_servers_updated_at BEFORE UPDATE ON mcp_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- These policies ensure multi-tenant isolation at the database level
-- Users can only access data within their assigned tenant workspace

-- Enable RLS on all tables
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id
    FROM public.employees
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin or owner
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.employees
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user belongs to tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(tenant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.employees
    WHERE user_id = auth.uid()
    AND tenant_id = tenant_uuid
    AND active = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- BUSINESSES TABLE POLICIES
-- ============================================================================

-- Users can view their business information
CREATE POLICY "Users can view their own business"
  ON public.businesses FOR SELECT
  USING (
    business_id IN (
      SELECT b.business_id
      FROM public.businesses b
      JOIN public.tenants t ON t.business_id = b.business_id
      JOIN public.employees e ON e.tenant_id = t.tenant_id
      WHERE e.user_id = auth.uid()
    )
  );

-- Only admins/owners can update business information
CREATE POLICY "Admins can update business info"
  ON public.businesses FOR UPDATE
  USING (
    is_user_admin()
    AND business_id IN (
      SELECT b.business_id
      FROM public.businesses b
      JOIN public.tenants t ON t.business_id = b.business_id
      JOIN public.employees e ON e.tenant_id = t.tenant_id
      WHERE e.user_id = auth.uid()
    )
  );

-- Only owners can delete businesses
CREATE POLICY "Owners can delete business"
  ON public.businesses FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      JOIN public.tenants t ON t.business_id = b.business_id
      JOIN public.employees e ON e.tenant_id = t.tenant_id
      WHERE e.user_id = auth.uid()
      AND e.role = 'owner'
      AND b.business_id = businesses.business_id
    )
  );

-- ============================================================================
-- TENANTS TABLE POLICIES
-- ============================================================================

-- Users can view their tenant information
CREATE POLICY "Users can view their tenant"
  ON public.tenants FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.employees
      WHERE user_id = auth.uid()
    )
  );

-- Only admins can update tenant information
CREATE POLICY "Admins can update tenant info"
  ON public.tenants FOR UPDATE
  USING (
    is_user_admin()
    AND user_belongs_to_tenant(tenant_id)
  );

-- Only owners can delete tenants
CREATE POLICY "Owners can delete tenant"
  ON public.tenants FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees
      WHERE user_id = auth.uid()
      AND tenant_id = tenants.tenant_id
      AND role = 'owner'
    )
  );

-- ============================================================================
-- EMPLOYEES TABLE POLICIES
-- ============================================================================

-- Users can view employees in their tenant
CREATE POLICY "Users can view tenant employees"
  ON public.employees FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));

-- Users can view their own employee record
CREATE POLICY "Users can view own employee record"
  ON public.employees FOR SELECT
  USING (user_id = auth.uid());

-- Admins can insert new employees in their tenant
CREATE POLICY "Admins can add employees"
  ON public.employees FOR INSERT
  WITH CHECK (
    is_user_admin()
    AND user_belongs_to_tenant(tenant_id)
  );

-- Admins can update employees in their tenant
CREATE POLICY "Admins can update employees"
  ON public.employees FOR UPDATE
  USING (
    is_user_admin()
    AND user_belongs_to_tenant(tenant_id)
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.employees FOR UPDATE
  USING (user_id = auth.uid());

-- Only owners can delete employees
CREATE POLICY "Owners can delete employees"
  ON public.employees FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
      AND e.tenant_id = employees.tenant_id
      AND e.role = 'owner'
    )
  );

-- ============================================================================
-- SETTINGS TABLE POLICIES
-- ============================================================================

-- Users can view their tenant settings
CREATE POLICY "Users can view tenant settings"
  ON public.settings FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));

-- Admins can manage tenant settings
CREATE POLICY "Admins can manage settings"
  ON public.settings FOR ALL
  USING (
    is_user_admin()
    AND user_belongs_to_tenant(tenant_id)
  );

-- ============================================================================
-- MCP SERVERS TABLE POLICIES
-- ============================================================================

-- Users can view MCP servers in their tenant
CREATE POLICY "Users can view tenant MCP servers"
  ON public.mcp_servers FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));

-- Admins can manage MCP servers
CREATE POLICY "Admins can manage MCP servers"
  ON public.mcp_servers FOR ALL
  USING (
    is_user_admin()
    AND user_belongs_to_tenant(tenant_id)
  );

-- ============================================================================
-- DOCUMENTS TABLE POLICIES
-- ============================================================================

-- Users can view documents in their tenant
CREATE POLICY "Users can view tenant documents"
  ON public.documents FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));

-- Users can insert documents in their tenant
CREATE POLICY "Users can create documents"
  ON public.documents FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id));

-- Users can update documents in their tenant
CREATE POLICY "Users can update documents"
  ON public.documents FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id));

-- Admins can delete documents
CREATE POLICY "Admins can delete documents"
  ON public.documents FOR DELETE
  USING (
    is_user_admin()
    AND user_belongs_to_tenant(tenant_id)
  );

-- ============================================================================
-- DOCUMENT CHUNKS TABLE POLICIES
-- ============================================================================

-- Users can view document chunks if they can view the parent document
CREATE POLICY "Users can view tenant document chunks"
  ON public.document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_chunks.document_id
      AND user_belongs_to_tenant(d.tenant_id)
    )
  );

-- System can insert chunks (via service role)
CREATE POLICY "Service role can manage chunks"
  ON public.document_chunks FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_chunks.document_id
      AND user_belongs_to_tenant(d.tenant_id)
    )
  );

-- ============================================================================
-- CONVERSATIONS TABLE POLICIES
-- ============================================================================

-- Users can view conversations in their tenant
CREATE POLICY "Users can view tenant conversations"
  ON public.conversations FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));

-- Users can create conversations in their tenant
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    user_belongs_to_tenant(tenant_id)
    AND employee_id IN (
      SELECT employee_id
      FROM public.employees
      WHERE user_id = auth.uid()
    )
  );

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (
    employee_id IN (
      SELECT employee_id
      FROM public.employees
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
  ON public.conversations FOR DELETE
  USING (
    employee_id IN (
      SELECT employee_id
      FROM public.employees
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- MESSAGES TABLE POLICIES
-- ============================================================================

-- Users can view messages in conversations they have access to
CREATE POLICY "Users can view conversation messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.conversation_id = messages.conversation_id
      AND user_belongs_to_tenant(c.tenant_id)
    )
  );

-- Users can create messages in their conversations
CREATE POLICY "Users can create messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.employees e ON e.employee_id = c.employee_id
      WHERE c.conversation_id = messages.conversation_id
      AND e.user_id = auth.uid()
    )
  );

-- System/service role can insert assistant messages
CREATE POLICY "Service can create assistant messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    role IN ('assistant', 'system')
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.conversation_id = messages.conversation_id
      AND user_belongs_to_tenant(c.tenant_id)
    )
  );

-- ============================================================================
-- USAGE LOGS TABLE POLICIES
-- ============================================================================

-- Admins can view usage logs for their tenant
CREATE POLICY "Admins can view usage logs"
  ON public.usage_logs FOR SELECT
  USING (
    is_user_admin()
    AND user_belongs_to_tenant(tenant_id)
  );

-- Users can view their own usage logs
CREATE POLICY "Users can view own usage logs"
  ON public.usage_logs FOR SELECT
  USING (
    employee_id IN (
      SELECT employee_id
      FROM public.employees
      WHERE user_id = auth.uid()
    )
  );

-- System can insert usage logs
CREATE POLICY "Service can create usage logs"
  ON public.usage_logs FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id));

-- ============================================================================
-- API KEYS TABLE POLICIES
-- ============================================================================

-- Users can view their own API keys
CREATE POLICY "Users can view own API keys"
  ON public.api_keys FOR SELECT
  USING (
    employee_id IN (
      SELECT employee_id
      FROM public.employees
      WHERE user_id = auth.uid()
    )
  );

-- Admins can view all tenant API keys
CREATE POLICY "Admins can view tenant API keys"
  ON public.api_keys FOR SELECT
  USING (
    is_user_admin()
    AND employee_id IN (
      SELECT e.employee_id
      FROM public.employees e
      WHERE user_belongs_to_tenant(e.tenant_id)
    )
  );

-- Users can create their own API keys
CREATE POLICY "Users can create own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT employee_id
      FROM public.employees
      WHERE user_id = auth.uid()
    )
  );

-- Users can update their own API keys
CREATE POLICY "Users can update own API keys"
  ON public.api_keys FOR UPDATE
  USING (
    employee_id IN (
      SELECT employee_id
      FROM public.employees
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own API keys
CREATE POLICY "Users can delete own API keys"
  ON public.api_keys FOR DELETE
  USING (
    employee_id IN (
      SELECT employee_id
      FROM public.employees
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Grant authenticated users access to tables (RLS policies will restrict access)

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;