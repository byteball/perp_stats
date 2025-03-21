export interface Price {
  usdPrice: number;
  asset: string;
  priceInReserve: number;
}

export interface PerpetualStat {
  aa: string;
  prices: Price[];
}
