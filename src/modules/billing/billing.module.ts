import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

/**
 * Billing module
 * Handles billing operations and invoice generation
 */
@Module({
  imports: [CommonModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
