/**
 * Subscription plan types
 */
export enum SubscriptionPlan {
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

/**
 * Subscription status types
 */
export enum SubscriptionStatus {
  TRIAL = "trial",
  ACTIVE = "active",
  PAST_DUE = "past_due",
  CANCELED = "canceled",
  UNPAID = "unpaid",
}

/**
 * Payment status types
 */
export enum PaymentStatus {
  PENDING = "pending",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  CANCELED = "canceled",
  REFUNDED = "refunded",
}

/**
 * Payment method types
 */
export enum PaymentMethod {
  CARD = "card",
  SEPA_DEBIT = "sepa_debit",
  PAYPAL = "paypal",
}
