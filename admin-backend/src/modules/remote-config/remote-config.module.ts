import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RemoteConfigController } from './remote-config.controller';
import { RemoteConfigService } from './remote-config.service';

/** Module for feature flags, A/B tests, remote config, and system settings. */
@Module({
  imports: [DatabaseModule],
  controllers: [RemoteConfigController],
  providers: [RemoteConfigService],
  exports: [RemoteConfigService],
})
export class RemoteConfigModule {}
