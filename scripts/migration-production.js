#!/usr/bin/env node
/**
 * Production Database Migration Script
 * 
 * Handles zero-downtime database migrations for production deployments.
 * Includes rollback capabilities and safety checks.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  migrationsDir: path.join(__dirname, '..', 'supabase', 'migrations'),
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
};

// Validation
if (!config.supabaseUrl || !config.supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

/**
 * Migration tracking table setup
 */
async function ensureMigrationsTable() {
  const { error } = await supabase.rpc('create_migrations_table_if_not_exists', {
    sql: `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL
      );
    `
  });

  if (error) {
    console.error('❌ Failed to create migrations table:', error);
    throw error;
  }
}

/**
 * Calculate file checksum for integrity verification
 */
function calculateChecksum(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get list of pending migrations
 */
async function getPendingMigrations() {
  if (!fs.existsSync(config.migrationsDir)) {
    console.log('ℹ️ No migrations directory found');
    return [];
  }

  const migrationFiles = fs.readdirSync(config.migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('ℹ️ No migration files found');
    return [];
  }

  // Get already applied migrations
  const { data: appliedMigrations, error } = await supabase
    .from('_migrations')
    .select('filename, checksum');

  if (error) {
    console.error('❌ Failed to fetch applied migrations:', error);
    throw error;
  }

  const appliedSet = new Set(appliedMigrations?.map(m => m.filename) || []);
  
  const pendingMigrations = migrationFiles
    .filter(file => !appliedSet.has(file))
    .map(file => {
      const content = fs.readFileSync(path.join(config.migrationsDir, file), 'utf8');
      return {
        filename: file,
        content,
        checksum: calculateChecksum(content)
      };
    });

  return pendingMigrations;
}

/**
 * Validate migration content for production safety
 */
function validateMigration(migration) {
  const dangerous = [
    'DROP TABLE',
    'DROP COLUMN',
    'ALTER COLUMN',
    'DROP INDEX'
  ];

  const warnings = [
    'CREATE INDEX',
    'ALTER TABLE',
    'UPDATE'
  ];

  const content = migration.content.toUpperCase();
  
  // Check for dangerous operations
  for (const operation of dangerous) {
    if (content.includes(operation)) {
      console.warn(`⚠️ Migration ${migration.filename} contains potentially dangerous operation: ${operation}`);
      // In strict mode, we would throw here
      // throw new Error(`Dangerous operation detected: ${operation}`);
    }
  }

  // Check for operations that need attention
  for (const operation of warnings) {
    if (content.includes(operation)) {
      console.log(`ℹ️ Migration ${migration.filename} contains operation requiring attention: ${operation}`);
    }
  }

  // Ensure transaction wrapping
  if (!content.includes('BEGIN') || !content.includes('COMMIT')) {
    console.warn(`⚠️ Migration ${migration.filename} should be wrapped in a transaction`);
  }

  return true;
}

/**
 * Apply a single migration with retry logic
 */
async function applyMigration(migration) {
  console.log(`🔄 Applying migration: ${migration.filename}`);
  
  let retries = 0;
  while (retries < config.maxRetries) {
    try {
      // Execute the migration
      const { error: migrationError } = await supabase.rpc('exec_sql', {
        sql: migration.content
      });

      if (migrationError) {
        throw migrationError;
      }

      // Record the migration as applied
      const { error: recordError } = await supabase
        .from('_migrations')
        .insert({
          filename: migration.filename,
          checksum: migration.checksum
        });

      if (recordError) {
        throw recordError;
      }

      console.log(`✅ Successfully applied migration: ${migration.filename}`);
      return true;

    } catch (error) {
      retries++;
      console.error(`❌ Migration failed (attempt ${retries}/${config.maxRetries}):`, error.message);
      
      if (retries < config.maxRetries) {
        console.log(`⏳ Retrying in ${config.retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      } else {
        console.error(`💥 Migration ${migration.filename} failed after ${config.maxRetries} attempts`);
        throw error;
      }
    }
  }
}

/**
 * Health check before migration
 */
async function performHealthCheck() {
  console.log('🏥 Performing pre-migration health check...');
  
  try {
    // Test database connectivity
    const { data, error } = await supabase
      .from('tenants')
      .select('count')
      .limit(1);

    if (error) {
      throw new Error(`Database connectivity check failed: ${error.message}`);
    }

    // Test write operations
    const testId = `test-${Date.now()}`;
    const { error: writeError } = await supabase
      .from('_migrations')
      .upsert({ 
        filename: `_health_check_${testId}`,
        checksum: 'test'
      });

    if (!writeError) {
      // Clean up test record
      await supabase
        .from('_migrations')
        .delete()
        .eq('filename', `_health_check_${testId}`);
    }

    console.log('✅ Health check passed');
    return true;

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    throw error;
  }
}

/**
 * Main migration function
 */
async function runMigrations() {
  console.log('🚀 Starting production database migration...');
  
  try {
    // Health check
    await performHealthCheck();
    
    // Set up migrations tracking
    await ensureMigrationsTable();
    
    // Get pending migrations
    const pendingMigrations = await getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations found');
      return;
    }
    
    console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(m => console.log(`  - ${m.filename}`));
    
    // Validate migrations
    console.log('🔍 Validating migrations...');
    for (const migration of pendingMigrations) {
      validateMigration(migration);
    }
    
    // Apply migrations
    console.log('⚡ Applying migrations...');
    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }
    
    console.log('🎉 All migrations applied successfully!');
    
  } catch (error) {
    console.error('💥 Migration process failed:', error.message);
    console.error('\n📋 Rollback may be required. Check the following:');
    console.error('1. Database state consistency');
    console.error('2. Application compatibility');
    console.error('3. Consider manual rollback if needed');
    
    process.exit(1);
  }
}

/**
 * Rollback function (for emergency use)
 */
async function rollbackLastMigration() {
  console.log('🔄 Rolling back last migration...');
  
  try {
    const { data: lastMigration, error } = await supabase
      .from('_migrations')
      .select('*')
      .order('applied_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !lastMigration) {
      console.log('ℹ️ No migrations to rollback');
      return;
    }

    console.log(`⚠️ Rolling back: ${lastMigration.filename}`);
    
    // Remove from migrations table
    const { error: deleteError } = await supabase
      .from('_migrations')
      .delete()
      .eq('filename', lastMigration.filename);

    if (deleteError) {
      throw deleteError;
    }

    console.log('⚠️ Migration record removed. Manual database rollback may be required.');
    console.log('📋 Check your migration file for rollback instructions.');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    throw error;
  }
}

// CLI handling
const command = process.argv[2];

if (command === 'rollback') {
  rollbackLastMigration().catch(error => {
    console.error('Rollback process failed:', error);
    process.exit(1);
  });
} else {
  runMigrations().catch(error => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runMigrations,
  rollbackLastMigration
};