class VirtualGamepad {
  constructor(emulator, options = {}) {
    this.emulator = emulator;
    this.options = options;
    this.joystick = null;
    this.actionHandler = null;
  }

  init() {
    this.joystick = new FloatingJoystick(this.emulator, this.options);
    this.actionHandler = new ActionButtonHandler(this.emulator, this.options);
  }

  setJoystickMode(mode) {
    if (this.joystick) this.joystick.setMode(mode);
  }

  setVibrationEnabled(enabled) {
    if (this.actionHandler) this.actionHandler.setVibrationEnabled(enabled);
  }

  setShowHint(enabled) {
    if (this.joystick) this.joystick.setHintEnabled(enabled);
  }
}

class FloatingJoystick {
  constructor(emulator, options = {}) {
    this.emulator = emulator;
    this.deadZone = 0.12;
    this.maxRadius = 50;
    this.mode = options.joystickMode === "fixed" ? "fixed" : "floating";
    this.hintEnabled = options.showJoystickHint !== false;
    this.activeButtons = new Set();
    this.pointerId = null;
    this.centerX = 0;
    this.centerY = 0;
    this.homeX = 0;
    this.homeY = 0;
    this.rafId = 0;
    this.latestTransform = "translate(-50%, -50%)";

    this.zone = document.getElementById("joystick-zone");
    this.base = document.getElementById("joystick-base");
    this.knob = document.getElementById("joystick-knob");
    this.hint = document.getElementById("joystick-hint");

    this._bindEvents();
    this._setIdlePosition();
    this._showIdleJoystick();
    this._syncHint();
  }

  _bindEvents() {
    this.zone.addEventListener("pointerdown", (e) => this._onStart(e));
    this.zone.addEventListener("pointermove", (e) => this._onMove(e));
    this.zone.addEventListener("pointerrawupdate", (e) => this._onMove(e));
    this.zone.addEventListener("pointerup", (e) => this._onEnd(e));
    this.zone.addEventListener("pointercancel", (e) => this._onEnd(e));
    window.addEventListener("resize", () => this._setIdlePosition());
  }

  _setIdlePosition() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const defaultX = isLandscape ? Math.round(window.innerWidth * 0.16) : Math.round(window.innerWidth * 0.22);
    const defaultY = isLandscape ? window.innerHeight - 95 : window.innerHeight - 140;

    this.homeX = Math.max(68, defaultX);
    this.homeY = Math.max(84, defaultY);

    if (this.pointerId !== null) return;

