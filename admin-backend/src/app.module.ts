import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { DatabaseModule }        from './database/database.module';
import { RedisModule }          from './database/redis.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AccessGuard }          from './common/guards/access.guard';
import { AuditLogInterceptor }   from './common/interceptors/audit-log.interceptor';

import { AuthModule }         from './modules/auth/auth.module';
import { AdminAuthModule }    from './modules/admin-auth/admin-auth.module';
import { ContentModule }      from './modules/content/content.module';
import { SecurityModule }     from './modules/security/security.module';
import { AdminSessionModule } from './modules/admin-auth/admin-session.module';
import { LiveModule }         from './modules/live/live.module';
import { SessionModule }      from './modules/session/session.module';
import { ModerationModule }   from './modules/moderation/moderation.module';
import { GrantsModule }       from './modules/grants/grants.module';
import { InsightsModule }     from './modules/insights/insights.module';
import { CheatWatchModule }   from './modules/cheatwatch/cheatwatch.module';
import { AuditModule }        from './modules/audit/audit.module';
import { SystemModule }       from './modules/system/system.module';
import { PrivacyModule }      from './modules/privacy/privacy.module';
import { PlayerModule }       from './modules/player/player.module';
import { MatchModule }        from './modules/match/match.module';
import { MatchmakingModule }  from './modules/matchmaking/matchmaking.module';
import { RewardsModule }      from './modules/rewards/rewards.module';
import { StoreModule }        from './modules/store/store.module';
import { PaymentModule }      from './modules/payment/payment.module';
import { InventoryModule }    from './modules/inventory/inventory.module';
import { ClanModule }         from './modules/clan/clan.module';
import { TournamentModule }   from './modules/tournament/tournament.module';
import { LeaderboardModule }  from './modules/leaderboard/leaderboard.module';
import { NotificationModule } from './modules/notification/notification.module';
import { LegalModule }        from './modules/legal/legal.module';
import { SupportModule }      from './modules/support/support.module';
import { AdminModule }        from './modules/admin/admin.module';
import { ReportsModule }      from './modules/reports/reports.module';
import { MasterDataModule }   from './modules/master-data/master-data.module';
import { RemoteConfigModule } from './modules/remote-config/remote-config.module';
import { AnticheatModule }    from './modules/anticheat/anticheat.module';
import { AnalyticsModule }    from './modules/analytics/analytics.module';
import { BackupModule }       from './modules/backup/backup.module';
import { LocalizationModule } from './modules/localization/localization.module';
import { FriendshipModule }   from './modules/friendship/friendship.module';
import { CostControlModule }  from './modules/cost-control/cost-control.module';
import { LiveOpsModule }      from './modules/liveops/liveops.module';
import { FraudModule }        from './modules/fraud/fraud.module';
import { AchievementModule }  from './modules/achievement/achievement.module';
import { HealthModule }       from './health/health.module';
import { GatewayModule }      from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{
      ttl:   parseInt(process.env.THROTTLE_TTL  ?? '60', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '1000', 10),
    }]),

    // Core
    DatabaseModule,
    RedisModule,

    // Feature modules
    AuthModule,
    AdminAuthModule,
    SecurityModule,
    AdminSessionModule,
    ContentModule,
    LiveModule,
    SessionModule,
    ModerationModule,
    GrantsModule,
    InsightsModule,
    CheatWatchModule,
    AuditModule,
    SystemModule,
    PrivacyModule,
    PlayerModule,
    MatchModule,
    MatchmakingModule,
    RewardsModule,
    StoreModule,
    PaymentModule,
    InventoryModule,
    ClanModule,
    TournamentModule,
    LeaderboardModule,
    NotificationModule,
    LegalModule,
    SupportModule,
    AdminModule,
    ReportsModule,
    MasterDataModule,
    RemoteConfigModule,
    AnticheatModule,
    AnalyticsModule,
    BackupModule,
    LocalizationModule,
    FriendshipModule,
    CostControlModule,
    LiveOpsModule,
    FraudModule,
    AchievementModule,
    HealthModule,
    GatewayModule,
  ],
  providers: [
    { provide: APP_FILTER,      useClass: GlobalExceptionFilter },
    { provide: APP_GUARD,       useClass: ThrottlerGuard },
    { provide: APP_GUARD,       useClass: AccessGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}

