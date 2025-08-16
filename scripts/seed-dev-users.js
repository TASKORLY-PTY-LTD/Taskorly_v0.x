/**
 * Development User Seeding Script
 * Creates fake test accounts for development environment only
 * 
 * Usage: node scripts/seed-dev-users.js
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test user accounts with different roles
const TEST_USERS = [
  {
    email: 'owner@taskorly.dev',
    password: 'DevOwner123!',
    fullName: 'Alice Johnson',
    role: 'owner',
    tenantName: 'Taskorly Demo Corp'
  },
  {
    email: 'admin@taskorly.dev', 
    password: 'DevAdmin123!',
    fullName: 'Bob Smith',
    role: 'admin',
    tenantId: null // Will be set to owner's tenant
  },
  {
    email: 'manager@taskorly.dev',
    password: 'DevManager123!', 
    fullName: 'Carol Wilson',
    role: 'manager',
    tenantId: null // Will be set to owner's tenant
  },
  {
    email: 'user@taskorly.dev',
    password: 'DevUser123!',
    fullName: 'David Brown',
    role: 'user',
    tenantId: null // Will be set to owner's tenant
  }
];

const ROLE_PERMISSIONS = {
  owner: [
    'admin:*',
    'manager:*', 
    'user:*',
    'servers:*',
    'settings:*',
    'analytics:*',
    'vector-store:*',
    'billing:*',
    'tenant:*'
  ],
  admin: [
    'admin:*',
    'manager:*',
    'user:*',
    'servers:*',
    'settings:*',
    'analytics:*',
    'vector-store:*'
  ],
  manager: [
    'manager:*',
    'user:*',
    'servers:read',
    'settings:read',
    'analytics:read',
    'documents:*',
    'chat:*'
  ],
  user: [
    'user:read',
    'chat:*',
    'documents:read'
  ]
};

async function cleanupExistingUsers() {
  console.log('🧹 Cleaning up existing test users...');
  
  for (const user of TEST_USERS) {
    try {
      // Get user by email
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email);

      if (existingUsers && existingUsers.length > 0) {
        for (const existingUser of existingUsers) {
          // Delete from auth.users (cascades to our users table)
          await supabase.auth.admin.deleteUser(existingUser.id);
          console.log(`  ✓ Deleted existing user: ${user.email}`);
        }
      }
    } catch (error) {
      console.log(`  ⚠️ Could not delete ${user.email}: ${error.message}`);
    }
  }
}

async function createTenant(tenantData) {
  console.log(`📊 Creating tenant: ${tenantData.name}`);
  
  const tenantSlug = tenantData.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .trim();

  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({
      name: tenantData.name,
      slug: tenantSlug
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create tenant: ${error.message}`);
  }

  console.log(`  ✓ Created tenant: ${tenant.name} (${tenant.id})`);
  return tenant;
}

async function createUser(userData, tenantId) {
  console.log(`👤 Creating user: ${userData.email} (${userData.role})`);

  // Create user in Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true,
    user_metadata: {
      full_name: userData.fullName,
      tenant_id: tenantId,
      role: userData.role,
      created_for_dev: true
    }
  });

  if (authError || !authUser.user) {
    throw new Error(`Failed to create auth user: ${authError?.message}`);
  }

  // Create user record in our database
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .insert({
      id: authUser.user.id,
      email: userData.email,
      full_name: userData.fullName,
      tenant_id: tenantId,
      role: userData.role
    })
    .select()
    .single();

  if (dbError) {
    // Rollback: delete the auth user if db insert fails
    await supabase.auth.admin.deleteUser(authUser.user.id);
    throw new Error(`Failed to create user profile: ${dbError.message}`);
  }

  console.log(`  ✓ Created user: ${userData.email} (${userData.role})`);
  return dbUser;
}

async function createTenantConfiguration(tenantId) {
  console.log(`⚙️ Creating default tenant configuration`);

  const { error } = await supabase
    .from('tenant_configurations')
    .insert({
      tenant_id: tenantId,
      llm_provider: 'openai',
      llm_model: 'gpt-4o',
      llm_api_key: '', // Will be set later via UI
      embedding_model: 'text-embedding-3-small',
      system_prompt: 'You are a helpful AI assistant for Taskorly development testing.',
      temperature: 0.7,
      max_context_length: 4000,
      vector_db_config: {}
    });

  if (error) {
    console.log(`  ⚠️ Could not create tenant config: ${error.message}`);
  } else {
    console.log(`  ✓ Created tenant configuration`);
  }
}

async function seedDevUsers() {
  console.log('🌱 Starting development user seeding...\n');

  try {
    // Environment check
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ This script should only be run in development environment');
      process.exit(1);
    }

    // Clean up existing test users
    await cleanupExistingUsers();
    console.log('');

    // Create tenant for the owner
    const ownerData = TEST_USERS.find(user => user.role === 'owner');
    const tenant = await createTenant({ name: ownerData.tenantName });
    console.log('');

    // Create all users
    const createdUsers = [];
    for (const userData of TEST_USERS) {
      const user = await createUser(userData, tenant.id);
      createdUsers.push(user);
    }
    console.log('');

    // Create tenant configuration
    await createTenantConfiguration(tenant.id);
    console.log('');

    // Display login credentials
    console.log('🎉 Development users created successfully!\n');
    console.log('📝 LOGIN CREDENTIALS FOR TESTING:\n');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    DEVELOPMENT TEST ACCOUNTS                │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    
    TEST_USERS.forEach(user => {
      console.log(`│ ${user.role.toUpperCase().padEnd(8)} │ ${user.email.padEnd(20)} │ ${user.password.padEnd(15)} │`);
    });
    
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ TENANT   │ ${tenant.name.padEnd(20)} │ ID: ${tenant.id.substring(0, 8)}... │`);
    console.log('└─────────────────────────────────────────────────────────────┘\n');
    
    console.log('🔗 Access the application at: http://localhost:3000\n');
    
    console.log('📋 Testing Guide:');
    console.log('  1. Use owner@taskorly.dev to test full admin capabilities');
    console.log('  2. Use admin@taskorly.dev to test admin features (no billing access)');
    console.log('  3. Use manager@taskorly.dev to test document/chat management');
    console.log('  4. Use user@taskorly.dev to test basic user functionality');
    console.log('');
    console.log('⚠️  These accounts are for DEVELOPMENT ONLY and should not be used in production!');

  } catch (error) {
    console.error('❌ Error seeding development users:', error.message);
    process.exit(1);
  }
}

// Run the seeding script
seedDevUsers();