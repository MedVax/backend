import {
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  type RawBodyRequest,
  Req,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaystackService } from 'modules/services/paystack-service';
import { OrdersService } from 'modules/orders/services/orders.service';
import { Response } from 'metadatas/response.metadata';
import { AuthAllow } from 'metadatas/auth-allow.metadata';

@Controller('payments')
@ApiTags('Payments')
export class PaymentsController {
  constructor(
    private paystackService: PaystackService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
  ) {}

  @Post('webhooks/paystack')
  @AuthAllow()
  @HttpCode(HttpStatus.OK)
  @Response({ status: HttpStatus.OK, message: 'Webhook processed' })
  @ApiOperation({ summary: 'Paystack webhook endpoint' })
  async handlePaystackWebhook(
    @Req() req: RawBodyRequest<typeof Request>,
    @Headers('x-paystack-signature') signature: string,
  ) {
    try {
      // Verify webhook signature
      const body = this.paystackService.verifyWebhookSignature(
        signature,
        req.rawBody,
      );

      // Handle different event types
      const event = body.event;
      const data = body.data;

      if (event === 'charge.success') {
        // Update order payment status
        if (data.reference) {
          await this.ordersService.verifyPayment(data.reference);
        }
      }

      return { message: 'Webhook processed successfully' };
    } catch (error) {
      console.error('Paystack webhook error:', error);
      throw error;
    }
  }
}
