class LibraryApp {
  constructor() {
    this.romManager = null;
    this.gridEl = document.getElementById("library-grid");
    this.searchInput = document.getElementById("search-input");
    this.statsEl = document.getElementById("library-stats");
    this.loadingOverlay = document.getElementById("loading-overlay");
    this.loadingBar = document.getElementById("loading-bar");
    this.loadingText = document.getElementById("loading-text");
    this.backLink = document.getElementById("library-back-link");
    this.currentCategory = "all";
    this.searchQuery = "";
    this.allGames = [];
    this.platform = "pc";
    this.returnUrl = "/";
    this.bundledGames = [
      { name: "MitsumeGaTooru.nes", label: "三目童子", url: "/roms/MitsumeGaTooru.nes", category: "puzzle", description: "-.", cover: null },
      { name: "Mitsume ga Tooru (Japan).nes", label: "三目通 (日版)", url: "/roms/Mitsume ga Tooru (Japan).nes", category: "puzzle", description: "-.", cover: null },
      { name: "2010 Street Fighter (Japan) (Beta).nes", label: "2010 街头霸王", url: "/roms/2010 Street Fighter (Japan) (Beta).nes", category: "puzzle", description: "-.", cover: null },
      { name: "Colour 2001 Streetfighter II (Asia) (En) (Pirate).nes", label: "2001 街头霸王II", url: "/roms/Colour 2001 Streetfighter II (Asia) (En) (Pirate).nes", category: "puzzle", description: "-.", cover: null },
      { name: "Contra (USA).nes", label: "魂斗罗", url: "/roms/Contra (USA).nes", category: "action", description: "经典横版射击游戏，玩家控制比尔·雷泽或兰斯·比恩，消灭外星人拯救世界。", cover: null },
      { name: "Crystalis (USA, Europe) (SNK 40th Anniversary Collection).nes", label: "水晶之剑", url: "/roms/Crystalis (USA, Europe) (SNK 40th Anniversary Collection).nes", category: "puzzle", description: "-.", cover: null },
    ];
  }

  async init() {
    this._readRouteContext();
    this._applyRouteContext();
    this.bindEvents();

    this.showLoading(10, "Initializing library...");
    try {
      this.romManager = new RomManager();
      await this.romManager.init();
      await this.loadGames();
      this.renderGames();
      this.showLoading(100, "Loaded " + this.allGames.length + " games");
      setTimeout(() => this.hideLoading(), 280);
    } catch (e) {
      console.error(e);
      this.showError(e.message || "Failed to initialize library");
      this.hideLoading();
    }
  }

  _readRouteContext() {
    const params = new URLSearchParams(window.location.search);
    const inferredH5 = window.location.pathname.indexOf("/h5/") === 0;
    this.platform = params.get("platform") === "h5" || inferredH5 ? "h5" : "pc";
    this.returnUrl = params.get("return") || (this.platform === "h5" ? "/h5/" : "/");
  }

  _applyRouteContext() {
    if (!this.backLink) return;
    this.backLink.href = this.returnUrl;
    this.backLink.textContent = this.platform === "h5" ? "返回H5" : "返回游戏";
  }

