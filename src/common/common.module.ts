import { Module, Global } from '@nestjs/common';
import { HttpClientLogger } from './interceptors/http-client.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { StripeService } from './services/stripe.service';
import { DbServiceClient } from './services/db-service.client';

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