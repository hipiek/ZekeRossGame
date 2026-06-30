/* ============================================================
   SNAP SQUAD: Clout Empire — character roster & game data
   Every character is one of the crew. Rarity drives stats.
   ============================================================ */

const RARITY = {
  common:    { name: "Common",    color: "#a8b3c2", ring: "#a8b3c2", weight: 50, mult: 1 },
  rare:      { name: "Rare",      color: "#3da9fc", ring: "#3da9fc", weight: 28, mult: 3 },
  epic:      { name: "Epic",      color: "#b06bff", ring: "#b06bff", weight: 14, mult: 9 },
  legendary: { name: "Legendary", color: "#ffb23e", ring: "#ffb23e", weight: 6.5, mult: 28 },
  mythic:    { name: "Mythic",    color: "#ff4d6d", ring: "#ff4d6d", weight: 1.5, mult: 95 },
};

/* ability types — active boosts triggered from the Boosts tab */
const ABILITIES = {
  frenzy:   { name: "Tap Frenzy",   desc: "Tap power ×8 for 12s",        dur: 12,  cd: 90,  icon: "👆" },
  overdrive:{ name: "Overdrive",    desc: "Idle income ×4 for 25s",      dur: 25,  cd: 120, icon: "⚙️" },
  goldrush: { name: "Gold Rush",    desc: "Rains 6 Golden Snaps",        dur: 0,   cd: 150, icon: "✨" },
  cloutbomb:{ name: "Clout Bomb",   desc: "Instantly grants 90s of income", dur: 0, cd: 180, icon: "💥" },
  blackout: { name: "Blackout",     desc: "ALL income ×10 for 8s",       dur: 8,   cd: 300, icon: "🌀" },
};

/* The crew. baseCps & tapBonus get multiplied by rarity.mult and level. */
const ROSTER = [
  // ---- Commons (starters / cheap) ----
  { id:"closer",     name:"The Closer",     rarity:"common", ability:"frenzy",
    quote:"headphones on, clout up. the main man.",          baseCost:15,        baseCps:0.3, tapBonus:1 },
  { id:"rookie",     name:"The Rookie",     rarity:"common", ability:"frenzy",
    quote:"new to the grind but eager. switch-plate enthusiast.", baseCost:120,  baseCps:1,   tapBonus:1 },
  { id:"swap",       name:"Face Swap",      rarity:"common", ability:"frenzy",
    quote:"is that even his real face? nobody knows.",        baseCost:1100,     baseCps:8,   tapBonus:2 },
  { id:"captain",    name:"Captain Bahia",  rarity:"common", ability:"overdrive",
    quote:"reporting live from Safe Harbor: it's 85, high of 90.", baseCost:12000, baseCps:47, tapBonus:4 },

  // ---- Rares ----
  { id:"shellshock", name:"Shellshock",     rarity:"rare", ability:"frenzy",
    quote:"eyes permanently set to 'just saw the WiFi bill'.", baseCost:130000,   baseCps:260, tapBonus:14 },
  { id:"aphex",      name:"Aphex",          rarity:"rare", ability:"overdrive",
    quote:"five-star reviewer of his own QR code.",            baseCost:1.4e6,    baseCps:1400,tapBonus:30 },
  { id:"nightshift", name:"Night Shift",    rarity:"rare", ability:"goldrush",
    quote:"\"i love working here!\" — said no one, screamed everyone.", baseCost:1.5e7, baseCps:7800, tapBonus:60 },
  { id:"bluehour",   name:"Blue Hour",      rarity:"rare", ability:"overdrive",
    quote:"thrives only between 11pm and the void.",           baseCost:1.6e8,    baseCps:43000, tapBonus:120 },
  { id:"goblin",     name:"Goblin Mode",    rarity:"rare", ability:"frenzy",
    quote:"fully committed to the bit. always.",               baseCost:1.8e9,    baseCps:240000, tapBonus:240 },
  { id:"licker",     name:"The Tongue",     rarity:"rare", ability:"goldrush",
    quote:"taste-tests the clout before you earn it.",         baseCost:2e10,     baseCps:1.3e6, tapBonus:480 },

  // ---- Epics ----
  { id:"toxic",      name:"Toxic",          rarity:"epic", ability:"cloutbomb",
    quote:"\"thank goodness i'm not green. if i were, i would die.\"", baseCost:2.4e11, baseCps:7.5e6, tapBonus:1100 },
  { id:"frost",      name:"Frostbyte",      rarity:"epic", ability:"overdrive",
    quote:"bathed in blue LED, cold as the read receipt.",     baseCost:3e12,     baseCps:4.3e7, tapBonus:2400 },
  { id:"golfgod",    name:"Golf God",       rarity:"epic", ability:"frenzy",
    quote:"500 ft to World Golf Village. eyes on the green.",  baseCost:3.8e13,   baseCps:2.5e8, tapBonus:5200 },
  { id:"phantom",    name:"The Phantom",    rarity:"epic", ability:"blackout",
    quote:"\"i'm currently being dematerialized ✌️😂\"",        baseCost:5e14,     baseCps:1.5e9, tapBonus:11000 },
  { id:"possessed",  name:"The Possessed",  rarity:"epic", ability:"cloutbomb",
    quote:"eyes rolled back, fully tapped into the algorithm.", baseCost:6.5e15,  baseCps:9e9,  tapBonus:24000 },

  // ---- Legendaries ----
  { id:"mustache",   name:"Mega Mustache",  rarity:"legendary", ability:"blackout",
    quote:"the 'stache files taxes for the whole squad.",      baseCost:9e16,     baseCps:6e10, tapBonus:55000 },
  { id:"stormcaller",name:"Stormcaller",    rarity:"legendary", ability:"overdrive",
    quote:"raw voltage in the fingertips. do not touch.",      baseCost:1.3e18,   baseCps:4e11, tapBonus:120000 },
  { id:"contractor", name:"The Contractor", rarity:"legendary", ability:"cloutbomb",
    quote:"PRIVATE MILITARY CONTRACTOR of pure rage. GERK.",   baseCost:2e19,     baseCps:2.8e12,tapBonus:260000 },

  // ---- Mythics ----
  { id:"panmaster",  name:"Pan Master",     rarity:"mythic", ability:"blackout",
    quote:"ascended into the zeke pan. a perfect, seared legend.", baseCost:3.5e20, baseCps:2.2e13, tapBonus:700000 },
  { id:"cursed",     name:"The Cursed One", rarity:"mythic", ability:"blackout",
    quote:"do not look directly at him after 3am.",            baseCost:6e21,     baseCps:1.6e14, tapBonus:1.6e6 },
];

