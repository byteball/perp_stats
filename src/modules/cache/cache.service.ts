import { Injectable } from '@nestjs/common';

interface CacheItem<T> {
  value: T;
}

@Injectable()
export class CacheService {
  private cache = new Map<string, CacheItem<any>>();

  get<T>(key: string): T | undefined {
    const item = this.cache.get(key);

    if (!item) {
      return undefined;
    }

    return item.value as T;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
    });
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const cachedValue = this.get<T>(key);

    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const value = await factory();
    this.set(key, value);
    return value;
  }
}
