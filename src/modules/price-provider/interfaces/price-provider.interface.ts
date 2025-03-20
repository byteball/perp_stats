export interface PriceProviderParams {
  symbol: string;
  vsCurrency: string;
  from: number; // Unix timestamp
  to: number; // Unix timestamp
}

export interface PriceData {
  timestamp: number;
  price: number;
}

export interface IPriceProvider {
  getMarketChartRange(params: PriceProviderParams): Promise<PriceData[]>;
}
