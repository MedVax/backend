import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GetUserDto {
  @IsString()
  @ApiProperty()
  id: string;
}
