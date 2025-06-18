import { Module, Global } from '@nestjs/common';
import { HttpClientLogger } from './interceptors/http-client.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

/**
 * Common module for shared services and interceptors
 * Marked as Global to be available throughout the application
 */
@Global()
@Module({
  providers: [
    HttpClientLogger,
    LoggingInterceptor,
  ],
  exports: [
    HttpClientLogger,
    LoggingInterceptor,
  ],
})
export class CommonModule {} 