import { Injectable } from '@nestjs/common';
import { getParam } from 'src/utils/getParam.utils';
import { getNotDefaultAssetsFromMeta, isBrokenPresale } from 'src/utils/perp.utils';
import { PerpetualStat } from './interfaces/prepare-pyth.interface';
import { OdappService } from '../odapp/odapp.service';

@Injectable()
export class PreparePythService {
  private assetsCache: Record<string, any> = {};

  constructor(private readonly odappService: OdappService) {}

  async prepareMetaByAA(metaByAA: Record<string, any>): Promise<PerpetualStat> {
    const assets = getNotDefaultAssetsFromMeta(metaByAA);
    const presalePeriod = getParam('presale_period', metaByAA);

    const reservePriceAA = metaByAA.reserve_price_aa;
    const { asset0 } = metaByAA.state;

    const assetList = [asset0];

    const priceInReserve = await this.getReservePrice(reservePriceAA);

    const _assets = {};

    for (const asset of assets) {
      const m = metaByAA[`asset_${asset}`];
      if (m.presale && isBrokenPresale(m, presalePeriod)) {
        continue;
      }

      _assets[asset] = {
        ...m,
      };
    }

    for (const asset in _assets) {
      const { supply } = _assets[asset];
      if (!supply) continue;

      assetList.push(asset);
    }

    const metaByAsset = await this.getAssetsMetadata(assetList);
    const r = await this.getPriceByAssets(metaByAA.aa, assetList, metaByAA);

    let asset0Price = 0;
    const ps: { usdPrice: number; asset: string }[] = [];
    for (const asset in r) {
      if (!metaByAsset[asset]) continue;
      const price = r[asset];

      let priceInUSD = price * priceInReserve; // raw price in usd
      priceInUSD *= 10 ** (metaByAsset[asset].decimals || 0); // price in usd with decimals

      if (asset === asset0) {
        asset0Price = priceInUSD;
      } else {
        ps.push({ usdPrice: priceInUSD, asset });
      }
    }

    return {
      aa: metaByAA.aa,
      prices: [{ usdPrice: asset0Price, asset: asset0 }, ...ps],
      priceInReserve,
    };
  }

  async getReservePrice(aa: string) {
    try {
      const def = await this.odappService.getDefinition(aa);
      const params = def[1].params;
      if (params.oswap_aa) {
        const oswapDef = await this.odappService.getDefinition(params.oswap_aa);
        const oswapParams = oswapDef[1].params;
        const balances = await this.odappService.getBalances([params.oswap_aa]);
        const vars = await this.odappService.getAAStateVars(params.oswap_aa);

        const xAsset = oswapParams.x_asset || 'base';
        const yAsset = oswapParams.y_asset || 'base';
        const xBalance = this.getBalanceOrDefault(balances[params.oswap_aa], xAsset);
        const yBalance = this.getBalanceOrDefault(balances[params.oswap_aa], yAsset);
        const lpShares = vars['lp_shares'];
        const supply = lpShares.issued;

        const xRate = await this.getRate(params.x_oracle, params.x_feed_name, params.x_decimals);
        const yRate = await this.getRate(params.y_oracle, params.y_feed_name, params.y_decimals);
        const balance = xBalance * xRate + yBalance * yRate;

        return balance / supply;
      } else {
        return await this.getRate(params.oracle, params.feed_name, params.decimals);
      }
    } catch (error) {
      console.error('Failed to get reserve price:', error);
      throw error;
    }
  }

  getBalanceOrDefault(balances: Record<string, { total: number }>, asset: string) {
    return balances[asset]?.total || 0;
  }

  async getRate(oracle: string, feedName: string, decimals: number) {
    const rate: number = +(await this.odappService.getDataFeed([oracle], feedName));
    return rate / Math.pow(10, decimals || 0);
  }

  async getAssetsMetadata(assets: string[]) {
    const cachedMetadata: Record<string, any> = {};
    const assetsToFetch: string[] = [];

    assets.forEach((asset: string) => {
      if (this.assetsCache[asset]) {
        cachedMetadata[asset] = this.assetsCache[asset];
      } else {
        assetsToFetch.push(asset);
      }
    });

    if (!assetsToFetch.length) {
      return cachedMetadata;
    }

    const fetchedMetadata = await this.odappService.getAssetsMetadata(assetsToFetch);
    Object.assign(this.assetsCache, fetchedMetadata);

    return { ...cachedMetadata, ...fetchedMetadata };
  }

  async getPriceByAssets(aa: string, assets: string[], varsAndParams: Record<string, any>) {
    const { state: initialState } = varsAndParams;
    const priceByAsset: Record<string, number> = {};

    for (const asset of assets) {
      const state = structuredClone(initialState);
      const isAsset0 = state.asset0 === asset;
      const assetInfo = structuredClone(varsAndParams['asset_' + asset]);
      await this.adjustPrices(asset, assetInfo, state, structuredClone(varsAndParams));
      if (!isAsset0 && !assetInfo) continue;

      const reserve = state.reserve;
      if (!reserve) {
        priceByAsset[asset] = 0;
        continue;
      }

      const coef = state.coef;
      const supply = isAsset0 ? state.s0 : assetInfo.supply;
      const a = isAsset0 ? state.a0 : assetInfo.a;
      priceByAsset[asset] = (coef * coef * a * supply) / reserve;
    }

    return priceByAsset;
  }

