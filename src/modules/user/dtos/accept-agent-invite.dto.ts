import { IsString } from 'class-validator';

export class AcceptAgentInviteDto {
  @IsString()
  token: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  password: string;
}
