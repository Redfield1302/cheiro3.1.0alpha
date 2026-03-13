
export class StorageCache {
    constructor(storage) {
        this.storage = storage;
    }

    set(key, value) {
        try {
            this.storage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error("Error setting cache item", e);
        }
    }

    get(key) {
        try {
            const item = this.storage.getItem(key);
            return item ? JSON.parse(item) : null;
        }
        catch (e) {
            console.error("Error getting cache item", e);
            return null;
        }
    }

    remove(key) {
        try {
            this.storage.removeItem(key);
        } catch (e) {
            console.error("Error removing cache item", e);
        }
    }

    clear() {
        try {
            this.storage.clear();
        } catch (e) {
            console.error("Error clearing cache", e);
        }
    }
}            

