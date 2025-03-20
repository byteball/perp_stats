import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PreparePythService } from './prepare-pyth.service';
import { PerpetualStat } from './interfaces/prepare-pyth.interface';
import { OdappService } from '../odapp/odapp.service';
import { SnapshotService } from '../snapshot/snapshot.service';

@Injectable()
export class CurrentDataService {
  private readonly logger = new Logger(CurrentDataService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly preparePythService: PreparePythService,
    private readonly snapshotService: SnapshotService,
    private readonly odappService: OdappService,
  ) {
    setTimeout(async () => {
      await this.handleHourlyUpdate();
    }, 10000);
  }

  @Cron('0 0 * * * *')
  async handleHourlyUpdate() {
    this.logger.log('Running hourly update task');
    try {
      const metaByAA: Record<string, any> = {};
      const baseAAs = this.configService.get<string[]>('obyte.baseAAs', []);
      const baseMetaWithVars: any = await this.odappService.getAAsByBaseAAsWithVars(baseAAs);
      const stakingAAs: string[] = [];

      for (const baseMeta of baseMetaWithVars) {
        metaByAA[baseMeta.address] = {
          aa: baseMeta.address,
          ...baseMeta.definition[1].params,
          ...baseMeta.stateVars,
        };

        stakingAAs.push(baseMeta.stateVars.staking_aa);
      }

      const [stakingDefs, stakingStateVars] = await Promise.all([
        this.odappService.getDefinitions(stakingAAs),
        this.odappService.getAAsStateVars(stakingAAs),
      ]);

      for (const aa in metaByAA) {
        const meta = metaByAA[aa];
        meta.stakingParams = stakingDefs[meta.staking_aa][1].params;
        meta.stakingVars = stakingStateVars[meta.staking_aa];
      }

      const perpetualStats: PerpetualStat[] = [];
      for (const aa in metaByAA) {
        perpetualStats.push(await this.preparePythService.prepareMetaByAA(metaByAA[aa]));
      }

      await this.savePerpetualStatsToDb(perpetualStats);
      this.logger.log('Hourly update completed successfully');
    } catch (error) {
      this.logger.error(`Error during hourly update: ${error.message}`, error.stack);
    }
  }

  private async savePerpetualStatsToDb(perpetualStats: PerpetualStat[]) {
    const timestamp = Math.floor(Date.now() / 1000);

    for (const stat of perpetualStats) {
      const aaAddress = stat.aa;
      for (const priceData of stat.prices) {
        await this.snapshotService.saveSnapshot({
          aaAddress,
          asset: priceData.asset,
          isRealtime: 1,
          usdPrice: priceData.usdPrice,
          priceInReserve: stat.priceInReserve,
          timestamp,
        });
      }
    }
  }
}
