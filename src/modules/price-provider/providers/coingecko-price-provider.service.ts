import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbstractPriceProviderService } from './abstract-price-provider.service';
import { PriceData, PriceProviderParams } from '../interfaces/price-provider.interface';

interface MarketChartRangeResponse {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][]; // [timestamp, market_cap]
  total_volumes: [number, number][]; // [timestamp, volume]
}

@Injectable()
export class CoinGeckoPriceProviderService implements AbstractPriceProviderService {
  private readonly logger = new Logger(CoinGeckoPriceProviderService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  private readonly symbolToIdMap: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    GBYTE: 'byteball',
    USDC: 'usd-coin',
    USDT: 'tether',
    BNB: 'binancecoin',
    XRP: 'ripple',
    ADA: 'cardano',
    SOL: 'solana',
    AVAX: 'avalanche-2',
    MATIC: 'matic-network',
    DOT: 'polkadot',
    LINK: 'chainlink',
    UNI: 'uniswap',
    AAVE: 'aave',
    WBTC: 'wrapped-bitcoin',
    WETH: 'weth',
  };

  private readonly brokenAssetSymbol: string = 'BBD';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('COINGECKO_TOKEN');

    if (!this.apiKey) {
      this.logger.warn('COINGECKO_TOKEN is not set in the environment variables');
    }
  }

  async getMarketChartRange(params: PriceProviderParams): Promise<PriceData[]> {
    try {
      const { symbol, vsCurrency, from, to } = params;
      const coinId = this.getCoinIdBySymbol(symbol);

      if (!coinId) {
        return [];
      }

      const url = `${this.baseUrl}/coins/${coinId}/market_chart/range?vs_currency=${vsCurrency}&from=${from}&to=${to}`;

      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...(this.apiKey ? { 'x-cg-demo-api-key': this.apiKey } : {}),
        },
      };

      this.logger.log(`Fetching market chart data for ${coinId} from ${from} to ${to}`);
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json();
        throw new HttpException(
          `CoinGecko API error: ${errorData.error || 'Unknown error'}`,
          response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const data: MarketChartRangeResponse = await response.json();

      // Transform the response to a more usable format
      return data.prices.map(([timestamp, price]) => ({
        timestamp: Math.floor(timestamp / 1000),
        price,
      }));
    } catch (error) {
      this.logger.error(`Error fetching market chart data: ${error.message}`, error.stack);
      throw new HttpException(`Failed to fetch data from CoinGecko: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private getCoinIdBySymbol(symbol: string): string | null {
    const upperSymbol = symbol.toUpperCase();

    if (upperSymbol === this.brokenAssetSymbol) {
      return null;
    }

    const coinId = this.symbolToIdMap[upperSymbol] || null;

    if (!coinId) {
      this.logger.error(`No CoinGecko mapping found for symbol: ${symbol}`);
      process.exit(1);
    }

    return coinId;
  }
}
