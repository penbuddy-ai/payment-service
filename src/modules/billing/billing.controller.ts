import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';

/**
 * Billing controller
 * Handles HTTP requests for billing operations
 */
@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // TODO: Implement billing endpoints
}
