import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { Subscription, SubscriptionSchema } from '../../common/schemas/subscription.schema';
import { Payment, PaymentSchema } from '../../common/schemas/payment.schema';
import { StripeService } from '../../common/services/stripe.service';
import { SubscriptionService } from '../subscription/subscription.service';

/**
 * Webhook module
 * Handles Stripe webhook events for payments and subscriptions
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [WebhookController],
  providers: [WebhookService, StripeService, SubscriptionService],
  exports: [WebhookService],
})
export class WebhookModule {} 