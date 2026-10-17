import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
  DefaultValuePipe,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { RedisCacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { CacheTTL } from '../../common/decorators/cache-ttl.decorator';
import { MasterDataService } from './master-data.service';
import { CreateCivilizationDto } from './dto/create-civilization.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateGameMapDto } from './dto/create-map.dto';
import { CreateBuildingDto } from './dto/create-building.dto';
import { CreateTechnologyDto } from './dto/create-technology.dto';
import { CreateLandmarkDto } from './dto/create-landmark.dto';

/**
 * MasterDataController
 *
 * Exposes read and write endpoints for all game master-data:
 * civilizations, units, buildings, technologies, maps, landmarks,
 * balance configs, and version management.
 */
@ApiTags('master-data')
@ApiBearerAuth()
@Controller('master-data')
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Civilizations
  // ─────────────────────────────────────────────────────────────────────────

  @Get('civilizations')
  @ApiOperation({ summary: 'List all civilizations' })
  getCivilizations() {
    return this.service.getCivilizations();
  }

  @Get('civilizations/:civId')
  @ApiOperation({ summary: 'Get a civilization by its stable id' })
  @ApiParam({ name: 'civId', example: 'english' })
  getCivilization(@Param('civId') civId: string) {
    return this.service.getCivilization(civId);
  }

  @Post('civilizations')
  @ApiOperation({ summary: 'Create a new civilization' })
  createCivilization(@Body() dto: CreateCivilizationDto) {
    return this.service.createCivilization(dto);
  }

  @Patch('civilizations/:civId')
  @ApiOperation({ summary: 'Update a civilization (partial)' })
  @ApiParam({ name: 'civId', example: 'english' })
  updateCivilization(
    @Param('civId') civId: string,
    @Body() body: { nameKey?: string; data?: Record<string, unknown> },
  ) {
    return this.service.updateCivilization(civId, body);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Units
  // ─────────────────────────────────────────────────────────────────────────

  @Get('units')
  @ApiOperation({ summary: 'List units, optionally filtered by civId and age' })
  @ApiQuery({ name: 'civId', required: false })
  @ApiQuery({ name: 'age', required: false, type: Number })
  getUnits(
    @Query('civId') civId?: string,
    @Query('age') age?: string,
  ) {
    return this.service.getUnits({
      civId,
      age: age !== undefined ? parseInt(age, 10) : undefined,
    });
  }

  @Get('units/:unitId')
  @ApiOperation({ summary: 'Get a unit by its stable id' })
  @ApiParam({ name: 'unitId', example: 'longbowman' })
  getUnit(@Param('unitId') unitId: string) {
    return this.service.getUnit(unitId);
  }

  @Post('units')
  @ApiOperation({ summary: 'Create a new unit' })
  createUnit(@Body() dto: CreateUnitDto) {
    return this.service.createUnit(dto);
  }

  @Patch('units/:unitId')
  @ApiOperation({ summary: 'Update a unit (partial)' })
  @ApiParam({ name: 'unitId', example: 'longbowman' })
  updateUnit(
    @Param('unitId') unitId: string,
    @Body() body: { nameKey?: string; data?: Record<string, unknown> },
  ) {
    return this.service.updateUnit(unitId, body);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Buildings
  // ─────────────────────────────────────────────────────────────────────────

  @Get('buildings')
  @ApiOperation({ summary: 'List buildings, optionally filtered by civId and age' })
  @ApiQuery({ name: 'civId', required: false })
  @ApiQuery({ name: 'age', required: false, type: Number })
  getBuildings(
    @Query('civId') civId?: string,
    @Query('age') age?: string,
  ) {
    return this.service.getBuildings({
      civId,
      age: age !== undefined ? parseInt(age, 10) : undefined,
    });
  }

  @Get('buildings/:buildingId')
  @ApiOperation({ summary: 'Get a building by its stable id' })
  @ApiParam({ name: 'buildingId', example: 'council_hall' })
  getBuilding(@Param('buildingId') buildingId: string) {
    return this.service.getBuilding(buildingId);
  }

  @Post('buildings')
  @ApiOperation({ summary: 'Create a new building' })
  createBuilding(@Body() dto: CreateBuildingDto) {
    return this.service.createBuilding(dto);
  }

  @Patch('buildings/:buildingId')
  @ApiOperation({ summary: 'Update a building (partial)' })
  @ApiParam({ name: 'buildingId', example: 'council_hall' })
  updateBuilding(
    @Param('buildingId') buildingId: string,
    @Body() body: { nameKey?: string; data?: Record<string, unknown> },
  ) {
    return this.service.updateBuilding(buildingId, body);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Technologies
  // ─────────────────────────────────────────────────────────────────────────

  @Get('technologies')
  @ApiOperation({ summary: 'List technologies, optionally filtered by civId and age' })
  @ApiQuery({ name: 'civId', required: false })
  @ApiQuery({ name: 'age', required: false, type: Number })
  getTechnologies(
    @Query('civId') civId?: string,
    @Query('age') age?: string,
  ) {
    return this.service.getTechnologies({
      civId,
      age: age !== undefined ? parseInt(age, 10) : undefined,
    });
  }

  @Get('technologies/:techId')
  @ApiOperation({ summary: 'Get a technology by its stable id' })
  @ApiParam({ name: 'techId', example: 'heavy_maa' })
  getTechnology(@Param('techId') techId: string) {
    return this.service.getTechnology(techId);
  }

  @Post('technologies')
  @ApiOperation({ summary: 'Create a new technology' })
  createTechnology(@Body() dto: CreateTechnologyDto) {
    return this.service.createTechnology(dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Maps
  // ─────────────────────────────────────────────────────────────────────────

  @Get('maps')
  @ApiOperation({ summary: 'List maps; pass activeOnly=true to filter inactive maps' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  getMaps(
    @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe) activeOnly: boolean,
  ) {
    return this.service.getMaps(activeOnly);
  }

  @Get('maps/:mapId')
  @ApiOperation({ summary: 'Get a map by its stable id' })
  @ApiParam({ name: 'mapId', example: 'arabia' })
  getMap(@Param('mapId') mapId: string) {
    return this.service.getMap(mapId);
  }

  @Post('maps')
  @ApiOperation({ summary: 'Create a new game map' })
  createMap(@Body() dto: CreateGameMapDto) {
    return this.service.createMap(dto);
  }

  @Patch('maps/:mapId')
  @ApiOperation({ summary: 'Update a map (partial); toggle isActive inside data blob' })
  @ApiParam({ name: 'mapId', example: 'arabia' })
  updateMap(
    @Param('mapId') mapId: string,
    @Body() body: { nameKey?: string; data?: Record<string, unknown> },
  ) {
    return this.service.updateMap(mapId, body);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Landmarks
  // ─────────────────────────────────────────────────────────────────────────

  @Get('landmarks')
  @ApiOperation({ summary: 'List landmarks, optionally filtered by civId' })
  @ApiQuery({ name: 'civId', required: false })
  getLandmarks(@Query('civId') civId?: string) {
    return this.service.getLandmarks(civId);
  }

  @Post('landmarks')
  @ApiOperation({ summary: 'Create a new landmark' })
  createLandmark(@Body() dto: CreateLandmarkDto) {
    return this.service.createLandmark(dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Balance Config
  // ─────────────────────────────────────────────────────────────────────────

  @Get('balance')
  @ApiOperation({ summary: 'List all balance config entries' })
  getAllBalanceConfigs() {
    return this.service.getAllBalanceConfigs();
  }

  @Get('balance/:key')
  @ApiOperation({ summary: 'Get a single balance config entry by key' })
  @ApiParam({ name: 'key', example: 'unit_damage_multiplier' })
  getBalanceConfig(@Param('key') key: string) {
    return this.service.getBalanceConfig(key);
  }

  @Post('balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert a balance config entry (version auto-incremented on update)' })
  setBalanceConfig(
    @Body() body: { key: string; value: unknown; updatedBy?: string },
  ) {
    return this.service.setBalanceConfig(body.key, body.value, body.updatedBy);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Master Data Versions
  // ─────────────────────────────────────────────────────────────────────────

  @Get('versions')
  @ApiOperation({ summary: 'List all master data versions' })
  getVersions() {
    return this.service.getVersions();
  }

  @Post('versions/:id/publish')
  @ApiOperation({ summary: 'Publish (stamp publishedAt/By) a master data version record' })
  @ApiParam({ name: 'id', description: 'UUID of the MasterDataVersion record' })
  publishVersion(
    @Param('id') id: string,
    @Body() body: { publishedBy: string },
  ) {
    return this.service.publishVersion(id, body.publishedBy);
  }
}
