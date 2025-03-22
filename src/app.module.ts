import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObyteModule } from './modules/obyte/obyte.module';
import { CurrentDataModule } from './modules/current-data/current-data.module';
import { ScheduleModule } from '@nestjs/schedule';
import { OdappModule } from './modules/odapp/odapp.module';
import { TradesModule } from './modules/trades/trades.module';
import { SnapshotModule } from './modules/snapshot/snapshot.module';
import obyteConfig from './config/obyte.config';
import { ApiModule } from './modules/api/api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [obyteConfig],
    }),
    ScheduleModule.forRoot(),
    ObyteModule,
    OdappModule,
    TradesModule,
    SnapshotModule,
    CurrentDataModule,
    ApiModule,
  ],
})
export class AppModule {}
