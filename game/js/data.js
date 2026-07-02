/* ============================================================
   SNAP SQUAD: Clout Empire — character roster & game data
   Every character is one of the crew. Rarity drives stats.

   Rank / economy rules (ZZZ-style):
   - rank 1-2 (Common/Rare)  -> "buy": recruitable with Clout AND rollable.
                                 Rolling one refunds half its price as Clout.
   - rank 3-5 (Epic+)        -> roll-only: can ONLY be obtained from summons.
   ============================================================ */

const RARITY = {
  common:    { name: "Common",    color: "#a8b3c2", ring: "#a8b3c2", weight: 70,   mult: 1,   rank: 1, buy: true  },
  rare:      { name: "Rare",      color: "#3da9fc", ring: "#3da9fc", weight: 21,   mult: 3,   rank: 2, buy: true  },
  epic:      { name: "Epic",      color: "#b06bff", ring: "#b06bff", weight: 7.5,  mult: 8,   rank: 3, buy: false },
  legendary: { name: "Legendary", color: "#ffb23e", ring: "#ffb23e", weight: 1.2,  mult: 22,  rank: 4, buy: false },
  mythic:    { name: "Mythic",    color: "#ff4d6d", ring: "#ff4d6d", weight: 0.3,  mult: 70,  rank: 5, buy: false },
};

/* Egg tiers (Egg Inc-style milestones from lifetime cash). Reaching the
   "Legendary" tier is what unlocks Mythic managers from summons. */
const EGG_TIERS = [
  { name:"Edible",      at:0 },
  { name:"Superfood",   at:2e3 },
  { name:"Medical",     at:5e4 },
  { name:"Rocket Fuel", at:1e6 },
  { name:"Quantum",     at:2e7 },
  { name:"Fusion",      at:5e8 },
  { name:"Legendary",   at:1e10 },
  { name:"Mythic",      at:2e11 },
];
const RARITY_ORDER = ["common","rare","epic","legendary","mythic"];

/* ability types — active boosts triggered from the Boosts tab */
const ABILITIES = {
  frenzy:   { name: "Hatch Rush",   desc: "Fill the habitat + ×3 income 12s", dur: 12, cd: 90, icon: "frenzy" },
  overdrive:{ name: "Overdrive",    desc: "Coin income ×4 for 25s",      dur: 25,  cd: 120, icon: "overdrive" },
  goldrush: { name: "Gold Rush",    desc: "Rains 6 Golden Cats",         dur: 0,   cd: 150, icon: "goldrush" },
  cloutbomb:{ name: "Clout Bomb",   desc: "Instantly grants 90s of income", dur: 0, cd: 180, icon: "cloutbomb" },
  blackout: { name: "Blackout",     desc: "ALL income ×10 for 8s",       dur: 8,   cd: 300, icon: "blackout" },
};

/* Signature abilities — only Epic+ managers have these. Each has a unique 3D
   effect (vfx) and a strong gameplay payoff on a long cooldown. */
const SIGNATURES = {
  storm:     { name:"Thunderstorm",  icon:"blackout",  vfx:"storm",     cd:240, desc:"Lightning storm · ×8 income 20s", kind:"all",  mult:8,  dur:20 },
  freeze:    { name:"Deep Freeze",   icon:"overdrive", vfx:"blizzard",  cd:240, desc:"Blizzard · ×6 income 25s",        kind:"all",  mult:6,  dur:25 },
  gold:      { name:"Gold Eruption", icon:"clout",     vfx:"gold",      cd:300, desc:"Erupt coins · +2h of income",    special:"coins", secs:7200 },
  airstrike: { name:"Airstrike",     icon:"cloutbomb", vfx:"meteor",    cd:300, desc:"Meteor strike · +1h of income",  special:"coins", secs:3600 },
  vanish:    { name:"Vanishing Act", icon:"blackout",  vfx:"evaporate", cd:300, desc:"Evaporate the flock · ×10 income 15s", kind:"all", mult:10, dur:15 },
  toxic:     { name:"Toxic Cloud",   icon:"goldrush",  vfx:"toxic",     cd:240, desc:"Poison fog · ×5 income 25s",      kind:"idle", mult:5,  dur:25 },
  chaos:     { name:"Total Chaos",   icon:"summon",    vfx:"chaos",     cd:360, desc:"Reality breaks · ×12 income 15s + fill", kind:"all", mult:12, dur:15, special:"fill" },
};
/* which signature each Epic+ manager wields (befitting the character) */
const MANAGER_SIG = {
  // epics
  toxic:"toxic", frost:"freeze", trippy:"chaos", golfgod:"airstrike", feral:"chaos", phantom:"vanish", possessed:"vanish",
  // legendaries
  mustache:"gold", billion:"gold", stormcaller:"storm", contractor:"airstrike",
  // mythics
  panmaster:"gold", unhinged:"chaos", cursed:"vanish",
};

