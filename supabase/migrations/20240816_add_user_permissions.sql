-- Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- Add RLS (Row Level Security)
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own permissions" 
    ON user_permissions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all permissions in their tenant" 
    ON user_permissions FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'owner')
            AND users.tenant_id = (
                SELECT tenant_id FROM users WHERE users.id = user_permissions.user_id
            )
        )
    );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_permissions_updated_at 
    BEFORE UPDATE ON user_permissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add password_hash column to users table (for custom auth if not using Supabase Auth)
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Update the users table RLS policies to work with the auth system
DROP POLICY IF EXISTS "Users can view users in their tenant" ON users;
DROP POLICY IF EXISTS "Admins can manage users in their tenant" ON users;

-- Create updated RLS policies for users table
CREATE POLICY "Users can view users in their tenant" 
    ON users FOR SELECT 
    USING (
        tenant_id = (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage users in their tenant" 
    ON users FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'owner')
            AND users.tenant_id = tenant_id
        )
    );

CREATE POLICY "Users can insert themselves during signup" 
    ON users FOR INSERT 
    WITH CHECK (id = auth.uid());

-- Insert default permissions for existing users if any
INSERT INTO user_permissions (user_id, permissions)
SELECT 
    id,
    CASE 
        WHEN role = 'owner' THEN ARRAY['admin:*', 'manager:*', 'user:*', 'servers:*', 'settings:*', 'analytics:*', 'vector-store:*', 'billing:*', 'tenant:*']
        WHEN role = 'admin' THEN ARRAY['admin:*', 'manager:*', 'user:*', 'servers:*', 'settings:*', 'analytics:*', 'vector-store:*']
        WHEN role = 'manager' THEN ARRAY['manager:*', 'user:*', 'servers:read', 'settings:read', 'analytics:read', 'documents:*', 'chat:*']
        WHEN role = 'user' THEN ARRAY['user:read', 'chat:*', 'documents:read']
        ELSE ARRAY['user:read', 'chat:read']
    END
FROM users 
WHERE NOT EXISTS (
    SELECT 1 FROM user_permissions WHERE user_permissions.user_id = users.id
);