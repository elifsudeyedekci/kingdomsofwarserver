import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsUUID, MaxLength } from 'class-validator';

/**
 * DTO for POST /analytics/event
 * Maps to AnalyticsEvent model in schema.prisma
 */
export class TrackEventDto {
  @ApiProperty({ example: 'match_started', description: 'Unique event type identifier' })
  @IsString()
  @MaxLength(100)
  eventType: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-...', description: 'Player user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 'sess_abc123', description: 'Client session identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { mapId: 'highland', civId: 'english' },
    description: 'Arbitrary event payload — stored as JSONB (properties field)',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
