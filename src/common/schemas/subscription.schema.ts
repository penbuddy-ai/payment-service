import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Subscription status enumeration
 */
export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
}

/**
 * Subscription plan types
 */
export enum SubscriptionPlan {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

/**
 * Subscription document interface
 */
export type SubscriptionDocument = Subscription & Document;

/**
 * Subscription schema for MongoDB
 * Stores all subscription-related information for users
 */
@Schema({ timestamps: true })
export class Subscription {
  /**
   * User ID from the auth service
   */
  @Prop({ required: true, unique: true })
  userId: string;

  /**
   * Stripe customer ID
   */
  @Prop({ required: true })
  stripeCustomerId: string;

  /**
   * Stripe subscription ID
   */
  @Prop()
  stripeSubscriptionId?: string;

  /**
   * Current subscription status
   */
  @Prop({ 
    required: true, 
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIAL,
  })
  status: SubscriptionStatus;

  /**
   * Subscription plan type
   */
  @Prop({ 
    required: true, 
    enum: SubscriptionPlan,
    default: SubscriptionPlan.MONTHLY,
  })
  plan: SubscriptionPlan;

  /**
   * Trial start date
   */
  @Prop()
  trialStart?: Date;

  /**
   * Trial end date
   */
  @Prop()
  trialEnd?: Date;

  /**
   * Current billing period start
   */
  @Prop()
  currentPeriodStart?: Date;

  /**
   * Current billing period end
   */
  @Prop()
  currentPeriodEnd?: Date;

  /**
   * Whether the subscription should cancel at period end
   */
  @Prop({ default: false })
  cancelAtPeriodEnd: boolean;

  /**
   * Cancellation date if applicable
   */
  @Prop()
  canceledAt?: Date;

  /**
   * Next billing date
   */
  @Prop()
  nextBillingDate?: Date;

  /**
   * Monthly price in cents
   */
  @Prop({ default: 2000 }) // 20€
  monthlyPrice: number;

  /**
   * Yearly price in cents  
   */
  @Prop({ default: 20000 }) // 200€ (10 mois)
  yearlyPrice: number;

  /**
   * Currency code
   */
  @Prop({ default: 'eur' })
  currency: string;

  /**
   * Whether user is in trial period
   */
  @Prop({ default: true })
  isTrialActive: boolean;

  /**
   * Metadata for additional information
   */
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

/**
 * Subscription schema factory
 */
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription); 