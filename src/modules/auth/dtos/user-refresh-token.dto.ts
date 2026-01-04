import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UserRefreshTokenDto {
  @IsString()
  @ApiProperty({ example: 'Ad/kdkndkdknksnsllnwinewwij' })
  refreshToken: string;
}
