# Production Deployment Checklist

Use this checklist to ensure safe and successful production deployments.

## Pre-Deployment Checklist

### Code Quality & Testing ✅

- [ ] All unit tests passing (`npm run test`)
- [ ] All E2E tests passing (`npm run test:e2e`)
- [ ] TypeScript compilation successful (`npm run type-check`)
- [ ] Linting passes with zero warnings (`npm run lint:strict`)
- [ ] Code formatting validated (`npm run format:check`)
- [ ] Security audit clean (`npm audit --audit-level high`)
- [ ] No hardcoded secrets in codebase

### Database & Migrations 🗄️

- [ ] Database migrations tested on staging environment
- [ ] Migration scripts wrapped in transactions (BEGIN/COMMIT)
- [ ] Rollback procedures documented and tested
- [ ] No destructive operations without approval (DROP TABLE, ALTER COLUMN)
- [ ] Database backup completed before deployment
- [ ] RLS policies verified for new tables

### Environment Configuration 🔧

- [ ] Production environment variables configured in Vercel
- [ ] Supabase production project set up and configured
- [ ] SSL certificates and custom domain configured
- [ ] Security headers configured (`vercel.json`)
- [ ] API rate limiting configured if needed
- [ ] Feature flags configured for gradual rollout

### Monitoring & Observability 📊

- [ ] Health check endpoint responding (`/api/health`)
- [ ] Error monitoring configured (Sentry/similar)
- [ ] Performance monitoring enabled
- [ ] Log aggregation configured
- [ ] Alerting configured for critical metrics

### Security Review 🛡️

- [ ] No API keys or secrets in source code
- [ ] Environment variables properly secured
- [ ] Authentication flows tested end-to-end
- [ ] Authorization policies validated
- [ ] HTTPS enforced across all endpoints
- [ ] Security headers properly configured

## Deployment Process ⚡

### Pre-Deployment Actions

- [ ] **Notify team** of upcoming deployment
- [ ] **Create deployment branch** from main if needed
- [ ] **Run final tests** on deployment branch
- [ ] **Backup current production** database

### During Deployment

- [ ] **Monitor CI/CD pipeline** for any failures
- [ ] **Watch health checks** during deployment
- [ ] **Monitor error rates** for immediate issues
- [ ] **Verify database migrations** completed successfully

### Post-Deployment Validation

- [ ] **Health check passes** (`curl -f https://your-domain.com/api/health`)
- [ ] **Key user flows work**:
  - [ ] User registration and login
  - [ ] Document upload and processing
  - [ ] Chat functionality with RAG
  - [ ] Settings and configuration
- [ ] **Performance metrics** within acceptable ranges
- [ ] **Error rates** below baseline thresholds
- [ ] **Database connectivity** and query performance normal

## Post-Deployment Monitoring ⏰

### First 15 Minutes

- [ ] Monitor health check endpoint every minute
- [ ] Check error logs for new issues
- [ ] Verify core functionality through manual testing
- [ ] Monitor response times and availability

### First Hour

- [ ] Check application performance metrics
- [ ] Monitor database performance and connections
- [ ] Review user activity and error reports
- [ ] Validate all integrations working (AI providers, etc.)

### First 24 Hours

- [ ] Monitor user feedback and support requests
- [ ] Review comprehensive performance metrics
- [ ] Analyze error patterns and trends
- [ ] Confirm no degradation in key metrics

## Rollback Procedures 🔄

### Immediate Rollback Triggers

- [ ] Health check failures persisting > 2 minutes
- [ ] Error rate increase > 10x baseline
- [ ] Critical functionality completely broken
- [ ] Security vulnerability discovered
- [ ] Database corruption detected

### Rollback Steps

1. **Stop traffic** to new deployment if possible
2. **Revert application** to previous stable version:
   ```bash
   vercel rollback --token=$VERCEL_TOKEN
   ```
3. **Rollback database** if migrations were applied:
   ```bash
   npm run db:rollback:production
   ```
4. **Verify rollback** success via health checks
5. **Notify team** and stakeholders of rollback
6. **Document issues** for post-mortem analysis

## Emergency Contacts 🆘

### Technical Contacts

- **Primary Developer**: [contact info]
- **DevOps Engineer**: [contact info]
- **Database Administrator**: [contact info]

### Service Providers

- **Vercel Support**: vercel.com/support
- **Supabase Support**: supabase.com/support
- **Domain/DNS Provider**: [provider support]

## Post-Deployment Review 📋

### Success Metrics

- [ ] Deployment completed within target time window
- [ ] Zero critical issues in first 24 hours
- [ ] Performance metrics maintained or improved
- [ ] User experience uninterrupted
- [ ] All planned features working as expected

### Documentation Updates

- [ ] Update CHANGELOG.md with new features/fixes
- [ ] Update API documentation if needed
- [ ] Document any configuration changes
- [ ] Update deployment procedures based on learnings

### Team Communication

- [ ] Send deployment success notification
- [ ] Schedule post-mortem if any issues occurred
- [ ] Update project status in team channels
- [ ] Plan next deployment cycle

---

## Deployment Commands Quick Reference

```bash
# Local validation before deployment
npm run validate

# Database migration check (local)
npm run type-check
npm run lint:strict

# Production database migration
npm run db:migrate:production

# Emergency rollback
npm run db:rollback:production

# Health check
curl -f https://your-domain.com/api/health

# Vercel deployment status
vercel ls

# Vercel logs
vercel logs https://your-domain.com
```

## Environment Variables Checklist

### Required for Production

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ENCRYPTION_KEY=32-character-key-exactly
NEXTAUTH_SECRET=secure-random-string
NEXTAUTH_URL=https://your-domain.com
NODE_ENV=production
```

### Optional (AI Providers)

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
```

---

**Remember**: When in doubt, don't deploy. It's better to delay deployment than to cause production
issues. Always have a rollback plan ready.
