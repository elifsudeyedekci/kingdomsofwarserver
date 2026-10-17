import { PlayerApi } from '../../common/decorators/player-api.decorator';
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AchievementService } from './achievement.service';
import { AchievementEventDTO } from './dto/achievement.dto';

@Controller('achievements')
export class AchievementController {
  constructor(private readonly achievements: AchievementService) {}

  @PlayerApi()
  @Get()
  getAll() { return this.achievements.getAllAchievements(); }

  @Get('stats')
  stats() { return this.achievements.getAchievementStats(); }

  @Get('player/:playerId')
  playerAchievements(@Param('playerId') playerId: string) {
    return this.achievements.getPlayerAchievements(playerId);
  }

  @Post('player/:playerId/track')
  track(@Param('playerId') playerId: string, @Body() event: AchievementEventDTO) {
    return this.achievements.trackProgress(playerId, event);
  }

  @Post('player/:playerId/grant')
  grant(@Param('playerId') playerId: string, @Body() body: { achievementId: string }) {
    return this.achievements.adminGrantAchievement(playerId, body.achievementId);
  }

  @Delete('player/:playerId/:achievementId')
  revoke(@Param('playerId') playerId: string, @Param('achievementId') achievementId: string) {
    return this.achievements.adminRevokeAchievement(playerId, achievementId);
  }
}