  bindEvents() {
    if (this.searchInput) {
      this.searchInput.addEventListener("input", (e) => {
        this.searchQuery = (e.target.value || "").trim().toLowerCase();
        this.renderGames();
      });
    }

    document.querySelectorAll("#category-filters .category-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.currentCategory = btn.dataset.category || "all";
        document.querySelectorAll("#category-filters .category-btn").forEach((el) => {
          el.classList.toggle("active", el === btn);
        });
        this.renderGames();
      });
    });
  }

  async loadGames() {
    this.showLoading(35, "Loading game list...");
    const bundled = this.bundledGames.map((g) => ({
      ...g,
      isBundled: true,
      favorite: this.romManager.isFavorite(g.name),
    }));

    const userRoms = await this.romManager.listROMs("all");
    const uploaded = userRoms.map((r) => ({
      name: r.name,
      label: r.name.replace(/\.nes$/i, ""),
      url: null,
      category: this.guessCategory(r.name),
      description: "User uploaded ROM",
      cover: null,
      isBundled: false,
      favorite: !!r.favorite,
    }));

    this.allGames = [...bundled, ...uploaded];
    this.showLoading(80, "Rendering games...");
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

  getFilteredGames() {
    let games = [...this.allGames];

    if (this.currentCategory === "favorites") {
      games = games.filter((g) => g.favorite);
    } else if (this.currentCategory !== "all") {
      games = games.filter((g) => g.category === this.currentCategory);
    }

    if (this.searchQuery) {
      games = games.filter((g) => g.label.toLowerCase().includes(this.searchQuery) || g.name.toLowerCase().includes(this.searchQuery));
    }

    return games;
  }

  renderGames() {
    const games = this.getFilteredGames();
    this.gridEl.innerHTML = "";

    if (games.length === 0) {
      this.gridEl.innerHTML = '<div class="library-empty"><div class="icon">🎮</div><div>No games found</div><div style="font-size:12px;margin-top:8px;color:#666;">Try a different search or category</div></div>';
      this.statsEl.textContent = "0 games";
      return;
    }

    this.statsEl.textContent = games.length + " game" + (games.length > 1 ? "s" : "");
    games.forEach((game) => {
      this.gridEl.appendChild(this.createGameCard(game));
    });
  }

  createGameCard(game) {
    const card = document.createElement("div");
    card.className = "game-card";

    const coverDiv = document.createElement("div");
    coverDiv.className = "cover";
    if (game.cover) {
      const img = document.createElement("img");
      img.src = game.cover;
      img.alt = game.label;
      coverDiv.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "placeholder";
      placeholder.textContent = "🎮";
      coverDiv.appendChild(placeholder);
    }

    const favOverlay = document.createElement("div");
    favOverlay.className = "fav-overlay" + (game.favorite ? " favorited" : "");
    favOverlay.textContent = game.favorite ? "★" : "☆";
    favOverlay.addEventListener("click", (e) => {
      e.stopPropagation();
      const newFav = this.romManager.toggleFavorite(game.name);
      game.favorite = newFav;
      favOverlay.textContent = newFav ? "★" : "☆";
      favOverlay.classList.toggle("favorited", newFav);
      if (this.currentCategory === "favorites" && !newFav) {
        this.renderGames();
      }
    });

    const infoDiv = document.createElement("div");
    infoDiv.className = "info";

    const titleEl = document.createElement("div");
    titleEl.className = "title";
    titleEl.textContent = game.label;

    const categoryEl = document.createElement("div");
    categoryEl.className = "category";
    categoryEl.textContent = this.getCategoryLabel(game.category);

    infoDiv.appendChild(titleEl);
    infoDiv.appendChild(categoryEl);

    card.appendChild(coverDiv);
    card.appendChild(favOverlay);
    card.appendChild(infoDiv);

    card.addEventListener("click", () => {
      this.openGameDetail(game);
    });

    return card;
  }

  openGameDetail(game) {
    const params = new URLSearchParams();
    params.set("name", game.name);
    params.set("bundled", game.isBundled ? "true" : "false");
    params.set("platform", this.platform);
    params.set("return", this.returnUrl);
    if (game.url) {
      params.set("url", game.url);
    }
    window.location.href = "game/?" + params.toString();
  }

  getCategoryLabel(category) {
    const labels = {
      action: "动作",
      adventure: "冒险",
      rpg: "RPG",
      sports: "体育",
      puzzle: "益智",
    };
    return labels[category] || category;
  }

  showLoading(percent, text) {
    this.loadingOverlay.classList.remove("hidden");
    this.loadingBar.style.width = percent + "%";
    this.loadingText.textContent = text;
  }

  hideLoading() {
    this.loadingOverlay.classList.add("hidden");
  }

  showError(msg) {
    this.gridEl.innerHTML = '<div class="library-empty"><div class="icon">⚠️</div><div>Error: ' + msg + "</div></div>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.libraryApp = new LibraryApp();
  window.libraryApp.init();
});
