import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { LogChargebackDto } from './dto/log-chargeback.dto';
import { GetChargebacksQueryDto } from './dto/get-chargebacks-query.dto';
import { GetPurchasesQueryDto } from './dto/get-purchases-query.dto';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto';

@ApiTags('payment')
@ApiBearerAuth()
@Controller('payment')
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new purchase record (status: pending)' })
  createPurchase(
    @Query('userId') userId: string,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.service.createPurchase(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all purchases with optional status filter (admin)' })
  getAllPurchases(@Query() query: GetPurchasesQueryDto) {
    return this.service.getAllPurchases(query.page ?? 1, query.limit ?? 20, query.status);
  }

  @Get('report/revenue')
  @ApiOperation({ summary: 'Revenue report for a given date range' })
  getRevenueReport(@Query() query: RevenueReportQueryDto) {
    return this.service.getRevenueReport(query.startDate, query.endDate);
  }

  @Get('chargebacks')
  @ApiOperation({ summary: 'List chargebacks with optional status filter (admin)' })
  getChargebacks(@Query() query: GetChargebacksQueryDto) {
    return this.service.getChargebacks(query);
  }

  @Post('chargebacks')
  @ApiOperation({ summary: 'Log a new chargeback event' })
  logChargeback(@Body() dto: LogChargebackDto) {
    return this.service.logChargeback(dto);
  }

  @Get('player/:userId')
  @ApiOperation({ summary: 'List purchases for a specific player' })
  getPlayerPurchases(
    @Param('userId') userId: string,
    @Query() query: GetPurchasesQueryDto,
  ) {
    return this.service.getPurchases(userId, query.page ?? 1, query.limit ?? 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single purchase by ID' })
  getPurchaseById(@Param('id') id: string) {
    return this.service.getPurchaseById(id);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify a purchase receipt and update status' })
  verifyReceipt(@Param('id') id: string, @Body() dto: VerifyReceiptDto) {
    return this.service.verifyReceipt(id, dto);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Create a refund for a purchase' })
  createRefund(@Param('id') id: string, @Body() dto: CreateRefundDto) {
    return this.service.createRefund(id, dto);
  }
}
