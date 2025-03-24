import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import * as migration from './database/migration';
import { TradesService } from './modules/trades/trades.service';
import { CurrentDataService } from './modules/current-data/current-data.service';
import { SnapshotService } from './modules/snapshot/snapshot.service';
import { ObyteService } from './modules/obyte/obyte.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  try {
    logger.log('Running database migration...');
    await migration.run();
    logger.log('Database migration completed successfully');

    const app = await NestFactory.create(AppModule);

    app.useGlobalInterceptors(new LoggingInterceptor());

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.enableCors();

    const port = process.env.PORT || 3000;
    await app.listen(port);

    logger.log(`Application is running on: ${port}`);
    await app.get(ObyteService).updateExchangeRates();
    await app.get(TradesService).initializeHistoricalData();
    await app.get(SnapshotService).initFillPythHistory();
    await app.get(CurrentDataService).handleHourlyUpdate();
    logger.log('Application started successfully');
  } catch (error) {
    logger.error(`Failed to start application: ${error.message}`, error.stack);
    process.exit(1);
  }
}

bootstrap();
