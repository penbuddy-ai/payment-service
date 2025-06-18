import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeService } from '../../common/services/stripe.service';
import { CommonModule } from '../../common/common.module';

/**
 * Payment module
 * Handles payment processing and transaction management
 */
@Module({
  imports: [CommonModule],
  controllers: [PaymentController],
  providers: [PaymentService, StripeService],
  exports: [PaymentService],
})
export class PaymentModule {}
