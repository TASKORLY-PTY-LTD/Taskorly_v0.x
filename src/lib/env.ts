import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Database
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
    SUPABASE_SERVICE_ROLE_KEY: z.string(),
    
    // LLM Providers
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    
    // Vector Database
    PINECONE_API_KEY: z.string().optional(),
    PINECONE_INDEX_NAME: z.string().optional(),
    PINECONE_ENVIRONMENT: z.string().optional(),
    
    // Security
    ENCRYPTION_KEY: z.string().min(32),
    NEXTAUTH_SECRET: z.string(),
    
    // Application
    NEXTAUTH_URL: z.string().url().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    
    // MCP Configuration
    MCP_SERVER_TIMEOUT: z.string().transform(Number).default("30000"),
    MCP_MAX_RETRIES: z.string().transform(Number).default("3"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME,
    PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NODE_ENV: process.env.NODE_ENV,
    MCP_SERVER_TIMEOUT: process.env.MCP_SERVER_TIMEOUT,
    MCP_MAX_RETRIES: process.env.MCP_MAX_RETRIES,
  },
});