/* The crew. baseCps & tapBonus get multiplied by rarity.mult and level. */
const ROSTER = [
  // ======================= COMMONS (cheap starters, lots to recruit) =======================
  { id:"closer",     name:"The Closer",     rarity:"common", ability:"frenzy",
    quote:"headphones on, clout up. the main man.",            baseCost:15,     baseCps:0.3,  tapBonus:1 },
  { id:"bedhead",    name:"Bedhead",        rarity:"common", ability:"frenzy",
    quote:"thats unfunny yo.",                                 baseCost:35,     baseCps:0.5,  tapBonus:1 },
  { id:"rookie",     name:"The Rookie",     rarity:"common", ability:"frenzy",
    quote:"new to the grind but eager. switch-plate enthusiast.", baseCost:120, baseCps:1,    tapBonus:1 },
  { id:"skipper",    name:"The Skipper",    rarity:"common", ability:"overdrive",
    quote:"permission to come aboard the clout boat.",         baseCost:340,    baseCps:2,    tapBonus:1 },
  { id:"smug",       name:"Smug Mode",      rarity:"common", ability:"frenzy",
    quote:"already knows he's that guy.",                      baseCost:1100,   baseCps:8,    tapBonus:2 },
  { id:"swap",       name:"Face Swap",      rarity:"common", ability:"frenzy",
    quote:"is that even his real face? nobody knows.",         baseCost:3200,   baseCps:18,   tapBonus:2 },
  { id:"tastemaker", name:"Tastemaker",     rarity:"common", ability:"goldrush",
    quote:"licks the vibe before it even drops.",              baseCost:12000,  baseCps:47,   tapBonus:4 },
  { id:"captain",    name:"Captain Bahia",  rarity:"common", ability:"overdrive",
    quote:"reporting live from Safe Harbor: it's 85, high of 90.", baseCost:42000, baseCps:130, tapBonus:6 },
  { id:"deckhand",   name:"Deckhand",       rarity:"common", ability:"overdrive",
    quote:"wide-eyed and seasick on the come-up.",             baseCost:130000, baseCps:300,  tapBonus:9 },
  { id:"tourist",    name:"The Tourist",    rarity:"common", ability:"frenzy",
    quote:"found the back nine of the algorithm.",             baseCost:6e5,    baseCps:900,  tapBonus:14 },
  { id:"lowkey",     name:"Lowkey",         rarity:"common", ability:"overdrive",
    quote:"keeps it lowkey. clout finds him anyway.",          baseCost:4e6,    baseCps:3500, tapBonus:20 },
  { id:"chin",       name:"The Chin",       rarity:"common", ability:"cloutbomb",
    quote:"leads with the jaw, always.",                       baseCost:4e7,    baseCps:18000,tapBonus:40 },
  { id:"drowsy",     name:"Drowsy",         rarity:"common", ability:"overdrive",
    quote:"running on 2 hours of sleep and pure spite.",       baseCost:5e8,    baseCps:95000,tapBonus:80 },
  { id:"android",    name:"Android",        rarity:"common", ability:"goldrush",
    quote:"rendering at 144p. please stand by.",               baseCost:6e9,    baseCps:5e5,  tapBonus:160 },
  { id:"lurker",     name:"The Lurker",     rarity:"common", ability:"frenzy",
    quote:"seen. never replies. always watching.",             baseCost:8e10,   baseCps:3e6,  tapBonus:320 },
  { id:"regular",    name:"The Regular",    rarity:"common", ability:"overdrive",
    quote:"same order, same seat, every single day.",          baseCost:1e12,   baseCps:2e7,  tapBonus:640 },

  // ======================= RARES (still buyable) =======================
  { id:"shellshock", name:"Shellshock",     rarity:"rare", ability:"frenzy",
    quote:"eyes permanently set to 'just saw the WiFi bill'.", baseCost:1.3e5,  baseCps:260,  tapBonus:14 },
  { id:"doppel",     name:"Doppelgänger",   rarity:"rare", ability:"frenzy",
    quote:"two faces, one grind. which one is real?",          baseCost:7e5,    baseCps:1200, tapBonus:28 },
  { id:"aphex",      name:"Aphex",          rarity:"rare", ability:"overdrive",
    quote:"five-star reviewer of his own QR code.",            baseCost:1.4e6,  baseCps:1400, tapBonus:30 },
  { id:"freshface",  name:"Fresh Face",     rarity:"rare", ability:"overdrive",
    quote:"no notes. just vibes and good skin.",               baseCost:9e6,    baseCps:7800, tapBonus:55 },
  { id:"nightshift", name:"Night Shift",    rarity:"rare", ability:"goldrush",
    quote:"\"i love working here!\" — said no one, screamed everyone.", baseCost:1.5e7, baseCps:1.3e4, tapBonus:60 },
  { id:"bluehour",   name:"Blue Hour",      rarity:"rare", ability:"overdrive",
    quote:"thrives only between 11pm and the void.",           baseCost:1.6e8,  baseCps:4.3e4,tapBonus:120 },
  { id:"grin",       name:"Gentle Grin",    rarity:"rare", ability:"goldrush",
    quote:"the warmest menace you will ever meet.",            baseCost:9e8,    baseCps:1.6e5,tapBonus:130 },
  { id:"goblin",     name:"Goblin Mode",    rarity:"rare", ability:"frenzy",
    quote:"fully committed to the bit. always.",               baseCost:1.8e9,  baseCps:2.4e5,tapBonus:240 },
  { id:"selfie",     name:"Perfect Selfie", rarity:"rare", ability:"cloutbomb",
    quote:"got it on the first try. obviously.",               baseCost:3e10,   baseCps:1.4e6,tapBonus:380 },
  { id:"licker",     name:"The Tongue",     rarity:"rare", ability:"goldrush",
    quote:"taste-tests the clout before you earn it.",         baseCost:2e11,   baseCps:1.3e6,tapBonus:480 },

  // ======================= EPICS (roll-only) =======================
  { id:"toxic",      name:"Toxic",          rarity:"epic", ability:"cloutbomb",
    quote:"\"thank goodness i'm not green. if i were, i would die.\"", baseCost:2.4e11, baseCps:7.5e6, tapBonus:1100 },
  { id:"frost",      name:"Frostbyte",      rarity:"epic", ability:"overdrive",
    quote:"bathed in blue LED, cold as the read receipt.",     baseCost:3e12,   baseCps:4.3e7,tapBonus:2400 },
  { id:"trippy",     name:"Kaleidoscope",   rarity:"epic", ability:"blackout",
    quote:"you are now breathing manually.",                   baseCost:8e12,   baseCps:9e7,  tapBonus:3000 },
  { id:"golfgod",    name:"Golf God",       rarity:"epic", ability:"frenzy",
    quote:"500 ft to World Golf Village. eyes on the green.",  baseCost:3.8e13, baseCps:2.5e8,tapBonus:5200 },
  { id:"feral",      name:"Feral",          rarity:"epic", ability:"cloutbomb",
    quote:"raw, shirtless, and absolutely unwell.",            baseCost:1.2e14, baseCps:6e8,  tapBonus:8000 },
  { id:"phantom",    name:"The Phantom",    rarity:"epic", ability:"blackout",
    quote:"\"i'm currently being dematerialized ✌️😂\"",        baseCost:5e14,   baseCps:1.5e9,tapBonus:11000 },
  { id:"possessed",  name:"The Possessed",  rarity:"epic", ability:"cloutbomb",
    quote:"eyes rolled back, fully tapped into the algorithm.", baseCost:6.5e15, baseCps:9e9, tapBonus:24000 },

  // ======================= LEGENDARIES (roll-only) =======================
  { id:"mustache",   name:"Mega Mustache",  rarity:"legendary", ability:"blackout",
    quote:"the 'stache files taxes for the whole squad.",      baseCost:9e16,   baseCps:6e10, tapBonus:55000 },
  { id:"billion",    name:"1 Billion O'Clock", rarity:"legendary", ability:"blackout",
    quote:"do you know what time it is? it's BILLION o'clock.",baseCost:4e17,   baseCps:1.5e11,tapBonus:75000 },
  { id:"stormcaller",name:"Stormcaller",    rarity:"legendary", ability:"overdrive",
    quote:"raw voltage in the fingertips. do not touch.",      baseCost:1.3e18, baseCps:4e11, tapBonus:120000 },
  { id:"contractor", name:"The Contractor", rarity:"legendary", ability:"cloutbomb",
    quote:"PRIVATE MILITARY CONTRACTOR of pure rage. GERK.",   baseCost:2e19,   baseCps:2.8e12,tapBonus:260000 },

  // ======================= MYTHICS (roll-only) =======================
  { id:"panmaster",  name:"Pan Master",     rarity:"mythic", ability:"blackout",
    quote:"ascended into the zeke pan. a perfect, seared legend.", baseCost:3.5e20, baseCps:2.2e13, tapBonus:700000 },
  { id:"unhinged",   name:"Unhinged",       rarity:"mythic", ability:"blackout",
    quote:"the eyes have seen the whole algorithm. there's no going back.", baseCost:1e22, baseCps:2.5e14, tapBonus:2.2e6 },
  { id:"cursed",     name:"The Cursed One", rarity:"mythic", ability:"blackout",
    quote:"do not look directly at him after 3am.",            baseCost:6e22,   baseCps:1.6e15,tapBonus:1.6e7 },
];

