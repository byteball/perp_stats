import { Module } from '@nestjs/common';
import { CurrentDataService } from './current-data.service';
import { ScheduleModule } from '@nestjs/schedule';
import { PreparePythService } from './prepare-pyth.service';
import { ObyteModule } from '../obyte/obyte.module';
import { OdappModule } from '../odapp/odapp.module';
import { SnapshotModule } from '../snapshot/snapshot.module';

@Module({
  imports: [ScheduleModule.forRoot(), ObyteModule, OdappModule, SnapshotModule],
  providers: [CurrentDataService, PreparePythService],
  exports: [CurrentDataService, PreparePythService],
})
export class CurrentDataModule {}
