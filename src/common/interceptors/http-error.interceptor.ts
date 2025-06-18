import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Interceptor to handle and format HTTP errors
 */
@Injectable()
export class HttpErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // If it's already a well-formatted HttpException, let it pass through
        if (error instanceof HttpException) {
          return throwError(() => error);
        }

        // If it's an Axios error, format it nicely
        if (error.response || error.request) {
          this.logger.error('Unhandled HTTP error caught by interceptor', error.message);
          
          let message = 'An error occurred while processing your request';
          let status = HttpStatus.INTERNAL_SERVER_ERROR;

          if (error.response) {
            status = error.response.status || HttpStatus.INTERNAL_SERVER_ERROR;
            
            if (error.response.data) {
              if (typeof error.response.data === 'string') {
                message = error.response.data;
              } else if (error.response.data.message) {
                message = Array.isArray(error.response.data.message)
                  ? error.response.data.message.join(', ')
                  : error.response.data.message;
              } else if (error.response.data.error) {
                message = error.response.data.error;
              }
            }
          }

          return throwError(() => new HttpException(message, status));
        }

        // For any other error, log it and return a generic message
        this.logger.error('Unhandled error caught by interceptor', error.stack);
        return throwError(() => new HttpException(
          'An unexpected error occurred',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ));
      }),
    );
  }
} 