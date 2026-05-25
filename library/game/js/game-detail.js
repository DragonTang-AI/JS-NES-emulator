class GameDetailApp {
  constructor() {
    this.romManager = null;
    this.gameName = "";
    this.isBundled = false;
    this.gameUrl = "";
    this.gameData = null;
    this.platform = "pc";
    this.returnUrl = "/";
            this.bundledGames = {
      "MitsumeGaTooru.nes": { label: "三目童子", url: "/roms/MitsumeGaTooru.nes", category: "puzzle", description: "-.", cover: null },
      "Mitsume ga Tooru (Japan).nes": { label: "三目通 (日版)", url: "/roms/Mitsume ga Tooru (Japan).nes", category: "puzzle", description: "-.", cover: null },
      "2010 Street Fighter (Japan) (Beta).nes": { label: "2010 街头霸王", url: "/roms/2010 Street Fighter (Japan) (Beta).nes", category: "puzzle", description: "-.", cover: null },
      "Colour 2001 Streetfighter II (Asia) (En) (Pirate).nes": { label: "2001 街头霸王II", url: "/roms/Colour 2001 Streetfighter II (Asia) (En) (Pirate).nes", category: "puzzle", description: "-.", cover: null },
      "Contra (USA).nes": { label: "魂斗罗", url: "/roms/Contra (USA).nes", category: "action", description: "经典横版射击游戏，玩家控制比尔·雷泽或兰斯·比恩，消灭外星人拯救世界。", cover: null },
      "Crystalis (USA, Europe) (SNK 40th Anniversary Collection).nes": { label: "水晶之剑", url: "/roms/Crystalis (USA, Europe) (SNK 40th Anniversary Collection).nes", category: "puzzle", description: "-.", cover: null },
    };
  }

  async init() {
    this.romManager = new RomManager();
    await this.romManager.init();

    const params = new URLSearchParams(window.location.search);
    this.gameName = params.get("name") || "";
    this.gameUrl = params.get("url") || "";
    this.isBundled = params.get("bundled") === "true";
    const inferredH5 = window.location.pathname.indexOf("/h5/") === 0;
    this.platform = params.get("platform") === "h5" || inferredH5 ? "h5" : "pc";
    this.returnUrl = params.get("return") || (this.platform === "h5" ? "/h5/" : "/");

    this.updateBackLinks();

    if (!this.gameName) {
      this.showError("No game specified");
      return;
    }

    await this.loadGameInfo();
    this.bindEvents();
  }

  updateBackLinks() {
    const href = this.getLibraryUrl();
    document.querySelectorAll(".game-back").forEach((link) => {
      link.href = href;
    });
  }

  getLibraryUrl() {
    const params = new URLSearchParams();
    params.set("platform", this.platform);
    params.set("return", this.returnUrl);
    return "../?" + params.toString();
  }

  async loadGameInfo() {
    this.showLoading(0, "Loading game info...");

    let gameInfo = null;

    if (this.isBundled && this.bundledGames[this.gameName]) {
      gameInfo = {
        ...this.bundledGames[this.gameName],
        name: this.gameName,
        isBundled: true,
        favorite: this.romManager.isFavorite(this.gameName)
      };
    } else {
      const roms = await this.romManager.listROMs("all");
      const rom = roms.find(r => r.name === this.gameName);
      if (rom) {
        gameInfo = {
          name: rom.name,
          label: rom.name.replace(/\.nes$/i, ""),
          url: null,
          category: this.guessCategory(rom.name),
          description: "User uploaded ROM",
          cover: null,
          isBundled: false,
          favorite: rom.favorite
        };
      }
    }

    if (!gameInfo) {
      this.showError("Game not found: " + this.gameName);
      return;
    }

    this.gameData = gameInfo;
    this.renderGameInfo(gameInfo);
    this.showLoading(100, "Loaded");
    setTimeout(() => this.hideLoading(), 500);

    if (!this.isBundled) {
      this.generateCover();
    }
  }

  guessCategory(filename) {
    const name = filename.toLowerCase();
    if (name.includes("mario") || name.includes("contra") || name.includes("ninja")) return "action";
    if (name.includes("zelda") || name.includes("metroid") || name.includes("adventure")) return "adventure";
    if (name.includes("dragon") || name.includes("final") || name.includes("quest")) return "rpg";
    if (name.includes("tennis") || name.includes("soccer") || name.includes("basket")) return "sports";
    if (name.includes("puzzle") || name.includes("tetris") || name.includes("mitsume")) return "puzzle";
    return "action";
  }

  renderGameInfo(game) {
    document.getElementById("game-title").textContent = game.label;
    document.getElementById("game-category").textContent = this.getCategoryLabel(game.category);
    document.getElementById("game-description").textContent = game.description;

    const favBtn = document.getElementById("game-fav-btn");
    favBtn.textContent = game.favorite ? "★ 已收藏" : "☆ 收藏";
    favBtn.classList.toggle("favorited", game.favorite);

    if (!game.isBundled) {
      document.getElementById("btn-delete").style.display = "inline-block";
    }

    this.renderSaveInfo();
  }

  renderSaveInfo() {
    const saveInfo = document.getElementById("save-info");
    let saveCount = 0;
    for (let i = 0; i < 10; i++) {
      const key = "nes_save_meta_" + this.gameName + "_slot" + i;
      if (localStorage.getItem(key)) saveCount++;
    }
    saveInfo.textContent = saveCount + " / 10 槽位已使用";
  }

  generateCover() {
    if (!this.gameData || this.gameData.cover) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 256;
    tempCanvas.height = 240;
    const tempCtx = tempCanvas.getContext("2d");

    tempCtx.fillStyle = "#000";
    tempCtx.fillRect(0, 0, 256, 240);

    tempCtx.fillStyle = "#e94560";
    tempCtx.font = "bold 20px monospace";
    tempCtx.textAlign = "center";
    tempCtx.fillText(this.gameData.label, 128, 110);

    tempCtx.fillStyle = "#888";
    tempCtx.font = "12px monospace";
    tempCtx.fillText("NES ROM", 128, 140);

    const coverData = tempCanvas.toDataURL("image/png");
    this.gameData.cover = coverData;

    const coverEl = document.getElementById("game-cover");
    coverEl.innerHTML = "";
    const img = document.createElement("img");
    img.src = coverData;
    img.alt = this.gameData.label;
    coverEl.appendChild(img);
  }

  bindEvents() {
    document.getElementById("btn-play").addEventListener("click", () => {
      const base = this.platform === "h5" ? "/h5/" : "../../";
      const romParam = this.isBundled ? this.gameUrl : this.gameName;
      const playUrl =
        base +
        "?rom=" +
        encodeURIComponent(romParam) +
        "&name=" +
        encodeURIComponent(this.gameData.label);
      window.location.href = playUrl;
    });

    document.getElementById("game-fav-btn").addEventListener("click", () => {
      const newFav = this.romManager.toggleFavorite(this.gameName);
      this.gameData.favorite = newFav;
      const favBtn = document.getElementById("game-fav-btn");
      favBtn.textContent = newFav ? "★ 已收藏" : "☆ 收藏";
      favBtn.classList.toggle("favorited", newFav);
    });

    document.getElementById("btn-delete").addEventListener("click", async () => {
      if (confirm("Delete " + this.gameName + "?")) {
        await this.romManager.deleteROM(this.gameName);
        window.location.href = this.getLibraryUrl();
      }
    });
  }

  getCategoryLabel(category) {
    const labels = {
      action: "动作",
      adventure: "冒险",
      rpg: "RPG",
      sports: "体育",
      puzzle: "益智"
    };
    return labels[category] || category;
  }

  showLoading(percent, text) {
    document.getElementById("loading-overlay").classList.remove("hidden");
    document.getElementById("loading-bar").style.width = percent + "%";
    document.getElementById("loading-text").textContent = text;
  }

  hideLoading() {
    document.getElementById("loading-overlay").classList.add("hidden");
  }

  showError(msg) {
    const backHref = this.getLibraryUrl();
    document.getElementById("game-detail").innerHTML = `
      <a href="${backHref}" class="game-back">← 返回游戏库</a>
      <div style="text-align:center;padding:60px 20px;color:#888;">
        <div style="font-size:48px;margin-bottom:15px;">⚠️</div>
        <div>${msg}</div>
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.gameDetailApp = new GameDetailApp();
  window.gameDetailApp.init();
});
