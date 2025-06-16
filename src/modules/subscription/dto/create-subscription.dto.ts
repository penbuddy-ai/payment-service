import { IsString, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '../../../common/schemas/subscription.schema';

/**
 * DTO for creating a new subscription
 */
export class CreateSubscriptionDto {
  /**
   * User ID from the auth service
   */
  @ApiProperty({
    description: 'User ID from the auth service',
    example: 'user_123456789',
  })
  @IsString()
  userId: string;

  /**
   * User email address
   */
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  /**
   * User full name
   */
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * Subscription plan type
   */
  @ApiProperty({
    description: 'Subscription plan type',
    enum: SubscriptionPlan,
    example: SubscriptionPlan.MONTHLY,
  })
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;
}
