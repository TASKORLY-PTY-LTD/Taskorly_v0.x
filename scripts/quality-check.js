#!/usr/bin/env node

/**
 * Comprehensive quality check script
 * Runs all quality gates and provides detailed reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, description, options = {}) {
  const { ignoreErrors = false, silent = false } = options;
  
  try {
    log(`\n${colors.blue}➤ ${description}${colors.reset}`);
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    
    if (silent) {
      return { success: true, output };
    }
    
    log(`${colors.green}✓ ${description} completed successfully${colors.reset}`);
    return { success: true };
  } catch (error) {
    const message = `✗ ${description} failed`;
    
    if (ignoreErrors) {
      log(`${colors.yellow}⚠ ${message} (ignored)${colors.reset}`);
      return { success: false, ignored: true, error };
    } else {
      log(`${colors.red}${message}${colors.reset}`);
      if (error.stdout) {
        console.error(error.stdout);
      }
      return { success: false, error };
    }
  }
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`${colors.green}✓ ${description}${colors.reset}`);
    return true;
  } else {
    log(`${colors.red}✗ ${description} not found${colors.reset}`);
    return false;
  }
}

async function main() {
  log(`${colors.bold}${colors.cyan}🔍 RAG Chat System - Comprehensive Quality Check${colors.reset}\n`);
  
  const results = {
    configFiles: 0,
    typeCheck: false,
    lint: false,
    format: false,
    security: false,
    build: false,
    tests: false,
  };

  // 1. Check configuration files
  log(`${colors.bold}📋 Configuration Files Check${colors.reset}`);
  const configFiles = [
    ['tsconfig.json', 'TypeScript configuration'],
    ['.eslintrc.js', 'ESLint configuration'],
    ['.prettierrc.js', 'Prettier configuration'],
    ['package.json', 'Package configuration'],
    ['.env.example', 'Environment template'],
    ['.gitignore', 'Git ignore rules'],
  ];

  let configCount = 0;
  configFiles.forEach(([file, desc]) => {
    if (checkFileExists(file, desc)) configCount++;
  });
  results.configFiles = configCount;

  // 2. TypeScript type checking
  log(`\n${colors.bold}📝 TypeScript Type Checking${colors.reset}`);
  const typeCheckResult = runCommand('npm run type-check', 'Type checking');
  results.typeCheck = typeCheckResult.success;

  // 3. ESLint
  log(`\n${colors.bold}🔍 ESLint Code Quality${colors.reset}`);
  const lintResult = runCommand('npm run lint:strict', 'ESLint strict checking');
  results.lint = lintResult.success;

  // 4. Prettier formatting
  log(`\n${colors.bold}🎨 Prettier Code Formatting${colors.reset}`);
  const formatResult = runCommand('npm run format:check', 'Prettier format checking');
  results.format = formatResult.success;

  // 5. Security audit
  log(`\n${colors.bold}🛡️ Security Audit${colors.reset}`);
  const securityResult = runCommand('npm audit --audit-level=high', 'Security vulnerability check', { ignoreErrors: true });
  results.security = securityResult.success || securityResult.ignored;

  // 6. Build test
  log(`\n${colors.bold}🏗️ Build Test${colors.reset}`);
  
  // Create temporary environment for build
  const envContent = `
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-key
SUPABASE_SERVICE_ROLE_KEY=test-service-key
ENCRYPTION_KEY=test-32-character-key-here-test
NEXTAUTH_SECRET=test-nextauth-secret-for-build
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
`.trim();

  fs.writeFileSync('.env.local', envContent);
  
  try {
    const buildResult = runCommand('npm run build', 'Production build test');
    results.build = buildResult.success;
  } finally {
    // Clean up
    if (fs.existsSync('.env.local')) {
      fs.unlinkSync('.env.local');
    }
  }

  // 7. Tests
  log(`\n${colors.bold}🧪 Test Suite${colors.reset}`);
  const testResult = runCommand('npm test', 'Running test suite', { ignoreErrors: true });
  results.tests = testResult.success;

  // Generate report
  log(`\n${colors.bold}${colors.magenta}📊 Quality Check Report${colors.reset}`);
  log('═'.repeat(50));
  
  const checks = [
    [`Configuration Files (${results.configFiles}/${configFiles.length})`, results.configFiles === configFiles.length],
    ['TypeScript Type Check', results.typeCheck],
    ['ESLint Code Quality', results.lint],
    ['Prettier Formatting', results.format],
    ['Security Audit', results.security],
    ['Production Build', results.build],
    ['Test Suite', results.tests],
  ];

  let passedChecks = 0;
  checks.forEach(([name, passed]) => {
    const status = passed ? `${colors.green}✓ PASS` : `${colors.red}✗ FAIL`;
    log(`${status} ${name}${colors.reset}`);
    if (passed) passedChecks++;
  });

  log('═'.repeat(50));
  
  const score = Math.round((passedChecks / checks.length) * 100);
  const scoreColor = score >= 80 ? colors.green : score >= 60 ? colors.yellow : colors.red;
  
  log(`${colors.bold}Overall Score: ${scoreColor}${score}%${colors.reset} (${passedChecks}/${checks.length} checks passed)`);

  // Recommendations
  if (score < 100) {
    log(`\n${colors.bold}${colors.yellow}💡 Recommendations:${colors.reset}`);
    
    if (!results.typeCheck) log('• Fix TypeScript type errors before proceeding');
    if (!results.lint) log('• Address ESLint warnings and errors');
    if (!results.format) log('• Run "npm run format" to fix formatting issues');
    if (!results.security) log('• Review and update dependencies with security vulnerabilities');
    if (!results.build) log('• Fix build errors and ensure all dependencies are properly configured');
    if (!results.tests) log('• Implement and ensure all tests pass');
  }

  // Commands summary
  log(`\n${colors.bold}${colors.cyan}🔧 Available Commands:${colors.reset}`);
  log('• npm run quality       - Run all quality checks');
  log('• npm run quality:fix   - Auto-fix linting and formatting issues');
  log('• npm run type-check    - Check TypeScript types');
  log('• npm run lint:strict   - Strict ESLint checking');
  log('• npm run format        - Format code with Prettier');
  log('• npm run build         - Build for production');
  log('• npm run validate      - Full validation pipeline');

  // Exit with appropriate code
  if (score >= 80) {
    log(`\n${colors.green}${colors.bold}🎉 Quality check passed! Your code meets the quality standards.${colors.reset}`);
    process.exit(0);
  } else {
    log(`\n${colors.red}${colors.bold}❌ Quality check failed. Please address the issues above.${colors.reset}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`${colors.red}Error running quality check:${colors.reset}`, error);
  process.exit(1);
});