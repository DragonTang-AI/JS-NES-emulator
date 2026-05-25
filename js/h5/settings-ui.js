class SettingsUI {
  constructor(app) {
    this.app = app;
  }

  init() {
    const userSettings = this._loadSettings();
    this.app.settings = Object.assign({}, this.app.settings, userSettings);
    this._bindEvents();
    this.syncSettingsUI();
    this.applySettings();
  }

  _bindEvents() {
    const settingsBtn = document.getElementById("quick-settings-btn");
    const settingsClose = document.getElementById("settings-close");
    const settingsModal = document.getElementById("settings-modal");

    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        settingsModal.hidden = !settingsModal.hidden;
      });
    }

    if (settingsClose) {
      settingsClose.addEventListener("click", () => {
        settingsModal.hidden = true;
      });
    }

    if (settingsModal) {
      settingsModal.addEventListener("click", (e) => {
        if (e.target === settingsModal) {
          settingsModal.hidden = true;
        }
      });
    }

    const settingMusic = document.getElementById("setting-music");
    const settingVolume = document.getElementById("setting-volume");
    const settingJoystickMode = document.getElementById("setting-joystick-mode");
    const settingVibration = document.getElementById("setting-vibration");
    const settingShowHint = document.getElementById("setting-show-hint");

    if (settingMusic) {
      settingMusic.addEventListener("change", () => {
        this.app.settings.musicEnabled = settingMusic.checked;
        this._saveSettings();
        this.applySettings();
      });
    }

    if (settingVolume) {
      settingVolume.addEventListener("input", () => {
        const val = parseInt(settingVolume.value, 10);
        this.app.settings.volume = val;
        const volumeLabel = document.getElementById("setting-volume-value") || document.getElementById("volume-label");
        if (volumeLabel) volumeLabel.textContent = val + "%";
        this._saveSettings();
        this.applySettings();
      });
    }

    if (settingJoystickMode) {
      settingJoystickMode.addEventListener("change", () => {
        this.app.settings.joystickMode = settingJoystickMode.value === "fixed" ? "fixed" : "floating";
        this._saveSettings();
        this.applySettings();
      });
    }

    if (settingVibration) {
      settingVibration.addEventListener("change", () => {
        this.app.settings.vibrationEnabled = settingVibration.checked;
        this._saveSettings();
        this.applySettings();
      });
    }

    if (settingShowHint) {
      settingShowHint.addEventListener("change", () => {
        this.app.settings.showJoystickHint = settingShowHint.checked;
        this._saveSettings();
        this.applySettings();
      });
    }
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(this.app.settingsKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed.joystickMode !== "fixed" && parsed.joystickMode !== "floating") {
        parsed.joystickMode = "floating";
      }
      parsed.volume = Math.max(0, Math.min(100, Number(parsed.volume) || 80));
      return parsed;
    } catch (e) {
      // ignore
    }
    return {};
  }

  _saveSettings() {
    try {
      localStorage.setItem(this.app.settingsKey, JSON.stringify(this.app.settings));
    } catch (e) {
      // ignore
    }
  }

  syncSettingsUI() {
    const settingMusic = document.getElementById("setting-music");
    const settingVolume = document.getElementById("setting-volume");
    const settingJoystickMode = document.getElementById("setting-joystick-mode");
    const settingVibration = document.getElementById("setting-vibration");
    const settingShowHint = document.getElementById("setting-show-hint");
    const volumeLabel = document.getElementById("setting-volume-value");

    if (settingMusic) settingMusic.checked = this.app.settings.musicEnabled !== false;
    if (settingVolume) settingVolume.value = this.app.settings.volume ?? 80;
    if (volumeLabel) volumeLabel.textContent = (this.app.settings.volume ?? 80) + "%";
    if (settingJoystickMode) settingJoystickMode.value = this.app.settings.joystickMode || "floating";
    if (settingVibration) settingVibration.checked = this.app.settings.vibrationEnabled !== false;
    if (settingShowHint) settingShowHint.checked = this.app.settings.showJoystickHint !== false;
  }

  applySettings() {
    if (this.app.emulator) {
      this.app.emulator.setMuted(this.app.settings.musicEnabled === false);
      this.app.emulator.setVolume((this.app.settings.volume ?? 80) / 100);
    }
    if (this.app.gamepad) {
      this.app.gamepad.setJoystickMode(this.app.settings.joystickMode || "floating");
      this.app.gamepad.setVibrationEnabled(this.app.settings.vibrationEnabled !== false);
      this.app.gamepad.setShowHint(this.app.settings.showJoystickHint !== false);
    }
  }
}
