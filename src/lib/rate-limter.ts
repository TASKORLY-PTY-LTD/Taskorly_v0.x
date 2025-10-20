interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Store rate limit data in memory
const limits = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically to prevent memory leaks
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // 1 minute

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number;    // Time window in milliseconds
}

export interface RateLimitResult {
  success: boolean;     // Whether request is allowed
  remaining: number;    // Requests remaining in window
  resetIn: number;      // Milliseconds until limit resets
  limit: number;        // Total limit
}

/**
 * Check if a request should be rate limited
 * 
 * @param identifier - Unique identifier (user ID, IP, etc.)
 * @param config - Rate limit configuration
 * @returns Result indicating if request is allowed
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 }
): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup to prevent memory leaks
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanupExpiredEntries(now);
    lastCleanup = now;
  }

  const entry = limits.get(identifier);

  // No existing entry or entry expired - create new window
  if (!entry || now > entry.resetAt) {
    limits.set(identifier, {
      count: 1,
      resetAt: now + config.windowMs,
    });

    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
      limit: config.maxRequests,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetIn: entry.resetAt - now,
      limit: config.maxRequests,
    };
  }

  // Increment count
  entry.count++;

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetAt - now,
    limit: config.maxRequests,
  };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(now: number): void {
  let cleaned = 0;
  
  for (const [key, entry] of limits.entries()) {
    if (now > entry.resetAt) {
      limits.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[RateLimit] Cleaned up ${cleaned} expired entries`);
  }
}

/**
 * Reset rate limit for a specific identifier (useful for testing)
 */
export function resetRateLimit(identifier: string): void {
  limits.delete(identifier);
}

/**
 * Get current rate limit stats for an identifier
 */
export function getRateLimitStats(identifier: string): RateLimitEntry | null {
  return limits.get(identifier) || null;
}

/**
 * Clear all rate limit data (useful for testing)
 */
export function clearAllRateLimits(): void {
  limits.clear();
  console.log('[RateLimit] All rate limits cleared');
}