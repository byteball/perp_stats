import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import oDapp from 'odapp';
import { ConfigService } from '@nestjs/config';
import { PreparePythService, PerpetualStat } from './prepare-pyth.service';
import { ObyteService } from '../obyte/obyte.service';
import { PerpPriceService } from '../perp-price/perp-price.service';

const odapp = new oDapp(process.env.NETWORK === 'mainnet' ? 'https://dapp.obyte.org' : 'https://odapp-t.aa-dev.net', true);

@Injectable()
export class CurrentDataService {
  private readonly logger = new Logger(CurrentDataService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly preparePythService: PreparePythService,
    private readonly obyteService: ObyteService,
    private readonly perpPriceService: PerpPriceService,
  ) {
    if (process.env.UPDATE_PRICES_ON_START) {
      setTimeout(async () => {
        await this.handleHourlyUpdate();
      }, 4000);
    }
  }

  @Cron('0 0 * * * *')
  async handleHourlyUpdate() {
    this.logger.log('Running hourly update task');
    try {
      const metaByAA: Record<string, any> = {};
      const baseAAs = this.configService.get<string[]>('obyte.baseAAs', []);
      const baseMetaWithVars: any = await odapp.getAAsByBaseAAsWithVars(baseAAs);
      const stakingAAs: string[] = [];

      for (const baseMeta of baseMetaWithVars) {
        metaByAA[baseMeta.address] = {
          aa: baseMeta.address,
          ...baseMeta.definition[1].params,
          ...baseMeta.stateVars,
        };

        stakingAAs.push(baseMeta.stateVars.staking_aa);
      }

      const [stakingDefs, stakingStateVars] = await Promise.all([odapp.getDefinitions(stakingAAs), odapp.getAAsStateVars(stakingAAs)]);

      for (const aa in metaByAA) {
        const meta = metaByAA[aa];
        meta.stakingParams = stakingDefs[meta.staking_aa][1].params;
        meta.stakingVars = stakingStateVars[meta.staking_aa];
      }

      const perpetualStats: PerpetualStat[] = [];
      for (const aa in metaByAA) {
        perpetualStats.push(await this.preparePythService.prepareMetaByAA(metaByAA[aa], odapp));
      }

      await this.savePerpetualStatsToDb(perpetualStats);
      this.logger.log('Hourly update completed successfully');
    } catch (error) {
      this.logger.error(`Error during hourly update: ${error.message}`, error.stack);
    }
  }

  private async savePerpetualStatsToDb(perpetualStats: PerpetualStat[]) {
    const mci = await this.obyteService.getLastMCI();
    const timestamp = Math.floor(Date.now() / 1000);

    for (const stat of perpetualStats) {
      const aaAddress = stat.aa;
      for (const priceData of stat.prices) {
        await this.perpPriceService.savePrice({
          aaAddress,
          mci,
          asset: priceData.asset,
          notForUse: 1,
          price: priceData.price,
          priceFromResponse: 0,
          timestamp,
        });
      }
    }
  }
}
