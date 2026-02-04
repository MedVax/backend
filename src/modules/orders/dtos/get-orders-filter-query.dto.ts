import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  OrderStatus,
  PaymentStatus,
  PrescriptionStatus,
} from 'generated/prisma/enums';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class GetOrdersFilterQuery {
  @ApiPropertyOptional({
    required: false,
    description: 'Search by order ID, user email, or user name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    required: false,
    enum: OrderStatus,
    isArray: true,
    description: 'Filter by order status',
  })
  @IsEnum(OrderStatus, { each: true })
  @IsOptional()
  orderStatus?: OrderStatus[] | OrderStatus;

  @ApiPropertyOptional({
    required: false,
    enum: PaymentStatus,
    isArray: true,
    description: 'Filter by payment status',
  })
  @IsEnum(PaymentStatus, { each: true })
  @IsOptional()
  paymentStatus?: PaymentStatus[] | PaymentStatus;

  @ApiPropertyOptional({
    required: false,
    enum: PrescriptionStatus,
    isArray: true,
    description: 'Filter by prescription status',
  })
  @IsEnum(PrescriptionStatus, { each: true })
  @IsOptional()
  prescriptionStatus?: PrescriptionStatus[] | PrescriptionStatus;

  @ApiPropertyOptional({
    required: false,
    description: 'Filter by recurring status',
  })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    required: false,
    description: 'Filter by recurring active status',
  })
  @IsBoolean()
  @IsOptional()
  isRecurringActive?: boolean;
}
