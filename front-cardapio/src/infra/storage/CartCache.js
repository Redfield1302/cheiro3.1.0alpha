import { StorageCache } from "./StorageCache";

const localStorage = window.localStorage;
const localStorageCache = new StorageCache(localStorage);

export class CartCache {
    constructor(tenantSlug) {
        this.tenantSlug = tenantSlug;
        this.cacheKey = `cart_${tenantSlug}`;
    }

    set(cart) {
        localStorageCache.set(this.cacheKey, cart);
    }

    get() {
        return localStorageCache.get(this.cacheKey);
    }

    clear() {
        localStorageCache.remove(this.cacheKey);
    }
}