const ROSTER_BY_ID = Object.fromEntries(ROSTER.map(c => [c.id, c]));
const ROSTER_INDEX = Object.fromEntries(ROSTER.map((c,i) => [c.id, i])); // progression order
const ROSTER_BY_RARITY = RARITY_ORDER.reduce((m,r)=>{ m[r]=ROSTER.filter(c=>c.rarity===r); return m; }, {});

/* ============================================================
   GACHA: currencies, banners, pity
   ============================================================ */
const CURRENCY = {
  clout: { name: "Clout",      icon: "clout" },
  gems:  { name: "Snaps",      icon: "snap" },
  stars: { name: "Star Snaps", icon: "star" },
};

const PITY_RARE = 10;    // guaranteed rare-or-better buff within this many pulls

/* Two draw banners. Summons now grant TEMPORARY BUFFS (and a small cosmetic
   chance) — not managers. Managers are unlocked with Coins on the Farm. */
const BANNERS = [
  { id:"snap",     name:"Snap Draw",     tagline:"Temporary buffs for your farm",   currency:"gems",  costSingle:5, costTen:45, premium:false, accent:"#ffb23e", theme:"overdrive", durationDays:14 },
  { id:"prestige", name:"Prestige Draw", tagline:"Premium buffs + cosmetic chance",  currency:"stars", costSingle:1, costTen:9,  premium:true,  accent:"#ff4d6d", theme:"star",      durationDays:21 },
];
const BANNER_BY_ID = Object.fromEntries(BANNERS.map(b => [b.id, b]));

