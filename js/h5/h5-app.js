class H5App {
  constructor() {
    this.settingsKey = "nes-h5-settings-v1";
    this.authTokenKey = "nes-auth-token";
    this.settings = {
      musicEnabled: true,
      volume: 80,
      joystickMode: "floating",
      vibrationEnabled: true,
      showJoystickHint: true,
      pixelFilter: true,
    };
    this.emulator = null;
    this.romManager = null;
    this.saveManager = null;
    this.gamepad = null;
    this.fileInput = document.getElementById("rom-upload");
    this.loadingOverlay = document.getElementById("loading-overlay");
    this.loadingBar = document.getElementById("loading-bar");
    this.loadingText = document.getElementById("loading-text");
    this.virtualGamepad = document.getElementById("virtual-gamepad");
    this.menuToggle = document.getElementById("menu-toggle");
    this.slideMenu = document.getElementById("slide-menu");
    this.slideMenuBackdrop = document.getElementById("slide-menu-backdrop");
    this.slideMenuClose = document.getElementById("slide-menu-close");
    this.slideRomList = document.getElementById("slide-rom-list");
    this.slideStatus = document.getElementById("slide-menu-status");
    this.menuAccount = document.getElementById("menu-account");
    this.menuAccountLabel = document.getElementById("menu-account-label");
    this.menuAccountSubpage = document.getElementById("menu-account-subpage");
    this.menuAuthForm = document.getElementById("menu-auth-form");
    this.menuAuthInfo = document.getElementById("menu-auth-info");
    this.menuAuthUser = document.getElementById("menu-auth-user");
    this.menuUpload = document.getElementById("menu-upload");
    this.menuLibrary = document.getElementById("menu-library");
    this.menuFavorites = document.getElementById("menu-favorites");
    this.menuCheats = document.getElementById("menu-cheats");
    this.cheatLibrary = window.NES_CHEAT_LIBRARY || [];
    this.settingsModal = document.getElementById("settings-modal");
    this.authPromptModal = document.getElementById("auth-prompt-modal");
    this.authPromptClose = document.getElementById("auth-prompt-close");
    this.authPromptLogin = document.getElementById("auth-prompt-login");
    this.authPromptGuest = document.getElementById("auth-prompt-guest");
    this.authUsername = document.getElementById("auth-username");
    this.authPassword = document.getElementById("auth-password");
    this.authLoginBtn = document.getElementById("auth-login-btn");
    this.authRegisterBtn = document.getElementById("auth-register-btn");
    this.authLogoutBtn = document.getElementById("auth-logout-btn");
    this.authSyncBtn = document.getElementById("auth-sync-btn");
    this.currentFilter = null;
    this.currentRom = null;
    this.bundledROMs = [
      { name: "MitsumeGaTooru.nes", url: "/roms/MitsumeGaTooru.nes", label: "三目童子" },
      { name: "Mitsume ga Tooru (Japan).nes", url: "/roms/Mitsume ga Tooru (Japan).nes", label: "三目通 (日版)" },
      { name: "2010 Street Fighter (Japan) (Beta).nes", url: "/roms/2010 Street Fighter (Japan) (Beta).nes", label: "2010 街头霸王" },
      { name: "Colour 2001 Streetfighter II (Asia) (En) (Pirate).nes", url: "/roms/Colour 2001 Streetfighter II (Asia) (En) (Pirate).nes", label: "2001 街头霸王II" },
      { name: "Crystalis (USA, Europe) (SNK 40th Anniversary Collection).nes", url: "/roms/Crystalis (USA, Europe) (SNK 40th Anniversary Collection).nes", label: "水晶之剑" },
    ];
    this.authUI = new AuthUI(this);
    this.cheatUI = new CheatUI(this);
    this.settingsUI = new SettingsUI(this);
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
      this.authUI.init();
      this.cheatUI.init();
      this.settingsUI.init();
      this.bindEvents();
      await this.authUI.restoreAuthSession();
      this.cheatUI.syncCheats();
      this.updateStatus("Ready");
      const loadedFromQuery = await this.loadFromQueryParams();
      if (!loadedFromQuery) {
        this.loadBundledROM();
      }
      this.handleOrientation();
    } catch (e) {
      this.handleError(e);
    }
  }

  _onEmulatorReady() {
    window.addEventListener("resize", () => {
      this.emulator.fitInParent();
      this.handleOrientation();
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
          this.virtualGamepad.hidden = false;
          this.cheatUI.syncCheats();
        }
      });
    }
  }

  async loadFromQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const romParam = params.get("rom");
    const displayName = params.get("name") || romParam;
    if (!romParam) return false;

    try {
      if (romParam.startsWith("/")) {
        this.currentRom = displayName;
        this.emulator.loadROMFromURL(romParam, displayName, (err) => {
          if (!err) {
            this.emulator.fitInParent();
            this.virtualGamepad.hidden = false;
            this.cheatUI.syncCheats();
          }
        });
        return true;
      }

      const data = await this.romManager.getROM(romParam);
      if (data) {
        this.emulator.loadROM(data, displayName || romParam);
        this.currentRom = displayName || romParam;
        this.emulator.fitInParent();
        this.virtualGamepad.hidden = false;
        this.cheatUI.syncCheats();
        return true;
      }
    } catch (e) {
      console.warn("Load from query failed:", e);
    }

    return false;
  }

  handleOrientation() {
    const isLandscape = window.innerWidth > window.innerHeight;
    if (isLandscape) {
      document.body.classList.add("landscape");
      document.body.classList.remove("portrait");
    } else {
      document.body.classList.add("portrait");
      document.body.classList.remove("landscape");
    }
    this.emulator.fitInParent();
  }

  bindEvents() {
    document.addEventListener("contextmenu", (e) => {
      if (!e.target.closest("input, textarea")) {
        e.preventDefault();
      }
    });
    document.addEventListener("selectstart", (e) => {
      if (!e.target.closest("input, textarea")) {
        e.preventDefault();
      }
    });
    document.addEventListener("dragstart", (e) => {
      if (!e.target.closest("input, textarea")) {
        e.preventDefault();
      }
    });

    this.menuToggle.addEventListener("click", () => {
      this.toggleMenu();
    });

    this.slideMenuClose.addEventListener("click", () => {
      this.closeMenu();
    });

    this.slideMenuBackdrop.addEventListener("click", () => {
      this.closeMenu();
    });

    this.menuUpload.addEventListener("click", () => {
      this.fileInput.click();
    });

    this.menuLibrary.addEventListener("click", () => {
      this.currentFilter = "all";
      this.menuLibrary.classList.add("active");
      this.menuFavorites.classList.remove("active");
      this.refreshRomList();
    });

    this.menuFavorites.addEventListener("click", () => {
      this.currentFilter = "favorites";
      this.menuFavorites.classList.add("active");
      this.menuLibrary.classList.remove("active");
      this.refreshRomList();
    });

    document.getElementById("btn-save").addEventListener("click", () => {
      if (this.emulator.getCurrentRom()) {
        this.saveManager.open();
      } else {
        this.updateStatus("No game loaded.");
      }
    });

    document.getElementById("btn-load").addEventListener("click", () => {
      if (this.emulator.getCurrentRom()) {
        this.saveManager.open();
      } else {
        this.updateStatus("No game loaded.");
      }
    });

    this.fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await this.romManager.handleFileUpload(file);
        this.emulator.loadROM(data, file.name);
        this.currentRom = file.name;
        this.emulator.fitInParent();
        this.virtualGamepad.hidden = false;
        this.cheatUI.syncCheats();
        this.closeMenu();
      } catch (err) {
        this.handleError(err);
      }
      this.fileInput.value = "";
    });

    const fullscreenBtn = document.getElementById("fullscreen-btn");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", () => {
        this.emulator.toggleFullscreen();
      });
    }

    this._bindDoubleTapFullscreen();

    this.gamepad = new VirtualGamepad(this.emulator, {
      joystickMode: this.settings.joystickMode,
      vibrationEnabled: this.settings.vibrationEnabled,
      showJoystickHint: this.settings.showJoystickHint,
    });
    this.gamepad.init();
    this.settingsUI.applySettings();
  }

  _bindDoubleTapFullscreen() {
    const container = document.getElementById("nes-container");
    if (!container) return;
    let lastTap = 0;
    container.addEventListener("click", (e) => {
      if (e.target !== container && !container.contains(e.target)) return;
      const now = Date.now();
      if (now - lastTap < 300) {
        this.emulator.toggleFullscreen();
        lastTap = 0;
      } else {
        lastTap = now;
      }
    });
  }

  toggleMenu() {
    if (this.slideMenu.hidden) {
      this.openMenu();
    } else {
      this.closeMenu();
    }
  }

  openMenu() {
    this.slideMenu.hidden = false;
    requestAnimationFrame(() => this.slideMenu.classList.add("open"));
    this.menuAccountSubpage.hidden = true;
    if (this.cheatUI.menuCheatsSubpage) this.cheatUI.menuCheatsSubpage.hidden = true;
    this.slideRomList.hidden = true;
  }

  closeMenu() {
    this.slideMenu.classList.remove("open");
    setTimeout(() => { this.slideMenu.hidden = true; }, 200);
  }

  _toggleAccountSubpage(forceOpen) {
    const isOpen = !this.menuAccountSubpage.hidden;
    if (forceOpen === true) {
      this.menuAccountSubpage.hidden = false;
    } else if (forceOpen === false) {
      this.menuAccountSubpage.hidden = true;
    } else {
      this.menuAccountSubpage.hidden = isOpen;
    }
    this.slideRomList.hidden = true;
  }

  // Delegation methods (kept for backwards compat / internal convenience)
  _syncCheats() { this.cheatUI.syncCheats(); }
  _syncSettingsUI() { this.settingsUI.syncSettingsUI(); }
  _applySettings() { this.settingsUI.applySettings(); }

  async refreshRomList() {
    this.slideRomList.hidden = false;
    this.menuAccountSubpage.hidden = true;
    this.slideRomList.innerHTML = "";

    try {
      const roms = await this.romManager.listROMs(this.currentFilter || "all");

      this.bundledROMs.forEach((rom) => {
        const item = this.createRomItem(rom.label, rom.url, true, false);
        this.slideRomList.appendChild(item);
      });

      if (roms.length === 0 && this.currentFilter === "favorites") {
        const span = document.createElement("span");
        span.textContent = "暂无收藏";
        span.className = "rom-empty";
        this.slideRomList.appendChild(span);
      } else if (roms.length === 0) {
        const span = document.createElement("span");
        span.textContent = "暂无上传的 ROM";
        span.className = "rom-empty";
        this.slideRomList.appendChild(span);
      } else {
        roms.forEach((rom) => {
          const item = this.createRomItem(rom.name, null, false, rom.favorite);
          this.slideRomList.appendChild(item);
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
    favBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newFav = this.romManager.toggleFavorite(name);
      favBtn.textContent = newFav ? "★" : "☆";
      favBtn.classList.toggle("favorited", newFav);
      if (this.currentFilter === "favorites" && !newFav) {
        this.refreshRomList();
      }
    });

    const playBtn = document.createElement("button");
    playBtn.className = "rom-name";
    playBtn.textContent = (isBundled ? " " : "") + name;
    playBtn.addEventListener("click", async () => {
      this.currentRom = name;
      if (isBundled && url) {
        this.emulator.loadROMFromURL(url, name, (err) => {
          if (!err) {
            this.emulator.fitInParent();
            this.virtualGamepad.hidden = false;
            this.closeMenu();
            this.cheatUI.syncCheats();
          }
        });
      } else {
        const data = await this.romManager.getROM(name);
        if (data) {
          this.emulator.loadROM(data, name);
          this.emulator.fitInParent();
          this.virtualGamepad.hidden = false;
          this.closeMenu();
          this.cheatUI.syncCheats();
        }
      }
      this.refreshRomList();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "del-btn";
    delBtn.textContent = "×";
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
    if (this.slideStatus) {
      this.slideStatus.textContent = msg;
    }
  }

  handleError(e) {
    console.error(e);
    this.updateStatus("Error: " + e.message);
    this.loadingOverlay.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new H5App();
  window.app.init();
});
