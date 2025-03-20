import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SnapshotRepository } from './snapshot.repository';
import { OdappService } from '../odapp/odapp.service';
import { AbstractPriceProviderService } from '../price-provider/providers/abstract-price-provider.service';
import { PriceProviderParams, PriceData } from '../price-provider/interfaces/price-provider.interface';
import { SnapshotDto } from './dto/shapshot.dto';
import { TradesService } from '../trades/trades.service';
import { getTimestamp30DaysAgo } from 'src/utils/date.utils';
import { ObyteService } from '../obyte/obyte.service';
import { HourlyPriceResponseDto } from '../api/dto/hourly-prices.dto';

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    private readonly obyteService: ObyteService,
    private readonly odappService: OdappService,
    private readonly snapshotRepository: SnapshotRepository,
    private readonly priceProvider: AbstractPriceProviderService,
    private readonly tradesService: TradesService,
  ) {
    this.initFillPythHistory();
  }

  async saveSnapshot(priceData: SnapshotDto) {
    await this.snapshotRepository.saveSnapshot(priceData);
  }

  async getLastWeekPrices(asset: string, tzOffset?: number): Promise<HourlyPriceResponseDto[]> {
    return this.snapshotRepository.getLastWeekPrices(asset, tzOffset);
  }

  async getLastMonthPrices(asset: string): Promise<HourlyPriceResponseDto[]> {
    return this.snapshotRepository.getLastMonthPrices(asset);
  }

  private async initFillPythHistory() {
    const lastTimestamp = await this.snapshotRepository.getLastTimestamp();
    const timestamp30DaysAgo = getTimestamp30DaysAgo();

    const pythAddresses = await this.obyteService.getPythAddresses();

    const startTimestamp = lastTimestamp > timestamp30DaysAgo ? lastTimestamp : timestamp30DaysAgo;

    this.logger.log(`Starting to fill Pyth history from ${startTimestamp} to ${Math.floor(Date.now() / 1000)}`);

    this.logger.log(`Found ${pythAddresses.length} Pyth addresses`);
    for (const pythAddress of pythAddresses) {
      await this.fillPythHistory(pythAddress, startTimestamp);
    }
  }

  private async getAssetsByPyth(pyth: string): Promise<string[]> {
    const vars = await this.odappService.getAAStateVars(pyth);
    this.logger.debug(`Vars for Pyth ${pyth}: ${JSON.stringify(vars)}`);
    if (vars.error) {
      this.logger.error(`Error getting assets by Pyth: ${pyth} ${vars.error}`);
      throw new InternalServerErrorException('Failed to retrieve assets by Pyth');
    }

    const assets = [vars['state'].asset0];
    const keys = Object.keys(vars);
    for (const key of keys) {
      if (key.startsWith('asset_')) {
        assets.push(key.split('_')[1]);
      }
    }

    return assets;
  }

  private async fillPythHistory(pythAddress: string, startTimestamp: number): Promise<void> {
    const endTimestamp = Math.floor(Date.now() / 1000);

    const aaDefinition = await this.odappService.getDefinition(pythAddress);
    if (!aaDefinition || !aaDefinition[1] || !aaDefinition[1].params) return;

    const reserve_price_aa = aaDefinition[1].params.reserve_price_aa;
    const reserve_price_aa_definition = await this.odappService.getDefinition(reserve_price_aa);
    if (!reserve_price_aa_definition || !reserve_price_aa_definition[1]) return;

    const feedName = reserve_price_aa_definition[1].params.feed_name;
    if (!feedName) {
      this.logger.warn(`No feed_name found for reserve_price_aa ${reserve_price_aa}`);
      return;
    }

    const symbol = feedName.split('_')[0];

    this.logger.log(`Fetching price data for ${symbol} from ${startTimestamp} to ${endTimestamp}`);

    const params: PriceProviderParams = {
      symbol,
      vsCurrency: 'usd',
      from: startTimestamp,
      to: endTimestamp,
    };

    try {
      const priceData: PriceData[] = await this.priceProvider.getMarketChartRange(params);

      this.logger.log(`Fetched price data for ${symbol} from ${startTimestamp} to ${endTimestamp}: ${priceData?.length || 0} points`);

      if (!priceData || priceData.length === 0) {
        this.logger.warn(`No price data returned for ${symbol}`);
        return;
      }

      const assets = await this.getAssetsByPyth(pythAddress);
      if (!assets || assets.length === 0) {
        this.logger.warn(`No assets found for Pyth address ${pythAddress}`);
        return;
      }

      this.logger.log(`Found ${assets.length} assets for Pyth ${pythAddress}: ${assets.join(', ')}`);

      for (const asset of assets) {
        this.logger.log(`Processing price data for ${asset} from ${pythAddress}`);
        await this.fillAssetHistory(pythAddress, asset, priceData);
        this.logger.log(`Finished processing price data for ${asset} from ${pythAddress}`);
      }
    } catch (error) {
      this.logger.error(`Error in fillPythHistory: ${error.message}`, error.stack);
    }
  }

  private async fillAssetHistory(pythAddress: string, asset: string, priceData: PriceData[]): Promise<void> {
    try {
      const priceInReserve = await this.tradesService.getLastPriceInReserve(pythAddress, asset);
      this.logger.log(`Last price in reserve for ${asset}: ${priceInReserve}`);
      this.logger.log(`Processing ${priceData.length} price points for asset ${asset}`);

      const dataForSave: SnapshotDto[] = [];
      for (const data of priceData) {
        const { timestamp, price: reservePrice } = data;
        const usdPrice = reservePrice * priceInReserve;

        dataForSave.push({
          aaAddress: pythAddress,
          asset,
          isRealtime: 0,
          priceInReserve,
          usdPrice,
          timestamp,
        });
      }

      if (!dataForSave.length) {
        this.logger.log(`No data to save for asset ${asset}`);
      }

      this.logger.log(`Saving ${dataForSave.length} price points for asset ${asset}`);

      await this.snapshotRepository.saveSnapshotsInBulk(dataForSave);
    } catch (error) {
      this.logger.error(`Error in fillAssetHistory for ${asset}: ${error.message}`, error.stack);
    }
  }
}
