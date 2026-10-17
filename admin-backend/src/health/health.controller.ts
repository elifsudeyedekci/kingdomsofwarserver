import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe — no auth required' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'kingdoms-of-war-admin-backend',
      version: process.env.npm_package_version ?? '1.0.0',
    };
  }
}
