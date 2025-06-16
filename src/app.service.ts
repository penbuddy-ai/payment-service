import { Injectable } from '@nestjs/common';

/**
 * Main application service
 * Provides health check and service information functionality
 */
@Injectable()
export class AppService {
  /**
   * Get service health status
   * @returns Health status object
   */
  getHealth() {
    return {
      status: 'OK',
      service: 'Penpal AI Payment Service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get detailed service information
   * @returns Service information object
   */
  getInfo() {
    return {
      name: 'Penpal AI Payment Service',
      description:
        'Service de gestion des paiements, abonnements et facturation',
      version: '1.0.0',
      features: [
        'Gestion des abonnements',
        'Intégration Stripe',
        'Paiements récurrents',
        'Webhooks',
        'Facturation automatique',
      ],
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}
