import { Controller, Headers, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Buffer } from "node:buffer";

import { WebhookService } from "./webhook.service";

/**
 * Webhook controller
 * Handles incoming Stripe webhook events
 */
@ApiTags("Webhooks")
@Controller("webhooks")
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Handle Stripe webhook events
   * This endpoint receives webhook events from Stripe
   */
  @Post("stripe")
  @ApiOperation({
    summary: "Handle Stripe webhook events",
    description: "Receives and processes webhook events from Stripe",
  })
  @ApiHeader({
    name: "stripe-signature",
    description: "Stripe webhook signature for verification",
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Webhook processed successfully",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid webhook signature or payload",
  })
  async handleStripeWebhook(
    @Req() request: Request,
    @Headers("stripe-signature") signature: string,
  ) {
    try {
      // Get raw body as buffer
      const payload = request.body as Buffer;

      if (!signature) {
        throw new Error("Missing stripe-signature header");
      }

      await this.webhookService.processWebhook(payload, signature);

      return { received: true };
    }
    catch (error) {
      throw new Error(`Webhook error: ${error.message}`);
    }
  }
}
