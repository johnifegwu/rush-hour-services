// apps/gateway/src/main.ts
import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module';
import { ValidationPipe } from '@nestjs/common';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);

  // Global middleware
  app.use(compression());
  app.use(helmet());

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  const port = process.env.GATEWAY_PORT || 3009;
  // Enable CORS
  app.enableCors();

  await app.listen(port);
}
bootstrap();
