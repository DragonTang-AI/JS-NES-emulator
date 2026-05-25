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
      mmc3FixEnabled: true,
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
    this.slideStatus = document.getElementById("slide-menu-status");
    this.libraryModal = document.getElementById("library-modal");
    this.libraryModalBody = document.getElementById("library-modal-body");
    this.libraryModalTitle = document.getElementById("library-modal-title");
    this.libraryModalClose = document.getElementById("library-modal-close");
    this.orientationToast = document.getElementById("orientation-toast");
    this.orientationToastClose = document.getElementById("orientation-toast-close");
    this._orientationToastTimer = null;
    this._orientationToastDismissed = false;
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
      { name: "Contra (USA).nes", url: "/roms/Contra (USA).nes", label: "魂斗罗" },
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
      this._hideOrientationToast();
    } else {
      document.body.classList.add("portrait");
      document.body.classList.remove("landscape");
      this._showOrientationToast();
    }
    this.emulator.fitInParent();
  }

  _showOrientationToast() {
    if (this._orientationToastDismissed) return;
    if (!this.orientationToast) return;
    if (this._orientationToastTimer) clearTimeout(this._orientationToastTimer);
    this.orientationToast.hidden = false;
    this._orientationToastTimer = setTimeout(() => {
      this._hideOrientationToast();
    }, 5000);
  }

  _hideOrientationToast() {
    if (this._orientationToastTimer) {
      clearTimeout(this._orientationToastTimer);
      this._orientationToastTimer = null;
    }
    if (this.orientationToast) this.orientationToast.hidden = true;
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
      this.closeMenu();
      this.openLibraryModal("all");
    });

    this.menuFavorites.addEventListener("click", () => {
      this.closeMenu();
      this.openLibraryModal("favorites");
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

    if (this.libraryModalClose) {
      this.libraryModalClose.addEventListener("click", () => this.closeLibraryModal());
    }
    if (this.libraryModal) {
      this.libraryModal.addEventListener("click", (e) => {
        if (e.target === this.libraryModal) this.closeLibraryModal();
      });

      this.libraryModal.querySelectorAll(".pixel-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          const filter = tab.dataset.filter;
          this.currentFilter = filter;
          if (this.libraryModalTitle) {
            this.libraryModalTitle.textContent = filter === "favorites" ? "收藏" : "游戏库";
          }
          const tabs = this.libraryModal.querySelectorAll(".pixel-tab");
          tabs.forEach(t => t.classList.remove("active"));
          tab.classList.add("active");
          this.refreshRomList(filter);
        });
      });
    }

    if (this.orientationToastClose) {
      this.orientationToastClose.addEventListener("click", () => {
        this._orientationToastDismissed = true;
        this._hideOrientationToast();
      });
    }

    const fullscreenBtn = document.getElementById("fullscreen-btn");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", () => {
        this.emulator.toggleFullscreen();
      });
    }

    const screenshotBtn = document.getElementById("screenshot-btn");
    if (screenshotBtn) {
      screenshotBtn.addEventListener("click", () => {
        this._takeScreenshot();
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
  }

  // Delegation methods (kept for backwards compat / internal convenience)
  _syncCheats() { this.cheatUI.syncCheats(); }
  _syncSettingsUI() { this.settingsUI.syncSettingsUI(); }
  _applySettings() { this.settingsUI.applySettings(); }

  openLibraryModal(filter) {
    if (!this.libraryModal || !this.libraryModalBody) {
      this.updateStatus("页面资源未更新，请刷新后重试");
      return;
    }
    this.currentFilter = filter || "all";
    this.libraryModal.hidden = false;
    const tabs = this.libraryModal.querySelectorAll(".pixel-tab");
    tabs.forEach(t => t.classList.toggle("active", t.dataset.filter === this.currentFilter));
    if (this.libraryModalTitle) {
      this.libraryModalTitle.textContent = filter === "favorites" ? "收藏" : "游戏库";
    }
    this.refreshRomList(this.currentFilter);
  }

  closeLibraryModal() {
    if (this.libraryModal) this.libraryModal.hidden = true;
  }

  async refreshRomList(filter) {
    const body = this.libraryModalBody;
    if (!body) return;
    body.innerHTML = "";

    try {
      const roms = await this.romManager.listROMs(filter || "all");

      this.bundledROMs.forEach((rom) => {
        const item = this._createLibraryItem(rom.label, rom.url, true, false);
        body.appendChild(item);
      });

      if (roms.length === 0 && filter === "favorites") {
        const span = document.createElement("div");
        span.textContent = "暂无收藏";
        span.className = "library-empty";
        body.appendChild(span);
      } else if (roms.length === 0) {
        const span = document.createElement("div");
        span.textContent = "暂无上传的 ROM";
        span.className = "library-empty";
        body.appendChild(span);
      } else {
        roms.forEach((rom) => {
          const item = this._createLibraryItem(rom.name, null, false, rom.favorite);
          body.appendChild(item);
        });
      }
    } catch (e) {
      console.warn("Failed to list ROMs:", e);
    }
  }

  _createLibraryItem(name, url, isBundled, isFavorite) {
    const item = document.createElement("div");
    item.className = "library-game-item" + (this.currentRom === name ? " active" : "");

    const icon = document.createElement("span");
    icon.className = "library-game-icon";
    icon.textContent = "🎮";

    const info = document.createElement("div");
    info.className = "library-game-info";
    const nameSpan = document.createElement("div");
    nameSpan.className = "library-game-name";
    nameSpan.textContent = name;
    const sub = document.createElement("div");
    sub.className = "library-game-sub";
    sub.textContent = isBundled ? "内置游戏" : "已上传";
    info.appendChild(nameSpan);
    info.appendChild(sub);

    const favBtn = document.createElement("button");
    favBtn.className = "library-game-fav" + (isFavorite ? " favorited" : "");
    favBtn.textContent = isFavorite ? "★" : "☆";
    favBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newFav = this.romManager.toggleFavorite(name);
      favBtn.textContent = newFav ? "★" : "☆";
      favBtn.classList.toggle("favorited", newFav);
      if (this.currentFilter === "favorites" && !newFav) {
        this.refreshRomList(this.currentFilter);
      }
    });

    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(favBtn);

    item.addEventListener("click", async () => {
      this.currentRom = name;
      if (isBundled && url) {
        this.emulator.loadROMFromURL(url, name, (err) => {
          if (!err) {
            this.emulator.fitInParent();
            this.virtualGamepad.hidden = false;
            this.closeLibraryModal();
            this.cheatUI.syncCheats();
          }
        });
      } else {
        const data = await this.romManager.getROM(name);
        if (data) {
          this.emulator.loadROM(data, name);
          this.emulator.fitInParent();
          this.virtualGamepad.hidden = false;
          this.closeLibraryModal();
          this.cheatUI.syncCheats();
        }
      }
    });

    return item;
  }

  _takeScreenshot() {
    if (!this.emulator || !this.emulator.getCurrentRom()) {
      this.updateStatus("请先加载游戏");
      return;
    }
    const dataUrl = this.emulator.screenshot();
    if (!dataUrl) {
      this.updateStatus("截图失败");
      return;
    }
    const blob = this._dataURLToBlob(dataUrl);
    const file = new File([blob], "nes-screenshot.png", { type: "image/png" });
    if (navigator.share && navigator.canShare({ files: [file] })) {
      navigator.share({
        title: "NES 游戏截图",
        text: "来看看我的 NES 游戏瞬间！",
        files: [file],
      }).then(() => {
        this.updateStatus("截图已分享");
      }).catch(() => {
        this._downloadScreenshot(dataUrl);
      });
    } else {
      this._downloadScreenshot(dataUrl);
    }
  }

  _dataURLToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const mime = parts[0].match(/:(.*?);/)[1];
    const bytes = atob(parts[1]);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      arr[i] = bytes.charCodeAt(i);
    }
    return new Blob([arr], { type: mime });
  }

  _downloadScreenshot(dataUrl) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "nes-screenshot-" + Date.now() + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.updateStatus("截图已保存");
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
