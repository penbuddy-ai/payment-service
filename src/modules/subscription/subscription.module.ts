import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { CommonModule } from '../../common/common.module';

/**
 * Subscription module
 * Handles subscription management, trial periods, and plan changes
 */
@Module({
  imports: [
    CommonModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
