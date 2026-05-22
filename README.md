# NES 在线模拟器 (JS-NES-emulator)

基于 Web 的 NES 模拟器，支持 PC 端和移动端（H5）两种界面，集成用户账户系统和云存档功能。

## Credits

本项目基于以下开源项目开发，在此表示诚挚感谢：

### jsnes — 核心 NES 模拟引擎

- **GitHub**: https://github.com/bfirsh/jsnes
- **作者**: Jamie Sanders, Ben Firshman
- **协议**: MIT License
- **使用方式**: 通过 CDN (`unpkg.com/jsnes@1.2.1`) 加载，运行 NES ROM
- **在本项目中的角色**: `js/core/emulator.js` 封装了 jsnes 的 `jsnes.NES` 类，提供 ROM 加载、音视频输出、按键绑定等功能

### MMC3 IRQ Counter Fix

- **来源**: jsnes issue #595 社区修正
- **文件**: `js/core/mapper4-fix.js`
- **用途**: 修复 MMC3 (Mapper 4) 映射器 IRQ 计数器行为，使《三目童子》等游戏正常运行

### 其他参考

- 虚拟手柄设计参考了移动端游戏通用交互模式
- 云存档架构参考了 IndexedDB + 服务端持久化的混合存储方案

## 项目架构

```
nes-dragontang/
├── index.html                  # PC 版入口
├── h5/
│   └── index.html              # 移动端 (H5) 入口
├── library/
│   ├── index.html              # PC 版游戏库
│   └── game/
│       └── index.html          # 游戏详情页
├── h5/library/                 # H5 版游戏库（同上结构）
├── css/
│   ├── common.css              # 公用样式
│   ├── pc.css                  # PC 端样式
│   ├── h5.css                  # 移动端样式（滑动菜单、虚拟手柄）
│   ├── library.css             # 游戏库样式
│   └── game.css                # 游戏详情页样式
├── js/
│   ├── core/
│   │   ├── emulator.js         # NES 模拟器核心封装（加载 jsnes、音视频、云存档）
│   │   ├── rom-manager.js      # ROM 管理（IndexedDB 存储、收藏）
│   │   ├── save-manager.js     # 存档管理 UI（本地+云存档）
│   │   └── mapper4-fix.js      # MMC3 Mapper 4 修正
│   ├── h5/
│   │   ├── h5-app.js           # 移动端主应用（滑动菜单、账户、设置）
│   │   └── virtual-gamepad.js  # 虚拟手柄（摇杆、AB按钮）
│   ├── pc/
│   │   └── pc-app.js           # PC 端主应用
│   └── library/
│       └── library-app.js      # 游戏库页面应用
├── backend/
│   ├── server.js               # Express API 服务器 (JWT + SQLite)
│   ├── package.json
│   └── data/                   # SQLite 数据库（运行时生成，不提交）
├── roms/                       # 内置 NES ROM 文件
├── sw.js                       # Service Worker（离线缓存、网络策略）
├── manifest.json               # PWA 配置
└── favicon.ico / icons         # 图标
```

### 前端架构

- **双界面设计**: PC 版 (`/`) 适合键鼠操作；H5 版 (`/h5/`) 专为移动端触屏优化，带虚拟手柄和滑动菜单
- **离线存储**: 使用 IndexedDB 存储上传的 ROM 文件和本地存档
- **PWA 支持**: Service Worker 实现离线缓存，支持移动设备添加到主屏幕
- **响应式适配**: 自动检测横竖屏，调整布局和手柄样式

### 后端架构

- **运行环境**: Node.js + Express
- **数据库**: SQLite（better-sqlite3）
- **认证**: JWT (jsonwebtoken) + bcryptjs 密码哈希
- **API 端点**:

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录，返回 JWT |
| GET | `/api/auth/me` | 验证 Token，返回用户信息 |
| GET | `/api/saves/:rom` | 获取某游戏的云存档列表 |
| GET | `/api/saves/:rom/:slot` | 获取指定存档 |
| PUT | `/api/saves/:rom/:slot` | 保存/覆盖云存档 |
| DELETE | `/api/saves/:rom/:slot` | 删除云存档 |

### 存档体系

- **本地存档**: 通过 IndexedDB 直接存储在浏览器中
- **云存档**: 登录后自动同步到后端 SQLite 数据库
- **存档管理**: PC 版有独立的存档管理面板，H5 版通过虚拟手柄的「存/读」按钮操作

## 部署方式

### 环境要求

- **Web 服务器**: Nginx（推荐）或 Apache
- **Node.js**: v18+
- **域名**: 配置 SSL 证书（Let's Encrypt 等）

### 1. 部署静态文件

将所有静态文件（HTML/CSS/JS/ROM等）部署到 Web 服务器的根目录，例如 `/var/www/nes-dragontang/`。

### 2. 部署后端

```bash
cd /var/www/nes-dragontang/backend
npm install
# 使用 pm2 或 nohup 保持运行
nohup node server.js > /var/log/nes-api.log 2>&1 &
```

后端默认运行在 `3030` 端口。`JWT_SECRET` 可通过环境变量配置。

### 3. 配置 Nginx

```nginx
server {
    server_name nes.example.com;

    location /api/ {
        proxy_pass http://127.0.0.1:3030/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    root /var/www/nes-dragontang;
    index index.html;

    location =/sw.js {
        add_header Cache-Control "no-cache, must-revalidate";
        add_header Service-Worker-Allowed /;
    }

    location ~* \.(js|css|png|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ =404;
    }

    listen 443 ssl;
    # SSL 配置...
}
```

### 4. 用户访问

- **PC 用户**: `https://nes.example.com/`
- **移动端用户**: `https://nes.example.com/h5/`
- **游戏库**: `https://nes.example.com/library/`

## 开发

### 内置 ROM

项目根目录 `roms/` 下放置 `.nes` 文件，在 `h5-app.js` 中的 `bundledROMs` 数组配置显示名称和路径。

### Service Worker

`sw.js` 定义了四种缓存策略：
- **API 请求** (networkFirst): `/api/*`
- **JS/CSS** (staleWhileRevalidate): `/js/*`, `/css/*`
- **静态资源** (cacheFirst): 图片、字体等
- **页面** (networkFirst): HTML 页面

部署新版本时，修改 SW 中的 `CACHE` 版本号（如 `v3` → `v4`）以触发浏览器更新缓存。

## 协议

- 项目代码：MIT License
- jsnes 核心库：MIT License (Copyright Jamie Sanders)
- 内置 ROM 文件仅供学习和测试使用，请自行替换为合法获取的 ROM 文件