const ROSTER_BY_ID = Object.fromEntries(ROSTER.map(c => [c.id, c]));

/* Achievements: id, name, desc, check(state)->bool, reward gems */
const ACHIEVEMENTS = [
  { id:"firsttap",  name:"First Snap",       desc:"Tap for the first time",            gems:1,  check:s=>s.stats.totalTaps>=1 },
  { id:"tap100",    name:"Trigger Finger",   desc:"Tap 100 times",                     gems:2,  check:s=>s.stats.totalTaps>=100 },
  { id:"tap1000",   name:"Carpal Tunnel",    desc:"Tap 1,000 times",                   gems:5,  check:s=>s.stats.totalTaps>=1000 },
  { id:"recruit3",  name:"Squad Forming",    desc:"Recruit 3 members",                 gems:3,  check:s=>ownedCount(s)>=3 },
  { id:"recruit10", name:"Full Roster",      desc:"Recruit 10 members",                gems:8,  check:s=>ownedCount(s)>=10 },
  { id:"recruitAll",name:"Gang's All Here",  desc:"Recruit the entire crew",           gems:50, check:s=>ownedCount(s)>=ROSTER.length },
  { id:"epicOwn",   name:"Getting Serious",  desc:"Own an Epic member",                gems:6,  check:s=>ownsRarity(s,"epic") },
  { id:"legOwn",    name:"Legend Status",    desc:"Own a Legendary member",            gems:15, check:s=>ownsRarity(s,"legendary") },
  { id:"mythOwn",   name:"Touched the Pan",  desc:"Own a Mythic member",               gems:40, check:s=>ownsRarity(s,"mythic") },
  { id:"clout1M",   name:"Micro-Influencer", desc:"Earn 1M total Clout",               gems:4,  check:s=>s.stats.totalClout>=1e6 },
  { id:"clout1B",   name:"Going Viral",      desc:"Earn 1B total Clout",               gems:10, check:s=>s.stats.totalClout>=1e9 },
  { id:"clout1T",   name:"Trending #1",      desc:"Earn 1T total Clout",               gems:20, check:s=>s.stats.totalClout>=1e12 },
  { id:"gold10",    name:"Snap Hunter",      desc:"Catch 10 Golden Snaps",             gems:6,  check:s=>s.stats.goldCaught>=10 },
  { id:"combo25",   name:"On Fire",          desc:"Reach a 25× combo",                 gems:8,  check:s=>s.stats.bestCombo>=25 },
  { id:"rebrand1",  name:"New Era",          desc:"Rebrand for the first time",        gems:25, check:s=>s.stats.rebrands>=1 },
  { id:"streak7",   name:"Daily Devotion",   desc:"Hit a 7-day login streak",          gems:30, check:s=>s.daily.streak>=7 },
];

function ownedCount(s){ return Object.values(s.squad).filter(c=>c.owned).length; }
function ownsRarity(s,r){ return ROSTER.some(c=>c.rarity===r && s.squad[c.id]?.owned); }
