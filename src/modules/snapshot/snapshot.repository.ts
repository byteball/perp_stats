import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as db from 'ocore/db';
import { SnapshotDto } from './dto/shapshot.dto';
import { HourlyPriceResponseDto } from '../api/dto/hourly-prices.dto';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

@Injectable()
export class SnapshotRepository {
  private readonly logger = new Logger(SnapshotRepository.name);

  async getAssetsByPyth(pyth: string): Promise<string[]> {
    try {
      const rows = await db.query('SELECT DISTINCT asset FROM perp_price_history WHERE aa_address = ?', [pyth]);

      return rows.map((row: { asset: string }) => row.asset);
    } catch (error) {
      this.logger.error(`Error getting assets by Pyth: ${error.message}`, error.stack);

      throw new InternalServerErrorException('Failed to retrieve assets by Pyth');
    }
  }

  async getLastTimestamp(): Promise<number> {
    try {
      const rows = await db.query('SELECT timestamp FROM snapshot_history ORDER BY timestamp DESC LIMIT 1');
      return rows[0]?.timestamp || 0;
    } catch (error) {
      this.logger.error(`Error getting last timestamp: ${error.message}`, error.stack);

      throw new InternalServerErrorException('Failed to retrieve last timestamp');
    }
  }

  async saveSnapshot(data: SnapshotDto): Promise<boolean> {
    try {
      await db.query(
        `INSERT OR IGNORE INTO snapshot_history 
        (aa_address, asset, is_realtime, usd_price, timestamp) 
        VALUES (?, ?, ?, ?, ?)`,
        [data.aaAddress, data.asset, data.isRealtime, data.usdPrice, data.timestamp],
      );

      return true;
    } catch (error) {
      this.logger.error(`Error saving snapshot data: ${error.message}`, error.stack);

      return false;
    }
  }

  async saveSnapshotsInBulk(records: SnapshotDto[]): Promise<void> {
    const conn = await db.takeConnectionFromPool();
    try {
      await conn.query(`BEGIN TRANSACTION`);

      for (const data of records) {
        await conn.query(
          `INSERT OR IGNORE INTO snapshot_history 
          (aa_address, asset, is_realtime, usd_price, timestamp) 
          VALUES (?, ?, ?, ?, ?)`,
          [data.aaAddress, data.asset, data.isRealtime, data.usdPrice, data.timestamp],
        );
      }

      await conn.query(`COMMIT`);
      this.logger.log(`Successfully saved ${records.length} snapshot records in bulk`);
    } catch (error) {
      await conn.query(`ROLLBACK`);
      this.logger.error(`Error saving snapshots in bulk: ${error.message}`, error.stack);
    } finally {
      conn.release();
    }
  }

  async getLastWeekPrices(asset: string, tzOffset?: number): Promise<HourlyPriceResponseDto[]> {
    try {
      const tzOffsetInHours = tzOffset ? tzOffset / 60 : 0;

      const startTimestamp = dayjs()
        .utc()
        .subtract(7, 'day')
        .hour(0)
        .minute(0)
        .second(0)
        .millisecond(0)
        .subtract(-tzOffsetInHours, 'hour')
        .unix();

      const query = `
        SELECT 
          usd_price as price, timestamp
        FROM snapshot_history
          WHERE asset = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `;

      return await db.query(query, [asset, startTimestamp]);
    } catch (error) {
      this.logger.error(`Error getting last week's prices: ${error.message}`, error.stack);

      throw new InternalServerErrorException('Failed to retrieve last week price data');
    }
  }

  async getLastMonthPrices(asset: string): Promise<HourlyPriceResponseDto[]> {
    try {
      const startTimestamp = dayjs().utc().subtract(30, 'day').unix();
      this.logger.log(`Getting last month prices for asset: ${asset} from timestamp: ${startTimestamp}`);

      const query = `
        SELECT 
          usd_price as price, timestamp
        FROM perp_price_history
        WHERE asset = ? 
        AND timestamp >= ?
        AND timestamp IN (
          SELECT MIN(timestamp)
          FROM perp_price_history
          WHERE asset = ?
          AND timestamp >= ?
          GROUP BY date(timestamp, 'unixepoch')
        )
        ORDER BY timestamp ASC
      `;

      return await db.query(query, [asset, startTimestamp, asset, startTimestamp]);
    } catch (error) {
      this.logger.error(`Error getting last month's prices: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve last month price data');
    }
  }
}
