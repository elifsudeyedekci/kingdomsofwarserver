import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CostControlService } from './cost-control.service';
import { UpdateCostDto } from './dto/update-cost.dto';
import { CostSimulationDto } from './dto/cost-simulation.dto';

/**
 * Admin REST surface for reading and adjusting live economy cost configs.
 * All endpoints require a valid JWT (enforced by the global JwtAuthGuard).
 */
@ApiTags('cost-control')
@ApiBearerAuth()
@Controller('cost-control')
export class CostControlController {
  constructor(private readonly service: CostControlService) {}

  @Get()
  @ApiOperation({ summary: 'List all cost configs (keys prefixed "cost.")' })
  getAllCosts() {
    return this.service.getAllCosts();
  }

  @Get('snapshot')
  @ApiOperation({
    summary: 'Economy snapshot grouped by unit / building / tech / resource',
  })
  getEconomySnapshot() {
    return this.service.getEconomySnapshot();
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Download all cost configs as a CSV file' })
  async exportCostSheet(@Res() res: Response) {
    const csv = await this.service.exportCostSheet();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cost-configs.csv"',
    );
    res.send(csv);
  }

  @Get(':configKey/history')
  @ApiOperation({
    summary: 'Get version metadata for a single cost config key',
  })
  @ApiParam({ name: 'configKey', example: 'cost.unit.spearman.wood' })
  getCostHistory(@Param('configKey') configKey: string) {
    return this.service.getCostHistory(configKey);
  }

  @Get(':configKey')
  @ApiOperation({ summary: 'Get a single cost config by key' })
  @ApiParam({ name: 'configKey', example: 'cost.unit.spearman.wood' })
  getCost(@Param('configKey') configKey: string) {
    return this.service.getCost(configKey);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a cost config (upsert)' })
  updateCost(@Body() dto: UpdateCostDto) {
    return this.service.updateCost(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk upsert multiple cost configs in a transaction' })
  @ApiBody({ type: [UpdateCostDto] })
  bulkUpdateCosts(@Body() updates: UpdateCostDto[]) {
    return this.service.bulkUpdateCosts(updates);
  }

  @Post('simulate')
  @ApiOperation({
    summary:
      'Dry-run: preview the effect of multiplying all costs for a civ/age',
  })
  simulateCostChange(@Body() dto: CostSimulationDto) {
    return this.service.simulateCostChange(dto);
  }
}
