/**
 * Retry Utility with Exponential Backoff
 * 
 * Provides resilient retry logic for API calls and other operations
 * that may fail transiently. Uses exponential backoff with jitter.
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  
  // Add jitter: random value between 0 and exponentialDelay * 0.5
  const jitter = Math.random() * exponentialDelay * 0.5;
  
  // Cap at maxDelayMs
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Execute a function with retry logic and exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, shouldRetry, onRetry } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      // Don't retry if shouldRetry returns false
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs);
        
        console.log(
          `[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}. Retrying in ${Math.round(delayMs)}ms...`
        );
        
        onRetry(attempt + 1, error, delayMs);
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error("Unknown error after retries");
}

/**
 * Check if an error is retryable (network errors, rate limits, server errors)
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network errors
  if (message.includes("fetch") || message.includes("network") || message.includes("timeout")) {
    return true;
  }
  
  // Rate limit errors (429)
  if (message.includes("429") || message.includes("rate limit")) {
    return true;
  }
  
  // Server errors (5xx)
  if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
    return true;
  }
  
  // API-specific retryable errors
  if (message.includes("overloaded") || message.includes("service unavailable")) {
    return true;
  }
  
  return false;
}

/**
 * Retry wrapper specifically optimized for API calls
 */
export async function retryApiCall<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(fn, {
    ...options,
    shouldRetry: options.shouldRetry ?? isRetryableError,
  });
}
