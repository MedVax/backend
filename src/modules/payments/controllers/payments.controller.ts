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
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaystackService } from 'modules/services/paystack-service';
import { OrdersService } from 'modules/orders/services/orders.service';
import { SessionsService } from 'modules/sessions/services/sessions.service';
import { TransactionsService } from 'modules/transactions/services/transactions.service';
import { Response } from 'metadatas/response.metadata';
import { AuthAllow } from 'metadatas/auth-allow.metadata';
import { TransactionStatus, TransactionType } from 'generated/prisma/enums';

@Controller('payments')
@ApiTags('Payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private paystackService: PaystackService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
    @Inject(forwardRef(() => SessionsService))
    private sessionsService: SessionsService,
    @Inject(forwardRef(() => TransactionsService))
    private transactionsService: TransactionsService,
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

      this.logger.log(
        `Paystack webhook received - Event: ${event}, Reference: ${data.reference || 'N/A'}`,
      );

      if (event === 'charge.success' || event === 'charge.failed') {
        if (data.reference) {
          // Find transaction to determine type
          const transaction =
            await this.transactionsService.findByProviderReference(
              data.reference,
            );

          if (transaction) {
            // Handle session payments
            if (transaction.type === TransactionType.SESSION) {
              const transactionStatus =
                event === 'charge.success'
                  ? TransactionStatus.SUCCESS
                  : TransactionStatus.FAILED;

              // Update transaction status first
              try {
                await this.transactionsService.updateByProviderReference(
                  data.reference,
                  {
                    status: transactionStatus,
                    webhookEvent: event,
                    webhookPayload: body,
                    providerResponse: data,
                    completedAt:
                      transactionStatus === TransactionStatus.SUCCESS
                        ? new Date()
                        : undefined,
                    failedAt:
                      transactionStatus === TransactionStatus.FAILED
                        ? new Date()
                        : undefined,
                    ...(data.authorization && {
                      authorizationCode: data.authorization.authorization_code,
                    }),
                  },
                );
              } catch (updateError) {
                this.logger.error(
                  `Failed to update transaction from webhook - Reference: ${data.reference}, Error: ${updateError.message}`,
                  updateError.stack,
                );
                // Don't throw - continue processing
              }

              // If payment successful, verify and create sessions
              if (event === 'charge.success') {
                try {
                  // Verify payment and create sessions
                  await this.sessionsService.verifySessionPayment(
                    data.reference,
                  );
                } catch (error) {
                  this.logger.error(
                    `Failed to complete session booking after payment - Reference: ${data.reference}, Error: ${error.message}`,
                    error.stack,
                  );
                  // Don't throw - webhook should still succeed
                  // Transaction status is already updated above
                }
              }
              // If payment failed, transaction status is already updated above
            } else if (transaction.type === TransactionType.ORDER) {
              // Handle order payments
              try {
                await this.ordersService.verifyPayment(data.reference);
              } catch (error) {
                this.logger.error(
                  `Failed to verify order payment - Reference: ${data.reference}, Error: ${error.message}`,
                  error.stack,
                );
                // Don't throw - webhook should still succeed
              }
            }

            // Update transaction record from webhook
            try {
              const transactionStatus =
                event === 'charge.success'
                  ? TransactionStatus.SUCCESS
                  : TransactionStatus.FAILED;

              await this.transactionsService.updateByProviderReference(
                data.reference,
                {
                  status: transactionStatus,
                  webhookEvent: event,
                  webhookPayload: body,
                  providerResponse: data,
                  completedAt:
                    transactionStatus === TransactionStatus.SUCCESS
                      ? new Date()
                      : undefined,
                  failedAt:
                    transactionStatus === TransactionStatus.FAILED
                      ? new Date()
                      : undefined,
                  ...(data.authorization && {
                    authorizationCode: data.authorization.authorization_code,
                  }),
                },
              );
            } catch (error) {
              this.logger.error(
                `Failed to update transaction from webhook - Reference: ${data.reference || 'N/A'}, Error: ${error.message}`,
                error.stack,
              );
              // Don't throw - webhook should still succeed even if transaction update fails
            }
          }
        }
      }

      this.logger.log(
        `Paystack webhook processed successfully - Event: ${body.event}, Reference: ${body.data?.reference || 'N/A'}`,
      );

      return { message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(
        `Paystack webhook processing failed - Error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
