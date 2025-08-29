-- Fix tenant RLS policy to allow admin operations during signup
-- The current policy blocks tenant creation during user signup

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can access their tenant data" ON tenants;

-- Create more permissive policies that allow:
-- 1. Service role (admin) operations (for signup)
-- 2. Authenticated users to access their tenant data

-- Allow service role to perform all operations (bypasses RLS)
CREATE POLICY "Service role can manage all tenants" ON tenants
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read their tenant data
CREATE POLICY "Users can read their tenant data" ON tenants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = tenants.id
    )
  );

-- Allow tenant owners/admins to update their tenant
CREATE POLICY "Owners and admins can update tenant data" ON tenants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = tenants.id
        AND u.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.tenant_id = tenants.id
        AND u.role IN ('owner', 'admin')
    )
  );

-- Note: INSERT and DELETE for tenants should only be done via service role
-- during user signup and tenant management operations