import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionStatus,
  SubscriptionPlan,
} from '../../common/schemas/subscription.schema';
import { StripeService } from '../../common/services/stripe.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

/**
 * Subscription service
 * Handles all subscription-related business logic
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly dbServiceUrl =
    process.env.DB_SERVICE_URL || 'http://localhost:3002';

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    private stripeService: StripeService,
  ) {}

  /**
   * Update user subscription info in the database service
   */
  private async updateUserSubscription(
    userId: string,
    plan: string,
    status: string,
    trialEnd?: Date,
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.dbServiceUrl}/users/${userId}/subscription`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.DB_SERVICE_API_KEY || 'default-key',
            'x-service-name': 'payment-service',
          },
          body: JSON.stringify({
            plan,
            status,
            trialEnd,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        this.logger.error(
          `Failed to update user subscription in DB: ${error.message || response.statusText}`,
        );
        // Don't throw error - subscription creation should still succeed even if user update fails
      } else {
        this.logger.log(
          `Successfully updated user ${userId} subscription in DB`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error calling DB service to update user subscription: ${error.message}`,
      );
      // Don't throw error - subscription creation should still succeed even if user update fails
    }
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

      // Create subscription in database
      const subscription = new this.subscriptionModel({
        userId,
        stripeCustomerId: stripeCustomer.id,
        status: SubscriptionStatus.TRIAL,
        plan,
        trialStart,
        trialEnd,
        isTrialActive: true,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
        nextBillingDate: trialEnd,
      });

      const savedSubscription = await subscription.save();
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
          const updatedSubscription = await this.changePlan(userId, plan);

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
            await this.subscriptionModel.findByIdAndUpdate(
              (updatedSubscription as any)._id,
              { cardValidated: true },
              { new: true },
            );
          }

          await this.updateUserSubscription(
            userId,
            plan,
            SubscriptionStatus.ACTIVE,
          );

          return updatedSubscription;
        } else {
          // Same plan, just return existing subscription
          this.logger.log(`User ${userId} already has the same plan ${plan}`);
          await this.updateUserSubscription(
            userId,
            plan,
            SubscriptionStatus.ACTIVE,
          );
          return existingSubscription;
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
      const subscription = new this.subscriptionModel({
        userId,
        stripeCustomerId: stripeCustomer.id,
        status: SubscriptionStatus.TRIAL,
        plan,
        trialStart,
        trialEnd,
        isTrialActive: true,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
        nextBillingDate: trialEnd,
        cardValidated: true, // Flag to indicate card was validated
      });

      const savedSubscription = await subscription.save();
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
    return this.subscriptionModel.findOne({ userId }).exec();
  }

  /**
   * Find subscription by ID
   * @param id Subscription ID
   * @returns Subscription
   */
  async findById(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionModel.findById(id).exec();
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
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
    const subscription = await this.subscriptionModel
      .findByIdAndUpdate(id, updateSubscriptionDto, { new: true })
      .exec();

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    this.logger.log(`Updated subscription ${id}`);
    await this.updateUserSubscription(
      subscription.userId,
      subscription.plan,
      subscription.status,
      subscription.trialEnd,
    );
    return subscription;
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
      const priceId = this.getPriceId(subscription.plan);

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

      const updatedSubscription = await this.subscriptionModel
        .findByIdAndUpdate(
          (subscription as any)._id,
          {
            stripeSubscriptionId: stripeSubscription.id,
            status: SubscriptionStatus.ACTIVE,
            isTrialActive: false,
            currentPeriodStart: now,
            currentPeriodEnd: nextBillingDate,
            nextBillingDate,
          },
          { new: true },
        )
        .exec();

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
      const updateData: Partial<Subscription> = {
        cancelAtPeriodEnd,
      };

      if (!cancelAtPeriodEnd) {
        updateData.status = SubscriptionStatus.CANCELED;
        updateData.canceledAt = new Date();
      }

      const updatedSubscription = await this.subscriptionModel
        .findByIdAndUpdate((subscription as any)._id, updateData, { new: true })
        .exec();

      this.logger.log(`Canceled subscription for user ${userId}`);
      await this.updateUserSubscription(
        userId,
        subscription.plan,
        subscription.status,
        subscription.trialEnd,
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

    if (subscription.plan === newPlan) {
      throw new BadRequestException('Subscription is already on this plan');
    }

    try {
      // Update plan in database
      const updatedSubscription = await this.subscriptionModel
        .findByIdAndUpdate(
          (subscription as any)._id,
          { plan: newPlan },
          { new: true },
        )
        .exec();

      this.logger.log(`Changed plan for user ${userId} to ${newPlan}`);
      await this.updateUserSubscription(
        userId,
        newPlan,
        SubscriptionStatus.TRIAL,
        subscription.trialEnd,
      );
      return updatedSubscription;
    } catch (error) {
      this.logger.error(`Failed to change plan: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if subscription is active
   * @param userId User ID
   * @returns Whether subscription is active
   */
  async isActive(userId: string): Promise<boolean> {
    const subscription = await this.findByUserId(userId);
    if (!subscription) {
      return false;
    }

    const now = new Date();

    // Check if trial is active
    if (
      subscription.isTrialActive &&
      subscription.trialEnd &&
      subscription.trialEnd > now
    ) {
      return true;
    }

    // Check if paid subscription is active
    return (
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd > now
    );
  }

  /**
   * Get subscription status for user
   * @param userId User ID
   * @returns Subscription status information
   */
  async getStatus(userId: string) {
    const subscription = await this.findByUserId(userId);

    if (!subscription) {
      return {
        hasSubscription: false,
        isActive: false,
        plan: null,
        status: null,
        trialActive: false,
        daysRemaining: 0,
      };
    }

    const now = new Date();
    const isActive = await this.isActive(userId);

    let daysRemaining = 0;
    if (subscription.isTrialActive && subscription.trialEnd) {
      daysRemaining = Math.max(
        0,
        Math.ceil(
          (subscription.trialEnd.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
    } else if (subscription.currentPeriodEnd) {
      daysRemaining = Math.max(
        0,
        Math.ceil(
          (subscription.currentPeriodEnd.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
    }

    return {
      hasSubscription: true,
      isActive,
      plan: subscription.plan,
      status: subscription.status,
      trialActive: subscription.isTrialActive,
      daysRemaining,
      nextBillingDate: subscription.nextBillingDate,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  /**
   * Get Stripe price ID based on plan
   * @param plan Subscription plan
   * @returns Stripe price ID
   */
  private getPriceId(plan: SubscriptionPlan): string {
    // These would be configured in environment variables in production
    const priceIds = {
      [SubscriptionPlan.MONTHLY]: 'price_monthly_placeholder',
      [SubscriptionPlan.YEARLY]: 'price_yearly_placeholder',
    };

    return priceIds[plan];
  }
}
