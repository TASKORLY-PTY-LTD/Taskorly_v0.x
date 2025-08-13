#!/usr/bin/env node

/**
 * Dependency Validation and Testing Framework
 * Prevents missing dependency issues before they break the dev server
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const REQUIRED_DEPENDENCIES = {
  // Core Next.js
  'next': '^15.0.0',
  'react': '^19.0.0',
  'react-dom': '^19.0.0',
  
  // shadcn/ui essentials
  '@radix-ui/react-icons': '^1.0.0',
  'clsx': '^2.0.0',
  'tailwind-merge': '^3.0.0',
  'class-variance-authority': '^0.7.0',
  'lucide-react': '^0.400.0',
  
  // Supabase (if using production auth)
  '@supabase/supabase-js': '^2.0.0',
  '@supabase/auth-helpers-nextjs': '^0.10.0',
  
  // Styling
  'tailwindcss': '^3.4.0',
  'postcss': '^8.4.0',
  'autoprefixer': '^10.4.0',
};

const CRITICAL_FILES = [
  'next.config.js',
  'tailwind.config.js',
  'postcss.config.js',
  'tsconfig.json',
  'src/app/globals.css',
  'components.json',
];

const DEPRECATED_CONFIGS = {
  'next.config.js': [
    { pattern: /experimental:\s*{\s*appDir:\s*true/, message: 'appDir is no longer experimental in Next.js 15+' }
  ]
};

class DependencyValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.packageJson = null;
  }

  async validate() {
    console.log('🔍 Starting dependency validation...\n');
    
    try {
      await this.loadPackageJson();
      await this.validateDependencies();
      await this.validateFiles();
      await this.validateConfigurations();
      await this.testImports();
      
      this.printResults();
      return this.errors.length === 0;
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      return false;
    }
  }

  async loadPackageJson() {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      this.packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    } catch (error) {
      this.errors.push('Cannot read package.json');
      throw error;
    }
  }

  async validateDependencies() {
    const allDeps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies
    };

    // Check for missing required dependencies
    for (const [dep, version] of Object.entries(REQUIRED_DEPENDENCIES)) {
      if (!allDeps[dep]) {
        this.errors.push(`Missing required dependency: ${dep}@${version}`);
      }
    }

    // Check for critical shadcn/ui dependencies
    const shadcnDeps = [
      '@radix-ui/react-icons',
      'clsx',
      'tailwind-merge',
      'class-variance-authority'
    ];

    const missingShadcnDeps = shadcnDeps.filter(dep => !allDeps[dep]);
    if (missingShadcnDeps.length > 0) {
      this.errors.push(`Missing shadcn/ui dependencies: ${missingShadcnDeps.join(', ')}`);
    }
  }

  async validateFiles() {
    for (const file of CRITICAL_FILES) {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        this.errors.push(`Missing critical file: ${file}`);
      }
    }
  }

  async validateConfigurations() {
    // Check Next.js config
    const nextConfigPath = path.join(process.cwd(), 'next.config.js');
    if (fs.existsSync(nextConfigPath)) {
      const content = fs.readFileSync(nextConfigPath, 'utf8');
      
      for (const check of DEPRECATED_CONFIGS['next.config.js']) {
        if (check.pattern.test(content)) {
          this.warnings.push(`next.config.js: ${check.message}`);
        }
      }
    }

    // Validate Tailwind CSS configuration
    const tailwindPath = path.join(process.cwd(), 'tailwind.config.js');
    if (fs.existsSync(tailwindPath)) {
      const content = fs.readFileSync(tailwindPath, 'utf8');
      if (!content.includes('darkMode')) {
        this.warnings.push('tailwind.config.js: Consider adding darkMode configuration');
      }
    }
  }

  async testImports() {
    const testImports = [
      'import { Button } from "@/components/ui/button"',
      'import { Card } from "@/components/ui/card"',
      'import { cn } from "@/lib/utils"',
      'import { CheckIcon } from "@radix-ui/react-icons"'
    ];

    // Create temporary test file
    const testFile = path.join(process.cwd(), 'test-imports.mjs');
    const testContent = `
${testImports.join(';\n')};
console.log('✅ All imports successful');
`;

    try {
      fs.writeFileSync(testFile, testContent);
      execSync('node --check ' + testFile, { stdio: 'pipe' });
      console.log('✅ Import validation passed');
    } catch (error) {
      this.errors.push('Import validation failed - check for missing dependencies');
    } finally {
      // Cleanup
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  }

  printResults() {
    console.log('\n📊 Validation Results:');
    console.log('─'.repeat(50));
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All validations passed! Your project is ready for development.');
      return;
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors (must fix):');
      this.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
      
      console.log('\n🔧 Quick Fix Commands:');
      console.log('npm install @radix-ui/react-icons @supabase/auth-helpers-nextjs');
      console.log('# Remove appDir from next.config.js experimental options');
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings (recommended fixes):');
      this.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`Summary: ${this.errors.length} error(s), ${this.warnings.length} warning(s)`);
  }
}

// Auto-fix functionality
class AutoFixer {
  static async fixMissingDependencies() {
    console.log('🔧 Auto-fixing missing dependencies...');
    
    const missingDeps = [
      '@radix-ui/react-icons',
      '@supabase/auth-helpers-nextjs'
    ];

    try {
      execSync(`npm install ${missingDeps.join(' ')}`, { stdio: 'inherit' });
      console.log('✅ Dependencies installed successfully');
    } catch (error) {
      console.error('❌ Failed to install dependencies:', error.message);
    }
  }

  static async fixNextConfig() {
    const configPath = path.join(process.cwd(), 'next.config.js');
    if (!fs.existsSync(configPath)) return;

    let content = fs.readFileSync(configPath, 'utf8');
    
    // Remove deprecated appDir experimental option
    content = content.replace(/experimental:\s*{\s*appDir:\s*true,?\s*},?\s*\n?/g, '');
    
    fs.writeFileSync(configPath, content);
    console.log('✅ Fixed next.config.js');
  }
}

// Testing framework integration
class TestFramework {
  static createPreCommitHook() {
    const hookContent = `#!/bin/sh
# Validate dependencies before commit
node scripts/validate-dependencies.js
if [ $? -ne 0 ]; then
  echo "❌ Dependency validation failed. Please fix the issues above."
  exit 1
fi
`;

    const hooksDir = path.join(process.cwd(), '.git/hooks');
    if (fs.existsSync(hooksDir)) {
      fs.writeFileSync(path.join(hooksDir, 'pre-commit'), hookContent);
      fs.chmodSync(path.join(hooksDir, 'pre-commit'), '755');
      console.log('✅ Pre-commit hook installed');
    }
  }

  static addPackageScript() {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['validate-deps'] = 'node scripts/validate-dependencies.js';
    packageJson.scripts['fix-deps'] = 'node scripts/validate-dependencies.js --fix';
    packageJson.scripts['predev'] = 'npm run validate-deps';
    
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Added validation scripts to package.json');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isFixMode = args.includes('--fix');
  const isSetup = args.includes('--setup');

  if (isSetup) {
    TestFramework.addPackageScript();
    TestFramework.createPreCommitHook();
    return;
  }

  if (isFixMode) {
    await AutoFixer.fixMissingDependencies();
    await AutoFixer.fixNextConfig();
    return;
  }

  const validator = new DependencyValidator();
  const isValid = await validator.validate();
  
  process.exit(isValid ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DependencyValidator, AutoFixer, TestFramework };