  async adjustPrices(asset: string, asset_info: Record<string, any>, state: Record<string, any>, varsAndParams: Record<string, any>) {
    const getParameter = (name: string, defaultValue: any) => {
      if (varsAndParams[name] !== undefined) {
        return varsAndParams[name];
      }

      return defaultValue;
    };

    // vars
    const get_token_share_threshold = () => getParameter('token_share_threshold', 0.1); // 10%
    const get_reserve_price_aa = () => getParameter('reserve_price_aa', null);
    const get_adjustment_period = () => getParameter('adjustment_period', 3 * 24 * 3600); // 3 days
    const get_min_s0_share = () => getParameter('min_s0_share', 0.01); // 1%

    // code
    const timestamp = Math.floor(Date.now() / 1000);
    if (state.asset0 === asset) return;

    const elapsed = timestamp - (asset_info.last_ts || 0);
    let target_price, price_aa, new_reserve;
    asset_info.last_ts = timestamp;

    if (asset_info.presale && asset_info.preipo) {
      target_price = asset_info.last_auction_price;
    } else {
      price_aa = asset_info.price_aa;
      if (!price_aa) return;
      target_price = (await this.getTargetPriceByPriceAa(price_aa)) / (await this.getReservePrice(get_reserve_price_aa()));
      if (typeof target_price !== 'number' || target_price < 0) return;
    }

    if (asset_info.presale) {
      if (
        asset_info.presale_amount &&
        (timestamp >= asset_info.presale_finish_ts ||
          asset_info.presale_amount >= get_token_share_threshold() * state.reserve ||
          (asset_info.preipo && asset_info.presale_amount / target_price >= asset_info.max_tokens))
      ) {
        delete asset_info.presale;
        asset_info.initial_price = target_price;
        asset_info.supply = Math.floor(asset_info.presale_amount / target_price);
        asset_info.a = (Math.pow(target_price / state.coef, 2) * state.reserve) / asset_info.presale_amount;
        new_reserve = state.reserve + asset_info.presale_amount;
        state.coef = state.coef * Math.sqrt(new_reserve / state.reserve);
        state.reserve = new_reserve;
      }
      return;
    }

    const r = state.reserve;
    const c = state.coef;
    const s = asset_info.supply;
    const a = asset_info.a;
    const p = (c * c * a * s) / r;
    const s0 = state.s0;

    if (!s) return;

    const full_delta_p = target_price - p;
    const adjustment_period = get_adjustment_period();
    const delta_p = elapsed >= adjustment_period ? full_delta_p : (elapsed / adjustment_period) * full_delta_p;

    //	delta_a = a * delta_p/p; // >= -a
    //	asset_info.a = asset_info.a + delta_a; // stays positive
    //	state.coef = c / sqrt(1 + delta_a * pow2(s * c / r));

    const new_c = c * Math.sqrt(1 - (s * r * delta_p) / (r * r - a * Math.pow(c * s, 2)));

    if (!((new_c - c) * delta_p <= 0)) {
      return { error: 'c should change opposite to p' };
    }

    const new_a = ((p + delta_p) * r) / new_c / new_c / s;

    if (!((new_a - a) * delta_p >= 0)) {
      return { error: 'a should change as p' };
    }

    asset_info.a = new_a;
    state.coef = new_c;

    // apply drift that slowly depreciates p and moves the wealth to s0 holders
    if (asset_info.drift_rate) {
      const relative_price_drift = (elapsed / 360 / 24 / 3600) * asset_info.drift_rate;
      if (relative_price_drift < 1) {
        asset_info.a = asset_info.a * (1 - relative_price_drift);
        state.a0 = state.a0 + Math.pow(s / s0, 2) * asset_info.a * relative_price_drift;
      }
    }

    // keeping s0 share above some minimum
    const a0 = state.a0;
    const c1 = state.coef;
    const s0_share = a0 * Math.pow((s0 * c1) / r, 2);
    let new_a0, new_c2;
    const min_s0_share = get_min_s0_share();
    if (s0_share < min_s0_share) {
      new_a0 = (Math.pow(r / c1 / s0, 2) - a0) / (1 / min_s0_share - 1);
      new_c2 = (r / s0) * Math.sqrt(min_s0_share / new_a0);

      if (!(new_a0 > a0)) return { error: 'a0 should grow' };
      if (!(new_c2 < c)) return { error: 'c should fall' };

      state.a0 = new_a0;
      state.coef = new_c;
    }
  }

  async getTargetPriceByPriceAa(price_aa: string) {
    const def = await this.odappService.getDefinition(price_aa);
    const params = def[1].params;

    return +(await this.odappService.getDataFeed([params.oracle], params.feed_name)) * (params.multiplier || 1);
  }
}
