import { IsNumber, IsOptional, IsString } from 'class-validator';

export class TokenPayloadDto {
  @IsString()
  @IsOptional()
  accessToken: string;

  @IsNumber()
  @IsOptional()
  expiresIn: number;

  @IsString()
  @IsOptional()
  refreshToken: string;
}
