import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContentService } from './content.service';

class SaveDto { @IsString() path!: string; @IsString() content!: string; @IsOptional() @IsBoolean() create?: boolean }
class PublishDto { @IsOptional() @IsString() @MaxLength(500) note?: string; @IsOptional() @IsIn(['live', 'staging']) channel?: string }
class RevertDto { @IsString() path!: string; @IsOptional() @IsBoolean() toBuild?: boolean }
class ImportDto { @IsOptional() @IsString() dir?: string; @IsOptional() @IsBoolean() resetBase?: boolean }
interface AdminReq { user: { id: string } }

/** Game data editor + server-side patches ("content releases"). Role access: ROUTE_POLICY['content']. */
@ApiTags('content')
@ApiBearerAuth()
@Controller('content')
export class ContentController {
  constructor(private readonly service: ContentService) {}

  @Get('files') @ApiOperation({ summary: 'Every managed data file with its state (changed from the build / unpublished)' })
  files() { return this.service.listFiles(); }

  @Get('file') file(@Query('path') path: string) { return this.service.getFile(path); }
  @Put('file') @ApiOperation({ summary: 'Save a DRAFT of a data file (validated JSON). Players do not see it until you publish.' })
  save(@Request() req: AdminReq, @Body() dto: SaveDto) { return this.service.saveDraft(dto.path, dto.content, req.user.id, dto.create); }
  @Post('revert') @HttpCode(200) revert(@Request() req: AdminReq, @Body() dto: RevertDto) { return this.service.revertDraft(dto.path, !!dto.toBuild, req.user.id); }
  @Get('diff') diff(@Query('path') path: string, @Query('against') against: 'active' | 'build' = 'active') { return this.service.diff(path, against === 'build' ? 'build' : 'active'); }

  @Get('releases') releases() { return this.service.releases(); }
  @Get('releases/diff') releaseDiff(@Query('a', ParseIntPipe) a: number, @Query('b', ParseIntPipe) b: number) { return this.service.releaseDiff(a, b); }
  @Post('publish') @HttpCode(200) @ApiOperation({ summary: 'Snapshot all drafts as a new numbered release and make it the one clients download' })
  publish(@Request() req: AdminReq, @Body() dto: PublishDto) { return this.service.publish(dto.note, req.user.id, dto.channel ?? 'live'); }
  @Post('releases/:version/activate') @HttpCode(200) @ApiOperation({ summary: 'Roll back / forward: make an older release the active one' })
  activate(@Request() req: AdminReq, @Param('version', ParseIntPipe) version: number) { return this.service.activate(version, req.user.id); }

  @Post('import') @HttpCode(200) @ApiOperation({ summary: 'Import the data files that ship inside the game build (first setup)' })
  import(@Request() req: AdminReq, @Body() dto: ImportDto) { return this.service.importFromDisk(req.user.id, dto.dir, dto.resetBase); }
}
