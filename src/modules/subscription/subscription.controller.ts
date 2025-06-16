import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionPlan } from '../../common/schemas/subscription.schema';

/**
 * Subscription controller
 * Handles HTTP requests for subscription management
 */
@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * Create a new subscription with trial period
   */
  @Post()
  @ApiOperation({ 
    summary: 'Create new subscription',
    description: 'Creates a new subscription with 30-day trial period',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subscription created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User already has an active subscription',
  })
  async create(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionService.create(createSubscriptionDto);
  }

  /**
   * Get subscription by user ID
   */
  @Get('user/:userId')
  @ApiOperation({ 
    summary: 'Get subscription by user ID',
    description: 'Retrieves subscription information for a specific user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'user_123456789',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  async findByUserId(@Param('userId') userId: string) {
    return this.subscriptionService.findByUserId(userId);
  }

  /**
   * Get subscription status for user
   */
  @Get('user/:userId/status')
  @ApiOperation({ 
    summary: 'Get subscription status',
    description: 'Returns detailed subscription status information for a user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'user_123456789',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription status retrieved',
  })
  async getStatus(@Param('userId') userId: string) {
    return this.subscriptionService.getStatus(userId);
  }

  /**
   * Check if user subscription is active
   */
  @Get('user/:userId/active')
  @ApiOperation({ 
    summary: 'Check if subscription is active',
    description: 'Returns whether the user has an active subscription',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'user_123456789',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription activity status',
    schema: {
      type: 'object',
      properties: {
        isActive: { type: 'boolean', example: true },
      },
    },
  })
  async isActive(@Param('userId') userId: string) {
    const isActive = await this.subscriptionService.isActive(userId);
    return { isActive };
  }

  /**
   * Start paid subscription after trial
   */
  @Post('user/:userId/activate')
  @ApiOperation({ 
    summary: 'Start paid subscription',
    description: 'Converts trial subscription to paid subscription',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'user_123456789',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paid subscription started successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Subscription is not in trial status',
  })
  async startPaidSubscription(
    @Param('userId') userId: string,
    @Body() body: { paymentMethodId: string },
  ) {
    return this.subscriptionService.startPaidSubscription(userId, body.paymentMethodId);
  }

  /**
   * Cancel subscription
   */
  @Post('user/:userId/cancel')
  @ApiOperation({ 
    summary: 'Cancel subscription',
    description: 'Cancels the user subscription',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'user_123456789',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription canceled successfully',
  })
  async cancel(
    @Param('userId') userId: string,
    @Body() body: { cancelAtPeriodEnd?: boolean } = {},
  ) {
    const { cancelAtPeriodEnd = true } = body;
    return this.subscriptionService.cancel(userId, cancelAtPeriodEnd);
  }

  /**
   * Change subscription plan
   */
  @Patch('user/:userId/plan')
  @ApiOperation({ 
    summary: 'Change subscription plan',
    description: 'Changes the subscription plan for a user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'user_123456789',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription plan changed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Subscription is already on this plan',
  })
  async changePlan(
    @Param('userId') userId: string,
    @Body() body: { plan: SubscriptionPlan },
  ) {
    return this.subscriptionService.changePlan(userId, body.plan);
  }

  /**
   * Get subscription by ID
   */
  @Get(':id')
  @ApiOperation({ 
    summary: 'Get subscription by ID',
    description: 'Retrieves subscription by its MongoDB ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  async findById(@Param('id') id: string) {
    return this.subscriptionService.findById(id);
  }

  /**
   * Update subscription
   */
  @Patch(':id')
  @ApiOperation({ 
    summary: 'Update subscription',
    description: 'Updates subscription information',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionService.update(id, updateSubscriptionDto);
  }
} 