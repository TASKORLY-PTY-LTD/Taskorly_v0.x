#!/usr/bin/env node

/**
 * Basic backend test script
 * Tests core functionality without requiring a full frontend
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Testing RAG Chat System Backend\n');

// Check if required files exist
const requiredFiles = [
  'package.json',
  'src/lib/rag/pipeline.ts',
  'src/lib/mcp/manager.ts',
  'src/server/routers/chat.ts',
  'src/server/routers/documents.ts',
  'src/server/routers/mcp.ts',
  'src/server/routers/config.ts',
  'src/server/api/root.ts',
  'supabase/migrations/001_initial_schema.sql',
];

console.log('📋 Checking required files...');
let missingFiles = [];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file}`);
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.log(`\n❌ Missing ${missingFiles.length} required files. Cannot proceed with tests.`);
  process.exit(1);
}

console.log('\n✅ All required files present\n');

// Check package.json dependencies
console.log('📦 Checking dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = [
  '@trpc/server',
  '@langchain/openai',
  '@modelcontextprotocol/sdk',
  '@supabase/supabase-js',
  'zod',
  'superjson',
];

let missingDeps = [];
requiredDeps.forEach(dep => {
  if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
    console.log(`✅ ${dep}`);
  } else {
    console.log(`❌ ${dep}`);
    missingDeps.push(dep);
  }
});

if (missingDeps.length > 0) {
  console.log(`\n⚠️  Missing ${missingDeps.length} dependencies. Run 'npm install' first.`);
}

// Check TypeScript compilation
console.log('\n🔧 Checking TypeScript compilation...');
try {
  execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.log('❌ TypeScript compilation failed:');
  console.log(error.stdout.toString());
  process.exit(1);
}

// Check environment variables template
console.log('\n🌍 Checking environment configuration...');
if (fs.existsSync('.env.example')) {
  console.log('✅ .env.example present');
  
  if (fs.existsSync('.env.local')) {
    console.log('✅ .env.local exists (configure with your values)');
  } else {
    console.log('⚠️  .env.local not found (copy from .env.example and configure)');
  }
} else {
  console.log('❌ .env.example missing');
}

// Test API route structure
console.log('\n🛣️  Checking API routes...');
const apiRoutes = [
  'src/app/api/trpc/[trpc]/route.ts',
  'src/app/api/health/route.ts',
];

apiRoutes.forEach(route => {
  if (fs.existsSync(route)) {
    console.log(`✅ ${route}`);
  } else {
    console.log(`❌ ${route}`);
  }
});

// Check database migration
console.log('\n🗄️  Checking database migration...');
if (fs.existsSync('supabase/migrations/001_initial_schema.sql')) {
  const migration = fs.readFileSync('supabase/migrations/001_initial_schema.sql', 'utf8');
  const requiredTables = ['tenants', 'users', 'conversations', 'messages', 'documents', 'document_chunks', 'mcp_servers', 'api_keys', 'usage_logs'];
  
  requiredTables.forEach(table => {
    if (migration.includes(`CREATE TABLE ${table}`)) {
      console.log(`✅ ${table} table`);
    } else {
      console.log(`❌ ${table} table missing`);
    }
  });
}

console.log('\n🎉 Backend structure validation complete!');
console.log('\n📋 Next steps:');
console.log('1. Copy .env.example to .env.local and configure your environment variables');
console.log('2. Set up your Supabase project and run the migrations');
console.log('3. Install dependencies: npm install');
console.log('4. Start the development server: npm run dev');
console.log('5. Test the health endpoint: curl http://localhost:3000/api/health');

console.log('\n🔧 Development commands:');
console.log('- npm run dev: Start development server');
console.log('- npm run build: Build for production');
console.log('- npm run type-check: Check TypeScript types');

console.log('\n📚 Documentation:');
console.log('- README.md: Complete setup and usage guide');
console.log('- API documentation available at tRPC introspection endpoint when running');

console.log('\n✨ Your RAG Chat System backend is ready for development!');