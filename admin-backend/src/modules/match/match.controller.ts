import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MatchService } from './match.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { RedisCacheInterceptor } from '../../common/interceptors/cache.interceptor';

@ApiTags('match')
@ApiBearerAuth()
@Controller('match')
export class MatchController {
  constructor(private readonly service: MatchService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new match lobby' })
  create(@Body() dto: CreateMatchDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  @UseInterceptors(RedisCacheInterceptor)
  @ApiOperation({ summary: 'Get match by ID' })
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a match (transitions waiting → loading)' })
  start(@Param('id') id: string) {
    return this.service.start(id);
  }

  @Patch(':id/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record match result and update MMR' })
  recordResult(@Param('id') id: string, @Body() dto: RecordResultDto) {
    return this.service.recordResult(id, dto);
  }

  @Patch(':id/abandon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abandon / cancel a match' })
  abandon(@Param('id') id: string) {
    return this.service.abandon(id);
  }
}
