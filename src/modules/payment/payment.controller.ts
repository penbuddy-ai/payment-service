import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';

/**
 * Payment controller
 * Handles HTTP requests for payment processing
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // TODO: Implement payment endpoints
}
