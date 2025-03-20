import { Injectable } from '@nestjs/common';
import { SnapshotService } from '../snapshot/snapshot.service';
import { HourlyPriceResponseDto } from './dto/hourly-prices.dto';

@Injectable()
export class ApiService {
  constructor(private readonly snapshotService: SnapshotService) {}

  async getLastWeekPrices(asset: string, tzOffset?: number): Promise<HourlyPriceResponseDto[]> {
    return this.snapshotService.getLastWeekPrices(asset, tzOffset);
  }

  async getLastMonthPrices(asset: string): Promise<HourlyPriceResponseDto[]> {
    return this.snapshotService.getLastMonthPrices(asset);
  }
}
