import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';

/** Read access to the audit trail: who changed what, when, from which address, with which (redacted) request body. Role access: ROUTE_POLICY['audit']. */
@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() @ApiOperation({ summary: 'Audit log, newest first (filter by admin, area, text, date)' })
  async list(@Query('adminId') adminId?: string, @Query('area') area?: string, @Query('q') q?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('take') take?: string, @Query('before') before?: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        adminId: adminId || undefined, targetType: area || undefined,
        action: q ? { contains: q, mode: 'insensitive' } : undefined,
        createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined, lt: before ? new Date(before) : undefined },
      },
      orderBy: { createdAt: 'desc' }, take: Math.min(Number(take) || 100, 500),
    });
    const admins = await this.prisma.adminUser.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.adminId).filter(Boolean) as string[])] } }, select: { id: true, name: true, email: true, role: true } });
    const by = new Map(admins.map((a) => [a.id, a]));
    return rows.map((r) => ({ ...r, admin: r.adminId ? by.get(r.adminId) ?? null : null }));
  }

  @Get('areas') async areas() { return (await this.prisma.auditLog.groupBy({ by: ['targetType'], _count: { _all: true }, orderBy: { _count: { targetType: 'desc' } }, take: 60 })).filter((x) => x.targetType).map((x) => ({ area: x.targetType, count: x._count._all })); }
}
