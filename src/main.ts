import "dotenv/config";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

/**
 * Bootstrap function to start the Payment Service application
 * Configures security, validation, documentation and starts the server
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  // Set global API prefix
  app.setGlobalPrefix("api/v1");

  // Enable HTTP logging in development mode
  const isDevelopment = configService.get("NODE_ENV", "development") === "development";
  if (isDevelopment) {
    app.useGlobalInterceptors(new LoggingInterceptor());
    logger.log("🔍 HTTP Request/Response details logging enabled (Development mode)");
  }

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // Enable CORS for microservice communication
  app.enableCors({
    origin: configService.get("CORS_ORIGIN", "*"),
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // API Documentation
  const config = new DocumentBuilder()
    .setTitle("Penpal AI Payment Service")
    .setDescription(
      "Service de gestion des paiements, abonnements et facturation",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/v1/docs", app, document);

  // Start the server
  const port = configService.get("PORT", 3003);
  await app.listen(port);

  logger.log(`🚀 Payment Service running on port ${port}`);
  logger.log(
    `📚 API Documentation available at http://localhost:${port}/api/v1/docs`,
  );
  logger.log(`🌐 API Base URL: http://localhost:${port}/api/v1`);
}

bootstrap();
