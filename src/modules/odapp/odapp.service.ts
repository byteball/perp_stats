import { Injectable } from '@nestjs/common';
import oDapp from 'odapp';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class OdappService {
  private odapp: oDapp;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    const network = process.env.NETWORK || this.configService.get<string>('NETWORK');
    const endpoint = network === 'mainnet' ? 'https://dapp.obyte.org' : 'https://odapp-t.aa-dev.net';
    this.odapp = new oDapp(endpoint, true);
  }

  async getAAsByBaseAAsWithVars(baseAAs: string[]) {
    return this.odapp.getAAsByBaseAAsWithVars(baseAAs);
  }

  async getDefinitions(aas: string[]) {
    const result: Record<string, any> = {};
    const uncachedAAs: string[] = [];

    for (const aa of aas) {
      const cacheKey = `definition_${aa}`;
      const cachedDefinition = this.cacheService.get(cacheKey);
      if (cachedDefinition !== undefined) {
        result[aa] = cachedDefinition;
      } else {
        uncachedAAs.push(aa);
      }
    }

    if (uncachedAAs.length > 0) {
      const freshDefinitions = await this.odapp.getDefinitions(uncachedAAs);

      for (const aa of uncachedAAs) {
        if (freshDefinitions[aa]) {
          const cacheKey = `definition_${aa}`;
          this.cacheService.set(cacheKey, freshDefinitions[aa]);
          result[aa] = freshDefinitions[aa];
        }
      }
    }
    return result;
  }

  async getDefinition(aa: string) {
    const cacheKey = `definition_${aa}`;

    return this.cacheService.getOrSet(cacheKey, () => this.odapp.getDefinition(aa));
  }

  async getAAsStateVars(aas: string[]) {
    return this.odapp.getAAsStateVars(aas);
  }

  async getAAStateVars(aa: string) {
    return this.odapp.getAAStateVars(aa);
  }

  async getDataFeed(oracles: string[], feedName: string) {
    return this.odapp.getDataFeed(oracles, feedName);
  }

  async getAssetsMetadata(assets: string[]) {
    const result: Record<string, any> = {};
    const uncachedAssets: string[] = [];

    for (const asset of assets) {
      const cacheKey = `asset_metadata_${asset}`;
      const cachedMetadata = this.cacheService.get(cacheKey);
      if (cachedMetadata !== undefined) {
        result[asset] = cachedMetadata;
      } else {
        uncachedAssets.push(asset);
      }
    }

    if (uncachedAssets.length > 0) {
      const freshMetadata = await this.odapp.getAssetsMetadata(uncachedAssets);

      for (const asset of uncachedAssets) {
        if (freshMetadata[asset]) {
          const cacheKey = `asset_metadata_${asset}`;
          this.cacheService.set(cacheKey, freshMetadata[asset]);
          result[asset] = freshMetadata[asset];
        }
      }
    }
    return result;
  }

  async getBalances(addresses: string[]) {
    return this.odapp.getBalances(addresses);
  }
}
