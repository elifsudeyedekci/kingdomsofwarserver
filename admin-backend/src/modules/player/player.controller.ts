import { PlayerApi } from '../../common/decorators/player-api.decorator';
import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Request,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PlayerService } from './player.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RedisCacheInterceptor } from '../../common/interceptors/cache.interceptor';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('player')
@ApiBearerAuth()
@Controller('player')
export class PlayerController {
  constructor(private readonly service: PlayerService) {}

  @PlayerApi()
  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@Request() req: AuthRequest) {
    return this.service.getMe(req.user.id);
  }

  @PlayerApi()
  @Put('me')
  @ApiOperation({ summary: 'Update own profile' })
  updateProfile(@Request() req: AuthRequest, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(req.user.id, dto);
  }

  @PlayerApi()
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete own account' })
  async deleteAccount(@Request() req: AuthRequest) {
    await this.service.softDelete(req.user.id, req.user.id);
  }

  @PlayerApi()
  @Get('me/stats')
  @ApiOperation({ summary: 'Get own match stats' })
  getStats(@Request() req: AuthRequest) {
    return this.service.getStats(req.user.id);
  }

  @PlayerApi()
  @Get('me/matches')
  @ApiOperation({ summary: 'Get own match history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMatchHistory(
    @Request() req: AuthRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.getMatchHistory(req.user.id, page, Math.min(limit, 50));
  }

  @Get(':id')
  @UseInterceptors(RedisCacheInterceptor)
  @ApiOperation({ summary: 'Get public player profile by userId' })
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
