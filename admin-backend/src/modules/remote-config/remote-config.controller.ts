import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RemoteConfigService } from './remote-config.service';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { CreateAbTestDto } from './dto/create-ab-test.dto';
import { UpsertRemoteConfigDto } from './dto/upsert-config.dto';

@ApiTags('remote-config')
@ApiBearerAuth()
@Controller('remote-config')
export class RemoteConfigController {
  constructor(private readonly service: RemoteConfigService) {}

  // ─────────────────────────────────────────────
  // Feature Flags
  // ─────────────────────────────────────────────

  @Get('flags')
  @ApiOperation({ summary: 'List all feature flags' })
  getFeatureFlags() {
    return this.service.getFeatureFlags();
  }

  @Get('flags/:key/enabled')
  @ApiOperation({ summary: 'Check if a flag is enabled' })
  async isFlagEnabled(@Param('key') key: string) {
    const enabled = await this.service.isEnabled(key);
    return { key, enabled };
  }

  @Get('flags/:key')
  @ApiOperation({ summary: 'Get a feature flag by key' })
  getFeatureFlag(@Param('key') key: string) {
    return this.service.getFeatureFlag(key);
  }

  @Post('flags')
  @ApiOperation({ summary: 'Create a feature flag' })
  createFeatureFlag(@Body() dto: CreateFeatureFlagDto) {
    return this.service.createFeatureFlag(dto);
  }

  @Patch('flags/:key')
  @ApiOperation({ summary: 'Update a feature flag' })
  updateFeatureFlag(
    @Param('key') key: string,
    @Body() data: Partial<CreateFeatureFlagDto>,
  ) {
    return this.service.updateFeatureFlag(key, data);
  }

  @Delete('flags/:key')
  @ApiOperation({ summary: 'Delete a feature flag' })
  deleteFeatureFlag(@Param('key') key: string) {
    return this.service.deleteFeatureFlag(key);
  }

  // ─────────────────────────────────────────────
  // A/B Tests
  // ─────────────────────────────────────────────

  @Get('ab-tests')
  @ApiOperation({ summary: 'List A/B tests' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  getAbTests(@Query('activeOnly') activeOnly?: string) {
    return this.service.getAbTests(activeOnly === 'true');
  }

  @Get('ab-tests/:name/variant')
  @ApiOperation({ summary: 'Get the deterministic variant assigned to a user' })
  @ApiQuery({ name: 'userId', required: true })
  async getVariantForUser(
    @Param('name') name: string,
    @Query('userId') userId: string,
  ) {
    const variantId = await this.service.getVariantForUser(name, userId);
    return { name, userId, variantId };
  }

  @Get('ab-tests/:name')
  @ApiOperation({ summary: 'Get an A/B test by name' })
  getAbTest(@Param('name') name: string) {
    return this.service.getAbTest(name);
  }

  @Post('ab-tests')
  @ApiOperation({ summary: 'Create an A/B test' })
  createAbTest(@Body() dto: CreateAbTestDto) {
    return this.service.createAbTest(dto);
  }

  @Patch('ab-tests/:name')
  @ApiOperation({ summary: 'Update an A/B test' })
  updateAbTest(
    @Param('name') name: string,
    @Body() data: Partial<CreateAbTestDto> & { status?: string; result?: any },
  ) {
    return this.service.updateAbTest(name, data);
  }

  // ─────────────────────────────────────────────
  // Remote Config
  // ─────────────────────────────────────────────

  @Get('configs')
  @ApiOperation({ summary: 'List remote configs, optionally filtered by environment' })
  @ApiQuery({ name: 'environment', required: false })
  getConfigs(@Query('environment') environment?: string) {
    return this.service.getConfigs(environment);
  }

  @Post('configs')
  @ApiOperation({ summary: 'Upsert a remote config entry' })
  upsertConfig(@Body() dto: UpsertRemoteConfigDto) {
    return this.service.upsertConfig(dto);
  }

  @Delete('configs/:id')
  @ApiOperation({ summary: 'Delete a remote config entry by id' })
  deleteConfig(@Param('id') id: string) {
    return this.service.deleteConfig(id);
  }

  // ─────────────────────────────────────────────
  // System Settings
  // ─────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'List all system settings' })
  getSettings() {
    return this.service.getSettings();
  }

  @Post('settings')
  @ApiOperation({ summary: 'Upsert a system setting' })
  setSetting(@Body() body: { key: string; value: any; updatedBy?: string }) {
    return this.service.setSetting(body.key, body.value, body.updatedBy);
  }

  @Delete('settings/:key')
  @ApiOperation({ summary: 'Delete a system setting by key' })
  deleteSetting(@Param('key') key: string) {
    return this.service.deleteSetting(key);
  }

  // ─────────────────────────────────────────────
  // Client Startup Bundle
  // ─────────────────────────────────────────────

  @Get('client')
  @ApiOperation({ summary: 'Mobile client startup payload — active configs + enabled flags' })
  @ApiQuery({ name: 'environment', required: false })
  getClientConfig(@Query('environment') environment?: string) {
    return this.service.getClientConfig(environment);
  }
}
