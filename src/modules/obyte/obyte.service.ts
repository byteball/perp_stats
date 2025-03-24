import { Injectable, Logger } from '@nestjs/common';
import { ObyteNetworkService } from './obyte-network.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ObyteService {
  private readonly logger = new Logger(ObyteService.name);
  private exchangeRates: Record<string, number> = {};

  constructor(
    private readonly obyteNetworkService: ObyteNetworkService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.scheduleExchangeRatesUpdate();
  }

  async getPythAddresses(): Promise<string[]> {
    const baseAAs = this.configService.get<string[]>('obyte.baseAAs', []);
    return this.obyteNetworkService.getAAsFromBaseAAs(baseAAs);
  }

  async updateExchangeRates(): Promise<void> {
    try {
      this.exchangeRates = await this.getExchangeRates();
      this.logger.debug('Exchange rates updated');
    } catch (error) {
      this.logger.error(`Failed to update exchange rates: ${error.message}`);
    }
  }

  private scheduleExchangeRatesUpdate(): void {
    setInterval(() => this.updateExchangeRates(), 1000 * 60 * 5);
  }

  getExchangeRateByAsset(asset: string): number {
    const assetExchangeRate = this.exchangeRates[`${asset}_USD`];

    if (assetExchangeRate === undefined) {
      throw new Error(`${asset} not found in exchange rates`);
    }

    return assetExchangeRate;
  }

  async getExchangeRates(): Promise<Record<string, number>> {
    try {
      return await this.obyteNetworkService.requestFromOcore('hub/get_exchange_rates');
    } catch (error) {
      this.logger.error(`Failed to get exchange rates: ${error.message}`);
      return {};
    }
  }

  async getJoint(unit: string): Promise<any> {
    const cacheKey = `joint_${unit}`;
    return this.cacheService.getOrSet(cacheKey, () => this.obyteNetworkService.requestFromOcore('get_joint', unit));
  }

  async getDataFeed(oracle: string, feedName: string, maxMci?: number, otherParams?: Record<string, number | string>): Promise<any> {
    let params: any = {
      oracles: [oracle],
      feed_name: feedName,
    };

    if (maxMci) {
      params.max_mci = maxMci;
    }

    if (otherParams) {
      params = { ...otherParams };
    }

    return this.obyteNetworkService.requestFromOcore('light/get_data_feed', params);
  }

  async getLastMCI() {
    return this.obyteNetworkService.requestFromOcore('get_last_mci');
  }

  async getAllAAResponses(aa: string, lastMci: number): Promise<any[]> {
    const allResponses: any[] = [];
    let latestMci = lastMci || 0;

    while (true) {
      const responses = await this.getAAResponses(aa, latestMci);
      if (responses.length === 0) break;
      allResponses.push(...responses);

      if (responses.length < 100) break;
      latestMci = responses[responses.length - 1].mci + 1;
    }

    return allResponses;
  }

  private async getAAResponses(aa: string, latestMci?: number): Promise<any[]> {
    const params: any = {
      aa: aa,
      order: 'ASC',
    };

    if (latestMci) {
      params.min_mci = latestMci;
    }

    const cacheKey = `aa_responses_${aa}${latestMci ? `_${latestMci}` : ''}`;
    return this.cacheService.getOrSet(cacheKey, () => this.obyteNetworkService.requestFromOcore('light/get_aa_responses', params));
  }
}
