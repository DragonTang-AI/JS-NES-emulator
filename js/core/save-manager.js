class SaveManager {
  constructor(emulator, containerId) {
    this.emulator = emulator;
    this.container = document.getElementById(containerId);
    this.overlay = null;
    this.isOpen = false;
  }

  init() {
    this._createOverlay();
    this._bindEvents();
  }

  _createOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.id = "save-manager-overlay";
    this.overlay.className = "save-overlay hidden";
    this.overlay.innerHTML = `
      <div class="save-modal">
        <div class="save-header">
          <h2>存档管理</h2>
          <button class="save-sync-btn" id="save-sync-btn">↻ 同步</button>
          <button class="save-close" id="save-close">×</button>
        </div>
        <div class="save-game-name" id="save-game-name"></div>
        <div class="save-sync-status" id="save-sync-status" style="display:none;"></div>
        <div class="save-slots" id="save-slots"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);
  }

  _bindEvents() {
    document.getElementById("save-close").addEventListener("click", () => {
      this.close();
    });

    document.getElementById("save-sync-btn").addEventListener("click", async () => {
      await this._doSync();
    });

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    });
  }

  _setSyncStatus(text, isError) {
    const el = document.getElementById("save-sync-status");
    if (!el) return;
    el.textContent = text;
    el.style.display = text ? "block" : "none";
    el.className = "save-sync-status" + (isError ? " sync-error" : " sync-ok");
  }

  async _doSync() {
    if (!this.emulator.isCloudReachable()) {
      if (this.emulator.isCloudAuthed()) {
        this._setSyncStatus("当前离线，无法同步云存档", true);
      } else {
        this._setSyncStatus("未登录，请先登录以启用云存档", true);
      }
      return;
    }

    const syncBtn = document.getElementById("save-sync-btn");
    if (syncBtn) syncBtn.disabled = true;

    this._setSyncStatus("正在同步云存档...", false);
    const result = await this.emulator.syncCloudSaves((current, total) => {
      this._setSyncStatus("同步中 " + current + "/" + total + "...", false);
    });

    if (syncBtn) syncBtn.disabled = false;

    if (result.ok) {
      const parts = [];
      if (result.pushed > 0) parts.push(result.pushed + " 个上传");
      if (result.pulled > 0) parts.push(result.pulled + " 个下载");
      if (result.failed > 0) parts.push(result.failed + " 个失败");
      const msg = parts.length > 0 ? "同步完成：" + parts.join("，") : "所有存档已是最新";
      this._setSyncStatus(msg, result.failed > 0);
    } else if (result.reason === "no_login") {
      this._setSyncStatus("未登录，云存档不可用", true);
    } else if (result.reason === "offline") {
      this._setSyncStatus("当前离线，请检查网络", true);
    } else if (result.reason === "auth_expired") {
      this._setSyncStatus("登录已过期，请重新登录", true);
    } else {
      this._setSyncStatus("同步失败，请稍后重试", true);
    }

    await this._renderSlots();
  }

  async open() {
    if (!this.emulator.getCurrentRom()) {
      this.emulator.onStatusUpdate("No game loaded.");
      return;
    }
    this.isOpen = true;
    document.getElementById("save-game-name").textContent = this.emulator.getCurrentRom();
    this._setSyncStatus("", false);

    if (this.emulator.isCloudReachable()) {
      this._setSyncStatus("正在加载云存档...", false);
      await this.emulator.syncCloudSaves();
      this._setSyncStatus("云存档已同步", false);
    } else if (this.emulator.isCloudAuthed()) {
      this._setSyncStatus("已登录但离线，仅显示本地存档", true);
    }

    await this._renderSlots();
    this.overlay.classList.remove("hidden");
  }

  close() {
    this.isOpen = false;
    this.overlay.classList.add("hidden");
  }

  async _renderSlots() {
    const slotsContainer = document.getElementById("save-slots");
    const saves = await this.emulator.getSaveList();
    slotsContainer.innerHTML = "";

    saves.forEach(save => {
      const slotEl = document.createElement("div");
      slotEl.className = "save-slot" + (save.exists ? " has-save" : "");

      const slotNum = document.createElement("div");
      slotNum.className = "save-slot-num";
      slotNum.textContent = "存档 " + save.slot;

      const badges = [];
      if (save.local) badges.push("本机");
      if (save.cloud) badges.push("云端");

      const slotInfo = document.createElement("div");
      slotInfo.className = "save-slot-info";
      if (save.exists && save.timestamp) {
        const date = new Date(save.timestamp);
        let text = date.toLocaleString("zh-CN");
        if (badges.length > 0) text += " [" + badges.join("+") + "]";
        slotInfo.textContent = text;
      } else {
        slotInfo.textContent = "空";
      }

      const slotActions = document.createElement("div");
      slotActions.className = "save-slot-actions";

      const saveBtn = document.createElement("button");
      saveBtn.className = "save-btn";
      saveBtn.textContent = "保存";
      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        const result = await this.emulator.saveState(save.slot);
        saveBtn.disabled = false;
        await this._renderSlots();
      });

      const loadBtn = document.createElement("button");
      loadBtn.className = "load-btn";
      loadBtn.textContent = "读取";
      loadBtn.disabled = !save.exists;
      loadBtn.addEventListener("click", async () => {
        loadBtn.disabled = true;
        const r = await this.emulator.loadState(save.slot);
        loadBtn.disabled = false;
        if (r && r.ok) {
          this.close();
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "删除";
      deleteBtn.disabled = !save.exists;
      deleteBtn.addEventListener("click", async () => {
        if (confirm("删除存档 " + save.slot + "？此操作不可恢复。")) {
          await this.emulator.deleteState(save.slot);
          await this._renderSlots();
        }
      });

      slotActions.appendChild(saveBtn);
      slotActions.appendChild(loadBtn);
      slotActions.appendChild(deleteBtn);

      slotEl.appendChild(slotNum);
      slotEl.appendChild(slotInfo);
      slotEl.appendChild(slotActions);

      slotsContainer.appendChild(slotEl);
    });
  }
}
