import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';

const SECRET_KEY = /pass(word)?|token|secret|authorization|otp|private.?key|refresh/i;
const MAX_BODY_BYTES = 16 * 1024;

/** Copy of `value` with secret-looking fields masked, so audit rows never store passwords or tokens. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value ?? null;
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = SECRET_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    return out;
  }
  if (typeof value === 'string' && value.length > 4000) return value.slice(0, 4000) + '…[truncated]';
  return value;
}

/**
 * Writes one AuditLog row for every successful mutating request (POST/PUT/PATCH/DELETE).
 * Admin principals -> adminId + redacted request body (so the panel can show WHO changed WHAT); players -> userId only.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, user, ip, headers } = req;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    return next.handle().pipe(
      tap(async () => {
        try {
          const path = String(req.originalUrl ?? req.url ?? '').split('?')[0];
          const parts = path.split('/').filter(Boolean);
          const isAdmin = user?.kind === 'admin';
          let newValue: unknown = null;
          if (isAdmin && req.body && Object.keys(req.body).length) {
            const body = redact(req.body);
            newValue = JSON.stringify(body).length > MAX_BODY_BYTES ? { truncated: true } : body;
          }
          await this.prisma.auditLog.create({
            data: {
              adminId: isAdmin ? user.id : null,
              userId: user && !isAdmin ? user.id : null,
              action: `${method} ${path}`,
              targetType: parts[0] ?? null,
              targetId: parts[1] ?? null,
              newValue: newValue as never,
              ipAddress: ip,
              userAgent: headers['user-agent'],
            },
          });
        } catch (err) {
          this.logger.warn(`Audit log write failed: ${(err as Error).message}`);
        }
      }),
    );
  }
}
