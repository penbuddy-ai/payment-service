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

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    private stripeService: StripeService,
  ) {}

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

      return savedSubscription;
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
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
