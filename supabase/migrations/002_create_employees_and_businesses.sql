-- Drop old users table if it exists
DROP TABLE IF EXISTS users CASCADE;

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  business_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  industry TEXT,
  type TEXT,
  phone TEXT,
  website TEXT,
  email TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add business_id to tenants if not exists
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(business_id);

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,  -- References auth.users(id) in Supabase auth schema
  tenant_id UUID REFERENCES tenants(tenant_id),
  role TEXT CHECK (role IN ('owner', 'admin', 'manager', 'user', 'guest')) DEFAULT 'user',
  active TEXT CHECK (active IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key to auth.users (Supabase auth schema)
ALTER TABLE employees
  ADD CONSTRAINT employees_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_role ON employees(tenant_id, role);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees
CREATE POLICY "Employees can view employees in their tenant"
  ON employees FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage employees in their tenant"
  ON employees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND tenant_id = employees.tenant_id
    )
  );

-- Update foreign keys in other tables
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(employee_id);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(employee_id);

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(employee_id);

-- Create settings table with correct lowercase name
CREATE TABLE IF NOT EXISTS settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id) UNIQUE,
  description TEXT,
  industry TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their settings"
  ON settings FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage their tenant settings"
  ON settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND tenant_id = settings.tenant_id
    )
  );