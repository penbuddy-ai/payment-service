import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Stripe service for handling payments and subscriptions
 * Provides wrapper methods for Stripe API calls
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not found, using test key for development',
      );
      // Use a placeholder for development when Stripe is not configured
      this.stripe = new Stripe('sk_test_placeholder', {
        apiVersion: '2025-02-24.acacia',
      });
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-02-24.acacia',
      });
    }
  }

  /**
   * Create a new customer in Stripe
   * @param email Customer email
   * @param name Customer name
   * @param metadata Additional metadata
   * @returns Stripe customer object
   */
  async createCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata,
      });

      this.logger.log(`Created Stripe customer: ${customer.id}`);
      return customer;
    } catch (error) {
      this.logger.error(`Failed to create customer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get customer by ID
   * @param customerId Stripe customer ID
   * @returns Stripe customer object
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      return customer as Stripe.Customer;
    } catch (error) {
      this.logger.error(
        `Failed to get customer ${customerId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Create a setup intent for saving payment method
   * @param customerId Stripe customer ID
   * @returns Setup intent
   */
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });

      this.logger.log(`Created setup intent: ${setupIntent.id}`);
      return setupIntent;
    } catch (error) {
      this.logger.error(`Failed to create setup intent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a subscription with trial period
   * @param customerId Stripe customer ID
   * @param priceId Stripe price ID
   * @param trialPeriodDays Number of trial days
   * @returns Stripe subscription
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    trialPeriodDays = 30,
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: trialPeriodDays,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      this.logger.log(`Created subscription: ${subscription.id}`);
      return subscription;
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   * @param subscriptionId Stripe subscription ID
   * @param atPeriodEnd Whether to cancel at period end
   * @returns Updated subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd = true,
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: atPeriodEnd,
        },
      );

      this.logger.log(`Canceled subscription: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      this.logger.error(
        `Failed to cancel subscription ${subscriptionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Create a payment intent
   * @param amount Amount in cents
   * @param currency Currency code
   * @param customerId Customer ID
   * @param metadata Additional metadata
   * @returns Payment intent
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        metadata,
      });

      this.logger.log(`Created payment intent: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to create payment intent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve a payment intent
   * @param paymentIntentId Payment intent ID
   * @returns Payment intent
   */
  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error(
        `Failed to get payment intent ${paymentIntentId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Create a refund
   * @param paymentIntentId Payment intent ID
   * @param amount Amount to refund (optional, full refund if not specified)
   * @returns Refund object
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
  ): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
      });

      this.logger.log(`Created refund: ${refund.id}`);
      return refund;
    } catch (error) {
      this.logger.error(`Failed to create refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Construct webhook event from request
   * @param payload Request payload
   * @param signature Stripe signature header
   * @returns Webhook event
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (error) {
      this.logger.error(`Failed to construct webhook event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get Stripe price ID based on plan
   * @param plan Subscription plan
   * @returns Stripe price ID
   */
  getPriceId(plan: string): string {
    const priceIds = {
      monthly: this.configService.get<string>('STRIPE_PRICE_MONTHLY'),
      yearly: this.configService.get<string>('STRIPE_PRICE_YEARLY'),
    };

    const priceId = priceIds[plan];
    if (!priceId) {
      this.logger.warn(
        `Price ID not configured for plan: ${plan}, using placeholder`,
      );
      return `price_${plan}_placeholder`;
    }

    return priceId;
  }

  /**
   * Attach a payment method to a customer
   * @param paymentMethodId Payment method ID
   * @param customerId Customer ID
   * @returns Updated payment method
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(
        paymentMethodId,
        { customer: customerId },
      );

      this.logger.log(
        `Attached payment method ${paymentMethodId} to customer ${customerId}`,
      );
      return paymentMethod;
    } catch (error) {
      this.logger.error(`Failed to attach payment method: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update customer information
   * @param customerId Customer ID
   * @param updateData Update data
   * @returns Updated customer
   */
  async updateCustomer(
    customerId: string,
    updateData: Stripe.CustomerUpdateParams,
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(
        customerId,
        updateData,
      );

      this.logger.log(`Updated customer: ${customerId}`);
      return customer;
    } catch (error) {
      this.logger.error(`Failed to update customer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Confirm a payment intent
   * @param paymentIntentId Payment intent ID
   * @param confirmParams Confirmation parameters
   * @returns Confirmed payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    confirmParams: Stripe.PaymentIntentConfirmParams,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        confirmParams,
      );

      this.logger.log(`Confirmed payment intent: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to confirm payment intent: ${error.message}`);
      throw error;
    }
  }
}
