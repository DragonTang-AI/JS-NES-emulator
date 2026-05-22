class RomManager {
  constructor() {
    this.db = null;
    this.dbName = "nes-roms";
    this.storeName = "roms";
    this.version = 1;
    this.favorites = new Set();
    this.favoritesKey = "nes-favorites";
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "name" });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        this._loadFavorites();
        resolve();
      };
      request.onerror = (e) => {
        reject(new Error("Failed to open IndexedDB"));
      };
    });
  }

  _loadFavorites() {
    try {
      const data = localStorage.getItem(this.favoritesKey);
      if (data) {
        const arr = JSON.parse(data);
        this.favorites = new Set(arr);
      }
    } catch (e) {
      console.warn("Failed to load favorites:", e);
      this.favorites = new Set();
    }
  }

  _saveFavorites() {
    try {
      localStorage.setItem(this.favoritesKey, JSON.stringify([...this.favorites]));
    } catch (e) {
      console.warn("Failed to save favorites:", e);
    }
  }

  isFavorite(name) {
    return this.favorites.has(name);
  }

  toggleFavorite(name) {
    if (this.favorites.has(name)) {
      this.favorites.delete(name);
    } else {
      this.favorites.add(name);
    }
    this._saveFavorites();
    return this.favorites.has(name);
  }

  getFavorites() {
    return [...this.favorites];
  }

  async handleFileUpload(file) {
    if (!file.name.endsWith(".nes")) {
      throw new Error("Please upload a .nes file");
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target.result;
          await this.saveROM(file.name, data);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsBinaryString(file);
    });
  }

  async saveROM(name, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ name, data, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to save ROM"));
    });
  }

  async getROM(name) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(name);
      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = () => reject(new Error("Failed to get ROM"));
    });
  }

  async listROMs(filter = "all") {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        let roms = request.result || [];
        roms.sort((a, b) => b.timestamp - a.timestamp);
        if (filter === "favorites") {
          roms = roms.filter(r => this.favorites.has(r.name));
        }
        resolve(roms.map(r => ({
          name: r.name,
          timestamp: r.timestamp,
          favorite: this.favorites.has(r.name)
        })));
      };
      request.onerror = () => reject(new Error("Failed to list ROMs"));
    });
  }

  async deleteROM(name) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(name);
      request.onsuccess = () => {
        this.favorites.delete(name);
        this._saveFavorites();
        resolve();
      };
      request.onerror = () => reject(new Error("Failed to delete ROM"));
    });
  }
}
