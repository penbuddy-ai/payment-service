import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { StripeService } from '../../common/services/stripe.service';
import { AuthServiceClient } from '../../common/services/auth-service.client';
import { 
  DbServiceClient, 
  Subscription, 
  CreateSubscriptionDto as DbCreateSubscriptionDto,
  UpdateSubscriptionDto as DbUpdateSubscriptionDto
} from '../../common/services/db-service.client';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

// Enums for compatibility
export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
}

export enum SubscriptionPlan {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

/**
 * Subscription service
 * Handles all subscription-related business logic
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private dbServiceClient: DbServiceClient,
    private stripeService: StripeService,
    private authServiceClient: AuthServiceClient,
  ) {}

  /**
   * Update user subscription info via auth service
   */
  private async updateUserSubscription(
    userId: string,
    plan: string,
    status: string,
    trialEnd?: Date,
  ): Promise<void> {
    await this.authServiceClient.updateUserSubscription(userId, {
      plan: plan as 'monthly' | 'yearly',
      status: status as 'trial' | 'active' | 'past_due' | 'canceled' | 'unpaid',
      trialEnd,
    });
  }

  /**
   * Create a new subscription with trial period
   * @param createSubscriptionDto Subscription creation data
   * @returns Created subscription
   */
  async create(
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    const { userId, email, name, plan } = createSubscriptionDto;

    try {
      // Check if user already has a subscription
      const existingSubscription = await this.findByUserId(userId);
      if (existingSubscription) {
        throw new BadRequestException(
          'User already has an active subscription',
        );
      }

      // Create Stripe customer
      const stripeCustomer = await this.stripeService.createCustomer(
        email,
        name,
        { userId },
      );

      // Calculate trial period (30 days)
      const trialStart = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      // Create subscription in database via db-service
      const dbSubscriptionData: DbCreateSubscriptionDto = {
        userId,
        stripeCustomerId: stripeCustomer.id,
        status: SubscriptionStatus.TRIAL,
        plan: plan as 'monthly' | 'yearly',
        trialStart,
        trialEnd,
        isTrialActive: true,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
        nextBillingDate: trialEnd,
      };

      const savedSubscription = await this.dbServiceClient.createSubscription(dbSubscriptionData);
      this.logger.log(
        `Created subscription for user ${userId} with trial period`,
      );

      await this.updateUserSubscription(
        userId,
        plan,
        SubscriptionStatus.TRIAL,
        trialEnd,
      );

      return savedSubscription;
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a subscription with immediate card validation (0€ payment)
   * @param createSubscriptionDto Subscription creation data with payment method
   * @returns Created subscription
   */
  async createSubscriptionWithCard(
    createSubscriptionDto: CreateSubscriptionDto & { paymentMethodId: string },
  ): Promise<Subscription> {
    const { userId, email, name, plan, paymentMethodId } =
      createSubscriptionDto;
    try {
      // Check if user already has a subscription
      const existingSubscription = await this.findByUserId(userId);
      if (existingSubscription) {
        this.logger.log(
          `User ${userId} already has subscription, changing plan to ${plan}`,
        );

        // If user already has a subscription, change the plan instead
        if (existingSubscription.plan !== plan) {
          const updatedSubscription = await this.changePlan(userId, plan as SubscriptionPlan);

          // If the subscription doesn't have a validated card yet, validate it
          if (
            !existingSubscription.cardValidated &&
            existingSubscription.stripeCustomerId
          ) {
            await this.validateCardForExistingSubscription(
              existingSubscription.stripeCustomerId,
              paymentMethodId,
              userId,
            );

            // Update the card validated flag
            await this.dbServiceClient.updateSubscriptionByUserId(
              userId,
              { cardValidated: true },
            );
          }

          await this.updateUserSubscription(
            userId,
            plan,
            SubscriptionStatus.ACTIVE,
          );

          return updatedSubscription;
        } else {
          // Create a new subscription with the same plan
          const newSubscription = await this.create(createSubscriptionDto);
          return newSubscription;
        }
      }

      // Create Stripe customer
      const stripeCustomer = await this.stripeService.createCustomer(
        email,
        name,
        { userId },
      );

      // Attach payment method to customer
      await this.stripeService.attachPaymentMethod(
        paymentMethodId,
        stripeCustomer.id,
      );

      // Set as default payment method
      await this.stripeService.updateCustomer(stripeCustomer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Payment method creation and attachment is sufficient for card validation
      this.logger.log(
        `Payment method ${paymentMethodId} attached and validated for customer ${stripeCustomer.id}`,
      );

      // Calculate trial period (30 days)
      const trialStart = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      // Create subscription in database with card validated flag
      const dbSubscriptionData: DbCreateSubscriptionDto = {
        userId,
        stripeCustomerId: stripeCustomer.id,
        status: SubscriptionStatus.TRIAL,
        plan: plan as 'monthly' | 'yearly',
        trialStart,
        trialEnd,
        isTrialActive: true,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
        nextBillingDate: trialEnd,
        cardValidated: true, // Flag to indicate card was validated
      };

      const savedSubscription = await this.dbServiceClient.createSubscription(dbSubscriptionData);
      this.logger.log(
        `Created subscription with card validation for user ${userId}`,
      );

      await this.updateUserSubscription(
        userId,
        plan,
        SubscriptionStatus.TRIAL,
        trialEnd,
      );

      return savedSubscription;
    } catch (error) {
      this.logger.error(
        `Failed to create subscription with card: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Validate card for existing subscription
   * @param stripeCustomerId Stripe customer ID
   * @param paymentMethodId Payment method ID
   * @param userId User ID for logging
   */
  private async validateCardForExistingSubscription(
    stripeCustomerId: string,
    paymentMethodId: string,
    userId: string,
  ): Promise<void> {
    try {
      // Attach payment method to customer
      await this.stripeService.attachPaymentMethod(
        paymentMethodId,
        stripeCustomerId,
      );

      // Set as default payment method
      await this.stripeService.updateCustomer(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      this.logger.log(
        `Validated card for existing subscription user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to validate card for existing subscription: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Find subscription by user ID
   * @param userId User ID
   * @returns Subscription or null
   */
  async findByUserId(userId: string): Promise<Subscription | null> {
    return this.dbServiceClient.findSubscriptionByUserId(userId);
  }

  /**
   * Find subscription by ID
   * @param id Subscription ID
   * @returns Subscription
   */
  async findById(id: string): Promise<Subscription> {
    // For now, we'll search by user ID - in a real implementation, you might need to add findById to the client
    throw new NotFoundException('Find by ID not yet implemented - use findByUserId instead');
  }

  /**
   * Update subscription
   * @param id Subscription ID
   * @param updateSubscriptionDto Update data
   * @returns Updated subscription
   */
  async update(
    id: string,
    updateSubscriptionDto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    // For now, we'll throw an error since we need user ID to update
    throw new NotFoundException('Update by ID not yet implemented - use updateByUserId instead');
  }

  /**
   * Start paid subscription after trial
   * @param userId User ID
   * @param paymentMethodId Stripe payment method ID
   * @returns Updated subscription
   */
  async startPaidSubscription(
    userId: string,
    paymentMethodId: string,
  ): Promise<Subscription> {
    const subscription = await this.findByUserId(userId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status !== SubscriptionStatus.TRIAL) {
      throw new BadRequestException('Subscription is not in trial status');
    }

    try {
      // Determine price based on plan
      const priceId = this.getPriceId(subscription.plan as SubscriptionPlan);

      // Create Stripe subscription
      const stripeSubscription = await this.stripeService.createSubscription(
        subscription.stripeCustomerId,
        priceId,
        0, // No trial period for paid subscription
      );

      // Update subscription in database
      const now = new Date();
      const nextBillingDate = new Date();
      if (subscription.plan === SubscriptionPlan.MONTHLY) {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      } else {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      }

      const updatedSubscription = await this.dbServiceClient.updateSubscriptionByUserId(
        userId,
        {
          stripeSubscriptionId: stripeSubscription.id,
          status: SubscriptionStatus.ACTIVE,
          isTrialActive: false,
          currentPeriodStart: now,
          currentPeriodEnd: nextBillingDate,
          nextBillingDate,
        },
      );

      this.logger.log(`Started paid subscription for user ${userId}`);
      await this.updateUserSubscription(
        userId,
        subscription.plan,
        SubscriptionStatus.ACTIVE,
        nextBillingDate,
      );
      return updatedSubscription;
    } catch (error) {
      this.logger.error(`Failed to start paid subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param userId User ID
   * @param cancelAtPeriodEnd Whether to cancel at period end
   * @returns Updated subscription
   */
  async cancel(
    userId: string,
    cancelAtPeriodEnd = true,
  ): Promise<Subscription> {
    const subscription = await this.findByUserId(userId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    try {
      // Cancel Stripe subscription if it exists
      if (subscription.stripeSubscriptionId) {
        await this.stripeService.cancelSubscription(
          subscription.stripeSubscriptionId,
          cancelAtPeriodEnd,
        );
      }

      // Update subscription in database
      const updateData: DbUpdateSubscriptionDto = {
        cancelAtPeriodEnd,
      };

      if (!cancelAtPeriodEnd) {
        updateData.status = SubscriptionStatus.CANCELED;
        updateData.canceledAt = new Date();
      }

      const updatedSubscription = await this.dbServiceClient.updateSubscriptionByUserId(
        userId,
        updateData,
      );

      this.logger.log(`Canceled subscription for user ${userId}`);
      await this.updateUserSubscription(
        userId,
        subscription.plan,
        updatedSubscription.status,
      );

      return updatedSubscription;
    } catch (error) {
      this.logger.error(`Failed to cancel subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Change subscription plan
   * @param userId User ID
   * @param newPlan New subscription plan
   * @returns Updated subscription
   */
  async changePlan(
    userId: string,
    newPlan: SubscriptionPlan,
  ): Promise<Subscription> {
    const subscription = await this.findByUserId(userId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    try {
      // Update subscription plan in database
      const updatedSubscription = await this.dbServiceClient.changeSubscriptionPlan(
        userId,
        newPlan,
      );

      this.logger.log(`Changed subscription plan for user ${userId} to ${newPlan}`);
      await this.updateUserSubscription(
        userId,
        newPlan,
        subscription.status,
      );

      return updatedSubscription;
    } catch (error) {
      this.logger.error(`Failed to change subscription plan: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if subscription is active
   * @param userId User ID
   * @returns Whether subscription is active
   */
  async isActive(userId: string): Promise<boolean> {
    return this.dbServiceClient.isSubscriptionActive(userId);
  }

  /**
   * Get subscription status
   * @param userId User ID
   * @returns Subscription status information
   */
  async getStatus(userId: string) {
    return this.dbServiceClient.getSubscriptionStatus(userId);
  }

  /**
   * Get Stripe price ID for subscription plan
   * @param plan Subscription plan
   * @returns Stripe price ID
   */
  private getPriceId(plan: SubscriptionPlan): string {
    switch (plan) {
      case SubscriptionPlan.MONTHLY:
        return process.env.STRIPE_MONTHLY_PRICE_ID || 'price_monthly_default';
      case SubscriptionPlan.YEARLY:
        return process.env.STRIPE_YEARLY_PRICE_ID || 'price_yearly_default';
      default:
        throw new BadRequestException('Invalid subscription plan');
    }
  }
}