/* Temporary buffs a draw can grant. dur in seconds (0 = instant).
   kind all/idle -> pushes an income multiplier boost; special -> one-shot. */
const BUFF_POOL = [
  { id:"income2",  name:"Overdrive",    icon:"overdrive", rarity:"common",    kind:"all",  mult:2,  dur:180, text:"×2 income · 3m" },
  { id:"hatch",    name:"Hatch Rush",   icon:"frenzy",    rarity:"common",    special:"fill",        text:"Fill the habitat" },
  { id:"coins",    name:"Coin Cache",   icon:"clout",     rarity:"common",    special:"coins", secs:900, text:"+15m of coins" },
  { id:"income3",  name:"Power Surge",  icon:"overdrive", rarity:"rare",      kind:"all",  mult:3,  dur:240, text:"×3 income · 4m" },
  { id:"feed3",    name:"Feed Frenzy",  icon:"goldrush",  rarity:"rare",      kind:"idle", mult:3,  dur:300, text:"×3 income · 5m" },
  { id:"snaps",    name:"Snap Windfall",icon:"snap",      rarity:"rare",      special:"snaps", amt:8, text:"+8 Snaps" },
  { id:"coinsBig", name:"Coin Vault",   icon:"clout",     rarity:"epic",      special:"coins", secs:3600, text:"+1h of coins" },
  { id:"income5",  name:"Blackout",     icon:"blackout",  rarity:"epic",      kind:"all",  mult:5,  dur:180, text:"×5 income · 3m" },
  { id:"star",     name:"Star Fragment",icon:"star",      rarity:"epic",      special:"stars", amt:1, text:"+1 Star Snap" },
  { id:"income10", name:"Clout Storm",  icon:"blackout",  rarity:"legendary", kind:"all",  mult:10, dur:180, text:"×10 income · 3m" },
  { id:"coinsHuge",name:"Coin Mint",    icon:"clout",     rarity:"legendary", special:"coins", secs:14400, text:"+4h of coins" },
];
const BUFF_BY_ID = Object.fromEntries(BUFF_POOL.map(b => [b.id, b]));

