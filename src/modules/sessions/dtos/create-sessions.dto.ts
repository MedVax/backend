import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsBoolean,
  IsUUID,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType } from 'generated/prisma/enums';
import { OrganizationSponsor } from 'generated/prisma/enums';

export class ParticipantDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsString()
  email: string;

  @ApiPropertyOptional({
    example: 'https://example.com/picture.jpg',
    description: 'Picture URL',
  })
  @IsString()
  @IsOptional()
  picture?: string;
}

export class CreateSessionsDto {
  @ApiProperty({ example: 'uuid', description: 'Consultant ID' })
  @IsUUID()
  consultantId: string;

  @ApiProperty({ example: 'uuid', description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiProperty({
    example: ['2024-01-15T10:00:00Z'],
    description: 'Array of ISO date strings for session dates',
    type: [String],
  })
  @IsArray()
  @IsDateString({}, { each: true })
  dates: string[];

  @ApiProperty({
    enum: SessionType,
    example: SessionType.INDIVIDUAL,
    description: 'Type of session',
  })
  @IsEnum(SessionType)
  sessionType: SessionType;

  @ApiProperty({
    example: 'Africa/Lagos',
    description: 'Client timezone',
  })
  @IsString()
  clientTimezone: string;

  @ApiPropertyOptional({
    example: 'https://app.example.com/success',
    description: 'Redirect URL after payment',
  })
  // @IsUrl()
  @IsString()
  @IsOptional()
  redirectUrl?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether to apply gift session',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  applyGift?: boolean;

  @ApiProperty({
    enum: OrganizationSponsor,
    example: OrganizationSponsor.CLIENT,
    description: 'Who pays for the session',
  })
  @IsEnum(OrganizationSponsor)
  paidBy: OrganizationSponsor;

  @ApiPropertyOptional({ example: 'uuid', description: 'HMO ID' })
  @IsUUID()
  @IsOptional()
  hmoId?: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'HMO membership number',
  })
  @IsString()
  @IsOptional()
  hmoNumber?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'Coupon ID' })
  @IsUUID()
  @IsOptional()
  couponId?: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Subscription ID to link session to',
  })
  @IsUUID()
  @IsOptional()
  subscriptionId?: string;

  @ApiPropertyOptional({
    example: 'Note for the session',
    description: 'Note for the session',
  })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    type: [ParticipantDto],
    description: 'Participants for couple sessions',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  @IsOptional()
  participants?: ParticipantDto[];
}
