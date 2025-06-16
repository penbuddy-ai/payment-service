import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Payment, PaymentSchema } from '../../common/schemas/payment.schema';
import {
  Subscription,
  SubscriptionSchema,
} from '../../common/schemas/subscription.schema';
import { StripeService } from '../../common/services/stripe.service';

/**
 * Payment module
 * Handles payment processing and transaction management
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, StripeService],
  exports: [PaymentService],
})
export class PaymentModule {}
