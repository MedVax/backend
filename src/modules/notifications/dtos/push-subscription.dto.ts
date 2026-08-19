import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'Client public key (base64url)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  p256dh: string;

  @ApiProperty({ description: 'Client auth secret (base64url)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  auth: string;
}

export class CreatePushSubscriptionDto {
  @ApiProperty({ description: 'Push service endpoint URL' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;

  @ApiPropertyOptional({ description: 'Browser user agent, for the UI' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}

export class DeletePushSubscriptionDto {
  @ApiProperty({ description: 'Push service endpoint URL to unsubscribe' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint: string;
}
