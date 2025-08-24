import { Injectable, Logger } from "@nestjs/common";
import { Buffer } from "node:buffer";
import Stripe from "stripe";

import {
  CreatePaymentDto,
  DbServiceClient,
  UpdateSubscriptionDto,
} from "../../common/services/db-service.client";
import { StripeService } from "../../common/services/stripe.service";
import { PaymentStatus, SubscriptionStatus } from "../../common/types";

/**
 * Webhook service
 * Processes Stripe webhook events
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private dbServiceClient: DbServiceClient,
    private stripeService: StripeService,
  ) {}

  /**
   * Process Stripe webhook event
   * @param payload Raw webhook payload
   * @param signature Stripe signature header
   */
  async processWebhook(payload: Buffer, signature: string): Promise<void> {
    try {
      const event = this.stripeService.constructWebhookEvent(
        payload,
        signature,
      );
      this.logger.log(`Processing webhook event: ${event.type}`);

      switch (event.type) {
        case "customer.subscription.created":
          await this.handleSubscriptionCreated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;

        case "invoice.payment_succeeded":
          await this.handlePaymentSucceeded(
            event.data.object as Stripe.Invoice,
          );
          break;

        case "invoice.payment_failed":
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case "payment_intent.succeeded":
          await this.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case "payment_intent.payment_failed":
          await this.handlePaymentIntentFailed(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        default:
          this.logger.log(`Unhandled webhook event type: ${event.type}`);
      }

      this.logger.log(`Successfully processed webhook event: ${event.type}`);
    }
    catch (error) {
      this.logger.error(`Failed to process webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle subscription created event
   * @param subscription Stripe subscription object
   */
  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    try {
      const existingSubscription = await this.dbServiceClient.findSubscriptionByStripeSubscriptionId(subscription.id);

      if (!existingSubscription) {
        this.logger.warn(
          `Subscription not found for Stripe subscription: ${subscription.id}`,
        );
        return;
      }

      await this.dbServiceClient.updateSubscriptionByStripeSubscriptionId(subscription.id, {
        stripeSubscriptionId: subscription.id,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(
          subscription.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });

      this.logger.log(
        `Updated subscription for Stripe subscription: ${subscription.id}`,
      );
    }
    catch (error) {
      this.logger.error(
        `Failed to handle subscription created: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle subscription updated event
   * @param subscription Stripe subscription object
   */
  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    try {
      const existingSubscription = await this.dbServiceClient.findSubscriptionByStripeSubscriptionId(subscription.id);

      if (!existingSubscription) {
        this.logger.warn(
          `Subscription not found for Stripe subscription: ${subscription.id}`,
        );
        return;
      }

      const updateData: UpdateSubscriptionDto = {
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };

      if (subscription.canceled_at) {
        updateData.canceledAt = new Date(subscription.canceled_at * 1000);
      }

      await this.dbServiceClient.updateSubscriptionByStripeSubscriptionId(subscription.id, updateData);

      this.logger.log(
        `Updated subscription for Stripe subscription: ${subscription.id}`,
      );
    }
    catch (error) {
      this.logger.error(
        `Failed to handle subscription updated: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle subscription deleted event
   * @param subscription Stripe subscription object
   */
  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    try {
      const existingSubscription = await this.dbServiceClient.findSubscriptionByStripeSubscriptionId(subscription.id);

      if (!existingSubscription) {
        this.logger.warn(
          `Subscription not found for Stripe subscription: ${subscription.id}`,
        );
        return;
      }

      await this.dbServiceClient.updateSubscriptionByStripeSubscriptionId(subscription.id, {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      });

      this.logger.log(
        `Canceled subscription for Stripe subscription: ${subscription.id}`,
      );
    }
    catch (error) {
      this.logger.error(
        `Failed to handle subscription deleted: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle payment succeeded event
   * @param invoice Stripe invoice object
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      if (!invoice.subscription || !invoice.payment_intent) {
        return;
      }

      const subscription = await this.dbServiceClient.findSubscriptionByStripeSubscriptionId(invoice.subscription as string);

      if (!subscription) {
        this.logger.warn(`Subscription not found for invoice: ${invoice.id}`);
        return;
      }

      // Create payment record
      const paymentData: CreatePaymentDto = {
        userId: subscription.userId,
        subscriptionId: subscription._id!,
        stripePaymentIntentId: invoice.payment_intent as string,
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: "card", // Default, could be determined from payment method
        amount: invoice.amount_paid,
        currency: invoice.currency,
        description: invoice.description || "Subscription payment",
        paidAt: new Date(),
        billingPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : undefined,
        billingPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined,
        receiptUrl: invoice.hosted_invoice_url || undefined,
        invoiceId: invoice.id,
      };

      await this.dbServiceClient.createPayment(paymentData);

      // Update subscription status if needed
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        await this.dbServiceClient.updateSubscriptionByStripeSubscriptionId(invoice.subscription as string, {
          status: SubscriptionStatus.ACTIVE,
          isTrialActive: false,
        });
      }

      this.logger.log(
        `Payment succeeded for subscription: ${subscription._id}`,
      );
    }
    catch (error) {
      this.logger.error(`Failed to handle payment succeeded: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle payment failed event
   * @param invoice Stripe invoice object
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      if (!invoice.subscription || !invoice.payment_intent) {
        return;
      }

      const subscription = await this.dbServiceClient.findSubscriptionByStripeSubscriptionId(invoice.subscription as string);

      if (!subscription) {
        this.logger.warn(`Subscription not found for invoice: ${invoice.id}`);
        return;
      }

      // Create failed payment record
      const paymentData: CreatePaymentDto = {
        userId: subscription.userId,
        subscriptionId: subscription._id!,
        stripePaymentIntentId: invoice.payment_intent as string,
        status: PaymentStatus.FAILED,
        paymentMethod: "card", // Default
        amount: invoice.amount_due,
        currency: invoice.currency,
        description: invoice.description || "Failed subscription payment",
        failureReason: "Payment failed via webhook",
        billingPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : undefined,
        billingPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined,
        invoiceId: invoice.id,
      };

      await this.dbServiceClient.createPayment(paymentData);

      // Update subscription status to past due
      await this.dbServiceClient.updateSubscriptionByStripeSubscriptionId(invoice.subscription as string, {
        status: SubscriptionStatus.PAST_DUE,
      });

      this.logger.log(
        `Payment failed for subscription: ${subscription._id}`,
      );
    }
    catch (error) {
      this.logger.error(`Failed to handle payment failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle payment intent succeeded event
   * @param paymentIntent Stripe payment intent object
   */
  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    try {
      const existingPayment = await this.dbServiceClient.findPaymentByStripePaymentIntentId(paymentIntent.id);

      if (existingPayment) {
        await this.dbServiceClient.updatePaymentByStripePaymentIntentId(paymentIntent.id, {
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date(),
        });

        this.logger.log(
          `Updated payment status to succeeded: ${paymentIntent.id}`,
        );
      }
      else {
        this.logger.log(
          `Payment intent succeeded but no payment record found: ${paymentIntent.id}`,
        );
      }
    }
    catch (error) {
      this.logger.error(
        `Failed to handle payment intent succeeded: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle payment intent failed event
   * @param paymentIntent Stripe payment intent object
   */
  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    try {
      const existingPayment = await this.dbServiceClient.findPaymentByStripePaymentIntentId(paymentIntent.id);

      if (existingPayment) {
        await this.dbServiceClient.updatePaymentByStripePaymentIntentId(paymentIntent.id, {
          status: PaymentStatus.FAILED,
          failureReason: paymentIntent.last_payment_error?.message || "Payment failed",
        });

        this.logger.log(
          `Updated payment status to failed: ${paymentIntent.id}`,
        );
      }
      else {
        this.logger.log(
          `Payment intent failed but no payment record found: ${paymentIntent.id}`,
        );
      }
    }
    catch (error) {
      this.logger.error(
        `Failed to handle payment intent failed: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Map Stripe subscription status to our internal status
   * @param stripeStatus Stripe subscription status
   * @returns Internal subscription status
   */
  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case "trialing":
        return SubscriptionStatus.TRIAL;
      case "active":
        return SubscriptionStatus.ACTIVE;
      case "past_due":
        return SubscriptionStatus.PAST_DUE;
      case "canceled":
      case "cancelled":
        return SubscriptionStatus.CANCELED;
      case "unpaid":
        return SubscriptionStatus.UNPAID;
      default:
        this.logger.warn(`Unknown Stripe status: ${stripeStatus}`);
        return SubscriptionStatus.UNPAID;
    }
  }
}
