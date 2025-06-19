import { Injectable, Logger } from '@nestjs/common';

/**
 * HTTP Client logging utility for outbound requests
 * Logs external API calls (Stripe, Auth Service, etc.)
 */
@Injectable()
export class HttpClientLogger {
  private readonly logger = new Logger('HTTP_CLIENT');

  /**
   * Log outbound HTTP request
   */
  logRequest(method: string, url: string, options?: any): string {
    const requestId = this.generateRequestId();
    
    this.logger.log(
      `🔵 OUTBOUND REQUEST [${requestId}]\n` +
      `┌─ Method: ${method.toUpperCase()}\n` +
      `├─ URL: ${url}\n` +
      `├─ Headers: ${JSON.stringify(this.sanitizeHeaders(options?.headers || {}))}\n` +
      `└─ Body: ${this.sanitizeBody(options?.body)}`
    );

    return requestId;
  }

  /**
   * Log outbound HTTP response
   */
  logResponse(
    requestId: string, 
    status: number, 
    duration: number, 
    responseData?: any,
    error?: any
  ): void {
    if (error) {
      this.logger.error(
        `🔴 OUTBOUND ERROR [${requestId}]\n` +
        `┌─ Status: ${status || 'N/A'}\n` +
        `├─ Duration: ${duration}ms\n` +
        `├─ Error: ${error.message}\n` +
        `└─ Stack: ${error.stack || 'N/A'}`
      );
    } else {
      this.logger.log(
        `🟢 OUTBOUND RESPONSE [${requestId}]\n` +
        `┌─ Status: ${status}\n` +
        `├─ Duration: ${duration}ms\n` +
        `└─ Data: ${this.sanitizeResponseData(responseData)}`
      );
    }
  }

  /**
   * Wrapper for fetch with logging
   */
  async loggedFetch(url: string, options: any = {}): Promise<Response> {
    const startTime = Date.now();
    const requestId = this.logRequest('fetch', url, options);

    try {
      const response = await fetch(url, options);
      const duration = Date.now() - startTime;
      
      // Clone response to read body without consuming it
      const responseClone = response.clone();
      let responseData;
      
      try {
        responseData = await responseClone.json();
      } catch {
        responseData = await responseClone.text();
      }

      this.logResponse(requestId, response.status, duration, responseData);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logResponse(requestId, 0, duration, null, error);
      throw error;
    }
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'x-service-key',
      'stripe-signature',
      'cookie'
    ];
    
    const sanitized = { ...headers };
    
    sensitiveHeaders.forEach(header => {
      const lowerHeader = header.toLowerCase();
      Object.keys(sanitized).forEach(key => {
        if (key.toLowerCase() === lowerHeader) {
          sanitized[key] = '[REDACTED]';
        }
      });
    });
    
    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: any): string {
    if (!body) {
      return 'null';
    }

    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        return this.sanitizeBodyObject(parsed);
      } catch {
        return body.length > 500 ? `${body.substring(0, 500)}...` : body;
      }
    }

    if (typeof body === 'object') {
      return this.sanitizeBodyObject(body);
    }

    return String(body);
  }

  /**
   * Sanitize body object
   */
  private sanitizeBodyObject(body: any): string {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'paymentMethodId',
      'cardNumber',
      'cvv',
      'expiryDate',
      'client_secret'
    ];

    const sanitized = { ...body };
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return JSON.stringify(sanitized, null, 2);
  }

  /**
   * Sanitize response data for logging
   */
  private sanitizeResponseData(data: any): string {
    if (!data) {
      return 'null';
    }

    if (typeof data === 'string') {
      return data.length > 500 ? `${data.substring(0, 500)}...` : data;
    }

    if (typeof data === 'object') {
      // Sanitize sensitive fields in response
      const sanitized = this.sanitizeResponseObject(data);
      const jsonString = JSON.stringify(sanitized, null, 2);
      return jsonString.length > 1000 
        ? `${jsonString.substring(0, 1000)}...` 
        : jsonString;
    }

    return String(data);
  }

  /**
   * Sanitize response object
   */
  private sanitizeResponseObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sensitiveFields = [
      'client_secret',
      'secret',
      'key',
      'token',
      'password'
    ];

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeResponseObject(item));
    }

    const sanitized = { ...obj };
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeResponseObject(sanitized[key]);
      }
    });

    return sanitized;
  }
} 