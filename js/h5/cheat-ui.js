class CheatUI {
  constructor(app) {
    this.app = app;
    this.menuCheatsSubpage = null;
    this.activeCheats = this._loadActiveCheats();
  }

  _loadActiveCheats() {
    try {
      const stored = localStorage.getItem("nes-active-cheats");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        const cleaned = parsed.filter((c) => c && typeof c === "object" && Array.isArray(c.codes));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem("nes-active-cheats", JSON.stringify(cleaned));
        }
        return cleaned;
      }
    } catch (e) {
      // ignore
    }
    return [];
  }

  _saveActiveCheats() {
    localStorage.setItem("nes-active-cheats", JSON.stringify(this.activeCheats));
  }

  init() {
    this.menuCheatsSubpage = document.getElementById("menu-cheats-subpage");
    this._bindEvents();
  }

  _bindEvents() {
    this.app.menuCheats.addEventListener("click", () => {
      if (this.menuCheatsSubpage.hidden) {
        this._renderCheatGameList();
      }
      this.menuCheatsSubpage.hidden = !this.menuCheatsSubpage.hidden;
      this.app.slideRomList.hidden = !this.menuCheatsSubpage.hidden;
    });

    const cheatModalClose = document.getElementById("cheat-modal-close");
    if (cheatModalClose) {
      cheatModalClose.addEventListener("click", () => {
        document.getElementById("cheat-modal").hidden = true;
      });
    }

    const cheatModal = document.getElementById("cheat-modal");
    if (cheatModal) {
      cheatModal.addEventListener("click", (e) => {
        if (e.target === cheatModal) {
          cheatModal.hidden = true;
        }
      });
    }
  }

  _getActiveCheatCodes() {
    const codes = [];
    for (const c of this.activeCheats) {
      if (c.enabled === false) continue;
      if (!Array.isArray(c.codes)) continue;
      for (const entry of c.codes) {
        codes.push(entry);
      }
    }
    return codes;
  }

  _getCurrentCheatLibrary() {
    const rom = this.app.currentRom;
    if (!rom || !this.app.cheatLibrary) return [];
    const nameLower = String(rom).toLowerCase().replace(/\.[a-z0-9]+$/, "");
    for (const game of this.app.cheatLibrary) {
      const matchTerms = game.match || [game.name];
      for (const term of matchTerms) {
        const termLower = term.toLowerCase().replace(/\.[a-z0-9]+$/, "");
        if (nameLower.includes(termLower) || termLower.includes(nameLower)) {
          return game.cheats || [];
        }
      }
    }
    return [];
  }

  syncCheats() {
    const currentCodes = this._getActiveCheatCodes();
    if (this.app.emulator) {
      this.app.emulator.setCheats(currentCodes);
    }
    const currentCheats = this._getCurrentCheatLibrary();
    this._updateCheatBadge(currentCheats);
    this._updateCheatIndicator(currentCheats);
  }

  _updateCheatBadge(availableCheats) {
    const badge = document.getElementById("menu-cheats-badge");
    if (!badge) return;
    if (availableCheats.length === 0) {
      badge.hidden = true;
      return;
    }
    const count = this.activeCheats.filter((c) => c.enabled !== false).length;
    if (count > 0) {
      badge.textContent = count + "项";
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  _updateCheatIndicator(availableCheats) {
    const indicator = document.getElementById("cheat-indicator");
    if (!indicator) return;
    if (availableCheats.length === 0) {
      indicator.hidden = true;
      return;
    }
    const active = this.activeCheats.filter((c) => c.enabled !== false);
    if (active.length > 0) {
      indicator.textContent = active.map((c) => c.name).join(", ");
      indicator.hidden = false;
    } else {
      indicator.hidden = true;
    }
  }

  _renderCheatGameList() {
    const container = document.getElementById("menu-cheats-game-list");
    if (!container) return;
    container.innerHTML = "";
    const currentCheats = this._getCurrentCheatLibrary();
    if (!this.app.currentRom) {
      container.innerHTML = '<div class="cheat-game-empty">请先加载游戏</div>';
      return;
    }
    if (currentCheats.length === 0) {
      container.innerHTML = '<div class="cheat-game-empty">该游戏暂无外挂库</div>';
      return;
    }
    for (const cheat of currentCheats) {
      const existing = this.activeCheats.find((c) => c.id === cheat.id);
      const enabled = existing ? existing.enabled !== false : false;
      const item = document.createElement("div");
      item.className = "cheat-item" + (enabled ? " cheat-enabled" : "");
      const label = document.createElement("div");
      label.className = "cheat-item-label";
      const nameSpan = document.createElement("span");
      nameSpan.className = "cheat-item-name";
      nameSpan.textContent = cheat.name;
      const descSpan = document.createElement("span");
      descSpan.className = "cheat-item-desc";
      descSpan.textContent = cheat.description || "";
      label.appendChild(nameSpan);
      label.appendChild(descSpan);
      const toggle = document.createElement("label");
      toggle.className = "switch-toggle";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = enabled;
      input.addEventListener("change", () => {
        input.checked ? this._enableCheat(cheat) : this._disableCheat(cheat);
        item.classList.toggle("cheat-enabled", input.checked);
        this.app.updateStatus(input.checked ? "已启用：" + cheat.name : "已关闭：" + cheat.name);
        this.syncCheats();
      });
      const slider = document.createElement("span");
      slider.className = "slider";
      toggle.appendChild(input);
      toggle.appendChild(slider);
      item.appendChild(label);
      item.appendChild(toggle);
      container.appendChild(item);
    }
  }

  _enableCheat(cheat) {
    const existing = this.activeCheats.find((c) => c.id === cheat.id);
    if (existing) {
      existing.enabled = true;
    } else {
      this.activeCheats.push({
        id: cheat.id,
        name: cheat.name,
        codes: cheat.codes,
        enabled: true,
      });
    }
    this._saveActiveCheats();
  }

  _disableCheat(cheat) {
    const existing = this.activeCheats.find((c) => c.id === cheat.id);
    if (existing) {
      existing.enabled = false;
    } else {
      this.activeCheats.push({
        id: cheat.id,
        name: cheat.name,
        codes: cheat.codes,
        enabled: false,
      });
    }
    this._saveActiveCheats();
  }
}
