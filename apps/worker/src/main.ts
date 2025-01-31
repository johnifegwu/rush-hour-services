import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule);
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));
  const globalPrefix = 'worker';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT ?? 3005;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
