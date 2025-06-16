import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Subscription, SubscriptionDocument, SubscriptionStatus } from '../../common/schemas/subscription.schema';
import { Payment, PaymentDocument, PaymentStatus } from '../../common/schemas/payment.schema';
import { StripeService } from '../../common/services/stripe.service';

/**
 * Webhook service
 * Processes Stripe webhook events
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    private stripeService: StripeService,
  ) {}

  /**
   * Process Stripe webhook event
   * @param payload Raw webhook payload
   * @param signature Stripe signature header
   */
  async processWebhook(payload: Buffer, signature: string): Promise<void> {
    try {
      const event = this.stripeService.constructWebhookEvent(payload, signature);
      this.logger.log(`Processing webhook event: ${event.type}`);

      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        default:
          this.logger.log(`Unhandled webhook event type: ${event.type}`);
      }

      this.logger.log(`Successfully processed webhook event: ${event.type}`);
    } catch (error) {
      this.logger.error(`Failed to process webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle subscription created event
   * @param subscription Stripe subscription object
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const existingSubscription = await this.subscriptionModel
        .findOne({ stripeSubscriptionId: subscription.id })
        .exec();

      if (!existingSubscription) {
        this.logger.warn(`Subscription not found for Stripe subscription: ${subscription.id}`);
        return;
      }

      await this.subscriptionModel
        .findByIdAndUpdate(existingSubscription._id, {
          stripeSubscriptionId: subscription.id,
          status: this.mapStripeStatus(subscription.status),
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        })
        .exec();

      this.logger.log(`Updated subscription for Stripe subscription: ${subscription.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle subscription created: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle subscription updated event
   * @param subscription Stripe subscription object
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const existingSubscription = await this.subscriptionModel
        .findOne({ stripeSubscriptionId: subscription.id })
        .exec();

      if (!existingSubscription) {
        this.logger.warn(`Subscription not found for Stripe subscription: ${subscription.id}`);
        return;
      }

      const updateData: Partial<Subscription> = {
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };

      if (subscription.canceled_at) {
        updateData.canceledAt = new Date(subscription.canceled_at * 1000);
      }

      await this.subscriptionModel
        .findByIdAndUpdate(existingSubscription._id, updateData)
        .exec();

      this.logger.log(`Updated subscription for Stripe subscription: ${subscription.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle subscription updated: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle subscription deleted event
   * @param subscription Stripe subscription object
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      const existingSubscription = await this.subscriptionModel
        .findOne({ stripeSubscriptionId: subscription.id })
        .exec();

      if (!existingSubscription) {
        this.logger.warn(`Subscription not found for Stripe subscription: ${subscription.id}`);
        return;
      }

      await this.subscriptionModel
        .findByIdAndUpdate(existingSubscription._id, {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
        })
        .exec();

      this.logger.log(`Canceled subscription for Stripe subscription: ${subscription.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle subscription deleted: ${error.message}`);
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

      const subscription = await this.subscriptionModel
        .findOne({ stripeSubscriptionId: invoice.subscription })
        .exec();

      if (!subscription) {
        this.logger.warn(`Subscription not found for invoice: ${invoice.id}`);
        return;
      }

      // Create payment record
      const payment = new this.paymentModel({
        userId: subscription.userId,
        subscriptionId: subscription._id,
        stripePaymentIntentId: invoice.payment_intent,
        status: PaymentStatus.SUCCEEDED,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        description: invoice.description || 'Subscription payment',
        paidAt: new Date(),
        billingPeriodStart: new Date(invoice.period_start * 1000),
        billingPeriodEnd: new Date(invoice.period_end * 1000),
        receiptUrl: invoice.hosted_invoice_url,
      });

      await payment.save();

      // Update subscription status if needed
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        await this.subscriptionModel
          .findByIdAndUpdate(subscription._id, {
            status: SubscriptionStatus.ACTIVE,
            isTrialActive: false,
          })
          .exec();
      }

      this.logger.log(`Payment succeeded for subscription: ${subscription._id}`);
    } catch (error) {
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

      const subscription = await this.subscriptionModel
        .findOne({ stripeSubscriptionId: invoice.subscription })
        .exec();

      if (!subscription) {
        this.logger.warn(`Subscription not found for invoice: ${invoice.id}`);
        return;
      }

      // Create failed payment record
      const payment = new this.paymentModel({
        userId: subscription.userId,
        subscriptionId: subscription._id,
        stripePaymentIntentId: invoice.payment_intent,
        status: PaymentStatus.FAILED,
        amount: invoice.amount_due,
        currency: invoice.currency,
        description: invoice.description || 'Subscription payment',
        failureReason: 'Payment failed',
      });

      await payment.save();

      // Update subscription status to past due
      await this.subscriptionModel
        .findByIdAndUpdate(subscription._id, {
          status: SubscriptionStatus.PAST_DUE,
        })
        .exec();

      this.logger.log(`Payment failed for subscription: ${subscription._id}`);
    } catch (error) {
      this.logger.error(`Failed to handle payment failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle payment intent succeeded event
   * @param paymentIntent Stripe payment intent object
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const payment = await this.paymentModel
        .findOne({ stripePaymentIntentId: paymentIntent.id })
        .exec();

      if (!payment) {
        this.logger.warn(`Payment not found for payment intent: ${paymentIntent.id}`);
        return;
      }

      await this.paymentModel
        .findByIdAndUpdate(payment._id, {
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date(),
        })
        .exec();

      this.logger.log(`Payment intent succeeded: ${paymentIntent.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle payment intent succeeded: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle payment intent failed event
   * @param paymentIntent Stripe payment intent object
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const payment = await this.paymentModel
        .findOne({ stripePaymentIntentId: paymentIntent.id })
        .exec();

      if (!payment) {
        this.logger.warn(`Payment not found for payment intent: ${paymentIntent.id}`);
        return;
      }

      await this.paymentModel
        .findByIdAndUpdate(payment._id, {
          status: PaymentStatus.FAILED,
          failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
        })
        .exec();

      this.logger.log(`Payment intent failed: ${paymentIntent.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle payment intent failed: ${error.message}`);
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
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      case 'trialing':
        return SubscriptionStatus.TRIAL;
      default:
        return SubscriptionStatus.ACTIVE;
    }
  }
} 