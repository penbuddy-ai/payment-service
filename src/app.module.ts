import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { PaymentModule } from './modules/payment/payment.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { BillingModule } from './modules/billing/billing.module';
import { HttpErrorInterceptor } from './common/interceptors/http-error.interceptor';

/**
 * Main application module for the Payment Service
 * Configures database, caching, throttling and all feature modules
 */
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database access is now handled via db-service

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get('THROTTLE_TTL', 60000), // 1 minute
          limit: configService.get('THROTTLE_LIMIT', 10), // 10 requests per minute
        },
      ],
      inject: [ConfigService],
    }),

    // Caching
    CacheModule.register({
      isGlobal: true,
    }),

    // Common utilities
    CommonModule,

    // Feature modules
    SubscriptionModule,
    PaymentModule,
    WebhookModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpErrorInterceptor,
    },
  ],
})
export class AppModule {}
