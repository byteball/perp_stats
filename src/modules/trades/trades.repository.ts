import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as db from 'ocore/db';
import type { TradeDto } from './dto/trades.dto';

@Injectable()
export class TradesRepository {
  private readonly logger = new Logger(TradesRepository.name);

  async saveTrade(data: TradeDto): Promise<boolean> {
    try {
      await db.query(
        `INSERT OR IGNORE INTO trades_history 
        (aa_address, trigger_unit, mci, asset, is_realtime, usd_price, price_in_reserve, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.aaAddress, data.triggerUnit, data.mci, data.asset, data.isRealtime, data.usdPrice, data.priceInReserve, data.timestamp],
      );

      return true;
    } catch (error) {
      this.logger.error(`Error saving trade data: ${error.message}`, error.stack);

      return false;
    }
  }

  async getLastPriceInReserve(pyth: string, asset: string): Promise<number> {
    try {
      const rows = await db.query(
        `SELECT price_in_reserve FROM trades_history 
        WHERE aa_address = ? AND asset = ?
        ORDER BY timestamp DESC LIMIT 1`,
        [pyth, asset],
      );

      return rows[0]?.price_in_reserve || 0;
    } catch (error) {
      this.logger.error(`Error getting last price from response for Pyth: ${pyth}, asset: ${asset}: ${error.message}`, error.stack);

      throw new InternalServerErrorException('Failed to retrieve last price from response');
    }
  }

  async getLastMci(): Promise<number> {
    try {
      const rows = await db.query('SELECT mci as last_mci FROM trades_history ORDER BY mci DESC LIMIT 1');

      return rows[0]?.last_mci || 0;
    } catch (error) {
      this.logger.error(`Error getting last MCI: ${error.message}`, error.stack);

      return 0;
    }
  }
}
