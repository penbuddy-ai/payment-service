import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthServiceClient {
  private readonly logger = new Logger(AuthServiceClient.name);
  private readonly authServiceUrl: string;
  private readonly serviceKey: string;

  constructor(private readonly configService: ConfigService) {
    this.authServiceUrl
      = this.configService.get<string>("AUTH_SERVICE_URL")
        || "http://localhost:3002/api/v1";
    this.serviceKey
      = this.configService.get<string>("SERVICE_API_KEY") || "default-key";
  }

  /**
   * Update user subscription information via auth service
   */
  async updateUserSubscription(
    userId: string,
    subscriptionData: {
      plan?: "monthly" | "yearly";
      status?: "trial" | "active" | "past_due" | "canceled" | "unpaid";
      trialEnd?: Date;
    },
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.authServiceUrl}/users/${userId}/subscription`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-service-key": this.serviceKey,
            "x-service-name": "payment-service",
          },
          body: JSON.stringify(subscriptionData),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        this.logger.error(
          `Failed to update user subscription via auth service: ${error.message || response.statusText}`,
        );
        // Don't throw error - subscription creation should still succeed even if user update fails
      }
      else {
        this.logger.log(
          `Successfully updated user ${userId} subscription via auth service`,
        );
      }
    }
    catch (error) {
      this.logger.error(
        `Error calling auth service to update user subscription: ${error.message}`,
      );
      // Don't throw error - subscription creation should still succeed even if user update fails
    }
  }
}
