# Deployment Strategy: Separate Customer & Admin Frontends

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Taskorly System                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐               │
│  │   Admin App     │    │  Customer Chat  │               │
│  │                 │    │                 │               │
│  │ admin.taskorly  │    │ chat.taskorly   │               │
│  │ .com            │    │ .com            │               │
│  │                 │    │                 │               │
│  │ - Configuration │    │ - Chat UI       │               │
│  │ - Analytics     │    │ - POS Context   │               │
│  │ - User Mgmt     │    │ - Screen Capture│               │
│  │ - Settings      │    │ - Quick Actions │               │
│  └─────────────────┘    └─────────────────┘               │
│           │                       │                       │
│           └───────────────────────┼───────────────────────┘
│                                   │
│         ┌─────────────────────────┴─────────────────┐
│         │            Shared Backend                │
│         │                                          │
│         │  - Database (Supabase)                   │
│         │  - RAG Pipeline                          │
│         │  - MCP Servers                           │
│         │  - Real-time WebSocket                   │
│         │  - Authentication                        │
│         └──────────────────────────────────────────┘
```

## Deployment Configuration

### 1. Admin Dashboard (Current System)
**Domain**: `admin.taskorly.com`
**Routes**: `/`, `/settings`, `/servers`, `/documents`, `/analytics`

```bash
# Deploy admin interface
npm run build:admin
vercel deploy --prod --alias admin.taskorly.com
```

### 2. Customer Chat Interface
**Domain**: `chat.taskorly.com`
**Routes**: `/`, `/overlay`, `/embedded`

```bash
# Deploy customer interface
npm run build:customer
vercel deploy --prod --alias chat.taskorly.com
```

### 3. Browser Extension
**Distribution**: Chrome Web Store, Firefox Add-ons
**Bundle**: Optimized for extension manifest v3

```bash
# Build extension
npm run build:extension
# Package for Chrome Web Store
npm run package:chrome
```

## Implementation Steps

### Phase 1: Current - Separate Routes
- ✅ Created `/customer` route with futuristic chat UI
- ✅ Created `/customer/overlay` for browser extension preview
- ✅ Bypassed admin authentication for customer routes
- ✅ Implemented shared design tokens with customer variants

### Phase 2: Separate Next.js Apps
Create two distinct Next.js applications:

```
taskorly-admin/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Dashboard
│   │   ├── settings/
│   │   ├── servers/
│   │   └── documents/
│   ├── components/
│   │   ├── layout/           # Admin layout
│   │   └── ui/               # Shared components
│   └── providers/
│       └── auth-provider.tsx # Admin auth

taskorly-customer/  
├── src/
│   ├── app/
│   │   ├── page.tsx          # Full-screen chat
│   │   ├── overlay/
│   │   └── embedded/
│   ├── components/
│   │   ├── customer/         # Customer components
│   │   └── ui/               # Shared components  
│   └── lib/
│       └── pos-context.ts    # POS detection
```

### Phase 3: Browser Extension
```
browser-extension/
├── manifest.json
├── background/
│   └── service-worker.js
├── content-scripts/
│   └── overlay-injector.js
├── popup/
│   └── quick-chat.html
└── shared/
    ├── api-client.js
    └── pos-detector.js
```

## Shared Infrastructure

### Database Schema (Supabase)
```sql
-- Shared tables
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  type TEXT CHECK (type IN ('admin', 'customer')),
  user_id UUID,
  pos_context JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT,
  screen_context JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Routes (Shared)
```typescript
// Shared tRPC router
export const sharedRouter = createTRPCRouter({
  chat: chatRouter,        // Used by both admin and customer
  pos: posRouter,          // Customer-specific POS integration
  analytics: analyticsRouter, // Admin-specific analytics
});
```

### Environment Configuration
```bash
# Admin App (.env.admin)
NEXT_PUBLIC_APP_TYPE=admin
NEXT_PUBLIC_API_URL=https://api.taskorly.com
NEXT_PUBLIC_ADMIN_AUTH_REQUIRED=true

# Customer App (.env.customer)  
NEXT_PUBLIC_APP_TYPE=customer
NEXT_PUBLIC_API_URL=https://api.taskorly.com
NEXT_PUBLIC_CUSTOMER_MODE=true
NEXT_PUBLIC_POS_DETECTION=true
```

## Build Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:admin": "cp .env.admin .env.local && next dev",
    "dev:customer": "cp .env.customer .env.local && next dev -p 3001",
    
    "build:admin": "cp .env.admin .env.local && next build",
    "build:customer": "cp .env.customer .env.local && next build",
    "build:extension": "webpack --config webpack.extension.js",
    
    "deploy:admin": "npm run build:admin && vercel deploy --prod --alias admin.taskorly.com",
    "deploy:customer": "npm run build:customer && vercel deploy --prod --alias chat.taskorly.com"
  }
}
```

## Current Status

✅ **Implemented:**
- Full-screen customer chat interface (`/customer`)
- Overlay chat interface (`/customer/overlay`)  
- Futuristic design with animated backgrounds
- POS system context awareness (mock)
- Separate authentication bypass for customer routes

🔄 **Next Steps:**
- [ ] Extract customer interface to separate Next.js app
- [ ] Implement real POS system detection
- [ ] Create browser extension manifest
- [ ] Set up separate deployment pipelines
- [ ] Add screen capture capabilities
- [ ] Implement real-time POS context integration

## Testing URLs

- **Admin Interface**: http://localhost:3000/ (requires login)
- **Customer Chat**: http://localhost:3000/customer (no auth required)
- **Overlay Demo**: http://localhost:3000/customer/overlay