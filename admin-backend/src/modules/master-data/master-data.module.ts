import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MasterDataService } from './master-data.service';
import { MasterDataController } from './master-data.controller';

/**
 * MasterDataModule
 *
 * Encapsulates all game master-data management:
 * civilizations, units, buildings, technologies, maps,
 * landmarks, balance configs, and version records.
 *
 * Exports MasterDataService so other modules (e.g. MatchModule)
 * can read game content without coupling to the database directly.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [MasterDataController],
  providers: [MasterDataService],
  exports: [MasterDataService],
})
export class MasterDataModule {}
