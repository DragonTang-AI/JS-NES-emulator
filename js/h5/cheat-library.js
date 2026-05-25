window.NES_CHEAT_LIBRARY = [
  {
    game: "三目童子",
    roms: [
      "三目童子",
      "三目通 (日版)",
      "MitsumeGaTooru.nes",
      "Mitsume ga Tooru (Japan).nes",
    ],
    cheats: [
      {
        name: "无限命",
        desc: "游戏结束后不会减少生命次数",
        codes: [{ address: 0x007B, value: 0x09 }],
      },
    ],
  },
  {
    game: "魂斗罗",
    roms: [
      "魂斗罗",
      "Contra",
      "Contra (USA).nes",
    ],
    cheats: [
      {
        name: "无限命",
        desc: "玩家1生命值锁定，永不减少",
        codes: [{ address: 0x0032, value: 0x09 }],
      },
      {
        name: "无限命 (双打)",
        desc: "玩家2生命值同时锁定",
        codes: [
          { address: 0x0032, value: 0x09 },
          { address: 0x0033, value: 0x09 },
        ],
      },
    ],
  },
  {
    game: "超级马里奥",
    roms: [
      "超级马里奥",
      "Super Mario Bros",
      "Super Mario Bros.nes",
      "Super Mario Bros (USA).nes",
    ],
    cheats: [
      {
        name: "无限命",
        desc: "永远保持 99 条命",
        codes: [{ address: 0x075A, value: 0x63 }],
      },
    ],
  },
  {
    game: "坦克大战",
    roms: [
      "坦克大战",
      "Battle City",
      "Battle City (USA).nes",
    ],
    cheats: [
      {
        name: "无限命",
        desc: "玩家1生命值锁定",
        codes: [{ address: 0x0048, value: 0x09 }],
      },
      {
        name: "无限命 (双打)",
        desc: "玩家1+2生命值同时锁定",
        codes: [
          { address: 0x0048, value: 0x09 },
          { address: 0x0049, value: 0x09 },
        ],
      },
    ],
  },
  {
    game: "冒险岛",
    roms: [
      "冒险岛",
      "Adventure Island",
      "Adventure Island (USA).nes",
    ],
    cheats: [
      {
        name: "无限命",
        desc: "生命值锁定，不再 game over",
        codes: [{ address: 0x0067, value: 0x09 }],
      },
    ],
  },
  {
    game: "忍者龙剑传",
    roms: [
      "忍者龙剑传",
      "Ninja Gaiden",
      "Ninja Gaiden (USA).nes",
    ],
    cheats: [
      {
        name: "无限命",
        desc: "生命值锁定",
        codes: [{ address: 0x004E, value: 0x09 }],
      },
    ],
  },
  {
    game: "双截龙",
    roms: [
      "双截龙",
      "Double Dragon",
      "Double Dragon (USA).nes",
    ],
    cheats: [
      {
        name: "无限命",
        desc: "玩家1生命值锁定",
        codes: [{ address: 0x0065, value: 0x09 }],
      },
    ],
  },
];
