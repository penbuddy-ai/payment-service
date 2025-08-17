import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Observable } from "rxjs";
import { catchError, tap } from "rxjs/operators";

/**
 * Enhanced logging interceptor for development mode
 * Complements existing HTTP logging with detailed request/response bodies
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP_DETAILS");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, headers, body, query, params } = request;
    const startTime = Date.now();

    // Generate unique request ID for tracking
    const requestId = this.generateRequestId();

    // Only log detailed information for specific conditions
    const shouldLogDetails = this.shouldLogDetails(method, url, body);

    if (shouldLogDetails) {
      // Log detailed request information
      this.logger.debug(
        `📋 REQUEST DETAILS [${requestId}] ${method} ${url}\n`
        + `├─ Query: ${JSON.stringify(query)}\n`
        + `├─ Params: ${JSON.stringify(params)}\n`
        + `├─ Headers: ${JSON.stringify(this.sanitizeHeaders(headers))}\n`
        + `└─ Body: ${this.sanitizeBody(body)}`,
      );
    }

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;

        if (shouldLogDetails && data) {
          // Log detailed response body (only if there's meaningful data)
          this.logger.debug(
            `📄 RESPONSE DETAILS [${requestId}] ${response.statusCode} (${duration}ms)\n`
            + `└─ Body: ${this.sanitizeResponseData(data)}`,
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Always log errors with details
        this.logger.error(
          `❌ ERROR DETAILS [${requestId}] ${method} ${url} (${duration}ms)\n`
          + `├─ Status: ${error.status || 500}\n`
          + `├─ Message: ${error.message}\n`
          + `└─ Stack: ${error.stack?.split("\n")[0] || "N/A"}`,
        );

        throw error;
      }),
    );
  }

  /**
   * Determine if we should log detailed information
   * Avoid logging for simple GET requests or health checks
   */
  private shouldLogDetails(method: string, url: string, body: any): boolean {
    // Skip health checks and simple GET requests
    if (url.includes("/health") || url.includes("/info") || url === "/") {
      return false;
    }

    // Log POST, PUT, PATCH requests (usually have meaningful bodies)
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
      return true;
    }

    // Log GET requests only if they have complex query parameters
    if (method.toUpperCase() === "GET" && url.includes("?")) {
      return true;
    }

    // Log if there's a request body
    if (body && Object.keys(body).length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = [
      "authorization",
      "cookie",
      "x-api-key",
      "x-service-key",
      "stripe-signature",
    ];

    const sanitized = { ...headers };

    sensitiveHeaders.forEach((header) => {
      const lowerHeader = header.toLowerCase();
      Object.keys(sanitized).forEach((key) => {
        if (key.toLowerCase() === lowerHeader) {
          sanitized[key] = "[REDACTED]";
        }
      });
    });

    // Only keep relevant headers
    const relevantHeaders = [
      "content-type",
      "user-agent",
      "authorization",
      "x-api-key",
      "x-service-key",
      "stripe-signature",
    ];

    const filtered = {};
    Object.keys(sanitized).forEach((key) => {
      if (relevantHeaders.some(h => key.toLowerCase().includes(h))) {
        filtered[key] = sanitized[key];
      }
    });

    return filtered;
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: any): string {
    if (!body || Object.keys(body).length === 0) {
      return "empty";
    }

    if (typeof body !== "object") {
      return JSON.stringify(body);
    }

    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "paymentMethodId",
      "cardNumber",
      "cvv",
      "expiryDate",
    ];

    const sanitized = { ...body };

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    });

    return JSON.stringify(sanitized, null, 2);
  }

  /**
   * Sanitize response data for logging
   */
  private sanitizeResponseData(data: any): string {
    if (!data) {
      return "null";
    }

    if (typeof data === "string") {
      return data.length > 200 ? `${data.substring(0, 200)}...` : data;
    }

    if (typeof data === "object") {
      // Don't log huge user objects in detail
      if (data._id || data.id) {
        return `Object {id: ${data._id || data.id}, ...${Object.keys(data).length - 1} more fields}`;
      }

      const jsonString = JSON.stringify(data, null, 2);
      return jsonString.length > 500
        ? `${jsonString.substring(0, 500)}...`
        : jsonString;
    }

    return String(data);
  }
}
