import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionService } from "./subscription.service";

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
