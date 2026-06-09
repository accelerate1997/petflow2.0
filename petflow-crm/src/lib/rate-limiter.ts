/**
 * rate-limiter.ts — Next.js CRM API Rate Limiter
 * Provides an in-memory token-bucket rate limiting implementation.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, Bucket> = new Map();
  private maxTokens: number;
  private refillIntervalMs: number;
  private refillAmount: number;

  constructor(limitPerWindow: number, windowMs: number) {
    this.maxTokens = limitPerWindow;
    this.refillIntervalMs = windowMs;
    this.refillAmount = limitPerWindow;

    // Periodic cleanup of stale records every 10 minutes to prevent memory leaks
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }
  }

  /**
   * Refills the bucket tokens based on time elapsed since last refill
   */
  private refill(bucket: Bucket, now: number): Bucket {
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * (this.refillAmount / this.refillIntervalMs);
    
    return {
      tokens: Math.min(this.maxTokens, bucket.tokens + tokensToAdd),
      lastRefill: now
    };
  }

  /**
   * Checks if a request key exceeds the rate limit.
   * If not, consumes 1 token.
   */
  public limit(key: string): { allowed: boolean; limit: number; remaining: number; reset: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
    } else {
      bucket = this.refill(bucket, now);
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      
      const timeToReset = Math.ceil(((this.maxTokens - bucket.tokens) / this.maxTokens) * this.refillIntervalMs);
      return {
        allowed: true,
        limit: this.maxTokens,
        remaining: Math.floor(bucket.tokens),
        reset: Math.max(0, timeToReset)
      };
    }

    this.buckets.set(key, bucket);
    const timeToReset = Math.ceil(((this.maxTokens - bucket.tokens) / this.maxTokens) * this.refillIntervalMs);
    return {
      allowed: false,
      limit: this.maxTokens,
      remaining: 0,
      reset: Math.max(0, timeToReset)
    };
  }

  /**
   * Removes stale buckets to free memory
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > this.refillIntervalMs) {
        this.buckets.delete(key);
      }
    }
  }
}

// Default global API rate limiter: 60 requests per 1 minute (60,000 ms)
export const apiRateLimiter = new RateLimiter(60, 60000);
