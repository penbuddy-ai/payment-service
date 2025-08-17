import { Global, Module } from "@nestjs/common";

import { HttpClientLogger } from "./interceptors/http-client.interceptor";
import { LoggingInterceptor } from "./interceptors/logging.interceptor";
import { DbServiceClient } from "./services/db-service.client";
import { StripeService } from "./services/stripe.service";

/**
 * Common module for shared services and interceptors
 * Marked as Global to be available throughout the application
 */
@Global()
@Module({
  providers: [
    HttpClientLogger,
    LoggingInterceptor,
    StripeService,
    DbServiceClient,
  ],
  exports: [
    HttpClientLogger,
    LoggingInterceptor,
    StripeService,
    DbServiceClient,
  ],
})
export class CommonModule {}
