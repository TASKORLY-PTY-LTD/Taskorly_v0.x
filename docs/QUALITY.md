# Code Quality and Linting Guide

This document outlines the comprehensive code quality system implemented for the RAG Chat System project.

## Overview

The project uses a multi-layered approach to code quality:

- **TypeScript** for static type checking
- **ESLint** for code quality and best practices
- **Prettier** for consistent code formatting
- **Husky** for Git hooks and pre-commit validation
- **lint-staged** for incremental linting
- **GitHub Actions** for CI/CD validation

## Configuration Files

### TypeScript (`tsconfig.json`)

Enhanced TypeScript configuration with strict type checking:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Key Features:**
- Strict type checking enabled
- No implicit any types allowed
- Unused variables and parameters detection
- Enhanced null checking
- Path mapping for clean imports

### ESLint (`.eslintrc.js`)

Comprehensive linting rules covering:

- **TypeScript-specific rules** for type safety
- **React best practices** and hooks rules
- **Security patterns** to prevent common vulnerabilities
- **Import organization** and dependency management
- **Code quality** standards and best practices

**Rule Categories:**

1. **TypeScript Rules**
   - No unsafe operations
   - Consistent type imports
   - Proper async/await usage
   - Type assertion restrictions

2. **React Rules**
   - Hooks rules compliance
   - JSX best practices
   - Performance optimizations
   - Accessibility considerations

3. **Security Rules**
   - Object injection prevention
   - Unsafe regex detection
   - File system security
   - Child process restrictions

4. **Import Rules**
   - Alphabetical ordering
   - Group organization
   - Unused import removal
   - Path resolution

### Prettier (`.prettierrc.js`)

Consistent code formatting with:

- 80 character line width
- 2-space indentation
- Single quotes preference
- Trailing commas (ES5)
- Semicolon enforcement
- Line ending normalization

## Available Commands

### Basic Commands

```bash
# Development
npm run dev                 # Start development server
npm run build              # Build for production
npm run start              # Start production server

# Type Checking
npm run type-check         # Check TypeScript types
npm run type-check:watch   # Watch mode type checking

# Linting
npm run lint              # Basic Next.js linting
npm run lint:fix          # Auto-fix linting issues
npm run lint:strict       # Strict linting with zero warnings

# Formatting
npm run format            # Format all files
npm run format:check      # Check formatting without fixing

# Quality Gates
npm run quality           # Run all quality checks
npm run quality:fix       # Auto-fix quality issues
npm run quality:check     # Comprehensive quality report

# Validation
npm run validate          # Full project validation
npm run test              # Run test suite (when implemented)
```

### Advanced Commands

```bash
# Database
npm run db:generate       # Generate TypeScript types from Supabase
npm run db:migrate        # Run database migrations
npm run db:reset          # Reset local database

# Cleanup
npm run clean             # Remove build artifacts
npm run clean:deps        # Clean and reinstall dependencies

# Pre-commit
npm run precommit         # Manual pre-commit check
```

## Git Hooks

### Pre-commit Hook

Automatically runs on `git commit`:

1. **Lint-staged** - Lints and formats only staged files
2. **Type checking** - Ensures no TypeScript errors
3. **Test execution** - Runs test suite (when implemented)

### Pre-push Hook

Automatically runs on `git push`:

1. **Full validation** - Complete quality pipeline
2. **Build verification** - Ensures production build works
3. **Security audit** - Checks for vulnerabilities

## Quality Gates

The project implements several quality gates:

### Gate 1: Development (IDE)
- Real-time TypeScript errors
- ESLint warnings in editor
- Prettier formatting on save
- Import organization

### Gate 2: Pre-commit
- Staged file linting and formatting
- Type checking validation
- Test execution

### Gate 3: Pre-push
- Full project validation
- Production build test
- Security audit

### Gate 4: CI/CD (GitHub Actions)
- Multi-job validation pipeline
- Security dependency review
- Build artifact generation
- Test coverage reporting

## Quality Metrics

The quality check script provides scoring based on:

- **Configuration completeness** (TypeScript, ESLint, Prettier, etc.)
- **Type safety** (TypeScript compilation without errors)
- **Code quality** (ESLint rules compliance)
- **Formatting consistency** (Prettier formatting)
- **Security** (Dependency audit)
- **Build success** (Production build completion)
- **Test coverage** (Test suite execution)

### Scoring Thresholds

- **80-100%**: Excellent quality ✅
- **60-79%**: Good quality ⚠️
- **Below 60%**: Needs improvement ❌

## IDE Integration

### VSCode Configuration

The project includes VSCode settings for:

- Automatic formatting on save
- ESLint integration
- TypeScript IntelliSense
- Import organization
- File nesting patterns
- Recommended extensions

### Recommended Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- GitLens
- Error Lens

## Troubleshooting

### Common Issues

1. **TypeScript Errors**
   ```bash
   npm run type-check        # Check specific errors
   # Fix types or add proper type annotations
   ```

2. **ESLint Errors**
   ```bash
   npm run lint:strict       # See all linting issues
   npm run lint:fix          # Auto-fix what's possible
   ```

3. **Formatting Issues**
   ```bash
   npm run format:check      # Check formatting
   npm run format            # Fix formatting
   ```

4. **Build Failures**
   ```bash
   npm run clean             # Clear build cache
   npm run build             # Rebuild
   ```

### Performance Optimization

- Use `lint-staged` for faster pre-commit checks
- Enable ESLint caching for faster subsequent runs
- Use TypeScript incremental compilation
- Exclude test files from production builds

## Best Practices

### Code Organization

1. **File Structure**
   - Group related functionality
   - Use consistent naming conventions
   - Implement proper import organization

2. **Type Definitions**
   - Define interfaces for all data structures
   - Use strict typing for API responses
   - Avoid `any` type usage

3. **Error Handling**
   - Implement proper error boundaries
   - Use typed error responses
   - Handle async operations correctly

4. **Security**
   - Never commit secrets or API keys
   - Validate all user inputs
   - Use secure coding practices

### Continuous Improvement

1. **Regular Updates**
   - Update dependencies monthly
   - Review and update linting rules
   - Monitor security advisories

2. **Team Coordination**
   - Establish consistent code style
   - Document architectural decisions
   - Conduct regular code reviews

3. **Performance Monitoring**
   - Track build times
   - Monitor bundle sizes
   - Analyze runtime performance

## Customization

### Adding New Rules

1. **ESLint Rules**
   ```javascript
   // .eslintrc.js
   rules: {
     'custom-rule': 'error',
     // Add new rules here
   }
   ```

2. **TypeScript Configuration**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "newOption": true
     }
   }
   ```

3. **Prettier Options**
   ```javascript
   // .prettierrc.js
   module.exports = {
     newOption: 'value'
   };
   ```

### Project-specific Overrides

Create overrides for specific file patterns:

```javascript
// .eslintrc.js
overrides: [
  {
    files: ['src/api/**/*.ts'],
    rules: {
      'no-console': 'off' // Allow console in API routes
    }
  }
]
```

## Conclusion

This comprehensive quality system ensures:

- **Consistent code style** across the entire project
- **Type safety** preventing runtime errors
- **Security** through automated vulnerability detection
- **Maintainability** through enforced best practices
- **Reliability** through automated testing and validation

The system is designed to catch issues early in the development process, reducing bugs and improving code quality while maintaining development velocity.