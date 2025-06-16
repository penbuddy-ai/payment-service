import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Payment status enumeration
 */
export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
  REFUNDED = 'refunded',
}

/**
 * Payment method types
 */
export enum PaymentMethod {
  CARD = 'card',
  SEPA = 'sepa_debit',
  PAYPAL = 'paypal',
}

/**
 * Payment document interface
 */
export type PaymentDocument = Payment & Document;

/**
 * Payment schema for MongoDB
 * Stores all payment transaction information
 */
@Schema({ timestamps: true })
export class Payment {
  /**
   * User ID from the auth service
   */
  @Prop({ required: true })
  userId: string;

  /**
   * Associated subscription ID
   */
  @Prop({ required: true })
  subscriptionId: string;

  /**
   * Stripe payment intent ID
   */
  @Prop({ required: true })
  stripePaymentIntentId: string;

  /**
   * Stripe charge ID
   */
  @Prop()
  stripeChargeId?: string;

  /**
   * Payment status
   */
  @Prop({ 
    required: true, 
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  /**
   * Payment method used
   */
  @Prop({ 
    required: true, 
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  /**
   * Amount in cents
   */
  @Prop({ required: true })
  amount: number;

  /**
   * Currency code
   */
  @Prop({ required: true, default: 'eur' })
  currency: string;

  /**
   * Description of the payment
   */
  @Prop()
  description?: string;

  /**
   * Payment date
   */
  @Prop()
  paidAt?: Date;

  /**
   * Failure reason if payment failed
   */
  @Prop()
  failureReason?: string;

  /**
   * Refund amount if refunded
   */
  @Prop({ default: 0 })
  refundedAmount: number;

  /**
   * Refund date if applicable
   */
  @Prop()
  refundedAt?: Date;

  /**
   * Receipt URL from Stripe
   */
  @Prop()
  receiptUrl?: string;

  /**
   * Invoice ID if applicable
   */
  @Prop()
  invoiceId?: string;

  /**
   * Billing period covered by this payment
   */
  @Prop()
  billingPeriodStart?: Date;

  /**
   * Billing period end covered by this payment
   */
  @Prop()
  billingPeriodEnd?: Date;

  /**
   * Whether this is a trial period payment (should be 0)
   */
  @Prop({ default: false })
  isTrial: boolean;

  /**
   * Payment metadata
   */
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

/**
 * Payment schema factory
 */
export const PaymentSchema = SchemaFactory.createForClass(Payment); 