import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.module';
import { CACHE_TTL_KEY } from '../decorators/cache-ttl.decorator';

export const DEFAULT_CACHE_TTL = 60; // seconds

/**
 * RedisCacheInterceptor
 *
 * Caches GET responses in Redis using the request URL as the cache key.
 * Default TTL is 60 seconds. Use @CacheTTL(n) on a route handler to override.
 * Non-GET requests bypass the cache entirely.
 */
@Injectable()
export class RedisCacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') return next.handle();

    const ttl =
      this.reflector.get<number>(CACHE_TTL_KEY, context.getHandler()) ?? DEFAULT_CACHE_TTL;

    const key = `cache:${request.url}`;
    const cached = await this.redis.get(key).catch(() => null);
    if (cached) return of(JSON.parse(cached));

    return next.handle().pipe(
      tap(async (data) => {
        await this.redis.setex(key, ttl, JSON.stringify(data)).catch(() => null);
      }),
    );
  }
}
