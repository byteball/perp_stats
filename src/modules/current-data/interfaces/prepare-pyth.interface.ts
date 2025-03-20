export interface Price {
  usdPrice: number;
  asset: string;
}

export interface PerpetualStat {
  aa: string;
  prices: Price[];
  priceInReserve: number;
}
