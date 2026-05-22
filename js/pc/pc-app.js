class PCApp {
  constructor() {
    this.emulator = null;
    this.romManager = null;
    this.saveManager = null;
    this.statusEl = document.getElementById("status");
    this.fileInput = document.getElementById("rom-upload");
    this.romListEl = document.getElementById("rom-list");
    this.loadingOverlay = document.getElementById("loading-overlay");
    this.loadingBar = document.getElementById("loading-bar");
    this.loadingText = document.getElementById("loading-text");
    this.currentFilter = "all";
    this.currentRom = null;
        this.bundledROMs = [
      { name: "MitsumeGaTooru.nes", url: "/roms/MitsumeGaTooru.nes", label: "三目童子" },
      { name: "Mitsume ga Tooru (Japan).nes", url: "/roms/Mitsume ga Tooru (Japan).nes", label: "三目通 (日版)" },
      { name: "2010 Street Fighter (Japan) (Beta).nes", url: "/roms/2010 Street Fighter (Japan) (Beta).nes", label: "2010 街头霸王" },
      { name: "Colour 2001 Streetfighter II (Asia) (En) (Pirate).nes", url: "/roms/Colour 2001 Streetfighter II (Asia) (En) (Pirate).nes", label: "2001 街头霸王II" },
      { name: "Crystalis (USA, Europe) (SNK 40th Anniversary Collection).nes", url: "/roms/Crystalis (USA, Europe) (SNK 40th Anniversary Collection).nes", label: "水晶之剑" },
    ];
  }

  async init() {
    this.emulator = new Emulator("nes-container", {
      onStatusUpdate: (msg) => this.updateStatus(msg),
      onError: (e) => this.handleError(e),
      onReady: () => this._onEmulatorReady(),
      onLoading: (percent, text) => this._updateLoading(percent, text),
    });

    this.romManager = new RomManager();
    this.saveManager = new SaveManager(this.emulator, "nes-container");

    try {
      await this.emulator.init();
      await this.romManager.init();
      this.saveManager.init();
      this.updateStatus("Ready. Select a ROM to play.");
      this.bindEvents();
      await this.refreshRomList();
      
      const urlParams = new URLSearchParams(window.location.search);
      const romParam = urlParams.get("rom");
      const nameParam = urlParams.get("name");
      
      if (romParam && nameParam) {
        this.loadGameFromURL(romParam, nameParam);
      } else {
        this.loadBundledROM();
      }
    } catch (e) {
      this.handleError(e);
    }
  }

  _onEmulatorReady() {
    window.addEventListener("resize", () => {
      this.emulator.fitInParent();
    });
  }

  _updateLoading(percent, text) {
    if (percent > 0) {
      this.loadingOverlay.classList.remove("hidden");
    }
    this.loadingBar.style.width = percent + "%";
    this.loadingText.textContent = text;
    if (percent >= 100) {
      setTimeout(() => {
        this.loadingOverlay.classList.add("hidden");
      }, 500);
    }
  }

  loadBundledROM() {
    if (this.bundledROMs.length > 0) {
      const rom = this.bundledROMs[0];
      this.currentRom = rom.label;
      this.emulator.loadROMFromURL(rom.url, rom.label, (err) => {
        if (!err) {
          this.emulator.fitInParent();
        }
      });
    }
  }

  loadGameFromURL(romParam, nameParam) {
    if (romParam.startsWith("/")) {
      this.emulator.loadROMFromURL(romParam, nameParam, (err) => {
        if (!err) {
          this.emulator.fitInParent();
          this.currentRom = nameParam;
          this.refreshRomList();
        }
      });
    } else {
      this.romManager.getROM(romParam).then(data => {
        if (data) {
          this.emulator.loadROM(data, nameParam);
          this.emulator.fitInParent();
          this.currentRom = nameParam;
          this.refreshRomList();
        } else {
          this.updateStatus("ROM not found: " + nameParam);
          this.loadBundledROM();
        }
      }).catch(err => {
        console.error("Failed to load ROM:", err);
        this.updateStatus("Failed to load ROM: " + nameParam);
        this.loadBundledROM();
      });
    }
  }

  bindEvents() {
    document.getElementById("upload-btn").addEventListener("click", () => {
      this.fileInput.click();
    });

    document.getElementById("fullscreen-btn").addEventListener("click", () => {
      this.emulator.toggleFullscreen();
    });

    document.getElementById("save-btn").addEventListener("click", () => {
      this.saveManager.open();
    });

    document.getElementById("screenshot-btn").addEventListener("click", () => {
      const dataUrl = this.emulator.screenshot();
      if (dataUrl) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "nes-screenshot.png";
        a.click();
        this.updateStatus("Screenshot saved!");
      }
    });

    document.getElementById("filter-all").addEventListener("click", () => {
      this.setFilter("all");
    });

    document.getElementById("filter-favorites").addEventListener("click", () => {
      this.setFilter("favorites");
    });

    this.fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await this.romManager.handleFileUpload(file);
        this.emulator.loadROM(data, file.name);
        this.currentRom = file.name;
        await this.refreshRomList();
      } catch (err) {
        this.handleError(err);
      }
      this.fileInput.value = "";
    });
  }

  setFilter(filter) {
    this.currentFilter = filter;
    document.getElementById("filter-all").classList.toggle("active", filter === "all");
    document.getElementById("filter-favorites").classList.toggle("active", filter === "favorites");
    this.refreshRomList();
  }

  async refreshRomList() {
    try {
      const roms = await this.romManager.listROMs(this.currentFilter);
      this.romListEl.innerHTML = "";

      this.bundledROMs.forEach((rom) => {
        const item = this.createRomItem(rom.label, rom.url, true, false);
        this.romListEl.appendChild(item);
      });

      if (roms.length === 0 && this.currentFilter === "all") {
        const span = document.createElement("span");
        span.textContent = "No user ROMs uploaded yet.";
        span.className = "rom-empty";
        this.romListEl.appendChild(span);
      } else if (roms.length === 0 && this.currentFilter === "favorites") {
        const span = document.createElement("span");
        span.textContent = "No favorites yet. Click ★ to add.";
        span.className = "rom-empty";
        this.romListEl.appendChild(span);
      } else {
        roms.forEach((rom) => {
          const item = this.createRomItem(rom.name, null, false, rom.favorite);
          this.romListEl.appendChild(item);
        });
      }
    } catch (e) {
      console.warn("Failed to list ROMs:", e);
    }
  }

  createRomItem(name, url, isBundled, isFavorite) {
    const item = document.createElement("div");
    item.className = "rom-item" + (this.currentRom === name ? " active" : "");

    const favBtn = document.createElement("button");
    favBtn.className = "fav-btn" + (isFavorite ? " favorited" : "");
    favBtn.textContent = isFavorite ? "★" : "☆";
    favBtn.title = isFavorite ? "Remove from favorites" : "Add to favorites";
    favBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newFav = this.romManager.toggleFavorite(name);
      favBtn.textContent = newFav ? "★" : "☆";
      favBtn.classList.toggle("favorited", newFav);
      this.updateStatus(newFav ? name + " added to favorites" : name + " removed from favorites");
      if (this.currentFilter === "favorites" && !newFav) {
        this.refreshRomList();
      }
    });

    const playBtn = document.createElement("button");
    playBtn.className = "rom-name";
    playBtn.textContent = (isBundled ? " " : "") + name;
    playBtn.addEventListener("click", async () => {
      if (isBundled && url) {
        this.emulator.loadROMFromURL(url, name, (err) => {
          if (!err) this.emulator.fitInParent();
        });
      } else {
        const data = await this.romManager.getROM(name);
        if (data) {
          this.emulator.loadROM(data, name);
          this.emulator.fitInParent();
        }
      }
      this.currentRom = name;
      this.refreshRomList();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "del-btn";
    delBtn.textContent = "×";
    delBtn.title = "Delete ROM";
    if (isBundled) {
      delBtn.style.display = "none";
    }
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Delete " + name + "?")) {
        await this.romManager.deleteROM(name);
        this.updateStatus(name + " deleted");
        this.refreshRomList();
      }
    });

    item.appendChild(favBtn);
    item.appendChild(playBtn);
    item.appendChild(delBtn);

    return item;
  }

  updateStatus(msg) {
    this.statusEl.textContent = msg;
  }

  handleError(e) {
    console.error(e);
    this.updateStatus("Error: " + e.message);
    this.loadingOverlay.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new PCApp();
  window.app.init();
});
