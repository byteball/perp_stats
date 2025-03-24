import { PriceData } from '../price-provider/interfaces/price-provider.interface';

export class PreparePriceData {
  private readonly priceData: PriceData[];
  private readonly hoursRange: number[];

  constructor(priceData: PriceData[], hoursRange: number[]) {
    this.priceData = priceData;
    this.hoursRange = hoursRange;
  }

  public prepare(): PriceData[] {
    if (!this.priceData.length || !this.hoursRange.length) {
      throw new Error('No price data or hours range provided');
    }

    const result: PriceData[] = [];
    let currentIndex = 0;

    for (const hour of this.hoursRange) {
      let closestIndex = -1;

      for (let i = currentIndex; i < this.priceData.length; i++) {
        if (this.priceData[i].timestamp <= hour) {
          closestIndex = i;
        } else {
          break;
        }
      }

      if (closestIndex !== -1) {
        result.push({
          timestamp: hour,
          price: this.priceData[closestIndex].price,
        });
        currentIndex = closestIndex;
      }
    }

    return result;
  }
}
