import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import {
  Subscription,
  SubscriptionSchema,
} from '../../common/schemas/subscription.schema';
import { StripeService } from '../../common/services/stripe.service';

/**
 * Subscription module
 * Handles subscription management, trial periods, and plan changes
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, StripeService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
