import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum CalendarProvider {
  GOOGLE = 'google',
  OUTLOOK = 'outlook',
  APPLE = 'apple',
}

export class ConnectCalendarDto {
  @ApiProperty({
    enum: CalendarProvider,
    example: CalendarProvider.GOOGLE,
    description: 'Calendar provider to connect',
  })
  @IsEnum(CalendarProvider)
  @IsNotEmpty()
  provider: 'google' | 'outlook' | 'apple';

  @ApiProperty({
    example: '4/0AeanS...',
    description: 'Authorization code from OAuth callback',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
