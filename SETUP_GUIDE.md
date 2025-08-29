# Non-Technical Setup Guide

**Taskorly** is an intelligent chat system that lets you upload documents and have conversations with AI about your content. Perfect for businesses, researchers, or anyone who needs to quickly find information in their documents.

## What Does This System Do?

- 💬 **Smart Chat**: Have natural conversations with AI about your documents
- 📄 **Document Upload**: Upload PDFs, Word docs, text files, and more
- 🔍 **Intelligent Search**: AI finds relevant information across all your documents
- 🏢 **Team Workspaces**: Separate spaces for different teams or projects
- 🔒 **Secure**: Your data stays private and secure
- 🤖 **Multiple AI Models**: Choose from OpenAI, Anthropic, or Google AI

## Quick Start Guide

### Step 1: Set Up Your Database (Supabase)

Supabase is like a smart database that stores your information securely in the cloud.

#### 1.1 Create a Free Supabase Account
1. Go to [supabase.com](https://supabase.com) and click "Start your project"
2. Sign up with your email address
3. Verify your email when prompted

#### 1.2 Create a New Project
1. Click "New Project" in your Supabase dashboard
2. Choose your organization (or create one)
3. Fill in project details:
   - **Name**: `Taskorly` (or any name you prefer)
   - **Database Password**: Create a strong password and **write it down** - you'll need it later
   - **Region**: Choose the closest to your location
4. Click "Create new project" and wait 2-3 minutes for setup

#### 1.3 Set Up Your Database Tables
1. In your Supabase project, click "SQL Editor" on the left sidebar
2. Click "New Query"
3. Copy the entire contents of the file `setup-database.sql` (in this project folder)
4. Paste it into the SQL editor
5. Click "Run" button (this creates all the tables your app needs)

#### 1.4 Get Your Database Keys
1. Click "Settings" → "API" in the left sidebar
2. **Copy and save these two keys** (you'll need them in Step 2):
   - **Project URL**: Something like `https://abcdefgh.supabase.co`
   - **anon public key**: A long string starting with `eyJ...`
   - **service_role key**: Another long string starting with `eyJ...`

⚠️ **Important**: Keep your `service_role` key secret - it's like a master key to your database!

### Step 2: Set Up Your Environment

#### 2.1 Install Node.js
If you don't have Node.js installed:
1. Go to [nodejs.org](https://nodejs.org)
2. Download the LTS version (recommended for most users)
3. Install it by following the installer instructions

#### 2.2 Download and Set Up the Project
1. Download this project folder to your computer
2. Open your computer's terminal/command prompt
3. Navigate to the project folder:
   ```bash
   cd path/to/taskorly-folder
   ```
4. Install the required components:
   ```bash
   npm install
   ```

#### 2.3 Configure Your Environment
1. Find the file named `.env.example` in the project folder
2. Make a copy of it and rename the copy to `.env.local`
3. Open `.env.local` in any text editor and fill in these values:

```bash
# Copy these from your Supabase project (Step 1.4)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Create a random 32-character string for security (exactly 32 characters!)
ENCRYPTION_KEY=abcdefghijklmnopqrstuvwxyz123456

# Create another random string for authentication
NEXTAUTH_SECRET=your-random-secret-here
NEXTAUTH_URL=http://localhost:3000

# AI Provider Keys (optional - you can add these later)
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=your-anthropic-key-here
GOOGLE_API_KEY=your-google-ai-key-here
```

**Important Notes:**
- The `ENCRYPTION_KEY` must be exactly 32 characters long
- Keep all keys starting with `sk-` or long strings secret
- You can get AI provider keys from:
  - OpenAI: [platform.openai.com](https://platform.openai.com)
  - Anthropic: [console.anthropic.com](https://console.anthropic.com)
  - Google AI: [makersuite.google.com](https://makersuite.google.com)

### Step 3: Start the System

1. In your terminal, run:
   ```bash
   npm run dev
   ```
2. Wait for the message "Ready - started server on 0.0.0.0:3000"
3. Open your web browser and go to: `http://localhost:3000`
4. You should see the Taskorly welcome page!

### Step 4: Create Your First Account

1. Click "Sign Up" on the welcome page
2. Fill in:
   - **Email**: Your email address
   - **Password**: At least 8 characters
   - **Full Name**: Your display name
   - **Organization Name**: Your company or team name
3. Click "Create Account"
4. You should be redirected to your dashboard!

## Troubleshooting Common Issues

### "Failed to create tenant" Error
**Problem**: Database tables weren't created properly
**Solution**: 
1. Go back to Supabase → SQL Editor
2. Run the `setup-database.sql` file again
3. Try creating your account again

### "PGRST106" or Schema Errors
**Problem**: Your database is empty
**Solution**:
1. In Supabase, go to SQL Editor
2. Copy and run the entire `setup-database.sql` file
3. Restart your development server (`npm run dev`)

### "tRPC Context" Errors
**Problem**: The app started in the wrong order
**Solution**: 
1. Stop the server (Ctrl+C in terminal)
2. Run `npm run dev` again

### Page Won't Load
**Problem**: Port might be in use
**Solution**:
1. Stop the server (Ctrl+C)
2. Try: `npm run dev -- --port 3001`
3. Open `http://localhost:3001` instead

### Can't Install Packages
**Problem**: Node.js or npm issues
**Solution**:
1. Make sure Node.js is installed: `node --version`
2. Try: `npm install --legacy-peer-deps`
3. Or try: `npm cache clean --force` then `npm install`

## Using the System

### Adding Documents
1. Go to the "Documents" page
2. Click "Upload Document"
3. Select your files (PDF, Word, text files, etc.)
4. Wait for processing to complete
5. Your documents are now searchable!

### Chatting with Your Documents
1. Go to the "Chat" page
2. Type questions about your uploaded documents
3. The AI will search through your documents and provide answers
4. You can see which documents were used for each answer

### Managing Your Team
1. Go to "Settings" → "Users"
2. Click "Invite User"
3. Enter their email and role
4. They'll receive instructions to join your workspace

## Security & Privacy

- Your data is stored securely in your own Supabase database
- All API keys are encrypted before storage
- Each team workspace is completely isolated
- You control who has access to your data

## Need Help?

If you run into issues:
1. Check the troubleshooting section above
2. Look at the browser console for error messages (F12 → Console)
3. Check the terminal where you ran `npm run dev` for server errors