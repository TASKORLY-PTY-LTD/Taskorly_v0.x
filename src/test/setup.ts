import '@testing-library/jest-dom';
import { beforeAll, vi } from 'vitest';
import dotenv from 'dotenv';

// Load test environment variables from .env.test
dotenv.config({ path: '.env.test' });

// Mock environment variables for tests
beforeAll(() => {
  // Ensure we're in test mode (NODE_ENV should already be set by test runner)
  if (process.env.NODE_ENV !== 'test') {
    // Use Object.defineProperty to override read-only property in test environment
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      writable: true,
    });
  }

  // Set default test environment variables if not provided
  const defaultEnvVars = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
    NEXTAUTH_SECRET: 'test-nextauth-secret',
    NEXTAUTH_URL: 'http://localhost:3000',
  };

  for (const [key, value] of Object.entries(defaultEnvVars)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  // Mock browser APIs
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});
