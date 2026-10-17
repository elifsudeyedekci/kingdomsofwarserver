import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LocalizationService } from './localization.service';
import { UpsertLocalizationKeyDto } from './dto/upsert-localization-key.dto';
import { ImportBatchDto } from './dto/import-batch.dto';

/**
 * REST endpoints for the Localization system.
 * All routes require a valid Bearer token (enforced at the JwtAuthGuard level).
 *
 * Schema note: the "locale" query/path param maps to the "language" column in
 * the LocalizationKey table — see localization.service.ts for details.
 */
@ApiTags('localization')
@ApiBearerAuth()
@Controller('localization')
export class LocalizationController {
  constructor(private readonly service: LocalizationService) {}

  // ---------------------------------------------------------------------------
  // GET /localization/locales
  // ---------------------------------------------------------------------------
  @Get('locales')
  @ApiOperation({ summary: 'List all supported locales present in the database' })
  getSupportedLocales() {
    return this.service.getSupportedLocales();
  }

  // ---------------------------------------------------------------------------
  // GET /localization/stats
  // ---------------------------------------------------------------------------
  @Get('stats')
  @ApiOperation({ summary: 'Get key count per locale' })
  getKeyStats() {
    return this.service.getKeyStats();
  }

  // ---------------------------------------------------------------------------
  // GET /localization/keys?locale=&page=&limit=&search=
  // ---------------------------------------------------------------------------
  @Get('keys')
  @ApiOperation({ summary: 'List localization keys for a locale (paginated, searchable)' })
  @ApiQuery({ name: 'locale', required: true, example: 'tr' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'search', required: false, description: 'Filter by key or value substring' })
  getKeys(
    @Query('locale') locale: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
  ) {
    return this.service.getKeys(locale, Number(page), Number(limit), search);
  }

  // ---------------------------------------------------------------------------
  // GET /localization/keys/:key?locale=
  // ---------------------------------------------------------------------------
  @Get('keys/:key')
  @ApiOperation({ summary: 'Get a single localization key for a specific locale' })
  @ApiParam({ name: 'key', description: 'The localization key identifier', example: 'ui.main_menu.play_button' })
  @ApiQuery({ name: 'locale', required: true, example: 'tr' })
  getKey(
    @Param('key') key: string,
    @Query('locale') locale: string,
  ) {
    return this.service.getKey(key, locale);
  }

  // ---------------------------------------------------------------------------
  // PUT /localization/keys — upsert a single key+locale pair
  // ---------------------------------------------------------------------------
  @Put('keys')
  @ApiOperation({ summary: 'Create or update a localization key for a locale' })
  upsertKey(@Body() dto: UpsertLocalizationKeyDto) {
    return this.service.upsertKey(dto);
  }

  // ---------------------------------------------------------------------------
  // DELETE /localization/keys/:key?locale=
  // ---------------------------------------------------------------------------
  @Delete('keys/:key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a localization key',
    description: 'If "locale" query param is provided, only that locale is deleted. Otherwise all locales for the key are removed.',
  })
  @ApiParam({ name: 'key', description: 'The localization key identifier' })
  @ApiQuery({ name: 'locale', required: false, description: 'If omitted, deletes all locales for this key' })
  deleteKey(
    @Param('key') key: string,
    @Query('locale') locale?: string,
  ) {
    return this.service.deleteKey(key, locale);
  }

  // ---------------------------------------------------------------------------
  // POST /localization/import — batch upsert
  // ---------------------------------------------------------------------------
  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk import localization strings for a locale' })
  importBatch(@Body() dto: ImportBatchDto) {
    return this.service.importBatch(dto.locale, dto.records);
  }

  // ---------------------------------------------------------------------------
  // GET /localization/export/:locale — full export as flat JSON
  // ---------------------------------------------------------------------------
  @Get('export/:locale')
  @ApiOperation({ summary: 'Export all key-value pairs for a locale as a flat JSON object' })
  @ApiParam({ name: 'locale', example: 'tr' })
  exportLocale(@Param('locale') locale: string) {
    return this.service.exportLocale(locale);
  }

  // ---------------------------------------------------------------------------
  // GET /localization/missing/:locale?referenceLocale=
  // ---------------------------------------------------------------------------
  @Get('missing/:locale')
  @ApiOperation({ summary: 'Find keys present in the reference locale but missing in the target locale' })
  @ApiParam({ name: 'locale', description: 'Target locale to check', example: 'de' })
  @ApiQuery({ name: 'referenceLocale', required: true, example: 'en', description: 'Locale used as the source of truth' })
  getMissingKeys(
    @Param('locale') locale: string,
    @Query('referenceLocale') referenceLocale: string,
  ) {
    return this.service.getMissingKeys(locale, referenceLocale);
  }
}
