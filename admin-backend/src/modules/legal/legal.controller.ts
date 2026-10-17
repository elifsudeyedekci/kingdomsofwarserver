import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrivacyRequestStatus, PrivacyRequestType } from '@prisma/client';
import { LegalService } from './legal.service';
import { AcceptLegalDto } from './dto/accept-legal.dto';
import { CreateLegalTextDto } from './dto/create-legal-text.dto';
import { CreatePrivacyRequestDto } from './dto/privacy-request.dto';

@ApiTags('legal')
@ApiBearerAuth()
@Controller('legal')
export class LegalController {
  constructor(private readonly service: LegalService) {}

  // ---------- Legal Texts ----------

  @Get('texts')
  @ApiOperation({ summary: 'Get active legal texts by language' })
  @ApiQuery({ name: 'language', required: false })
  getActiveLegalTexts(@Query('language') language = 'en') {
    return this.service.getActiveLegalTexts(language);
  }

  @Get('texts/:type/:language')
  @ApiOperation({ summary: 'Get a specific active legal text' })
  getLegalText(@Param('type') type: string, @Param('language') language: string) {
    return this.service.getLegalText(type, language);
  }

  @Post('texts')
  @ApiOperation({ summary: 'Create a new legal text version' })
  createLegalText(@Body() dto: CreateLegalTextDto) {
    return this.service.createLegalText(dto);
  }

  @Patch('texts/:id/publish')
  @ApiOperation({ summary: 'Publish a legal text (deactivates others of same type+language)' })
  publishLegalText(@Param('id') id: string) {
    return this.service.publishLegalText(id);
  }

  // ---------- Acceptances ----------

  @Post('accept')
  @ApiOperation({ summary: 'Record user acceptance of a legal text' })
  acceptLegal(
    @Headers('x-user-id') userId: string,
    @Headers('x-forwarded-for') ipAddress: string,
    @Body() dto: AcceptLegalDto,
  ) {
    return this.service.acceptLegal(userId, dto, ipAddress);
  }

  @Get('acceptances/:userId')
  @ApiOperation({ summary: 'Get all legal acceptances for a user' })
  getUserAcceptances(@Param('userId') userId: string) {
    return this.service.getUserAcceptances(userId);
  }

  // ---------- Privacy Requests ----------

  @Post('privacy-request')
  @ApiOperation({ summary: 'Create a GDPR privacy request (export or delete)' })
  createPrivacyRequest(@Body() dto: CreatePrivacyRequestDto) {
    return this.service.createPrivacyRequest(dto.userId, dto.type as PrivacyRequestType);
  }

  @Get('privacy-requests')
  @ApiOperation({ summary: 'List privacy requests with optional status filter' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  getPrivacyRequests(
    @Query('status') status?: string,
    @Query('page')   page  = '1',
    @Query('limit')  limit = '10',
  ) {
    return this.service.getPrivacyRequests(
      status as PrivacyRequestStatus | undefined,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('privacy-requests/:id')
  @ApiOperation({ summary: 'Get a privacy request by ID' })
  getPrivacyRequest(@Param('id') id: string) {
    return this.service.getPrivacyRequest(id);
  }

  @Patch('privacy-requests/:id/start')
  @ApiOperation({ summary: 'Mark a privacy request as processing' })
  startProcessing(@Param('id') id: string, @Headers('x-admin-id') adminId: string) {
    return this.service.startProcessing(id, adminId);
  }

  @Patch('privacy-requests/:id/complete-export')
  @ApiOperation({ summary: 'Complete a data export request' })
  completeExport(@Param('id') id: string, @Body('fileUrl') fileUrl?: string) {
    return this.service.completeExport(id, fileUrl);
  }

  @Patch('privacy-requests/:id/complete-delete')
  @ApiOperation({ summary: 'Complete a data delete request' })
  completeDelete(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.service.completeDelete(id, req.user.id);      // the signed-in admin, never a client-supplied header
  }

  @Get('privacy-requests/:id/export')
  @ApiOperation({ summary: 'Generate the full data export of the player behind a privacy request (JSON)' })
  exportData(@Param('id') id: string) {
    return this.service.exportForRequest(id);
  }

  // ---------- Evidence Export ----------

  @Post('evidence/:userId')
  @ApiOperation({ summary: 'Create a legal evidence export record for a user' })
  exportLegalEvidence(
    @Param('userId')   userId: string,
    @Headers('x-admin-id') requestedBy: string,
  ) {
    return this.service.exportLegalEvidence(userId, requestedBy);
  }
}
