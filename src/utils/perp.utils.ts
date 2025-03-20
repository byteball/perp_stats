import dayjs from 'dayjs';

export function getNotDefaultAssetsFromMeta(metaByAA: Record<string, any>) {
  const keys = Object.keys(metaByAA);
  const assets: string[] = [];

  keys.forEach(key => {
    if (key.startsWith('asset_')) {
      const asset = key.substring(6);
      assets.push(asset);
    }
  });

  return assets;
}

export function isBrokenPresale(meta: Record<string, any>, presalePeriod: number) {
  const presaleStartTimestamp = meta.creation_ts;
  const finishDate = dayjs((presaleStartTimestamp + presalePeriod) * 1000);
  return !meta.presale_amount && finishDate.diff(dayjs()) < 0;
}
