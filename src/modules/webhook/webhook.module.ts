import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { StripeService } from "../../common/services/stripe.service";
import { WebhookController } from "./webhook.controller";
import { WebhookService } from "./webhook.service";

/**
 * Webhook module
 * Handles Stripe webhook events for payments and subscriptions
 */
@Module({
  imports: [CommonModule],
  controllers: [WebhookController],
  providers: [WebhookService, StripeService],
  exports: [WebhookService],
})
export class WebhookModule {}
