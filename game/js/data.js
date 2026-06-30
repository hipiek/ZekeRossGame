/* ============================================================
   SNAP SQUAD: Clout Empire — character roster & game data
   Every character is one of the crew. Rarity drives stats.

   Rank / economy rules (ZZZ-style):
   - rank 1-2 (Common/Rare)  -> "buy": recruitable with Clout AND rollable.
                                 Rolling one refunds half its price as Clout.
   - rank 3-5 (Epic+)        -> roll-only: can ONLY be obtained from summons.
   ============================================================ */

const RARITY = {
  common:    { name: "Common",    color: "#a8b3c2", ring: "#a8b3c2", weight: 50,  mult: 1,  rank: 1, buy: true  },
  rare:      { name: "Rare",      color: "#3da9fc", ring: "#3da9fc", weight: 28,  mult: 3,  rank: 2, buy: true  },
  epic:      { name: "Epic",      color: "#b06bff", ring: "#b06bff", weight: 14,  mult: 9,  rank: 3, buy: false },
  legendary: { name: "Legendary", color: "#ffb23e", ring: "#ffb23e", weight: 6.5, mult: 28, rank: 4, buy: false },
  mythic:    { name: "Mythic",    color: "#ff4d6d", ring: "#ff4d6d", weight: 1.5, mult: 95, rank: 5, buy: false },
};
const RARITY_ORDER = ["common","rare","epic","legendary","mythic"];

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
const ROSTER_BY_RARITY = RARITY_ORDER.reduce((m,r)=>{ m[r]=ROSTER.filter(c=>c.rarity===r); return m; }, {});

/* ============================================================
   GACHA: currencies, banners, pity
   ============================================================ */
const CURRENCY = {
  clout: { name: "Clout",      icon: "💠" },
  gems:  { name: "Snaps",      icon: "💎" },
  stars: { name: "Star Snaps", icon: "⭐" },
};

const PITY_LEGENDARY = 100;   // guaranteed banner-top rarity within this many pulls
const PITY_RARE      = 10;    // guaranteed rare-or-better within this many pulls

/* Two live campaigns. Featured shows large on the pull screen; the banner's
   "top" rarity is rate-up + governed by 50/50 + hard pity. */
const BANNERS = [
  {
    id: "snap",
    name: "Snap Summon",
    tagline: "Featured Legendary — limited time",
    currency: "gems",
    costSingle: 5,
    costTen: 45,
    featured: "billion",      // Legendary rate-up
    topRarity: "legendary",
    durationDays: 14,
    accent: "#ffb23e",
  },
  {
    id: "prestige",
    name: "Prestige Summon",
    tagline: "Premium Mythic banner — Star Snaps only",
    currency: "stars",
    costSingle: 1,
    costTen: 9,
    featured: "unhinged",     // Mythic rate-up
    topRarity: "mythic",
    durationDays: 21,
    accent: "#ff4d6d",
  },
];
const BANNER_BY_ID = Object.fromEntries(BANNERS.map(b => [b.id, b]));

/* Characters eligible for the wishlist: the roll-only top-tier crew. */
function wishlistPool(){
  return ROSTER.filter(c => RARITY[c.rarity].rank >= 4); // legendary + mythic
}

/* Achievements: id, name, desc, check(state)->bool, reward gems */
const ACHIEVEMENTS = [
  { id:"firsttap",  name:"First Snap",       desc:"Tap for the first time",            gems:1,  check:s=>s.stats.totalTaps>=1 },
  { id:"tap100",    name:"Trigger Finger",   desc:"Tap 100 times",                     gems:2,  check:s=>s.stats.totalTaps>=100 },
  { id:"tap1000",   name:"Carpal Tunnel",    desc:"Tap 1,000 times",                   gems:5,  check:s=>s.stats.totalTaps>=1000 },
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
  { id:"gold10",    name:"Snap Hunter",      desc:"Catch 10 Golden Snaps",             gems:6,  check:s=>s.stats.goldCaught>=10 },
  { id:"combo25",   name:"On Fire",          desc:"Reach a 25× combo",                 gems:8,  check:s=>s.stats.bestCombo>=25 },
  { id:"summon50",  name:"Big Spender",      desc:"Summon 50 times",                   gems:12, check:s=>(s.stats.totalPulls||0)>=50 },
  { id:"rebrand1",  name:"New Era",          desc:"Rebrand for the first time",        gems:25, check:s=>s.stats.rebrands>=1 },
  { id:"streak7",   name:"Daily Devotion",   desc:"Hit a 7-day login streak",          gems:30, check:s=>s.daily.streak>=7 },
];

function ownedCount(s){ return Object.values(s.squad).filter(c=>c.owned).length; }
function ownsRarity(s,r){ return ROSTER.some(c=>c.rarity===r && s.squad[c.id]?.owned); }
