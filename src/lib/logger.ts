import { supabaseAdmin } from './supabase';

/**
 * Log levels for structured logging
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Structured logger that integrates with Supabase for log review across environments
 * This allows us to track application logs in the database for better debugging and monitoring
 */
export class Logger {
  private tenantId?: string;
  private userId?: string;

  constructor(tenantId?: string, userId?: string) {
    this.tenantId = tenantId;
    this.userId = userId;
  }

  /**
   * Log a debug message - used for detailed debugging information
   * These logs are typically only shown in development environments
   */
  async debug(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log an info message - used for general information about application flow
   * These logs help track normal application behavior
   */
  async info(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log a warning message - used for potentially harmful situations
   * These logs indicate something unexpected happened but the application can continue
   */
  async warn(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log an error message - used for error events that might still allow the application to continue
   * These logs indicate serious problems that need attention
   */
  async error(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.ERROR, message, metadata);
  }

  /**
   * Internal method to handle the actual logging
   * Stores logs in Supabase for centralized log management across environments
   */
  private async log(level: LogLevel, message: string, metadata?: Record<string, any>) {
    try {
      // Always log to console for immediate visibility during development
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(logEntry, metadata || '');
          break;
        case LogLevel.INFO:
          console.info(logEntry, metadata || '');
          break;
        case LogLevel.WARN:
          console.warn(logEntry, metadata || '');
          break;
        case LogLevel.ERROR:
          console.error(logEntry, metadata || '');
          break;
      }

      // Store in Supabase for centralized log management
      // This allows us to review logs across different environments
      if (this.tenantId) {
        const { data, error } = await supabaseAdmin.from('usage_logs').insert({
          tenant_id: this.tenantId,
          user_id: this.userId,
          operation: `log_${level}`, // Use actual DB column name
          tokens_used: 0,
          cost_usd: 0, // Use actual DB column name
          metadata: {
            level,
            message,
            timestamp,
            ...metadata,
          },
        } as any); // Add 'as any' to bypass TypeScript type checking

        // Debug: Log if Supabase insert fails
        if (error) {
          console.error('Supabase log insert failed:', error);
        } else {
          console.log('Log successfully stored in Supabase');
        }
      } else {
        console.warn('Cannot store log in Supabase: missing tenant_id');
      }
    } catch (error) {
      // Fallback to console if Supabase logging fails
      console.error('Failed to log to Supabase:', error);
      console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`, metadata || '');
    }
  }
}

/**
 * Create a logger instance with tenant and user context
 * This provides better traceability for logs in multi-tenant environments
 */
export function createLogger(tenantId?: string, userId?: string): Logger {
  return new Logger(tenantId, userId);
}

/**
 * Default logger for general application logging
 * Use this when tenant/user context is not available
 */
export const logger = new Logger();