    this.base.style.left = this.homeX + "px";
    this.base.style.top = this.homeY + "px";
    this.knob.style.left = this.homeX + "px";
    this.knob.style.top = this.homeY + "px";
    this.knob.style.transform = "translate(-50%, -50%)";
  }

  _showIdleJoystick() {
    this.base.classList.remove("active");
    this.knob.classList.remove("active");
    this.base.classList.add("idle");
    this.knob.classList.add("idle");
    this.base.style.left = this.homeX + "px";
    this.base.style.top = this.homeY + "px";
    this.knob.style.left = this.homeX + "px";
    this.knob.style.top = this.homeY + "px";
    this.knob.style.transform = "translate(-50%, -50%)";
  }

  _syncHint() {
    if (!this.hint) return;
    if (this.hintEnabled) {
      this.hint.classList.remove("dismissed");
    } else {
      this.hint.classList.add("dismissed");
    }
  }

  _dismissHint() {
    if (this.hint && this.hintEnabled) {
      this.hint.classList.add("dismissed");
    }
  }

  setMode(mode) {
    this.mode = mode === "fixed" ? "fixed" : "floating";
    if (this.pointerId === null) {
      this._showIdleJoystick();
    }
  }

  setHintEnabled(enabled) {
    this.hintEnabled = !!enabled;
    this._syncHint();
  }

  _onStart(e) {
    e.preventDefault();
    if (this.pointerId !== null) return;

    this._dismissHint();

    this.pointerId = e.pointerId;
    if (this.mode === "fixed") {
      this.centerX = this.homeX;
      this.centerY = this.homeY;
    } else {
      this.centerX = e.clientX;
      this.centerY = e.clientY;
    }

    this.base.classList.remove("idle");
    this.knob.classList.remove("idle");

    this.base.style.left = this.centerX + "px";
    this.base.style.top = this.centerY + "px";
    this.base.classList.add("active");

    this.knob.style.left = this.centerX + "px";
    this.knob.style.top = this.centerY + "px";
    this.knob.style.transition = "none";
    this.latestTransform = "translate(-50%, -50%)";
    this.knob.style.transform = this.latestTransform;
    this.knob.classList.add("active");

    this.zone.setPointerCapture(e.pointerId);
  }

  _onMove(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();

    const dx = e.clientX - this.centerX;
    const dy = e.clientY - this.centerY;
    const distance = Math.hypot(dx, dy);
    const clamped = Math.min(distance, this.maxRadius);
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;

    this.latestTransform = "translate(calc(-50% + " + kx + "px), calc(-50% + " + ky + "px))";

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.knob.style.transform = this.latestTransform;
        this.rafId = 0;
      });
    }

    this._updateDirection(dx, dy, clamped);
  }

  _updateDirection(dx, dy, clampedDistance) {
    const nes = this.emulator.getNES();
    if (!nes) return;

    const force = clampedDistance / this.maxRadius;
    const newButtons = new Set();

    if (force > this.deadZone) {
      const nx = dx / this.maxRadius;
      const ny = dy / this.maxRadius;
      if (ny < -this.deadZone) newButtons.add(jsnes.Controller.BUTTON_UP);
      if (ny > this.deadZone) newButtons.add(jsnes.Controller.BUTTON_DOWN);
      if (nx < -this.deadZone) newButtons.add(jsnes.Controller.BUTTON_LEFT);
      if (nx > this.deadZone) newButtons.add(jsnes.Controller.BUTTON_RIGHT);
    }

    for (const btn of this.activeButtons) {
      if (!newButtons.has(btn)) nes.buttonUp(1, btn);
    }
    for (const btn of newButtons) {
      if (!this.activeButtons.has(btn)) nes.buttonDown(1, btn);
    }
    this.activeButtons = newButtons;
  }

  _onEnd(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();

    const nes = this.emulator.getNES();
    if (nes) {
      for (const btn of this.activeButtons) {
        nes.buttonUp(1, btn);
      }
    }

    this.activeButtons = new Set();
    this.pointerId = null;

    this.base.classList.remove("active");
    this.knob.classList.remove("active");
    this.base.classList.add("idle");
    this.knob.classList.add("idle");

    this.base.style.left = this.homeX + "px";
    this.base.style.top = this.homeY + "px";

    this.knob.style.transition = "transform 150ms ease-out, left 150ms ease-out, top 150ms ease-out";
    this.knob.style.left = this.homeX + "px";
    this.knob.style.top = this.homeY + "px";
    this.knob.style.transform = "translate(-50%, -50%)";

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    setTimeout(() => {
      this.knob.style.transition = "none";
    }, 170);

    try {
      this.zone.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }
}

class ActionButtonHandler {
  constructor(emulator, options = {}) {
    this.emulator = emulator;
    this.vibrationEnabled = options.vibrationEnabled !== false;
    this.buttonMap = {
      "btn-a": jsnes.Controller.BUTTON_A,
      "btn-b": jsnes.Controller.BUTTON_B,
      "btn-start": jsnes.Controller.BUTTON_START,
      "btn-select": jsnes.Controller.BUTTON_SELECT,
    };
    this.activePointers = new Map();

    this._bindEvents();
  }

  setVibrationEnabled(enabled) {
    this.vibrationEnabled = !!enabled;
  }

  _bindEvents() {
    for (const [id, button] of Object.entries(this.buttonMap)) {
      const el = document.getElementById(id);
      if (!el) continue;

      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        const nes = this.emulator.getNES();
        if (!nes) return;
        nes.buttonDown(1, button);
        if (this.vibrationEnabled && navigator.vibrate) {
          navigator.vibrate(10);
        }
        this.activePointers.set(e.pointerId, { id, button, el });
        el.classList.add("pressed");
        el.setPointerCapture(e.pointerId);
      });

      el.addEventListener("pointerleave", (e) => {
        if (!el.hasPointerCapture(e.pointerId)) {
          this._releasePointer(e.pointerId);
        }
      });

      el.addEventListener("pointerup", (e) => {
        e.preventDefault();
        this._releasePointer(e.pointerId);
      });

      el.addEventListener("pointercancel", (e) => {
        this._releasePointer(e.pointerId);
      });
    }
  }

  _releasePointer(pointerId) {
    const info = this.activePointers.get(pointerId);
    if (!info) return;

    const nes = this.emulator.getNES();
    if (nes) nes.buttonUp(1, info.button);

    this.activePointers.delete(pointerId);
    info.el.classList.remove("pressed");

    try {
      info.el.releasePointerCapture(pointerId);
    } catch (err) {}
  }
}
