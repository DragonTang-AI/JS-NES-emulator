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
    this.menuAccountArrow = document.getElementById("menu-account-arrow");
    this.menuAccountSubpage = document.getElementById("menu-account-subpage");
    this.menuAuthForm = document.getElementById("menu-auth-form");
    this.menuAuthInfo = document.getElementById("menu-auth-info");
    this.menuAuthUser = document.getElementById("menu-auth-user");
    this.menuUpload = document.getElementById("menu-upload");
    this.menuLibrary = document.getElementById("menu-library");
    this.menuFavorites = document.getElementById("menu-favorites");
    this.menuCheats = document.getElementById("menu-cheats");
    this.menuCheatsArrow = document.getElementById("menu-cheats-arrow");
    this.menuCheatsSubpage = document.getElementById("menu-cheats-subpage");
    this.cheatAddress = document.getElementById("cheat-address");
    this.cheatValue = document.getElementById("cheat-value");
    this.cheatAddBtn = document.getElementById("cheat-add-btn");
    this.cheatList = document.getElementById("menu-cheats-list");
    this.cheatCodes = JSON.parse(localStorage.getItem("nes-cheat-codes") || "[]");
    this.settingsBtn = document.getElementById("quick-settings-btn");
    this.settingsModal = document.getElementById("settings-modal");
    this.settingsClose = document.getElementById("settings-close");
    this.authPromptModal = document.getElementById("auth-prompt-modal");
    this.authPromptClose = document.getElementById("auth-prompt-close");
    this.authPromptLogin = document.getElementById("auth-prompt-login");
    this.authPromptGuest = document.getElementById("auth-prompt-guest");
    this.settingMusic = document.getElementById("setting-music");
    this.settingVolume = document.getElementById("setting-volume");
    this.settingVolumeValue = document.getElementById("setting-volume-value");
    this.settingJoystickMode = document.getElementById("setting-joystick-mode");
    this.settingVibration = document.getElementById("setting-vibration");
    this.settingShowHint = document.getElementById("setting-show-hint");
    this.authUsername = document.getElementById("auth-username");
    this.authPassword = document.getElementById("auth-password");
    this.authLoginBtn = document.getElementById("auth-login-btn");
    this.authRegisterBtn = document.getElementById("auth-register-btn");
    this.authLogoutBtn = document.getElementById("auth-logout-btn");
    this.authSyncBtn = document.getElementById("auth-sync-btn");
    this.authToken = localStorage.getItem(this.authTokenKey) || null;
    this.authUser = null;
    this.authPromptDismissed = localStorage.getItem("nes-auth-prompt-dismissed") === "1";
    this.currentFilter = null;
    this.currentRom = null;
    this.bundledROMs = [
      { name: "MitsumeGaTooru.nes", url: "/roms/MitsumeGaTooru.nes", label: "三目童子" },
      { name: "Mitsume ga Tooru (Japan).nes", url: "/roms/Mitsume ga Tooru (Japan).nes", label: "三目通 (日版)" },
      { name: "2010 Street Fighter (Japan) (Beta).nes", url: "/roms/2010 Street Fighter (Japan) (Beta).nes", label: "2010 街头霸王" },
      { name: "Colour 2001 Streetfighter II (Asia) (En) (Pirate).nes", url: "/roms/Colour 2001 Streetfighter II (Asia) (En) (Pirate).nes", label: "2001 街头霸王II" },
      { name: "Crystalis (USA, Europe) (SNK 40th Anniversary Collection).nes", url: "/roms/Crystalis (USA, Europe) (SNK 40th Anniversary Collection).nes", label: "水晶之剑" },
    ];
    this._loadSettings();
  }

  async init() {
    this.emulator = new Emulator("nes-container", {
      onStatusUpdate: (msg) => this.updateStatus(msg),
      onError: (e) => this.handleError(e),
      onReady: () => this._onEmulatorReady(),
      onLoading: (percent, text) => this._updateLoading(percent, text),
    });

    this.emulator.onCloudAuthExpired = () => {
      this._setAuthState(null, null);
      this.updateStatus("登录已过期，请重新登录以启用云存档");
      this.authPromptModal.hidden = false;
    };

    this.romManager = new RomManager();
    this.saveManager = new SaveManager(this.emulator, "nes-container");

    try {
      await this.emulator.init();
      await this.romManager.init();
      this.saveManager.init();
      this.bindEvents();
      await this.restoreAuthSession();
      if (this.emulator && this.cheatCodes.length > 0) {
        this.emulator.setCheats(this.cheatCodes);
      }
      if (!this.authUser && !this.authPromptDismissed) {
        setTimeout(() => {
          this.authPromptModal.hidden = false;
        }, 1500);
      }
      this._syncSettingsUI();
      this._applySettings();
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

    if (this.settingsBtn) {
      this.settingsBtn.addEventListener("click", () => {
        this._syncSettingsUI();
        this.settingsModal.hidden = false;
      });
    }

    this.settingsClose.addEventListener("click", () => {
      this.settingsModal.hidden = true;
    });

    this.settingsModal.addEventListener("click", (e) => {
      if (e.target === this.settingsModal) {
        this.settingsModal.hidden = true;
      }
    });

    if (this.authPromptClose) {
      this.authPromptClose.addEventListener("click", () => {
        this.authPromptModal.hidden = true;
      });
    }

    if (this.authPromptGuest) {
      this.authPromptGuest.addEventListener("click", () => {
        this.authPromptModal.hidden = true;
        this.authPromptDismissed = true;
        localStorage.setItem("nes-auth-prompt-dismissed", "1");
        this.updateStatus("游客模式：可游玩，但无法永久云存档");
      });
    }

    if (this.authPromptLogin) {
      this.authPromptLogin.addEventListener("click", () => {
        this.authPromptModal.hidden = true;
        this.authPromptDismissed = true;
        localStorage.setItem("nes-auth-prompt-dismissed", "1");
        this.openMenu();
        this._toggleAccountSubpage(true);
        if (this.authUsername) this.authUsername.focus();
      });
    }

    if (this.authPromptModal) {
      this.authPromptModal.addEventListener("click", (e) => {
        if (e.target === this.authPromptModal) {
          this.authPromptModal.hidden = true;
        }
      });
    }

    this.menuAccount.addEventListener("click", () => {
      this._toggleAccountSubpage();
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

    this.menuCheats.addEventListener("click", () => {
      const isOpen = !this.menuCheatsSubpage.hidden;
      this.menuCheatsSubpage.hidden = isOpen;
      this.menuCheatsArrow.classList.toggle("open", !isOpen);
      this.slideRomList.hidden = true;
      if (!isOpen) this._renderCheatList();
    });

    if (this.cheatAddBtn) {
      this.cheatAddBtn.addEventListener("click", () => this._addCheat());
    }

    if (this.cheatAddress) {
      this.cheatAddress.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._addCheat();
      });
    }

    if (this.cheatValue) {
      this.cheatValue.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._addCheat();
      });
    }

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
        this.closeMenu();
      } catch (err) {
        this.handleError(err);
      }
      this.fileInput.value = "";
    });

    this.settingMusic.addEventListener("change", () => {
      this.settings.musicEnabled = this.settingMusic.checked;
      this._saveSettings();
      this._applySettings();
    });

    this.settingVolume.addEventListener("input", () => {
      this.settings.volume = Number(this.settingVolume.value);
      this.settingVolumeValue.textContent = this.settings.volume + "%";
      this._saveSettings();
      this._applySettings();
    });

    this.settingJoystickMode.addEventListener("change", () => {
      this.settings.joystickMode = this.settingJoystickMode.value === "fixed" ? "fixed" : "floating";
      this._saveSettings();
      this._applySettings();
    });

    this.settingVibration.addEventListener("change", () => {
      this.settings.vibrationEnabled = this.settingVibration.checked;
      this._saveSettings();
      this._applySettings();
    });

    this.settingShowHint.addEventListener("change", () => {
      this.settings.showJoystickHint = this.settingShowHint.checked;
      this._saveSettings();
      this._applySettings();
    });

    if (this.authLoginBtn) {
      this.authLoginBtn.addEventListener("click", async () => {
        await this.login();
      });
    }

    if (this.authRegisterBtn) {
      this.authRegisterBtn.addEventListener("click", async () => {
        await this.register();
      });
    }

    if (this.authLogoutBtn) {
      this.authLogoutBtn.addEventListener("click", async () => {
        await this.logout();
      });
    }

    if (this.authSyncBtn) {
      this.authSyncBtn.addEventListener("click", async () => {
        if (!this.emulator.isCloudReachable()) {
          this.updateStatus(this.emulator.isCloudAuthed() ? "当前离线，无法同步" : "未登录");
          return;
        }
        this.authSyncBtn.disabled = true;
        const user = this.authUser ? " (" + this.authUser.username + ")" : "";
        this.updateStatus("正在同步云存档" + user + "...");
        const result = await this.emulator.syncCloudSaves();
        this.authSyncBtn.disabled = false;
        if (result.ok) {
          const parts = [];
          if (result.pushed > 0) parts.push(result.pushed + "\u4E2A\u4E0A\u4F20");
          if (result.pulled > 0) parts.push(result.pulled + "\u4E2A\u4E0B\u8F7D");
          const msg = parts.length > 0 ? "\u540C\u6B65\u5B8C\u6210\uFF1A" + parts.join("\uFF0C") : "\u6240\u6709\u5B58\u6863\u5DF2\u662F\u6700\u65B0";
          this.updateStatus(msg + user);
        } else if (result.reason === "no_login") {
          this.updateStatus("\u672A\u767B\u5F55\uFF0C\u65E0\u6CD5\u540C\u6B65");
        } else if (result.reason === "offline") {
          this.updateStatus("\u5F53\u524D\u79BB\u7EBF\uFF0C\u65E0\u6CD5\u540C\u6B65");
        } else {
          this.updateStatus("\u540C\u6B65\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
        }
      });
    }

    this.gamepad = new VirtualGamepad(this.emulator, {
      joystickMode: this.settings.joystickMode,
      vibrationEnabled: this.settings.vibrationEnabled,
      showJoystickHint: this.settings.showJoystickHint,
    });
    this.gamepad.init();
    this._applySettings();
    this._syncAuthUI();
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
    this.menuAccountSubpage.hidden = true;
    this.menuAccountArrow.classList.remove("open");
    this.menuCheatsSubpage.hidden = true;
    this.menuCheatsArrow.classList.remove("open");
    this.slideRomList.hidden = true;
  }

  closeMenu() {
    this.slideMenu.hidden = true;
  }

  _toggleAccountSubpage(forceOpen) {
    const isOpen = !this.menuAccountSubpage.hidden;
    if (forceOpen === true) {
      this.menuAccountSubpage.hidden = false;
      this.menuAccountArrow.classList.add("open");
    } else if (forceOpen === false) {
      this.menuAccountSubpage.hidden = true;
      this.menuAccountArrow.classList.remove("open");
    } else {
      this.menuAccountSubpage.hidden = isOpen;
      this.menuAccountArrow.classList.toggle("open");
    }
    this.slideRomList.hidden = true;
  }

  async apiRequest(path, method = "GET", body = null, withAuth = true) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (withAuth && this.authToken) {
      headers.Authorization = "Bearer " + this.authToken;
    }
    const res = await fetch("/api" + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }

  _setAuthState(token, user) {
    this.authToken = token || null;
    this.authUser = user || null;
    if (this.authToken) {
      localStorage.setItem(this.authTokenKey, this.authToken);
      if (this.emulator) {
        this.emulator.setCloudAuth(this.authToken, this.authUser);
      }
    } else {
      localStorage.removeItem(this.authTokenKey);
      if (this.emulator) {
        this.emulator.clearCloudAuth();
      }
    }
    this._syncAuthUI();
  }

  _syncAuthUI() {
    if (this.authUser && this.authUser.username) {
      this.menuAccountLabel.textContent = this.authUser.username;
      if (this.menuAuthForm) this.menuAuthForm.hidden = true;
      if (this.menuAuthInfo) {
        this.menuAuthInfo.hidden = false;
        this.menuAuthUser.textContent = "已登录: " + this.authUser.username;
      }
    } else {
      this.menuAccountLabel.textContent = "未登录";
      if (this.menuAuthForm) this.menuAuthForm.hidden = false;
      if (this.menuAuthInfo) this.menuAuthInfo.hidden = true;
    }
  }

  async restoreAuthSession() {
    if (!this.authToken) {
      this._setAuthState(null, null);
      return;
    }
    try {
      const data = await this.apiRequest("/auth/me", "GET", null, true);
      this._setAuthState(this.authToken, data.user || null);
    } catch (e) {
      this._setAuthState(null, null);
    }
  }

  async register() {
    const username = (this.authUsername && this.authUsername.value || "").trim();
    const password = (this.authPassword && this.authPassword.value || "").trim();
    if (username.length < 3 || username.length > 24) {
      this.updateStatus("账号长度需 3-24 位");
      return;
    }
    if (password.length < 6) {
      this.updateStatus("密码至少 6 位");
      return;
    }
    try {
      await this.apiRequest("/auth/register", "POST", { username, password }, false);
      this.updateStatus("注册成功，请登录");
    } catch (e) {
      this.updateStatus("注册失败: " + e.message);
    }
  }

  async login() {
    const username = (this.authUsername && this.authUsername.value || "").trim();
    const password = (this.authPassword && this.authPassword.value || "").trim();
    if (!username || !password) {
      this.updateStatus("请输入账号和密码");
      return;
    }
    try {
      const data = await this.apiRequest("/auth/login", "POST", { username, password }, false);
      this._setAuthState(data.token, data.user || null);
      this._toggleAccountSubpage(false);
      this.updateStatus("登录成功，云存档已启用");
      if (this.authPassword) this.authPassword.value = "";
    } catch (e) {
      this.updateStatus("登录失败: " + e.message);
    }
  }

  async logout() {
    this._setAuthState(null, null);
    this._toggleAccountSubpage(false);
    this.updateStatus("已退出登录");
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(this.settingsKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.settings = {
        ...this.settings,
        ...parsed,
      };
      if (this.settings.joystickMode !== "fixed" && this.settings.joystickMode !== "floating") {
        this.settings.joystickMode = "floating";
      }
      this.settings.volume = Math.max(0, Math.min(100, Number(this.settings.volume) || 80));
      this.settings.musicEnabled = !!this.settings.musicEnabled;
      this.settings.vibrationEnabled = !!this.settings.vibrationEnabled;
      this.settings.showJoystickHint = !!this.settings.showJoystickHint;
    } catch (e) {
      console.warn("Load settings failed:", e);
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
    } catch (e) {
      console.warn("Save settings failed:", e);
    }
  }

  _syncSettingsUI() {
    this.settingMusic.checked = this.settings.musicEnabled;
    this.settingVolume.value = String(this.settings.volume);
    this.settingVolumeValue.textContent = this.settings.volume + "%";
    this.settingJoystickMode.value = this.settings.joystickMode;
    this.settingVibration.checked = this.settings.vibrationEnabled;
    this.settingShowHint.checked = this.settings.showJoystickHint;
  }

  _applySettings() {
    if (this.emulator) {
      this.emulator.setMuted(!this.settings.musicEnabled);
      this.emulator.setVolume(this.settings.volume / 100);
    }
    if (this.gamepad) {
      this.gamepad.setJoystickMode(this.settings.joystickMode);
      this.gamepad.setVibrationEnabled(this.settings.vibrationEnabled);
      this.gamepad.setShowHint(this.settings.showJoystickHint);
    }
  }

  async refreshRomList() {
    this.slideRomList.hidden = false;
    this.menuAccountSubpage.hidden = true;
    this.menuAccountArrow.classList.remove("open");
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
      if (isBundled && url) {
        this.emulator.loadROMFromURL(url, name, (err) => {
          if (!err) {
            this.emulator.fitInParent();
            this.virtualGamepad.hidden = false;
            this.closeMenu();
          }
        });
      } else {
        const data = await this.romManager.getROM(name);
        if (data) {
          this.emulator.loadROM(data, name);
          this.emulator.fitInParent();
          this.virtualGamepad.hidden = false;
          this.closeMenu();
        }
      }
      this.currentRom = name;
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

  _saveCheats() {
    localStorage.setItem("nes-cheat-codes", JSON.stringify(this.cheatCodes));
    if (this.emulator) {
      this.emulator.setCheats(this.cheatCodes);
    }
  }

  _addCheat() {
    const addrStr = (this.cheatAddress.value || "").trim().replace(/^0x/i, "");
    const valStr = (this.cheatValue.value || "").trim().replace(/^0x/i, "");
    if (!addrStr || !valStr) {
      this.updateStatus("请输入地址和值");
      return;
    }
    const address = parseInt(addrStr, 16);
    const value = parseInt(valStr, 16);
    if (isNaN(address) || address < 0 || address > 0xFFFF) {
      this.updateStatus("地址格式错误，范围 0000-FFFF");
      return;
    }
    if (isNaN(value) || value < 0 || value > 0xFF) {
      this.updateStatus("值格式错误，范围 00-FF");
      return;
    }
    this.cheatCodes.push({ address, value, enabled: true, label: addrStr.toUpperCase() + ":" + valStr.toUpperCase() });
    this._saveCheats();
    this.cheatAddress.value = "";
    this.cheatValue.value = "";
    this._renderCheatList();
    this.updateStatus("已添加金手指 " + addrStr.toUpperCase() + ":" + valStr.toUpperCase());
  }

  _toggleCheat(index) {
    if (index >= 0 && index < this.cheatCodes.length) {
      this.cheatCodes[index].enabled = !this.cheatCodes[index].enabled;
      this._saveCheats();
      this._renderCheatList();
    }
  }

  _deleteCheat(index) {
    if (index >= 0 && index < this.cheatCodes.length) {
      this.cheatCodes.splice(index, 1);
      this._saveCheats();
      this._renderCheatList();
    }
  }

  _renderCheatList() {
    this.cheatList.innerHTML = "";
    if (this.cheatCodes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cheat-empty";
      empty.textContent = "暂无金手指";
      this.cheatList.appendChild(empty);
      return;
    }
    this.cheatCodes.forEach((cheat, index) => {
      const row = document.createElement("div");
      row.className = "cheat-row" + (cheat.enabled ? " cheat-enabled" : "");

      const toggle = document.createElement("button");
      toggle.className = "cheat-toggle";
      toggle.textContent = cheat.enabled ? "ON" : "OFF";
      toggle.addEventListener("click", () => this._toggleCheat(index));

      const label = document.createElement("span");
      label.className = "cheat-label";
      label.textContent = cheat.label || (cheat.address.toString(16).toUpperCase() + ":" + cheat.value.toString(16).toUpperCase());

      const del = document.createElement("button");
      del.className = "cheat-del";
      del.textContent = "×";
      del.addEventListener("click", () => this._deleteCheat(index));

      row.appendChild(toggle);
      row.appendChild(label);
      row.appendChild(del);
      this.cheatList.appendChild(row);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new H5App();
  window.app.init();
});
