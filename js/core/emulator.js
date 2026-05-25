class Emulator {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.nes = null;
    this.canvas = null;
    this.ctx = null;
    this.imageData = null;
    this.buf32 = null;
    this.onStatusUpdate = options.onStatusUpdate || (() => {});
    this.onError = options.onError || (() => {});
    this.onReady = options.onReady || (() => {});
    this.onLoading = options.onLoading || (() => {});
    this.running = false;
    this.frameId = null;
    this.audioCtx = null;
    this.masterGain = null;
    this.audioLeft = [];
    this.audioRight = [];
    this.sampleRate = 44100;
    this.audioStarted = false;
    this.audioMuted = false;
    this.audioVolume = 0.8;
    this.audioBufferL = new Float32Array(4096);
    this.audioBufferR = new Float32Array(4096);
    this.audioWritePos = 0;
    this.audioReadPos = 0;
    this.audioCount = 0;
    this.currentRom = null;
    this.maxSaveSlots = 10;
    this.saveDB = null;
    this.cloudToken = null;
    this.cloudUser = null;
    this.cloudApiBase = "/api";
  }

  async init() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/jsnes@1.2.1/dist/jsnes.min.js";
      script.onload = async () => {
        if (!window.jsnes || !window.jsnes.NES) {
          reject(new Error("jsnes library not loaded correctly"));
          return;
        }
        this._createEmulator();
        try {
          await this.initSaveDB();
        } catch (e) {
          console.warn("Save DB init failed:", e);
        }
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load jsnes"));
      document.head.appendChild(script);
    });
  }

  async initSaveDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("nes-save-states", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("saves")) {
          db.createObjectStore("saves", { keyPath: "key" });
        }
      };
      request.onsuccess = (e) => {
        this.saveDB = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(new Error("Failed to open save DB"));
    });
  }

  _createEmulator() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 256;
    this.canvas.height = 240;
    this.canvas.style.imageRendering = "pixelated";
    this.canvas.style.imageRendering = "crisp-edges";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d");
    this.imageData = this.ctx.createImageData(256, 240);
    this.buf32 = new Uint32Array(this.imageData.data.buffer);

    this.nes = new jsnes.NES({
      onFrame: (frameBuffer) => {
        for (let i = 0; i < frameBuffer.length; i++) {
          const pixel = frameBuffer[i];
          const r = (pixel >> 16) & 0xff;
          const g = (pixel >> 8) & 0xff;
          const b = pixel & 0xff;
          this.buf32[i] = (0xff << 24) | (r << 16) | (g << 8) | b;
        }
        this.ctx.putImageData(this.imageData, 0, 0);
      },
      onAudioSample: (left, right) => {
        if (this.audioStarted && this.audioCount < 4096) {
          this.audioBufferL[this.audioWritePos] = left;
          this.audioBufferR[this.audioWritePos] = right;
          this.audioWritePos = (this.audioWritePos + 1) % 4096;
          this.audioCount++;
        }
      },
      onStatusUpdate: (status) => {
        this.onStatusUpdate(status);
      },
      onBatteryRamWrite: (address, value) => {
        this._saveBatteryRam(address, value);
      },
      sampleRate: 44100,
    });

    this.nes.stop = () => {
      this.stop();
    };
    this._bindKeyboard();
    this._bindAudioUnlock();
    this.onReady();
    this.onStatusUpdate("Emulator initialized. Please load a ROM.");
  }

  _initAudio() {
    if (this.audioCtx) {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(e => console.warn("Audio resume failed:", e));
      }
      this._applyAudioGain();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.sampleRate = this.audioCtx.sampleRate;

      const bufferSize = 2048;
      this.scriptNode = this.audioCtx.createScriptProcessor(bufferSize, 2, 2);
      this.scriptNode.onaudioprocess = (e) => {
        const outputL = e.outputBuffer.getChannelData(0);
        const outputR = e.outputBuffer.getChannelData(1);
        for (let i = 0; i < bufferSize; i++) {
          if (this.audioCount > 0) {
            outputL[i] = this.audioBufferL[this.audioReadPos];
            outputR[i] = this.audioBufferR[this.audioReadPos];
            this.audioReadPos = (this.audioReadPos + 1) % 4096;
            this.audioCount--;
          } else {
            outputL[i] = 0;
            outputR[i] = 0;
          }
        }
      };
      this.masterGain = this.audioCtx.createGain();
      this.scriptNode.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);
      this._applyAudioGain();
      this.audioStarted = true;
      console.log("Audio initialized, sample rate:", this.sampleRate);
    } catch (e) {
      console.warn("Audio init failed:", e);
    }
  }

  _applyAudioGain() {
    if (!this.masterGain) return;
    this.masterGain.gain.value = this.audioMuted ? 0 : this.audioVolume;
  }

  setMuted(muted) {
    this.audioMuted = !!muted;
    this._applyAudioGain();
  }

  setVolume(volume) {
    const v = Number.isFinite(volume) ? volume : 0.8;
    this.audioVolume = Math.max(0, Math.min(1, v));
    this._applyAudioGain();
  }

  getAudioSettings() {
    return {
      muted: this.audioMuted,
      volume: this.audioVolume,
    };
  }

  _bindAudioUnlock() {
    const unlock = () => {
      this._initAudio();
    };
    document.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("mousedown", unlock, { passive: true });
    document.addEventListener("keydown", unlock, { passive: true });
  }

  _bindKeyboard() {
    const keyMap = {
      88: [1, jsnes.Controller.BUTTON_A],
      90: [1, jsnes.Controller.BUTTON_B],
      17: [1, jsnes.Controller.BUTTON_SELECT],
      13: [1, jsnes.Controller.BUTTON_START],
      38: [1, jsnes.Controller.BUTTON_UP],
      40: [1, jsnes.Controller.BUTTON_DOWN],
      37: [1, jsnes.Controller.BUTTON_LEFT],
      39: [1, jsnes.Controller.BUTTON_RIGHT],
      70: ["fullscreen"],
    };

    document.addEventListener("keydown", (e) => {
      if (e.keyCode === 70) {
        this.toggleFullscreen();
        e.preventDefault();
        return;
      }
      const mapping = keyMap[e.keyCode];
      if (mapping) {
        this.nes.buttonDown(mapping[0], mapping[1]);
        e.preventDefault();
        this._initAudio();
      }
    });

    document.addEventListener("keyup", (e) => {
      const mapping = keyMap[e.keyCode];
      if (mapping) {
        this.nes.buttonUp(mapping[0], mapping[1]);
        e.preventDefault();
      }
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => {
        console.warn("Fullscreen failed:", e);
      });
    } else {
      document.exitFullscreen();
    }
  }

  loadROM(data, romName = "ROM") {
    if (!this.nes) {
      this.onError(new Error("Emulator not initialized"));
      return;
    }
    this.stop();
    this.currentRom = romName;
    this.onLoading(0, "Loading " + romName + "...");
    try {
      this.nes.loadROM(data);
      this._startLoop();
      this._fitScreen();
      this._initAudio();
      this.onLoading(100, "Playing: " + romName);
      this.onStatusUpdate("ROM loaded successfully.");
    } catch (e) {
      this.onError(e);
      this.onLoading(0, "Error loading ROM");
      if (typeof this.nes.reset === "function") {
        this.nes.reset();
      }
    }
  }

  loadROMFromURL(url, romName, callback) {
    if (!this.nes) {
      this.onError(new Error("Emulator not initialized"));
      return;
    }
    this.currentRom = romName;
    this.onLoading(0, "Loading " + romName + "...");
    const req = new XMLHttpRequest();
    req.open("GET", url);
    req.overrideMimeType("text/plain; charset=x-user-defined");
    req.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        this.onLoading(percent, "Loading " + romName + "... " + percent + "%");
      }
    };
    req.onerror = () => {
      this.onError(new Error("Failed to load ROM"));
      this.onLoading(0, "Error loading ROM");
      if (callback) callback(new Error("Failed to load ROM"));
    };
    req.onload = () => {
      if (req.status === 200) {
        this.loadROM(req.responseText, romName);
        if (callback) callback(null, req.responseText);
      } else {
        this.onError(new Error("Failed to load ROM"));
        this.onLoading(0, "Error loading ROM");
        if (callback) callback(new Error("Failed to load ROM"));
      }
    };
    req.send();
  }

  _cheats = [];

  setCheats(cheats) {
    this._cheats = (cheats || []).filter(c => c && c.address !== undefined && c.value !== undefined);
  }

  _applyCheats() {
    for (let i = 0; i < this._cheats.length; i++) {
      const c = this._cheats[i];
      if (c.address !== undefined && c.value !== undefined && this.nes && this.nes.cpu) {
        try {
          this.nes.cpu.write(c.address, c.value);
        } catch (e) { /* ignore write errors */ }
      }
    }
  }

  _startLoop() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      try {
        this.nes.frame();
        this._applyCheats();
      } catch (e) {
        console.error("Emulation error:", e);
        this.onError(e);
        this.running = false;
        return;
      }
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
  }

  start() {
    if (!this.running && this.nes) this._startLoop();
  }

  reset() {
    if (!this.nes) {
      this.onStatusUpdate("Emulator not initialized.");
      return;
    }
    try {
      const wasRunning = this.running;
      this.stop();
      if (typeof this.nes.reset === "function") {
        this.nes.reset();
        this.onStatusUpdate("Emulator reset.");
      } else {
        this.onStatusUpdate("Reset not supported by this emulator version.");
      }
      if (wasRunning) {
        this.start();
      }
    } catch (e) {
      console.error("Reset error:", e);
      this.onError(e);
    }
  }

  destroy() {
    this.stop();
    if (this.scriptNode) this.scriptNode.disconnect();
    if (this.masterGain) this.masterGain.disconnect();
    if (this.audioCtx) this.audioCtx.close();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.nes = null;
  }

  getNES() {
    return this.nes;
  }

  getCurrentRom() {
    return this.currentRom;
  }

  setCloudAuth(token, user = null) {
    this.cloudToken = token || null;
    this.cloudUser = user || null;
  }

  clearCloudAuth() {
    this.cloudToken = null;
    this.cloudUser = null;
  }

  getCloudAuth() {
    return {
      token: this.cloudToken,
      user: this.cloudUser,
    };
  }

  isCloudAuthed() {
    return !!this.cloudToken;
  }

  isCloudReachable() {
    return !!(this.cloudToken && navigator.onLine);
  }

  async _cloudFetch(path, options = {}) {
    if (!this.cloudToken) return { _error: "no_token" };
    try {
      const res = await fetch(this.cloudApiBase + path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + this.cloudToken,
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          this.onStatusUpdate("登录已过期，请重新登录");
          if (this.onCloudAuthExpired) this.onCloudAuthExpired();
        }
        return { _error: "http_" + res.status };
      }
      return await res.json();
    } catch (e) {
      console.warn("Cloud request failed:", e);
      return { _error: "network" };
    }
  }

  fitInParent() {
    if (!this.canvas) return;
    const parent = this.canvas.parentNode;
    if (!parent) return;
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;
    const parentRatio = parentWidth / parentHeight;
    const desiredRatio = 256 / 240;
    if (desiredRatio < parentRatio) {
      this.canvas.style.width = Math.round(parentHeight * desiredRatio) + "px";
      this.canvas.style.height = parentHeight + "px";
    } else {
      this.canvas.style.width = parentWidth + "px";
      this.canvas.style.height = Math.round(parentWidth / desiredRatio) + "px";
    }
  }

  _fitScreen() {
    requestAnimationFrame(() => {
      this.fitInParent();
    });
  }

  _compressForCloud(state) {
    try {
      if (typeof LZString !== "undefined") {
        const json = JSON.stringify(state);
        const compressed = LZString.compressToBase64(json);
        if (compressed.length < json.length * 0.9) {
          return { _c: true, d: compressed };
        }
      }
    } catch (e) {
      console.warn("Compress failed, sending uncompressed:", e);
    }
    return state;
  }

  _decompressFromCloud(state) {
    if (state && state._c === true && typeof state.d === "string") {
      try {
        if (typeof LZString !== "undefined") {
          const json = LZString.decompressFromBase64(state.d);
          if (json) return JSON.parse(json);
        }
      } catch (e) {
        console.warn("Decompress failed, falling back:", e);
      }
    }
    return state;
  }

  async saveState(slot) {
    if (!this.nes || !this.currentRom || !this.saveDB) {
      this.onStatusUpdate("Save system not ready.");
      return { ok: false, local: false, cloud: false };
    }
    try {
      const state = this.nes.toJSON ? this.nes.toJSON() : null;
      if (!state) {
        this.onStatusUpdate("Save not supported for this ROM.");
        return { ok: false, local: false, cloud: false };
      }
      const now = Date.now();
      const key = this.currentRom + "_slot" + slot;
      const data = {
        key: key,
        state: state,
        timestamp: now,
        rom: this.currentRom
      };

      const localOk = await new Promise((resolve) => {
        const tx = this.saveDB.transaction("saves", "readwrite");
        const store = tx.objectStore("saves");
        const req = store.put(data);
        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          console.warn("Save failed:", req.error);
          resolve(false);
        };
      });
      if (!localOk) {
        this.onStatusUpdate("本地存档写入失败");
        return { ok: false, local: false, cloud: false };
      }

      let cloudOk = false;
      if (this.cloudToken) {
        const cloudState = this._compressForCloud(state);
        const cloudResult = await this._cloudFetch(
          "/saves/" + encodeURIComponent(this.currentRom) + "/" + slot,
          {
            method: "PUT",
            body: JSON.stringify({ state: cloudState, timestamp: now }),
          }
        );
        cloudOk = cloudResult && !cloudResult._error;
        if (!cloudOk) {
          this.onStatusUpdate("已保存到本地，云存档上传失败（" + this._cloudErrorReason(cloudResult) + "）");
        } else {
          const user = this.cloudUser ? " (" + (this.cloudUser.username || this.cloudUser) + ")" : "";
          this.onStatusUpdate("已保存到本地 + 云存档" + user);
        }
      } else {
        this.onStatusUpdate("已保存到本地（未登录，无法云存档）");
      }

      return { ok: true, local: true, cloud: cloudOk };
    } catch (e) {
      console.warn("Save failed:", e);
      return { ok: false, local: false, cloud: false };
    }
  }

  _cloudErrorReason(result) {
    if (!result) return "无响应";
    if (result._error === "no_token") return "未登录";
    if (result._error === "network") return "网络错误";
    if (result._error === "http_401") return "登录过期";
    if (result._error === "http_413") return "存档过大";
    return "错误 " + (result._error || "未知");
  }

  async loadState(slot) {
    if (!this.nes || !this.currentRom || !this.saveDB) {
      this.onStatusUpdate("Save system not ready.");
      return { ok: false, source: null };
    }
    try {
      if (this.isCloudReachable()) {
        const cloudData = await this._cloudFetch(
          "/saves/" + encodeURIComponent(this.currentRom) + "/" + slot
        );
        if (cloudData && !cloudData._error && cloudData.state) {
          const state = this._decompressFromCloud(cloudData.state);
          if (state && this.nes.fromJSON) {
            this.nes.fromJSON(state);
            const cloudUser = this.cloudUser ? " (" + (this.cloudUser.username || this.cloudUser) + ")" : "";
            this.onStatusUpdate("已从云存档读取 Slot " + slot + cloudUser);

            const key = this.currentRom + "_slot" + slot;
            try {
              const tx = this.saveDB.transaction("saves", "readwrite");
              const store = tx.objectStore("saves");
              store.put({ key, state, timestamp: cloudData.timestamp || Date.now(), rom: this.currentRom });
            } catch (e) { /* cache best-effort */ }

            return { ok: true, source: "cloud" };
          }
        }
      }

      const key = this.currentRom + "_slot" + slot;
      return new Promise((resolve) => {
        const tx = this.saveDB.transaction("saves", "readonly");
        const store = tx.objectStore("saves");
        const req = store.get(key);
        req.onsuccess = () => {
          if (!req.result) {
            this.onStatusUpdate("Slot " + slot + " 无存档");
            resolve({ ok: false, source: null });
            return;
          }
          if (this.nes.fromJSON) {
            this.nes.fromJSON(req.result.state);
            this.onStatusUpdate("已从本地存档读取 Slot " + slot);
            resolve({ ok: true, source: "local" });
          } else {
            this.onStatusUpdate("存档格式不兼容");
            resolve({ ok: false, source: null });
          }
        };
        req.onerror = () => {
          console.warn("Load failed:", req.error);
          resolve({ ok: false, source: null });
        };
      });
    } catch (e) {
      console.warn("Load failed:", e);
      return { ok: false, source: null };
    }
  }

  async getSaveList() {
    if (!this.currentRom || !this.saveDB) return [];
    const saves = [];
    for (let i = 0; i < this.maxSaveSlots; i++) {
      const key = this.currentRom + "_slot" + i;
      try {
        const data = await new Promise((resolve, reject) => {
          const tx = this.saveDB.transaction("saves", "readonly");
          const store = tx.objectStore("saves");
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        if (data) {
          saves.push({ slot: i, timestamp: data.timestamp, rom: data.rom, exists: true, local: true, cloud: false });
        } else {
          saves.push({ slot: i, exists: false, local: false, cloud: false });
        }
      } catch (e) {
        saves.push({ slot: i, exists: false, local: false, cloud: false });
      }
    }

    if (this.isCloudReachable()) {
      const cloudList = await this._cloudFetch(
        "/saves/" + encodeURIComponent(this.currentRom)
      );
      if (cloudList && !cloudList._error && Array.isArray(cloudList.saves)) {
        cloudList.saves.forEach((cloudSave) => {
          const idx = Number(cloudSave.slot);
          if (Number.isNaN(idx) || idx < 0 || idx >= this.maxSaveSlots) return;
          const local = saves[idx] || { slot: idx, exists: false, local: false, cloud: false };
          const cloudTs = cloudSave.timestamp || 0;
          const localTs = local.timestamp || 0;
          saves[idx] = {
            slot: idx,
            timestamp: Math.max(cloudTs, localTs),
            rom: this.currentRom,
            exists: true,
            local: local.exists && local.local,
            cloud: true,
            cloudTimestamp: cloudTs,
            localTimestamp: localTs,
          };
        });
      }
    }

    return saves;
  }

  async deleteState(slot) {
    if (!this.saveDB) return;
    const key = this.currentRom + "_slot" + slot;
    await new Promise((resolve) => {
      const tx = this.saveDB.transaction("saves", "readwrite");
      const store = tx.objectStore("saves");
      const req = store.delete(key);
      req.onsuccess = () => {
        this.onStatusUpdate("已删除 Slot " + slot);
        resolve();
      };
      req.onerror = () => resolve();
    });
    if (this.isCloudReachable()) {
      const r = await this._cloudFetch(
        "/saves/" + encodeURIComponent(this.currentRom) + "/" + slot,
        { method: "DELETE" }
      );
      if (r && !r._error) {
        this.onStatusUpdate("已从本机和云存档删除 Slot " + slot);
      } else {
        this.onStatusUpdate("已从本机删除 Slot " + slot + "（云删除失败：" + this._cloudErrorReason(r) + "）");
      }
    } else {
      this.onStatusUpdate("已从本机删除 Slot " + slot);
    }
  }

  async syncCloudSaves(onProgress) {
    try {
      if (!this.currentRom || !this.saveDB) {
        return { ok: false, reason: "no_game" };
      }
      if (!this.isCloudReachable()) {
        return { ok: false, reason: this.cloudToken ? "offline" : "no_login" };
      }

      let pushed = 0, pulled = 0, failed = 0;

      const cloudList = await this._cloudFetch(
        "/saves/" + encodeURIComponent(this.currentRom)
      );
      const cloudMap = {};
      if (cloudList && !cloudList._error && Array.isArray(cloudList.saves)) {
        cloudList.saves.forEach(s => { cloudMap[s.slot] = s.timestamp || 0; });
      } else if (cloudList && cloudList._error === "http_401") {
        return { ok: false, reason: "auth_expired" };
      }

      for (let i = 0; i < this.maxSaveSlots; i++) {
        if (onProgress) onProgress(i, this.maxSaveSlots, "同步中...");

        const key = this.currentRom + "_slot" + i;
        let localData = null;
        try {
          localData = await new Promise((resolve, reject) => {
            const tx = this.saveDB.transaction("saves", "readonly");
            const store = tx.objectStore("saves");
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
        } catch (e) { /* skip */ }

        const localTs = localData ? localData.timestamp : 0;
        const cloudTs = cloudMap[i] || 0;

        if (localTs > cloudTs && localData) {
          const cloudState = this._compressForCloud(localData.state);
          const r = await this._cloudFetch(
            "/saves/" + encodeURIComponent(this.currentRom) + "/" + i,
            { method: "PUT", body: JSON.stringify({ state: cloudState, timestamp: localTs }) }
          );
          if (r && !r._error) pushed++;
          else failed++;
        } else if (cloudTs > localTs) {
          const cloudData = await this._cloudFetch(
            "/saves/" + encodeURIComponent(this.currentRom) + "/" + i
          );
          if (cloudData && !cloudData._error && cloudData.state) {
            const state = this._decompressFromCloud(cloudData.state);
            try {
              const tx = this.saveDB.transaction("saves", "readwrite");
              const store = tx.objectStore("saves");
              store.put({ key, state, timestamp: cloudData.timestamp, rom: this.currentRom });
            } catch (e) { /* skip */ }
            pulled++;
          } else {
            failed++;
          }
        }
      }

      return { ok: true, pushed, pulled, failed };
    } catch (e) {
      console.warn("syncCloudSaves error:", e);
      return { ok: false, reason: "error" };
    }
  }

  _saveBatteryRam(address, value) {
    try {
      let saves = JSON.parse(localStorage.getItem("nes_saves") || "{}");
      saves[address] = value;
      localStorage.setItem("nes_saves", JSON.stringify(saves));
    } catch (e) {
      console.warn("Failed to save battery RAM:", e);
    }
  }

  screenshot() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL("image/png");
  }

  getCoverImage() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL("image/png");
  }
}
