import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemService } from './system.service';

/** Measured server health for the panel (CPU, memory, event loop, database latency, online players, running matches, error rate, last backup). Role access: ROUTE_POLICY['system']. */
@ApiTags('system')
@ApiBearerAuth()
@Controller('system')
export class SystemController {
  constructor(private readonly service: SystemService) {}
  @Get('health') @ApiOperation({ summary: 'Real, measured health of this server' }) health() { return this.service.health(); }
}
