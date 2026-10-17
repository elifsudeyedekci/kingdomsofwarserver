import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_KEY = 'cache_ttl';

/** Override the default cache TTL (60 s) for a specific route handler. */
export const CacheTTL = (seconds: number) => SetMetadata(CACHE_TTL_KEY, seconds);