/* ============================================================
   TYCOON BUILD CATALOG — buildings placeable on the map grid.
   Each placed building adds +2% income. Cost scales per copy.
   ============================================================ */
const BUILD_CATALOG = [
  { id:"tree",     name:"Tree",            icon:"paint",  cost:400,    desc:"+2% income · decorative" },
  { id:"barn",     name:"Red Barn",        icon:"shop",   cost:6000,   desc:"+2% income · classic" },
  { id:"statue",   name:"Golden Chicken",  icon:"star",   cost:80000,  desc:"+2% income · glorious" },
  { id:"fountain", name:"Fountain",        icon:"snap",   cost:1.2e6,  desc:"+2% income · fancy" },
];
const BUILD_BY_ID = Object.fromEntries(BUILD_CATALOG.map(b => [b.id, b]));

/* Rare cosmetics (small draw chance). Some apply a visible change. */
const COSMETICS = [
  { id:"gold_chickens", name:"Golden Chickens", icon:"star",  apply:"gold", text:"Your whole flock turns gold" },
  { id:"sunset_coop",   name:"Sunset Palette",  icon:"paint", apply:"none", text:"A warm farm palette (badge)" },
  { id:"disco_flock",   name:"Disco Flock",     icon:"summon",apply:"none", text:"Party vibes (badge)" },
];

/* ============================================================
   SHOP — Clout & Snap sinks. `cost` is a fn(timesBoughtToday) ->
   {cur, amt}; some Clout costs scale with your current income so
   they stay relevant at every stage. limit 0 = unlimited/day.
   ============================================================ */
const SHOP_ITEMS = [
  { id:"snappack", name:"Snap Pack", desc:"Instantly get 10 Snaps for summoning.",
    icon:"snap", limit:5, reward:{ gems:10 },
    cost:(b)=>({ cur:"clout", amt: Math.max(5000, cps()*7200) * Math.pow(1.85, b) }) },

  { id:"starsnap", name:"Star Snap", desc:"A premium Star Snap for the Prestige banner.",
    icon:"star", limit:3, reward:{ stars:1 },
    cost:()=>({ cur:"gems", amt:60 }) },

  { id:"payout", name:"Instant Payout", desc:"Instantly bank 4 hours of idle income.",
    icon:"clout", limit:5, reward:{ payoutHours:4 },
    cost:()=>({ cur:"gems", amt:10 }) },

  { id:"overclock", name:"Overclock", desc:"2× ALL income for 15 minutes.",
    icon:"boosts", limit:0, reward:{ overclock:{ mult:2, secs:900 } },
    cost:()=>({ cur:"clout", amt: Math.max(10000, cps()*21600) }) },

  { id:"refresh", name:"Refresh Abilities", desc:"Reset every ability cooldown right now.",
    icon:"overdrive", limit:0, reward:{ refresh:true },
    cost:()=>({ cur:"gems", amt:5 }) },
];

/* ============================================================
   DAILY GOALS — 3 rotate in each day. Progress is measured as a
   delta from when the goal was assigned (base snapshot).
   ============================================================ */
