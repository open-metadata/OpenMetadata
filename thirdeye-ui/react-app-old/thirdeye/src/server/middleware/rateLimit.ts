import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

// In-memory store for rate limiting (use Redis in production)
const buckets = new Map<string, TokenBucket>();

/**
 * Simple token bucket rate limiter
 */
export function createRateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Get or create bucket for this key
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: maxRequests,
        lastRefill: now
      };
      buckets.set(key, bucket);
    }

    // Calculate tokens to add based on time elapsed
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timeElapsed / windowMs) * maxRequests);
    
    // Refill bucket
    bucket.tokens = Math.min(maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if request can proceed
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, bucket.tokens));
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
      
      next();
    } else {
      // Rate limit exceeded
      const retryAfter = Math.ceil(windowMs / 1000);
      
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
      res.setHeader('Retry-After', retryAfter.toString());
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      });
    }
  };
}

// Predefined rate limiters for common endpoints
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  keyGenerator: (req) => `auth:${req.ip}:${req.body?.email || 'unknown'}`
});

export const signupRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 signups per hour per IP
  keyGenerator: (req) => `signup:${req.ip}`
});

export const passwordResetRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 password reset requests per hour
  keyGenerator: (req) => `reset:${req.ip}:${req.body?.email || 'unknown'}`
});

export const emailVerificationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 verification requests per hour
  keyGenerator: (req) => `verify:${req.ip}:${req.body?.email || 'unknown'}`
});

export const refreshTokenRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 refresh attempts per 15 minutes
  keyGenerator: (req) => `refresh:${req.ip}`
});

export const generalApiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  keyGenerator: (req) => `api:${req.ip}`
});

// Clean up old buckets periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  const keysToDelete: string[] = [];
  buckets.forEach((bucket, key) => {
    if (now - bucket.lastRefill > maxAge) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => buckets.delete(key));
}, 60 * 60 * 1000); // Clean up every hour

export default createRateLimit;
