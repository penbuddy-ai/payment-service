import { Injectable, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

// Types for API calls
export interface Subscription {
  _id?: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  plan: 'monthly' | 'yearly';
  trialStart?: Date;
  trialEnd?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  cardValidated: boolean;
  canceledAt?: Date;
  nextBillingDate?: Date;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  isTrialActive: boolean;
  metadata: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Payment {
  _id?: string;
  userId: string;
  subscriptionId: string;
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  paymentMethod: 'card' | 'sepa_debit' | 'paypal';
  amount: number;
  currency: string;
  description?: string;
  paidAt?: Date;
  failureReason?: string;
  refundedAmount: number;
  refundedAt?: Date;
  receiptUrl?: string;
  invoiceId?: string;
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;
  isTrial: boolean;
  metadata: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateSubscriptionDto {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  status?: 'trial' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  plan?: 'monthly' | 'yearly';
  trialStart?: Date;
  trialEnd?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  cardValidated?: boolean;
  canceledAt?: Date;
  nextBillingDate?: Date;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  isTrialActive?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateSubscriptionDto {
  stripeSubscriptionId?: string;
  status?: 'trial' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  plan?: 'monthly' | 'yearly';
  trialStart?: Date;
  trialEnd?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  cardValidated?: boolean;
  canceledAt?: Date;
  nextBillingDate?: Date;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  isTrialActive?: boolean;
  metadata?: Record<string, any>;
}

export interface CreatePaymentDto {
  userId: string;
  subscriptionId: string;
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  paymentMethod: 'card' | 'sepa_debit' | 'paypal';
  amount: number;
  currency?: string;
  description?: string;
  paidAt?: Date;
  failureReason?: string;
  refundedAmount?: number;
  refundedAt?: Date;
  receiptUrl?: string;
  invoiceId?: string;
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;
  isTrial?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdatePaymentDto {
  stripeChargeId?: string;
  status?: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  paymentMethod?: 'card' | 'sepa_debit' | 'paypal';
  amount?: number;
  currency?: string;
  description?: string;
  paidAt?: Date;
  failureReason?: string;
  refundedAmount?: number;
  refundedAt?: Date;
  receiptUrl?: string;
  invoiceId?: string;
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;
  isTrial?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Client for communicating with the DB service
 */
@Injectable()
export class DbServiceClient {
  private readonly logger = new Logger(DbServiceClient.name);
  private readonly httpClient: AxiosInstance;
  private readonly dbServiceUrl: string;
  private readonly apiKey: string;
  private readonly serviceName: string;

  constructor() {
    this.dbServiceUrl = process.env.DB_SERVICE_URL || 'http://localhost:3001';
    this.apiKey = process.env.DB_SERVICE_API_KEY || 'default-api-key';
    this.serviceName = 'payment-service';

    this.httpClient = axios.create({
      baseURL: this.dbServiceUrl,
      timeout: 30000,
      headers: {
        'x-api-key': this.apiKey,
        'x-service-name': this.serviceName,
        'Content-Type': 'application/json',
      },
    });

    // Remove response interceptor to avoid automatic exception throwing
    // We'll handle errors manually in each method
  }

  /**
   * Handle HTTP errors in a clean, readable format
   */
  private handleHttpError(error: any): never {
    if (error.response) {
      // Server responded with error status
      const { status, statusText, data } = error.response;
      const url = error.config?.url || 'unknown';
      const method = error.config?.method?.toUpperCase() || 'unknown';
      
      let errorMessage = `DB Service ${method} ${url} failed: ${status} ${statusText}`;
      
      // Extract meaningful error messages
      let userMessage = statusText;
      if (data) {
        if (typeof data === 'string') {
          userMessage = data;
        } else if (data.message) {
          if (Array.isArray(data.message)) {
            userMessage = data.message.join(', ');
          } else {
            userMessage = data.message;
          }
        } else if (data.error) {
          userMessage = data.error;
        }
        errorMessage += ` - ${userMessage}`;
      }
      
      this.logger.error(errorMessage);
      
      // Map HTTP status codes to appropriate NestJS exceptions
      switch (status) {
        case 400:
          throw new HttpException(userMessage, HttpStatus.BAD_REQUEST);
        case 401:
          throw new HttpException(userMessage, HttpStatus.UNAUTHORIZED);
        case 403:
          throw new HttpException(userMessage, HttpStatus.FORBIDDEN);
        case 404:
          throw new NotFoundException(userMessage);
        case 409:
          throw new HttpException(userMessage, HttpStatus.CONFLICT);
        case 422:
          throw new HttpException(userMessage, HttpStatus.UNPROCESSABLE_ENTITY);
        case 500:
          throw new HttpException(userMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        default:
          throw new HttpException(userMessage, status);
      }
    } else if (error.request) {
      // Request was made but no response received
      const message = 'DB Service is not responding';
      this.logger.error(`DB Service request failed: No response received - ${error.message}`);
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    } else {
      // Something else happened
      const message = 'Failed to setup request to DB Service';
      this.logger.error(`DB Service request setup failed: ${error.message}`);
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Subscription methods
  async createSubscription(createSubscriptionDto: CreateSubscriptionDto): Promise<Subscription> {
    try {
      const response = await this.httpClient.post('/subscriptions', createSubscriptionDto);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      this.handleHttpError(error);
    }
  }

  async findSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    try {
      const response = await this.httpClient.get(`/subscriptions/user/${userId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.debug(`No subscription found for user ${userId} (this is normal for new users)`);
        return null;
      }
      this.logger.error(`Failed to find subscription by user ID: ${error.message}`);
      this.handleHttpError(error);
    }
  }

  async findSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    try {
      const response = await this.httpClient.get(`/subscriptions/stripe-subscription/${stripeSubscriptionId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.debug(`No subscription found for Stripe subscription ID ${stripeSubscriptionId}`);
        return null;
      }
      this.logger.error(`Failed to find subscription by Stripe subscription ID: ${error.message}`);
      this.handleHttpError(error);
    }
  }

  async updateSubscriptionByUserId(userId: string, updateSubscriptionDto: UpdateSubscriptionDto): Promise<Subscription> {
    try {
      const response = await this.httpClient.put(`/subscriptions/user/${userId}`, updateSubscriptionDto);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update subscription by user ID: ${error.message}`);
      throw error;
    }
  }

  async updateSubscriptionByStripeSubscriptionId(
    stripeSubscriptionId: string,
    updateSubscriptionDto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    try {
      const response = await this.httpClient.put(
        `/subscriptions/stripe-subscription/${stripeSubscriptionId}`,
        updateSubscriptionDto,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update subscription by Stripe subscription ID: ${error.message}`);
      throw error;
    }
  }

  async isSubscriptionActive(userId: string): Promise<boolean> {
    try {
      const response = await this.httpClient.get(`/subscriptions/user/${userId}/active`);
      return response.data.isActive;
    } catch (error) {
      this.logger.error(`Failed to check subscription activity: ${error.message}`);
      throw error;
    }
  }

  async getSubscriptionStatus(userId: string): Promise<{
    subscription: Subscription | null;
    isActive: boolean;
    isTrialActive: boolean;
    daysLeft: number | null;
  }> {
    try {
      const response = await this.httpClient.get(`/subscriptions/user/${userId}/status`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get subscription status: ${error.message}`);
      throw error;
    }
  }

  async changeSubscriptionPlan(userId: string, plan: 'monthly' | 'yearly'): Promise<Subscription> {
    try {
      const response = await this.httpClient.put(`/subscriptions/user/${userId}/plan`, { plan });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to change subscription plan: ${error.message}`);
      throw error;
    }
  }

  // Payment methods
  async createPayment(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    try {
      const response = await this.httpClient.post('/payments', createPaymentDto);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`);
      throw error;
    }
  }

  async findPaymentByStripePaymentIntentId(stripePaymentIntentId: string): Promise<Payment | null> {
    try {
      const response = await this.httpClient.get(`/payments/stripe-payment-intent/${stripePaymentIntentId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.debug(`No payment found for Stripe payment intent ID ${stripePaymentIntentId}`);
        return null;
      }
      this.logger.error(`Failed to find payment by Stripe payment intent ID: ${error.message}`);
      this.handleHttpError(error);
    }
  }

  async findPaymentsByUserId(userId: string): Promise<Payment[]> {
    try {
      const response = await this.httpClient.get(`/payments/user/${userId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to find payments by user ID: ${error.message}`);
      throw error;
    }
  }

  async findPaymentsBySubscriptionId(subscriptionId: string): Promise<Payment[]> {
    try {
      const response = await this.httpClient.get(`/payments/subscription/${subscriptionId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to find payments by subscription ID: ${error.message}`);
      throw error;
    }
  }

  async updatePaymentByStripePaymentIntentId(
    stripePaymentIntentId: string,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<Payment> {
    try {
      const response = await this.httpClient.put(
        `/payments/stripe-payment-intent/${stripePaymentIntentId}`,
        updatePaymentDto,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update payment by Stripe payment intent ID: ${error.message}`);
      throw error;
    }
  }

  async updatePaymentStatus(
    paymentId: string,
    status: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded',
  ): Promise<Payment> {
    try {
      const response = await this.httpClient.put(`/payments/${paymentId}/status`, { status });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update payment status: ${error.message}`);
      throw error;
    }
  }
} 