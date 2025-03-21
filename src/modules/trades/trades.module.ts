import { Module } from '@nestjs/common';
import { TradesService } from './trades.service';
import { TradesRepository } from './trades.repository';
import { ObyteModule } from '../obyte/obyte.module';
import { OdappModule } from '../odapp/odapp.module';

@Module({
  imports: [ObyteModule, OdappModule],
  providers: [TradesService, TradesRepository],
  exports: [TradesService, TradesRepository],
})
export class TradesModule {}
