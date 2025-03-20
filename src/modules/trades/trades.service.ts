import { Injectable, Logger } from '@nestjs/common';
import { TradesRepository } from './trades.repository';
import eventBus from 'ocore/event_bus';
import { ObyteService } from '../obyte/obyte.service';
import { OdappService } from '../odapp/odapp.service';

@Injectable()
export class TradesService {
  private readonly logger = new Logger(TradesService.name);

  constructor(
    private readonly tradesRepository: TradesRepository,
    private readonly obyteService: ObyteService,
    private readonly odappService: OdappService,
  ) {
    this.subscribeToAAResponses();
    this.initializeHistoricalData();
  }

  async getLastPriceFromResponse(pyth: string, asset: string): Promise<number> {
    return this.tradesRepository.getLastPriceFromResponse(pyth, asset);
  }

  private subscribeToAAResponses(): void {
    eventBus.on('aa_response', (responseFromEvent: any) => {
      this.handleAAResponse(responseFromEvent, true);
    });
  }

  private async handleAAResponse(responseFromEvent: any, isRealtime: boolean): Promise<void> {
    const { mci, aa_address, trigger_unit, bounced, response, timestamp } = responseFromEvent;

    if (bounced) return;

    const { responseVars } = response;
    if (!responseVars || responseVars.price === undefined) return;

    const priceInReserve = responseVars.price;

    try {
      const { joint } = await this.obyteService.getJoint(trigger_unit);
      const dataFromRequest = joint.unit.messages.find(({ app }: { app: string }) => app === 'data');

      if (!dataFromRequest || !dataFromRequest.payload?.asset) return;

      const asset = dataFromRequest.payload.asset;
      const assetsMetadata = await this.odappService.getAssetsMetadata([asset]);
      const assetMetadata =
        assetsMetadata && assetsMetadata[asset]
          ? {
              ...assetsMetadata[asset],
              asset,
            }
          : null;

      if (!assetMetadata) return;

      const aaDefinition = await this.odappService.getDefinition(aa_address);
      if (!aaDefinition || !aaDefinition[1] || !aaDefinition[1].params) return;

      const reserve_asset = aaDefinition[1].params.reserve_asset;
      const reserve_price_aa = aaDefinition[1].params.reserve_price_aa;

      const reserve_price_aa_definition = await this.odappService.getDefinition(reserve_price_aa);
      if (!reserve_price_aa_definition || !reserve_price_aa_definition[1]) return;

      let reservePrice: number = 0;

      if (reserve_price_aa_definition[1].params.oswap_aa) {
        reservePrice = this.obyteService.getExchangeRateByAsset(reserve_asset);
      } else {
        const oracle = reserve_price_aa_definition[1].params.oracle;
        const feed_name = reserve_price_aa_definition[1].params.feed_name;
        const decimals = reserve_price_aa_definition[1].params.decimals;
        const oracle_price = await this.obyteService.getDataFeed(oracle, feed_name, mci);
        reservePrice = oracle_price / 10 ** decimals;
      }

      const usdPrice = reservePrice * priceInReserve * 10 ** assetMetadata.decimals;
      this.logger.log(`Processed price: ${assetMetadata.decimals}`);

      await this.tradesRepository.saveTrade({
        aaAddress: aa_address,
        triggerUnit: trigger_unit,
        mci,
        asset,
        isRealtime: isRealtime ? 1 : 0,
        usdPrice,
        priceInReserve,
        timestamp,
      });
    } catch (error) {
      this.logger.error(`Error in handleAAResponse: ${error.message}`);
    }
  }

  async initializeHistoricalData(): Promise<void> {
    const lastMci = await this.tradesRepository.getLastMci();
    this.logger.log(`Initializing historical data from MCI ${lastMci}`);

    try {
      const obyteNetworkService = this.obyteService['obyteNetworkService'];
      const configService = obyteNetworkService['configService'];
      const baseAAs = configService.get<string[]>('obyte.baseAAs', []);
      const aas = await obyteNetworkService.getAAsFromBaseAAs(baseAAs);

      const promises = aas.map(aa => this.processHistoricalResponses(aa, lastMci));
      await Promise.all(promises);

      this.logger.log('Historical data initialization completed');
    } catch (error) {
      this.logger.error(`Failed to initialize historical data: ${error.message}`);
    }
  }

  private async processHistoricalResponses(aa: string, lastMci: number): Promise<void> {
    try {
      const responses = await this.obyteService.getAllAAResponses(aa, lastMci);
      this.logger.log(`Processing ${responses.length} historical responses for AA ${aa}`);

      const batchSize = 50;
      const batches = Math.ceil(responses.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, responses.length);
        const batchResponses = responses.slice(start, end);

        for (const response of batchResponses) {
          await this.handleAAResponse(response, false);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing historical responses for AA ${aa}: ${error.message}`);
    }
  }
}
