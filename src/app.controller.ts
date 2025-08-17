import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

/**
 * Main application controller
 * Provides health check and basic service information
 */
@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check endpoint
   * @returns Service status and basic information
   */
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is running',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'OK' },
        service: { type: 'string', example: 'Penpal AI Payment Service' },
        version: { type: 'string', example: '1.0.0' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }

  /**
   * Health check endpoint (alternative path)
   * @returns Service status and basic information
   */
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is running',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'OK' },
        service: { type: 'string', example: 'Penpal AI Payment Service' },
        version: { type: 'string', example: '1.0.0' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  getHealthAlternative() {
    return this.appService.getHealth();
  }

  /**
   * Service information endpoint
   * @returns Detailed service information
   */
  @Get('info')
  @ApiOperation({ summary: 'Get service information' })
  @ApiResponse({
    status: 200,
    description: 'Service information',
  })
  getInfo() {
    return this.appService.getInfo();
  }
}
