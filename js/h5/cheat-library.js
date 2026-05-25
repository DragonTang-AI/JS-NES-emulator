window.NES_CHEAT_LIBRARY = [
  {
    game: "三目童子",
    match: ["三目童子", "三目通 (日版)", "MitsumeGaTooru.nes", "Mitsume ga Tooru (Japan).nes"],
    cheats: [
      {
        id: "mitsume-hp",
        name: "无限血（HP）",
        description: "角色不会掉血",
        codes: [{ address: 0x007A, value: 0x01 }],
      },
      {
        id: "mitsume-max-money",
        name: "钱无限",
        description: "购物升级不用愁",
        codes: [{ address: 0x007C, value: 0x02 }],
      },
      {
        id: "mitsume-invincible",
        name: "闪烁无敌",
        description: "碰不到敌人",
        codes: [{ address: 0x0074, value: 0x01 }],
      },
      {
        id: "mitsume-all-weapons",
        name: "所有武器",
        description: "开局自带全套装备",
        codes: [{ address: 0x0081, value: 0x01 }],
      },
      {
        id: "mitsume-inf-life",
        name: "生命无限",
        description: "挂了多少条命都够用",
        codes: [{ address: 0x007B, value: 0x01 }],
      },
      {
        id: "mitsume-instant-arrow",
        name: "随时放箭",
        description: "按开启键就能射箭",
        codes: [{ address: 0x0527, value: 0x11 }],
      },
    ],
  },
  {
    game: "魂斗罗",
    match: ["魂斗罗", "Contra", "Contra (USA).nes"],
    cheats: [
      {
        id: "contra-inf-life",
        name: "无限命",
        description: "玩家1生命值锁定，永不减少",
        codes: [{ address: 0x0032, value: 0x09 }],
      },
      {
        id: "contra-inf-life-2p",
        name: "无限命 (双打)",
        description: "玩家2生命值同时锁定",
        codes: [
          { address: 0x0032, value: 0x09 },
          { address: 0x0033, value: 0x09 },
        ],
      },
    ],
  },
  {
    game: "超级马里奥",
    match: ["超级马里奥", "Super Mario Bros", "Super Mario Bros.nes", "Super Mario Bros (USA).nes"],
    cheats: [
      {
        id: "mario-inf-life",
        name: "无限命",
        description: "永远保持 99 条命",
        codes: [{ address: 0x075A, value: 0x63 }],
      },
    ],
  },
  {
    game: "坦克大战",
    match: ["坦克大战", "Battle City", "Battle City (USA).nes"],
    cheats: [
      {
        id: "battlecity-inf-life",
        name: "无限命",
        description: "玩家1生命值锁定",
        codes: [{ address: 0x0048, value: 0x09 }],
      },
      {
        id: "battlecity-inf-life-2p",
        name: "无限命 (双打)",
        description: "玩家1+2生命值同时锁定",
        codes: [
          { address: 0x0048, value: 0x09 },
          { address: 0x0049, value: 0x09 },
        ],
      },
    ],
  },
  {
    game: "冒险岛",
    match: ["冒险岛", "Adventure Island", "Adventure Island (USA).nes"],
    cheats: [
      {
        id: "adventure-island-inf-life",
        name: "无限命",
        description: "生命值锁定，不再 game over",
        codes: [{ address: 0x0067, value: 0x09 }],
      },
    ],
  },
  {
    game: "忍者龙剑传",
    match: ["忍者龙剑传", "Ninja Gaiden", "Ninja Gaiden (USA).nes"],
    cheats: [
      {
        id: "ninja-gaiden-inf-life",
        name: "无限命",
        description: "生命值锁定",
        codes: [{ address: 0x004E, value: 0x09 }],
      },
    ],
  },
  {
    game: "双截龙",
    match: ["双截龙", "Double Dragon", "Double Dragon (USA).nes"],
    cheats: [
      {
        id: "double-dragon-inf-life",
        name: "无限命",
        description: "玩家1生命值锁定",
        codes: [{ address: 0x0065, value: 0x09 }],
      },
    ],
  },
];
