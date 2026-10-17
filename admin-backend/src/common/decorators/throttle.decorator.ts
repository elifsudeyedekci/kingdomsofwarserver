import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

// Auth endpoints — strict limit to prevent brute force
export const AuthThrottle = () => Throttle({ default: { limit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 5), ttl: 60000 } });   // AUTH_THROTTLE_LIMIT only raises it for automated tests

// API read endpoints — generous limit
export const ReadThrottle = () => Throttle({ default: { limit: 100, ttl: 60000 } });

// Write/mutation endpoints
export const WriteThrottle = () => Throttle({ default: { limit: 20, ttl: 60000 } });

// Strict for sensitive operations (password reset, admin actions)
export const StrictThrottle = () => Throttle({ default: { limit: 3, ttl: 300000 } });
