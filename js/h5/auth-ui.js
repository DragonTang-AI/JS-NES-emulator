class AuthUI {
  constructor(app) {
    this.app = app;
    this.authTokenKey = "nes-auth-token";
    this.authToken = localStorage.getItem(this.authTokenKey) || null;
    this.authUser = null;
    this.authPromptDismissed = localStorage.getItem("nes-auth-prompt-dismissed") === "1";
  }

  init() {
    this.app.emulator.onCloudAuthExpired = () => {
      this.setAuthState(null, null);
      this.app.updateStatus("登录已过期，请重新登录以启用云存档");
      this.app.authPromptModal.hidden = false;
    };
    this._bindEvents();
  }

  _bindEvents() {
    if (this.app.authPromptClose) {
      this.app.authPromptClose.addEventListener("click", () => {
        this.app.authPromptModal.hidden = true;
      });
    }

    if (this.app.authPromptGuest) {
      this.app.authPromptGuest.addEventListener("click", () => {
        this.app.authPromptModal.hidden = true;
        this.authPromptDismissed = true;
        localStorage.setItem("nes-auth-prompt-dismissed", "1");
        this.app.updateStatus("游客模式：可游玩，但无法永久云存档");
      });
    }

    if (this.app.authPromptLogin) {
      this.app.authPromptLogin.addEventListener("click", () => {
        this.app.authPromptModal.hidden = true;
        this.authPromptDismissed = true;
        localStorage.setItem("nes-auth-prompt-dismissed", "1");
        this.app.openMenu();
        this.app._toggleAccountSubpage(true);
        if (this.app.authUsername) this.app.authUsername.focus();
      });
    }

    if (this.app.authPromptModal) {
      this.app.authPromptModal.addEventListener("click", (e) => {
        if (e.target === this.app.authPromptModal) {
          this.app.authPromptModal.hidden = true;
        }
      });
    }

    this.app.menuAccount.addEventListener("click", () => {
      this.app._toggleAccountSubpage();
    });

    if (this.app.authLoginBtn) {
      this.app.authLoginBtn.addEventListener("click", async () => {
        await this.login();
      });
    }

    if (this.app.authRegisterBtn) {
      this.app.authRegisterBtn.addEventListener("click", async () => {
        await this.register();
      });
    }

    if (this.app.authLogoutBtn) {
      this.app.authLogoutBtn.addEventListener("click", async () => {
        await this.logout();
      });
    }

    if (this.app.authSyncBtn) {
      this.app.authSyncBtn.addEventListener("click", async () => {
        if (!this.app.emulator.isCloudReachable()) {
          this.app.updateStatus(this.app.emulator.isCloudAuthed() ? "当前离线，无法同步" : "未登录");
          return;
        }
        this.app.authSyncBtn.disabled = true;
        const user = this.authUser ? " (" + this.authUser.username + ")" : "";
        this.app.updateStatus("正在同步云存档" + user + "...");
        const result = await this.app.emulator.syncCloudSaves();
        this.app.authSyncBtn.disabled = false;
        if (result.ok) {
          const parts = [];
          if (result.pushed > 0) parts.push(result.pushed + "\u4E2A\u4E0A\u4F20");
          if (result.pulled > 0) parts.push(result.pulled + "\u4E2A\u4E0B\u8F7D");
          const msg = parts.length > 0 ? "\u540C\u6B65\u5B8C\u6210\uFF1A" + parts.join("\uFF0C") : "\u6240\u6709\u5B58\u6863\u5DF2\u662F\u6700\u65B0";
          this.app.updateStatus(msg + user);
        } else if (result.reason === "no_login") {
          this.app.updateStatus("\u672A\u767B\u5F55\uFF0C\u65E0\u6CD5\u540C\u6B65");
        } else if (result.reason === "offline") {
          this.app.updateStatus("\u5F53\u524D\u79BB\u7EBF\uFF0C\u65E0\u6CD5\u540C\u6B65");
        } else {
          this.app.updateStatus("\u540C\u6B65\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
        }
      });
    }
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

  setAuthState(token, user) {
    this.authToken = token || null;
    this.authUser = user || null;
    if (this.authToken) {
      localStorage.setItem(this.authTokenKey, this.authToken);
      if (this.app.emulator) {
        this.app.emulator.setCloudAuth(this.authToken, this.authUser);
      }
    } else {
      localStorage.removeItem(this.authTokenKey);
      if (this.app.emulator) {
        this.app.emulator.clearCloudAuth();
      }
    }
    this.syncAuthUI();
  }

  syncAuthUI() {
    if (this.authUser && this.authUser.username) {
      this.app.menuAccountLabel.textContent = this.authUser.username;
      if (this.app.menuAuthForm) this.app.menuAuthForm.hidden = true;
      if (this.app.menuAuthInfo) {
        this.app.menuAuthInfo.hidden = false;
        this.app.menuAuthUser.textContent = "已登录: " + this.authUser.username;
      }
    } else {
      this.app.menuAccountLabel.textContent = "未登录";
      if (this.app.menuAuthForm) this.app.menuAuthForm.hidden = false;
      if (this.app.menuAuthInfo) this.app.menuAuthInfo.hidden = true;
    }
  }

  async restoreAuthSession() {
    if (!this.authToken) {
      this.setAuthState(null, null);
      return;
    }
    try {
      const data = await this.apiRequest("/auth/me", "GET", null, true);
      this.setAuthState(this.authToken, data.user || null);
    } catch (e) {
      this.setAuthState(null, null);
    }
  }

  async register() {
    const username = (this.app.authUsername && this.app.authUsername.value || "").trim();
    const password = (this.app.authPassword && this.app.authPassword.value || "").trim();
    if (username.length < 3 || username.length > 24) {
      this.app.updateStatus("账号长度需 3-24 位");
      return;
    }
    if (password.length < 6) {
      this.app.updateStatus("密码至少 6 位");
      return;
    }
    try {
      await this.apiRequest("/auth/register", "POST", { username, password }, false);
      this.app.updateStatus("注册成功，请登录");
    } catch (e) {
      this.app.updateStatus("注册失败: " + e.message);
    }
  }

  async login() {
    const username = (this.app.authUsername && this.app.authUsername.value || "").trim();
    const password = (this.app.authPassword && this.app.authPassword.value || "").trim();
    if (!username || !password) {
      this.app.updateStatus("请输入账号和密码");
      return;
    }
    try {
      const data = await this.apiRequest("/auth/login", "POST", { username, password }, false);
      this.setAuthState(data.token, data.user || null);
      this.app._toggleAccountSubpage(false);
      this.app.updateStatus("登录成功，云存档已启用");
      if (this.app.authPassword) this.app.authPassword.value = "";
    } catch (e) {
      this.app.updateStatus("登录失败: " + e.message);
    }
  }

  async logout() {
    this.setAuthState(null, null);
    this.app._toggleAccountSubpage(false);
    this.app.updateStatus("已退出登录");
  }
}
