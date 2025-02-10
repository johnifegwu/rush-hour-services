import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CleanupModule } from './cleanup/cleanup.module';

async function bootstrap() {
  const app = await NestFactory.create(CleanupModule, {
    logger: ['error', 'warn', 'debug', 'log'],
  });
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));
  const globalPrefix = 'cron';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.CRON_PORT ?? 3002;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
