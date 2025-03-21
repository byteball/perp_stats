import { Module } from '@nestjs/common';
import { SnapshotService } from './snapshot.service';
import { SnapshotRepository } from './snapshot.repository';
import { OdappModule } from '../odapp/odapp.module';
import { PriceProviderModule } from '../price-provider/price-provider.module';
import { TradesModule } from '../trades/trades.module';
import { ObyteModule } from '../obyte/obyte.module';

@Module({
  imports: [ObyteModule, OdappModule, PriceProviderModule, TradesModule],
  providers: [SnapshotService, SnapshotRepository],
  exports: [SnapshotService],
})
export class SnapshotModule {}
