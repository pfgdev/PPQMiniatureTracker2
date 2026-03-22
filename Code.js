function doGet() {
  var template = HtmlService.createTemplateFromFile("Index");
  template.initialStateJson = JSON.stringify(buildMockAppState_());

  return template
    .evaluate()
    .setTitle("PPQ Miniature Tracker")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function buildMockAppState_() {
  var groups = [
    createMockGroup_({
      rootId: "013-ZHESOL",
      name: "Zhent Soldier",
      home: "Spare People",
      size: "Medium",
      creatureType: "Humanoid",
      sex: "Male",
      race: "Human",
      role: "Tank",
      paint: true,
      set: "Lords of Madness",
      setNumber: "60",
      notes: "Great CR3-ish beefy minion.",
      stickers: ["A12", "A55", "A56"],
      currentLocations: ["Spare People", "Spare People", "Spare People"]
    }),
    createMockGroup_({
      rootId: "086-BREJAG",
      name: "Bregol Jagstone",
      home: "Dwarves",
      size: "Medium",
      creatureType: "Humanoid",
      sex: "Male",
      race: "Dwarf",
      role: "Melee",
      paint: true,
      set: "n/a",
      setNumber: "",
      notes: "Repeat miniature with custom paint job. Works well as a woodsman or ranger.",
      stickers: ["A97"],
      currentLocations: ["Quest Minis"]
    }),
    createMockGroup_({
      rootId: "048-SPIFOLFIG",
      name: "Spirit Folk Fighter",
      home: "Spare People",
      size: "Medium",
      creatureType: "Humanoid",
      sex: "Female",
      race: "Elf",
      role: "Melee",
      paint: true,
      set: "Underdark (2005)",
      setNumber: "23",
      notes: "Very basic elf with a sword. Useful everywhere.",
      stickers: ["C10", "C11", "C12", "C13", "C14", "C15", "C16", "C17", "C18", "C19"],
      currentLocations: [
        "Spare People",
        "Spare People",
        "Spare People",
        "Spare People",
        "Spare People",
        "Spare People",
        "Encounter Box G",
        "Spare People",
        "Quest Minis",
        "Spare People"
      ]
    }),
    createMockGroup_({
      rootId: "070-HUMTOWGAR",
      name: "Human Town Guard",
      home: "Spare People",
      size: "Medium",
      creatureType: "Humanoid",
      sex: "Male",
      race: "Human",
      role: "Melee",
      paint: true,
      set: "Lords of Madness",
      setNumber: "22",
      notes: "Has a halberd. Generic city or militia guard.",
      stickers: ["B11", "B12", "B13", "B14", "B15", "B16", "B17"],
      currentLocations: [
        "Spare People",
        "Spare People",
        "Spare People",
        "Spare People",
        "Spare People",
        "Spare People",
        "Spare People"
      ]
    }),
    createMockGroup_({
      rootId: "002-ARC",
      name: "Archmage",
      home: "Male Humans",
      size: "Medium",
      creatureType: "Humanoid",
      sex: "Male",
      race: "Human",
      role: "Spellcaster",
      paint: true,
      set: "Angelfire",
      setNumber: "14",
      notes: "Kind-of looks like Gargamel.",
      stickers: ["A01"],
      currentLocations: ["Male Humans"]
    }),
    createMockGroup_({
      rootId: "093-CROCAP",
      name: "Crow Shaman",
      home: "Male Humans",
      size: "Medium",
      creatureType: "Humanoid",
      sex: "Male",
      race: "Human",
      role: "Melee",
      paint: true,
      set: "Aberrations",
      setNumber: "15",
      notes: "Kind-of owl or hawk vibe. Great generic tribal caster.",
      stickers: ["D24", "D25"],
      currentLocations: ["Male Humans", "Encounter Box C"]
    }),
    createMockGroup_({
      rootId: "121-DRORAN",
      name: "Drow Ranger Captain",
      home: "Drow",
      size: "Medium",
      creatureType: "Humanoid",
      sex: "Female",
      race: "Drow",
      role: "Ranged",
      paint: true,
      set: "Night Below",
      setNumber: "09",
      notes: "Blue cloak and crossbow. Easy to identify on the table.",
      stickers: ["", ""],
      currentLocations: ["Drow", "Drow"]
    }),
    createMockGroup_({
      rootId: "144-WILMAG",
      name: "Wild Mage",
      home: "Female Humans",
      size: "Medium",
      creatureType: "Humanoid",
      sex: "Female",
      race: "Human",
      role: "Spellcaster",
      paint: true,
      set: "Night Below",
      setNumber: "24",
      notes: "Lost a fight with a bucket of paint.",
      stickers: ["F34"],
      currentLocations: ["Female Humans"]
    })
  ];

  return {
    prototypeMode: true,
    generatedAt: new Date().toISOString(),
    locations: [
      "Spare People",
      "Male Humans",
      "Female Humans",
      "Dwarves",
      "Elves",
      "Drow",
      "Encounter Box C",
      "Encounter Box G",
      "Quest Minis",
      "Painting Queue"
    ],
    groups: groups
  };
}

function createMockGroup_(config) {
  var copies = [];
  var totalCopies = config.currentLocations.length;

  for (var i = 0; i < totalCopies; i++) {
    var copyNumber = i + 1;
    var miniNumber = String(copyNumber).padStart(2, "0");
    copies.push({
      id: config.rootId + "-" + miniNumber,
      miniNumber: miniNumber,
      sticker: config.stickers[i] || "",
      currentLocation: config.currentLocations[i],
      home: config.home
    });
  }

  return {
    rootId: config.rootId,
    name: config.name,
    home: config.home,
    size: config.size,
    creatureType: config.creatureType,
    sex: config.sex,
    race: config.race,
    role: config.role,
    paint: config.paint,
    set: config.set,
    setNumber: config.setNumber,
    notes: config.notes,
    copies: copies
  };
}
