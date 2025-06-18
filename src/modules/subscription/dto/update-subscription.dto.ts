import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  SubscriptionStatus,
  SubscriptionPlan,
} from '../../../common/types';

/**
 * DTO for updating a subscription
 */
export class UpdateSubscriptionDto {
  /**
   * Subscription status
   */
  @ApiProperty({
    description: 'Subscription status',
    enum: SubscriptionStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  /**
   * Subscription plan
   */
  @ApiProperty({
    description: 'Subscription plan',
    enum: SubscriptionPlan,
    required: false,
  })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  /**
   * Whether to cancel at period end
   */
  @ApiProperty({
    description: 'Whether to cancel at period end',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  /**
   * Trial end date
   */
  @ApiProperty({
    description: 'Trial end date',
    type: Date,
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  trialEnd?: Date;

  /**
   * Current period start
   */
  @ApiProperty({
    description: 'Current period start',
    type: Date,
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  currentPeriodStart?: Date;

  /**
   * Current period end
   */
  @ApiProperty({
    description: 'Current period end',
    type: Date,
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  currentPeriodEnd?: Date;

  /**
   * Next billing date
   */
  @ApiProperty({
    description: 'Next billing date',
    type: Date,
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  nextBillingDate?: Date;
}
