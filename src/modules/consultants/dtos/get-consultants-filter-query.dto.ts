import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  AvailabilityPeriod,
  PaymentStatus,
  UserStatus,
} from 'generated/prisma/enums';

export class GetConsultantsFilterQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(AvailabilityPeriod)
  availabilityPeriod?: AvailabilityPeriod;

  @IsOptional()
  @IsString()
  paymentStatus?: PaymentStatus;
}