const GOAL_DEFS = [
  { id:"earn",   name:"Coin Rush",     icon:"clout",   desc:t=>`Earn ${t} Coins`,          measure:s=>s.stats.totalClout, target:()=>Math.max(2000, Math.ceil(cps()*2400)), reward:{gems:4} },
  { id:"pulls",  name:"Lucky Streak",  icon:"summon",  desc:t=>`Make ${t} draws`,          measure:s=>s.stats.totalPulls||0, target:()=>5,  reward:{gems:5} },
  { id:"gold",   name:"Cat Chaser",    icon:"star",    desc:t=>`Catch ${t} Golden Cats`,   measure:s=>s.stats.goldCaught, target:()=>3,  reward:{gems:4} },
  { id:"build",  name:"Park Architect",icon:"hammer",  desc:t=>`Place ${t} buildings`,     measure:s=>s.buildings.length, target:()=>2,  reward:{gems:5} },
  { id:"upg",    name:"Renovator",     icon:"boosts",  desc:t=>`Buy ${t} farm upgrades`,   measure:s=>s.upg.hab+s.upg.feed+s.upg.hatch+s.upg.veh, target:()=>2, reward:{gems:6} },
  { id:"golden", name:"Egg Hunter",    icon:"trophy",  desc:t=>`Catch ${t} Golden Chicken`,measure:s=>s.stats.goldenCaught||0, target:()=>1, reward:{stars:1} },
];
const GOAL_BY_ID = Object.fromEntries(GOAL_DEFS.map(g=>[g.id,g]));

/* Achievements: id, name, desc, check(state)->bool, reward gems */
const ACHIEVEMENTS = [
  { id:"firsthatch",name:"First Cluck",      desc:"Start your farm",                   gems:1,  check:s=>s.pop>=8 },
  { id:"pop100",    name:"Getting Crowded",  desc:"Reach 100 chickens",                gems:2,  check:s=>s.pop>=100 },
  { id:"pop1000",   name:"Poultry Empire",   desc:"Reach 1,000 chickens",              gems:5,  check:s=>s.pop>=1000 },
  { id:"recruit3",  name:"Squad Forming",    desc:"Recruit 3 members",                 gems:3,  check:s=>ownedCount(s)>=3 },
  { id:"recruit10", name:"Full Roster",      desc:"Recruit 10 members",                gems:8,  check:s=>ownedCount(s)>=10 },
  { id:"recruit25", name:"Certified Crew",   desc:"Recruit 25 members",                gems:18, check:s=>ownedCount(s)>=25 },
  { id:"recruitAll",name:"Gang's All Here",  desc:"Recruit the entire crew",           gems:75, check:s=>ownedCount(s)>=ROSTER.length },
  { id:"epicOwn",   name:"Getting Serious",  desc:"Own an Epic member",                gems:6,  check:s=>ownsRarity(s,"epic") },
  { id:"legOwn",    name:"Legend Status",    desc:"Own a Legendary member",            gems:15, check:s=>ownsRarity(s,"legendary") },
  { id:"mythOwn",   name:"Touched the Pan",  desc:"Own a Mythic member",               gems:40, check:s=>ownsRarity(s,"mythic") },
  { id:"clout1M",   name:"Micro-Influencer", desc:"Earn 1M total Clout",               gems:4,  check:s=>s.stats.totalClout>=1e6 },
  { id:"clout1B",   name:"Going Viral",      desc:"Earn 1B total Clout",               gems:10, check:s=>s.stats.totalClout>=1e9 },
  { id:"clout1T",   name:"Trending #1",      desc:"Earn 1T total Clout",               gems:20, check:s=>s.stats.totalClout>=1e12 },
  { id:"gold10",    name:"Cat Hunter",       desc:"Catch 10 Golden Cats",              gems:6,  check:s=>s.stats.goldCaught>=10 },
  { id:"tierLeg",   name:"Legendary Eggs",   desc:"Reach the Legendary egg tier",      gems:20, check:s=>s.stats.totalClout>=1e10 },
  { id:"summon50",  name:"Big Spender",      desc:"Summon 50 times",                   gems:12, check:s=>(s.stats.totalPulls||0)>=50 },
  { id:"rebrand1",  name:"New Era",          desc:"Rebrand for the first time",        gems:25, check:s=>s.stats.rebrands>=1 },
  { id:"streak7",   name:"Daily Devotion",   desc:"Hit a 7-day login streak",          gems:30, check:s=>s.daily.streak>=7 },
];

function ownedCount(s){ return Object.values(s.squad).filter(c=>c.owned).length; }
function ownsRarity(s,r){ return ROSTER.some(c=>c.rarity===r && s.squad[c.id]?.owned); }
