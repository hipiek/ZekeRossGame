/* ============================================================
   SNAP SQUAD: Clout Empire — game engine
   Vanilla JS. No dependencies. Mobile-first.
   ============================================================ */
'use strict';

const SAVE_KEY = "snapsquad.save.v1";
const GAME_VERSION = "2.0.0";   // shown in Settings; keep in sync with package.json
const TICK_MS = 100;            // simulation tick
const COMBO_WINDOW = 900;       // ms to keep a combo alive
const COMBO_MAX = 30;           // max combo multiplier contribution
const CRIT_CHANCE = 0.08;
const CRIT_MULT = 12;
const GOLD_INTERVAL = [16000, 34000]; // random golden-snap spawn window (ms)

/* ---------------- number formatting ---------------- */
const SUFFIX = ["","K","M","B","T","Qa","Qi","Sx","Sp","Oc","No","Dc","Ud","Dd","Td"];
function fmt(n){
  if(n < 1000) return (Math.floor(n*10)/10 % 1 === 0) ? String(Math.floor(n)) : n.toFixed(1);
  let t = 0;
  while(n >= 1000 && t < SUFFIX.length-1){ n /= 1000; t++; }
  return (n >= 100 ? n.toFixed(1) : n.toFixed(2)) + SUFFIX[t];
}
function fmtTime(s){
  s = Math.max(0, Math.floor(s));
  if(s < 60) return s+"s";
  if(s < 3600) return Math.floor(s/60)+"m "+(s%60)+"s";
  if(s < 86400) return Math.floor(s/3600)+"h "+Math.floor((s%3600)/60)+"m";
  return Math.floor(s/86400)+"d "+Math.floor((s%86400)/3600)+"h";
}

/* ---------------- default state ---------------- */
function freshGacha(){
  const g = {};
  BANNERS.forEach(b => g[b.id] = { pity:0, rarePity:0, guaranteedFeatured:false });
  return g;
}
function freshBannerEnds(){
  const now = Date.now(), e = {};
  BANNERS.forEach(b => e[b.id] = now + b.durationDays*86400000);
  return e;
}
function freshState(){
  const squad = {};
  ROSTER.forEach(c => squad[c.id] = { owned:false, level:0 });
  squad.closer.owned = true; squad.closer.level = 1; // free starter
  return {
    clout: 0,              // "Coins" — farm cash
    gems: 5,
    stars: 0,
    featured: "closer",
    squad,
    pop: 8,                // chickens on the farm
    upg: { hab:0, feed:0, hatch:0 }, // habitat capacity / feed value / hatchery speed
    influence: 0,          // permanent prestige multiplier source
    abilityReady: {},      // id -> timestamp when ready
    activeBoosts: [],      // {type,until,mult,kind}
    daily: { streak:0, last:0, claimedToday:false },
    achievements: {},      // id -> true
    activeBanner: "snap",
    gacha: freshGacha(),   // per-banner pity/50-50 state
    wishlist: [],          // char ids the player wants (max 5)
    bannerEnds: freshBannerEnds(),
    shop: { day:0, bought:{} },  // daily shop purchase counts
    stats: { totalTaps:0, totalClout:0, goldCaught:0, bestCombo:0, rebrands:0, totalPulls:0, playStart:Date.now() },
    lastSeen: Date.now(),
    settings: { sfx:true, haptics:true },
    version: 2,
  };
}

let S = freshState();

/* ---------------- persistence ---------------- */
function save(){
  S.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch(e){}
}
function load(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    S = Object.assign(freshState(), data);
    // make sure newly-added roster members exist in old saves
    ROSTER.forEach(c => { if(!S.squad[c.id]) S.squad[c.id] = { owned:false, level:0 }; });
    // migrate fields that may be missing from older saves
    if(typeof S.stars !== "number") S.stars = 0;
    if(!S.activeBanner || !BANNER_BY_ID[S.activeBanner]) S.activeBanner = "snap";
    if(!S.gacha) S.gacha = freshGacha();
    BANNERS.forEach(b => { if(!S.gacha[b.id]) S.gacha[b.id] = { pity:0, rarePity:0, guaranteedFeatured:false }; });
    if(!Array.isArray(S.wishlist)) S.wishlist = [];
    if(!S.bannerEnds) S.bannerEnds = freshBannerEnds();
    BANNERS.forEach(b => { if(!S.bannerEnds[b.id]) S.bannerEnds[b.id] = Date.now()+b.durationDays*86400000; });
    if(typeof S.stats.totalPulls !== "number") S.stats.totalPulls = 0;
    if(!S.shop || typeof S.shop.day !== "number") S.shop = { day:0, bought:{} };
    if(typeof S.pop !== "number") S.pop = 8;
    if(!S.upg) S.upg = { hab:0, feed:0, hatch:0 };
    return true;
  } catch(e){ return false; }
}

/* ============================================================
   FARM ECONOMY (Egg Inc-style): population, capacity, upgrades,
   manager multipliers. Cash is stored in S.clout ("Coins").
   ============================================================ */
function influenceMult(){ return 1 + S.influence * 0.02; } // permanent prestige bonus

function capacity(){ return Math.floor(40 * Math.pow(2.15, S.upg.hab)); }
function eggValue(){ return 0.05 * Math.pow(1.6, S.upg.feed); }     // coins / chicken / sec
function hatchRate(){ return 0.6 * Math.pow(1.5, S.upg.hatch); }     // auto chickens / sec

/* collection bonus from every owned manager; the featured one counts extra */
function collectionMult(){
  let sum = 0;
  for(const id in S.squad){
    const st = S.squad[id];
    if(st.owned) sum += RARITY[ROSTER_BY_ID[id].rarity].mult * st.level;
  }
  return 1 + sum * 0.02;
}
function featuredBonus(){
  const st = S.squad[S.featured]; if(!st || !st.owned) return 1;
  return 1 + RARITY[ROSTER_BY_ID[S.featured].rarity].mult * st.level * 0.06;
}
function farmMult(){ return collectionMult() * featuredBonus(); }

function idleMult(){
  let m = influenceMult();
  for(const b of S.activeBoosts){ if(b.kind==="idle" || b.kind==="all") m *= b.mult; }
  return m;
}
/* coins per second produced by the flock */
function cps(){ return S.pop * eggValue() * farmMult() * idleMult(); }

/* ---- upgrade costs (steep = slow, deliberate progression) ---- */
function habCost(){   return Math.ceil(120  * Math.pow(9, S.upg.hab)); }
function feedCost(){  return Math.ceil(90   * Math.pow(8, S.upg.feed)); }
function hatchCost(){ return Math.ceil(200  * Math.pow(7, S.upg.hatch)); }

/* ---- manager recruit / level costs (rescaled for the farm economy) ---- */
function recruitBase(c){ return Math.ceil((RARITY[c.rarity].mult * 120 + 60)); }
function upgradeCost(c, lvl){ return Math.ceil(recruitBase(c) * Math.pow(1.7, lvl)); }

/* ---- egg tier (milestone ladder from lifetime coins) ---- */
function eggTierIndex(){
  let idx = 0;
  for(let i=0;i<EGG_TIERS.length;i++){ if(S.stats.totalClout >= EGG_TIERS[i].at) idx = i; }
  return idx;
}
function eggTier(){ return EGG_TIERS[eggTierIndex()]; }
function mythicUnlocked(){ return EGG_TIERS[eggTierIndex()].name === "Legendary" || EGG_TIERS[eggTierIndex()].name === "Mythic"; }

/* influence you'd gain by rebranding now */
function pendingInfluence(){
  const tc = S.stats.totalClout;
  if(tc < 1e7) return 0;
  return Math.floor(Math.pow(tc / 1e7, 0.5));
}

/* ---------------- hatching ---------------- */
function hatch(n){
  const cap = capacity();
  if(S.pop >= cap){ toast("Habitat full — upgrade Habitat"); return false; }
  S.pop = Math.min(cap, S.pop + n);
  if(window.World) World.setPopulation(S.pop);
  return true;
}

/* ============================================================
   RENDERING helpers
   ============================================================ */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; };

function imgFor(id){ return `assets/chars/${id}.webp`; }

function floatText(x, y, text, cls){
  const f = el("div", "floater "+(cls||""), text);
  f.style.left = x+"px"; f.style.top = y+"px";
  $("#fx-layer").appendChild(f);
  setTimeout(()=>f.remove(), 1100);
}
function burstParticles(x, y, color, n){
  if(!S.settings.sfx) return;
  for(let i=0;i<n;i++){
    const p = el("div","particle");
    const ang = Math.random()*Math.PI*2, dist = 30+Math.random()*70;
    p.style.left=x+"px"; p.style.top=y+"px"; p.style.background=color;
    p.style.setProperty("--dx",(Math.cos(ang)*dist)+"px");
    p.style.setProperty("--dy",(Math.sin(ang)*dist)+"px");
    $("#fx-layer").appendChild(p);
    setTimeout(()=>p.remove(),700);
  }
}
function haptic(ms){ if(S.settings.haptics && navigator.vibrate) navigator.vibrate(ms); }
function shake(intensity){
  if(!S.settings.sfx) return;
  const s = $("#hero-stage"); if(!s) return;
  s.style.setProperty("--shake", intensity+"px");
  s.classList.remove("shaking"); void s.offsetWidth; s.classList.add("shaking");
}
function screenShake(intensity){
  if(!S.settings.sfx) return;
  const a = document.body;
  a.style.setProperty("--sshake", intensity+"px");
  a.classList.remove("sshaking"); void a.offsetWidth; a.classList.add("sshaking");
  setTimeout(()=>a.classList.remove("sshaking"), 600);
}

/* ---------- HUD ---------- */
function renderHUD(){
  $("#clout-amt").textContent = fmt(S.clout);
  $("#cps-amt").textContent = fmt(cps());
  $("#gem-amt").textContent = fmt(S.gems);
  $("#star-amt").textContent = fmt(S.stars);
  $("#infl-amt").textContent = "×"+influenceMult().toFixed(2);
  // manager face (top-left, Egg-Inc style) + egg tier
  const c = ROSTER_BY_ID[S.featured];
  const face = $("#mgr-face");
  if(face && face.dataset.cur !== S.featured){
    face.dataset.cur = S.featured;
    face.style.setProperty("--ring", RARITY[c.rarity].ring);
    $("#mgr-face-img").src = imgFor(S.featured);
  }
  const tierEl = $("#egg-tier"); if(tierEl) tierEl.textContent = eggTier().name;
}

/* ---------- FARM screen ---------- */
function renderFarm(){
  const c = ROSTER_BY_ID[S.featured];
  const r = RARITY[c.rarity];
  const cap = capacity();
  $("#farm-pop").textContent = fmt(Math.floor(S.pop));
  $("#farm-cap").textContent = fmt(cap);
  $("#farm-fill").style.width = Math.min(100, S.pop/cap*100)+"%";
  $("#farm-mgr-name").textContent = c.name;
  $("#farm-mgr-name").style.color = r.ring;
  $("#farm-cps").textContent = fmt(cps());

  const rows = [
    ["hab",  habCost(),   "Habitat", "Capacity → "+fmt(Math.floor(40*Math.pow(2.15,S.upg.hab+1)))],
    ["feed", feedCost(),  "Feed",    "Egg value +60%"],
    ["hatch",hatchCost(), "Hatchery","Hatch speed +50%"],
  ];
  rows.forEach(([key,cost,name,desc])=>{
    const b = $("#upg-"+key); if(!b) return;
    b.classList.toggle("cant", S.clout < cost);
    b.querySelector(".upg-cost").innerHTML = fmt(cost)+" "+ic('clout');
    b.querySelector(".upg-desc").textContent = desc;
  });
  const hb = $("#hatch-btn");
  if(hb) hb.classList.toggle("full", S.pop>=cap);

  // hatch button also shows manager face passively via HUD (renderHUD)
}

/* tap the farm / hatch button -> add chickens */
function doHatch(clientX, clientY){
  const before = S.pop;
  if(hatch(4)){
    if(clientX!=null) floatText(clientX, clientY, "+"+fmt(S.pop-before), "");
    haptic(12);
    if(window.World) World.pulse();
    renderFarm();
  }
}

function buyFarmUpgrade(key){
  const cost = key==="hab"?habCost() : key==="feed"?feedCost() : hatchCost();
  if(S.clout < cost){ toast("Not enough Coins"); return; }
  S.clout -= cost;
  S.upg[key]++;
  toast((key==="hab"?"Habitat":key==="feed"?"Feed":"Hatchery")+" upgraded!", "#34d399");
  haptic(30);
  checkAchievements();
  renderFarm(); renderHUD();
  save();
}

/* ============================================================
   SQUAD screen
   ============================================================ */
function renderSquad(){
  const wrap = $("#squad-list"); wrap.innerHTML="";
  ROSTER.forEach(c=>{
    const st = S.squad[c.id];
    const r = RARITY[c.rarity];
    const card = el("div","sqcard rarity-"+c.rarity+(st.owned?" owned":" locked"));
    const cost = upgradeCost(c, st.level);
    const affordable = S.clout >= cost;
    const isFeatured = S.featured===c.id;
    const rollOnly = !r.buy;
    let actionBtn;
    if(st.owned){
      actionBtn = `<button class="btn-up ${affordable?'':'cant'}" data-up="${c.id}">Upgrade · ${fmt(cost)} ${ic('clout')}</button>`;
    } else if(rollOnly){
      actionBtn = `<button class="btn-up summon-only" data-goto-summon="1">${ic('summon')} Summon only</button>`;
    } else {
      actionBtn = `<button class="btn-up ${affordable?'':'cant'}" data-up="${c.id}">Recruit · ${fmt(cost)} ${ic('clout')}</button>`;
    }
    card.innerHTML = `
      <div class="sq-portrait" style="--ring:${r.ring}">
        <img src="${imgFor(c.id)}" loading="lazy" alt="${c.name}">
        ${st.owned?`<span class="lvl">Lv ${st.level}</span>`:`<span class="lock">${rollOnly?ic('summon'):ic('lock')}</span>`}
      </div>
      <div class="sq-info">
        <div class="sq-top">
          <span class="sq-name">${st.owned?c.name:(rollOnly?'???':c.name)}</span>
          <span class="sq-rar" style="background:${r.ring}">${r.name}</span>
        </div>
        <div class="sq-sub">${st.owned
            ? `Lv ${st.level} · +${fmt(r.mult*st.level)} farm boost${S.featured===c.id?' · ACTIVE':''}`
            : (rollOnly?`Pull on the Summon banner to unlock`:`Recruit to reveal`)}</div>
        <div class="sq-actions">
          ${actionBtn}
          ${st.owned?`<button class="btn-feat ${isFeatured?'on':''}" data-feat="${c.id}">${isFeatured?ic('star')+' Featured':'Feature'}</button>`:``}
        </div>
      </div>`;
    wrap.appendChild(card);
  });
  $("#squad-count").textContent = `${ownedCount(S)}/${ROSTER.length}`;
}

function buyUpgrade(id){
  const c = ROSTER_BY_ID[id], st = S.squad[id];
  if(!st.owned && !RARITY[c.rarity].buy){ toast("Summon-only — pull to unlock"); return; }
  const cost = upgradeCost(c, st.level);
  if(S.clout < cost){ toast("Not enough Clout"); return; }
  S.clout -= cost;
  const wasOwned = st.owned;
  st.owned = true; st.level++;
  if(!wasOwned){ toast(`Recruited ${c.name}!`, RARITY[c.rarity].ring); haptic(40); }
  checkAchievements();
  renderSquad(); renderHUD(); renderBoosts();
  save();
}

/* ============================================================
   SUMMON (gacha) — dual banners, pity, 50/50, wishlist
   ============================================================ */
function activeBanner(){ return BANNER_BY_ID[S.activeBanner]; }
function curHave(cur){ return cur==="gems"?S.gems : cur==="stars"?S.stars : S.clout; }
function curSpend(cur, amt){ if(cur==="gems") S.gems-=amt; else if(cur==="stars") S.stars-=amt; else S.clout-=amt; }

function weightedRarity(){
  const total = RARITY_ORDER.reduce((a,k)=>a+RARITY[k].weight,0);
  let roll = Math.random()*total;
  for(const key of RARITY_ORDER){ roll -= RARITY[key].weight; if(roll<=0) return key; }
  return "common";
}

/* pick a top-rarity NON-featured member, preferring the player's wishlist */
function pickTopNonFeatured(banner){
  const rar = banner.topRarity;
  const pool = ROSTER_BY_RARITY[rar].filter(c => c.id !== banner.featured);
  if(pool.length === 0) return ROSTER_BY_ID[banner.featured];
  const wished = pool.filter(c => S.wishlist.includes(c.id));
  const from = wished.length ? wished : pool;
  return from[Math.floor(Math.random()*from.length)];
}

function applyPull(c){
  const st = S.squad[c.id];
  let kind;
  if(!st.owned){ st.owned = true; st.level = Math.max(1, st.level); kind = "new"; }
  else { st.level += 1; kind = "dupe"; }
  // low-rank pulls refund half the recruit price as Clout
  let refund = 0;
  if(RARITY[c.rarity].buy){
    refund = Math.floor(recruitBase(c) * 0.5);
    S.clout += refund; S.stats.totalClout += refund;
  }
  return { c, kind, refund };
}

function pullOne(banner){
  const gs = S.gacha[banner.id];
  gs.pity++; gs.rarePity++;
  S.stats.totalPulls++;

  let rar;
  if(gs.pity >= PITY_LEGENDARY){ rar = banner.topRarity; }   // hard pity for the banner top
  else {
    rar = weightedRarity();
    if(gs.rarePity >= PITY_RARE && RARITY[rar].rank < 2) rar = "rare"; // guaranteed rare+ each 10
  }
  if(RARITY[rar].rank >= 2) gs.rarePity = 0;

  const isTop = (rar === banner.topRarity);
  let c;
  if(isTop){
    gs.pity = 0;
    const feat = ROSTER_BY_ID[banner.featured];
    if(gs.guaranteedFeatured || Math.random() < 0.5){
      c = feat; gs.guaranteedFeatured = false;     // won the 50/50 (or it was guaranteed)
    } else {
      gs.guaranteedFeatured = true;                // lost -> next top is guaranteed featured
      c = pickTopNonFeatured(banner);
    }
  } else {
    const pool = ROSTER_BY_RARITY[rar];
    c = pool[Math.floor(Math.random()*pool.length)];
  }
  return applyPull(c);
}

function summon(n){
  const banner = activeBanner();
  const cost = n===1 ? banner.costSingle : banner.costTen;
  const cur = banner.currency;
  if(curHave(cur) < cost){
    toast(`Not enough ${CURRENCY[cur].name} ${ic(CURRENCY[cur].icon)}`);
    return;
  }
  curSpend(cur, cost);
  const results = [];
  for(let i=0;i<n;i++) results.push(pullOne(banner));
  checkAchievements();
  renderHUD(); renderSquad(); renderBoosts(); renderSummon();
  save();
  playSummon(results, banner);
}

/* ---------- pity / countdown helpers ---------- */
function bannerCountdown(banner){
  const left = (S.bannerEnds[banner.id] - Date.now())/1000;
  return left > 0 ? "Ends in "+fmtTime(left) : "Ending soon";
}

function renderSummon(){
  const banner = activeBanner();
  const gs = S.gacha[banner.id];
  const feat = ROSTER_BY_ID[banner.featured];
  const r = RARITY[feat.rarity];

  // banner tabs
  const tabs = $("#banner-tabs"); tabs.innerHTML="";
  BANNERS.forEach(b=>{
    const t = el("button","banner-tab"+(b.id===S.activeBanner?" on":""));
    t.dataset.banner = b.id;
    t.style.setProperty("--accent", b.accent);
    t.innerHTML = `<span>${b.name}</span><small>${ic(CURRENCY[b.currency].icon)} ${CURRENCY[b.currency].name}</small>`;
    tabs.appendChild(t);
  });

  // featured stage
  const stage = $("#featured-stage");
  stage.style.setProperty("--accent", banner.accent);
  stage.innerHTML = `
    <div class="feat-rays"></div>
    <div class="feat-glow"></div>
    <img class="feat-img" src="${imgFor(feat.id)}" alt="${feat.name}">
    <div class="feat-badge" style="background:${r.ring}">${ic('star')} FEATURED ${r.name.toUpperCase()}</div>
    <div class="feat-meta">
      <div class="feat-name" style="color:${r.ring}">${feat.name}</div>
      <div class="feat-quote">“${feat.quote}”</div>
    </div>`;

  // banner title + countdown
  $("#banner-name").textContent = banner.name;
  $("#banner-tagline").textContent = banner.tagline;
  $("#banner-timer").innerHTML = ic('hourglass')+" "+bannerCountdown(banner);

  // pity meter
  const toGuarantee = Math.max(0, PITY_LEGENDARY - gs.pity);
  $("#pity-count").textContent = toGuarantee;
  $("#pity-top").textContent = RARITY[banner.topRarity].name;
  $("#pity-fill").style.width = (gs.pity/PITY_LEGENDARY*100)+"%";
  $("#pity-fill").style.background = banner.accent;
  $("#fifty-state").textContent = gs.guaranteedFeatured ? "Guaranteed FEATURED next" : "50/50 next";
  $("#fifty-state").className = "fifty "+(gs.guaranteedFeatured?"guaranteed":"");

  // buttons w/ cost + currency
  const curIcon = ic(CURRENCY[banner.currency].icon);
  $("#single-cost").textContent = banner.costSingle;
  $("#ten-cost").textContent = banner.costTen;
  $("#single-cur").innerHTML = curIcon;
  $("#ten-cur").innerHTML = curIcon;
  const have = curHave(banner.currency);
  $("#pull-1").classList.toggle("cant", have < banner.costSingle);
  $("#pull-10").classList.toggle("cant", have < banner.costTen);

  // wishlist button
  $("#wishlist-count").textContent = `${S.wishlist.length}/5`;

  // odds list
  const odds = $("#odds-list"); odds.innerHTML="";
  const total = RARITY_ORDER.reduce((a,k)=>a+RARITY[k].weight,0);
  RARITY_ORDER.forEach(k=>{
    const rr=RARITY[k];
    const isTop = k===banner.topRarity;
    odds.appendChild(el("div","odd"+(isTop?" up":""),
      `<span style='color:${rr.ring}'>${rr.name}${isTop?' '+ic('up'):''}</span><span>${(rr.weight/total*100).toFixed(1)}%</span>`));
  });
}

/* ============================================================
   SUMMON ANIMATION SEQUENCE
   ============================================================ */
let summonTimers = [];
let pendingReveal = null;   // {results, banner}
function clearSummonTimers(){ summonTimers.forEach(clearTimeout); summonTimers = []; }
function sTimeout(fn, ms){ const t=setTimeout(fn, ms); summonTimers.push(t); return t; }

function bestRarity(results){
  return results.reduce((b,res)=> RARITY[res.c.rarity].rank>RARITY[b].rank ? res.c.rarity : b, "common");
}

function flashScreen(color){
  const f = el("div","summon-flash");
  f.style.background = `radial-gradient(circle at 50% 45%, ${color} 0%, transparent 60%)`;
  $("#fx-layer").appendChild(f);
  setTimeout(()=>f.remove(), 650);
}

function playSummon(results, banner){
  clearSummonTimers();
  pendingReveal = { results, banner };
  const best = bestRarity(results);
  const accent = RARITY[best].ring;

  const ov = $("#summon-overlay");
  ov.classList.add("show","summoning");
  ov.classList.remove("revealed");
  ov.style.setProperty("--accent", accent);

  const charge = $("#summon-charge");
  charge.className = "summon-charge rar-"+best+" charging";
  const mascot = $("#summon-mascot");
  mascot.classList.remove("pop-out");
  $("#summon-cards").innerHTML = "";
  $("#summon-cards").classList.remove("show");
  $("#summon-skip").classList.add("show");
  $("#summon-continue").classList.remove("show");

  const chargeMs = best==="mythic"?2400 : best==="legendary"?2000 : best==="epic"?1500 : 1050;
  // the summoner bounces excitedly around the screen, hopping faster near the end
  hopMascot();
  let t = 260;
  while(t < chargeMs - 140){ sTimeout(hopMascot, t); t += (t > chargeMs*0.6 ? 190 : 300); }
  sTimeout(()=>charge.classList.add("peak"), chargeMs*0.55);
  sTimeout(()=>{
    charge.classList.add("burst");
    mascot.classList.add("pop-out");
    flashScreen(accent);
    screenShake(best==="mythic"?16:best==="legendary"?12:7);
    haptic(best==="mythic"||best==="legendary"?90:40);
  }, chargeMs);
  sTimeout(()=>{
    charge.classList.add("done");
    revealCards(results, banner, false);
  }, chargeMs+420);
}

/* the summoner mascot hops to a new spot with a squash-and-stretch bounce */
function hopMascot(){
  const m = $("#summon-mascot"); if(!m) return;
  m.style.left = (14 + Math.random()*72) + "%";
  m.style.top  = (22 + Math.random()*50) + "%";
  m.classList.remove("hop"); void m.offsetWidth; m.classList.add("hop");
  if(S.settings.haptics) haptic(6);
}

function revealCards(results, banner, instant){
  const cards = $("#summon-cards");
  cards.className = "summon-cards show "+(results.length>1?"multi":"single");
  cards.innerHTML = "";
  $("#summon-skip").classList.remove("show");

  results.forEach((res,i)=>{
    const r = RARITY[res.c.rarity];
    const top = r.rank>=4;
    const card = el("div","reveal-card rar-"+res.c.rarity+(top?" cinematic":""));
    const delay = instant?0 : 0.12 + i*0.14;
    card.style.setProperty("--d", delay+"s");
    const featTag = res.c.id===banner.featured ? `<span class="rv-feat">${ic('star')} FEATURED</span>` : "";
    const refundTag = res.refund>0 ? `<span class="rv-refund">+${fmt(res.refund)} ${ic('clout')}</span>` : "";
    card.innerHTML = `
      <div class="rv-inner">
        <div class="rv-back"><span>?</span></div>
        <div class="rv-front" style="--ring:${r.ring}">
          <div class="rv-rays"></div>
          <img src="${imgFor(res.c.id)}" alt="${res.c.name}">
          <div class="rv-grad"></div>
          <div class="rv-info">
            <div class="rv-rar" style="color:${r.ring}">${r.name}</div>
            <div class="rv-name">${res.c.name}</div>
          </div>
          ${featTag}
          <div class="rv-tag ${res.kind}">${res.kind==="new"?"NEW!":"+1 LV"}</div>
          ${refundTag}
        </div>
      </div>`;
    cards.appendChild(card);
    if(top && !instant){
      sTimeout(()=>{
        burstParticles(window.innerWidth/2, window.innerHeight*0.42, r.ring, 26);
        haptic(70); screenShake(10);
      }, delay*1000+480);
    }
  });

  const showContinue = ()=> $("#summon-continue").classList.add("show");
  if(instant) showContinue(); else sTimeout(showContinue, (0.12+results.length*0.14)*1000+500);
  $("#summon-overlay").classList.add("revealed");
}

function skipToReveal(){
  if(!pendingReveal) return;
  clearSummonTimers();
  $("#summon-charge").className = "summon-charge done";
  revealCards(pendingReveal.results, pendingReveal.banner, true);
}
function closeSummon(){
  clearSummonTimers();
  pendingReveal = null;
  $("#summon-overlay").classList.remove("show","summoning","revealed");
}

/* ============================================================
   WISHLIST
   ============================================================ */
function renderWishlist(){
  const wrap = $("#wishlist-grid"); wrap.innerHTML="";
  wishlistPool().forEach(c=>{
    const r = RARITY[c.rarity];
    const on = S.wishlist.includes(c.id);
    const owned = S.squad[c.id].owned;
    const card = el("div","wish-card rarity-"+c.rarity+(on?" on":""));
    card.dataset.wish = c.id;
    card.innerHTML = `
      <div class="wish-port" style="--ring:${r.ring}">
        <img src="${imgFor(c.id)}" loading="lazy" alt="${c.name}">
        ${on?`<span class="wish-check">${ic('check')}</span>`:''}
        ${owned?'<span class="wish-owned">OWNED</span>':''}
      </div>
      <div class="wish-name">${c.name}</div>
      <div class="wish-rar" style="color:${r.ring}">${r.name}</div>`;
    wrap.appendChild(card);
  });
  $("#wishlist-modal-count").textContent = `${S.wishlist.length}/5 selected`;
}
function toggleWish(id){
  const i = S.wishlist.indexOf(id);
  if(i>=0){ S.wishlist.splice(i,1); }
  else {
    if(S.wishlist.length>=5){ toast("Wishlist full (max 5)"); return; }
    S.wishlist.push(id);
  }
  renderWishlist(); renderSummon(); save();
}

/* ============================================================
   SHOP — Clout & Snap sinks with daily restock
   ============================================================ */
const EXTRA_BOOST = {
  goldfrenzy: { icon:"goldrush", name:"Gold Frenzy" },
  overclock:  { icon:"boosts",   name:"Overclock" },
};

function shopResetIfNewDay(){
  const today = Math.floor(Date.now()/86400000);
  if(!S.shop || S.shop.day !== today) S.shop = { day:today, bought:{} };
}

function renderShop(){
  shopResetIfNewDay();
  const wrap = $("#shop-list"); if(!wrap) return; wrap.innerHTML="";
  SHOP_ITEMS.forEach(it=>{
    const bought = S.shop.bought[it.id]||0;
    const soldOut = it.limit>0 && bought>=it.limit;
    const c = it.cost(bought);
    const amt = Math.ceil(c.amt);
    const afford = curHave(c.cur) >= amt;
    const card = el("div","shop-card"+(soldOut?" soldout":""));
    card.innerHTML = `
      <div class="shop-ic">${ic(it.icon)}</div>
      <div class="shop-info">
        <div class="shop-name">${it.name}</div>
        <div class="shop-desc">${it.desc}</div>
        ${it.limit>0?`<div class="shop-limit">${Math.max(0,it.limit-bought)}/${it.limit} left today</div>`:``}
      </div>
      <button class="shop-buy ${afford&&!soldOut?'':'cant'}" data-shop="${it.id}" ${soldOut?'disabled':''}>
        ${soldOut?'SOLD OUT':`${fmt(amt)} ${ic(CURRENCY[c.cur].icon)}`}
      </button>`;
    wrap.appendChild(card);
  });
}

function buyShopItem(id){
  shopResetIfNewDay();
  const it = SHOP_ITEMS.find(i=>i.id===id); if(!it) return;
  const bought = S.shop.bought[id]||0;
  if(it.limit>0 && bought>=it.limit){ toast("Sold out today — restocks tomorrow"); return; }
  const c = it.cost(bought);
  const amt = Math.ceil(c.amt);
  if(curHave(c.cur) < amt){ toast(`Not enough ${CURRENCY[c.cur].name} ${ic(CURRENCY[c.cur].icon)}`); return; }
  curSpend(c.cur, amt);
  const r = it.reward;
  if(r.gems) S.gems += r.gems;
  if(r.stars) S.stars += r.stars;
  if(r.payoutHours){
    const g = cps()*3600*r.payoutHours;
    S.clout += g; S.stats.totalClout += g;
    floatText(window.innerWidth/2, window.innerHeight*0.4, "+"+fmt(g), "crit");
  }
  if(r.overclock){
    S.activeBoosts.push({ type:"overclock", until:Date.now()+r.overclock.secs*1000, mult:r.overclock.mult, kind:"all" });
  }
  if(r.refresh) S.abilityReady = {};
  S.shop.bought[id] = bought+1;
  haptic(35);
  toast(`${it.name} purchased`, "#34d399");
  checkAchievements();
  renderHUD(); renderShop(); renderBoosts();
  save();
}

/* ============================================================
   BOOSTS (active abilities) screen
   ============================================================ */
function abilityList(){
  const owned = ROSTER.filter(c=>S.squad[c.id].owned);
  const seen = {}, list = [];
  owned.forEach(c=>{ if(seen[c.ability]) return; seen[c.ability]=true; list.push({ ability:c.ability, owner:c }); });
  return list;
}
function triggerAbility(type){
  const now = Date.now();
  const ready = S.abilityReady[type] || 0;
  if(now < ready){ toast("On cooldown"); return; }
  const A = ABILITIES[type];
  S.abilityReady[type] = now + A.cd*1000;
  if(type==="frenzy"){   hatch(capacity()); S.activeBoosts.push({type, until:now+A.dur*1000, mult:3, kind:"all"}); }
  if(type==="overdrive") S.activeBoosts.push({type, until:now+A.dur*1000, mult:4, kind:"idle"});
  if(type==="blackout")  S.activeBoosts.push({type, until:now+A.dur*1000, mult:10, kind:"all"});
  if(type==="goldrush"){ for(let i=0;i<6;i++) setTimeout(spawnGold, i*350); }
  if(type==="cloutbomb"){ const amt = cps()*90; S.clout+=amt; S.stats.totalClout+=amt; floatText(window.innerWidth/2, window.innerHeight*0.4, "+"+fmt(amt), "crit"); }
  if(window.World) World.playAbility(type);
  toast(ic(A.icon)+" "+A.name+"!", "#ffb23e");
  haptic(50);
  renderBoosts(); renderHUD();
  save();
}
function renderBoosts(){
  const wrap = $("#boost-list"); wrap.innerHTML="";
  const list = abilityList();
  if(list.length===0){ wrap.innerHTML="<p class='muted'>Recruit squad members to unlock their abilities.</p>"; }
  const now = Date.now();
  list.forEach(({ability})=>{
    const A = ABILITIES[ability];
    const ready = S.abilityReady[ability]||0;
    const cd = Math.max(0, (ready-now)/1000);
    const pct = cd>0 ? (1 - cd/A.cd)*100 : 100;
    const card = el("div","boost-card"+(cd>0?" cooling":""));
    card.innerHTML = `
      <div class="boost-icon">${ic(A.icon)}</div>
      <div class="boost-meta">
        <div class="boost-name">${A.name}</div>
        <div class="boost-desc">${A.desc}</div>
        <div class="cd-bar"><div class="cd-fill" style="width:${pct}%"></div></div>
      </div>
      <button class="boost-go" data-ability="${ability}" ${cd>0?'disabled':''}>${cd>0?fmtTime(cd):"GO"}</button>`;
    wrap.appendChild(card);
  });
  const chips = $("#active-boosts"); chips.innerHTML="";
  S.activeBoosts.forEach(b=>{
    const A=ABILITIES[b.type]||EXTRA_BOOST[b.type]||{icon:"timer",name:b.type};
    const left=Math.max(0,(b.until-now)/1000);
    chips.appendChild(el("div","boost-chip",`${ic(A.icon)} ${A.name} ${left.toFixed(0)}s`));
  });
}

/* ============================================================
   GOLDEN SNAPS
   ============================================================ */
let goldTimer = 0;
function spawnGold(){
  const g = el("div","gold-snap",`<img src="assets/fx/cookiecat.webp" alt="Golden Cat">`);
  g.style.top = (20 + Math.random()*60)+"vh";
  g.style.left = "-12vw";
  $("#fx-layer").appendChild(g);
  const dur = 5200 + Math.random()*2200;
  g.animate([
    { transform:"translateX(0) rotate(0deg)" },
    { transform:`translateX(124vw) rotate(${Math.random()<.5?360:-360}deg)` }
  ], { duration:dur, easing:"linear" });
  let caught=false;
  g.addEventListener("pointerdown", e=>{
    if(caught) return; caught=true;
    e.stopPropagation();
    const rect = g.getBoundingClientRect();
    catchGold(rect.left+rect.width/2, rect.top+rect.height/2);
    g.remove();
  });
  setTimeout(()=>g.remove(), dur+50);
}
function catchGold(x,y){
  S.stats.goldCaught++;
  const roll = Math.random();
  if(roll < 0.45){
    const amt = Math.max(cps()*90, 50);
    S.clout += amt; S.stats.totalClout+=amt;
    floatText(x,y,"+"+fmt(amt)+" COINS","gold");
  } else if(roll < 0.70){
    S.activeBoosts.push({type:"goldfrenzy", until:Date.now()+15000, mult:7, kind:"all"});
    floatText(x,y,"×7 FRENZY 15s","gold");
  } else if(roll < 0.93){
    const g = 1+Math.floor(Math.random()*3);
    S.gems += g; floatText(x,y,"+"+g+" "+ic('snap'),"gold");
  } else {
    S.stars += 1; floatText(x,y,"+1 "+ic('star')+" Star Snap","star");
  }
  burstParticles(x,y,"#ffd166",24);
  haptic(45);
  checkAchievements();
  renderHUD(); save();
}

/* ============================================================
   PRESTIGE / REBRAND
   ============================================================ */
function renderPrestige(){
  const pend = pendingInfluence();
  $("#infl-have").textContent = fmt(S.influence);
  $("#infl-pending").textContent = "+"+fmt(pend);
  $("#infl-bonus").textContent = "×"+(1+(S.influence+pend)*0.02).toFixed(2);
  $("#rebrand-btn").disabled = pend<=0;
  $("#rebrand-note").innerHTML = pend<=0
    ? "Reach 10M lifetime Coins to Rebrand."
    : `Rebranding resets your farm &amp; managers but grants a permanent multiplier + 3 ${ic('star')}.`;
}
function rebrand(){
  const pend = pendingInfluence();
  if(pend<=0) return;
  if(!confirm(`Rebrand for +${fmt(pend)} Influence? Your Clout and squad levels reset, but you keep Snaps, Star Snaps, achievements, and gain a permanent x${(1+(S.influence+pend)*0.02).toFixed(2)} multiplier (and +3 Star Snaps).`)) return;
  S.influence += pend;
  S.stats.rebrands++;
  S.stars += 3;
  S.clout = 0; S.stats.totalClout = 0;
  S.activeBoosts = []; S.abilityReady = {};
  S.pop = 8; S.upg = { hab:0, feed:0, hatch:0 };
  const squad = {};
  ROSTER.forEach(c => squad[c.id] = { owned:false, level:0 });
  squad.closer.owned=true; squad.closer.level=1;
  S.squad = squad;
  S.featured = "closer";
  if(window.World) World.setPopulation(S.pop);
  toast("Rebranded! New era begins "+ic('summon'),"#b06bff");
  checkAchievements();
  save();
  renderAll();
}

/* ============================================================
   ACHIEVEMENTS + DAILY
   ============================================================ */
function checkAchievements(){
  let gained=0;
  ACHIEVEMENTS.forEach(a=>{
    if(!S.achievements[a.id] && a.check(S)){
      S.achievements[a.id]=true;
      S.gems += a.gems; gained += a.gems;
      toast(`${ic('trophy')} ${a.name} (+${a.gems} ${ic('snap')})`, "#ffd166");
    }
  });
  if(gained){ renderHUD(); renderAchievements(); }
}
function renderAchievements(){
  const wrap=$("#ach-list"); if(!wrap) return; wrap.innerHTML="";
  ACHIEVEMENTS.forEach(a=>{
    const done=!!S.achievements[a.id];
    const c=el("div","ach-row"+(done?" done":""));
    c.innerHTML=`<div class="ach-ico">${done?ic('trophy'):ic('lock')}</div>
      <div class="ach-txt"><b>${a.name}</b><span>${a.desc}</span></div>
      <div class="ach-rew">+${a.gems} ${ic('snap')}</div>`;
    wrap.appendChild(c);
  });
}

function checkDaily(){
  const today = Math.floor(Date.now()/86400000);
  const last = S.daily.last||0;
  if(last === today){ S.daily.claimedToday=true; return; }
  if(today - last === 1) S.daily.streak += 1; else S.daily.streak = 1;
  S.daily.last = today;
  S.daily.claimedToday = false;
}
function dailyReward(){
  const s = S.daily.streak;
  return { gems: 2 + Math.min(s,7), stars: (s>0 && s%7===0)?1:0 };
}
function claimDaily(){
  if(S.daily.claimedToday){ toast("Already claimed today"); return; }
  const rw = dailyReward();
  S.gems += rw.gems; S.stars += rw.stars;
  S.daily.claimedToday = true;
  toast(`Day ${S.daily.streak}: +${rw.gems} ${ic('snap')}${rw.stars?` +${rw.stars} ${ic('star')}`:""}`, "#ffd166");
  checkAchievements();
  renderHUD(); renderDaily(); save();
}
function renderDaily(){
  const box=$("#daily-box"); if(!box) return;
  const rw=dailyReward();
  box.innerHTML = `
    <div class="daily-streak">${ic('fire')} ${S.daily.streak}-day streak</div>
    <button id="daily-claim" class="big-btn ${S.daily.claimedToday?'cant':''}">
      ${S.daily.claimedToday?"Come back tomorrow":`Claim +${rw.gems} ${ic('snap')}${rw.stars?` +${rw.stars} ${ic('star')}`:""}`}
    </button>`;
  const b=$("#daily-claim"); if(b) b.onclick=claimDaily;
}

/* ============================================================
   STATS screen
   ============================================================ */
function renderStats(){
  const wrap=$("#stats-list"); if(!wrap) return;
  const rows = [
    ["Lifetime Coins earned", fmt(S.stats.totalClout)],
    ["Coins / second", fmt(cps())],
    ["Egg tier", eggTier().name],
    ["Chickens", fmt(Math.floor(S.pop))+" / "+fmt(capacity())],
    ["Farm multiplier", "×"+farmMult().toFixed(2)],
    ["Total summons", fmt(S.stats.totalPulls||0)],
    ["Golden Cats caught", S.stats.goldCaught],
    ["Managers recruited", ownedCount(S)+"/"+ROSTER.length],
    ["Influence", fmt(S.influence)+" (×"+influenceMult().toFixed(2)+")"],
    ["Rebrands", S.stats.rebrands],
    [`Snaps ${ic('snap')}`, fmt(S.gems)],
    [`Star Snaps ${ic('star')}`, fmt(S.stars)],
  ];
  wrap.innerHTML = rows.map(r=>`<div class="stat-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("");
  renderAchievements();
}

/* ============================================================
   TOASTS
   ============================================================ */
let toastTimer=null;
function toast(msg, color){
  const t=$("#toast");
  t.innerHTML=msg;
  t.style.borderColor = color||"#3da9fc";
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove("show"),1900);
}

/* ============================================================
   NAV / SCREENS
   ============================================================ */
const SCREENS = ["farm","squad","summon","boosts","shop","stats"];
function showScreen(name){
  SCREENS.forEach(s=>{
    $("#screen-"+s).classList.toggle("active", s===name);
    const nav=$(`[data-nav="${s}"]`); if(nav) nav.classList.toggle("on", s===name);
  });
  document.body.classList.toggle("farm-active", name==="farm");
  if(window.World) World.setActive(name==="farm");
  if(name==="farm") renderFarm();
  if(name==="squad") renderSquad();
  if(name==="summon") renderSummon();
  if(name==="boosts") renderBoosts();
  if(name==="shop") renderShop();
  if(name==="stats"){ renderStats(); renderDaily(); renderPrestige(); }
}

function renderAll(){
  renderHUD(); renderFarm(); renderSquad(); renderSummon(); renderBoosts();
  renderStats(); renderDaily(); renderPrestige();
}

/* ============================================================
   MAIN LOOP
   ============================================================ */
let lastTick = Date.now();
function tick(){
  const now = Date.now();
  const dt = (now - lastTick)/1000;
  lastTick = now;

  if(S.activeBoosts.length) S.activeBoosts = S.activeBoosts.filter(b=>b.until>now);

  // passive hatching toward capacity
  const cap = capacity();
  if(S.pop < cap){
    S.pop = Math.min(cap, S.pop + hatchRate()*dt);
    if(window.World) World.setPopulation(S.pop);
  }

  const gain = cps()*dt;
  if(gain>0){ S.clout += gain; S.stats.totalClout += gain; }

  goldTimer -= dt*1000;
  if(goldTimer<=0){ spawnGold(); goldTimer = GOLD_INTERVAL[0] + Math.random()*(GOLD_INTERVAL[1]-GOLD_INTERVAL[0]); }

  renderHUD();
  if($("#screen-farm").classList.contains("active")) renderFarm();
  if($("#screen-boosts").classList.contains("active")) renderBoosts();
  if($("#screen-summon").classList.contains("active")) $("#banner-timer").innerHTML = ic('hourglass')+" "+bannerCountdown(activeBanner());

  if(Math.random()<0.02) checkAchievements();
}

/* ============================================================
   OFFLINE EARNINGS
   ============================================================ */
function applyOffline(){
  const now = Date.now();
  const away = (now - (S.lastSeen||now))/1000;
  if(away < 60) return;
  const rate = cps();
  const capped = Math.min(away, 8*3600);
  const earned = rate * capped * 0.5;
  if(earned <= 0) return;
  S.clout += earned; S.stats.totalClout += earned;
  setTimeout(()=>{
    const ov=$("#offline-overlay");
    $("#offline-time").textContent = fmtTime(away);
    $("#offline-amt").textContent = fmt(earned);
    ov.classList.add("show");
  }, 400);
}

/* ============================================================
   BOOT
   ============================================================ */
let hatchHold = null;
function bindEvents(){
  // tap the field to hatch; press-and-hold the HATCH button to hatch fast
  const field = $("#screen-farm .farm-flex");
  if(field) field.addEventListener("pointerdown", e=>{
    if(e.target.closest(".gold-snap")) return;
    doHatch(e.clientX, e.clientY);
  });
  const hb = $("#hatch-btn");
  if(hb){
    const start = e=>{ e.preventDefault(); doHatch(); clearInterval(hatchHold); hatchHold=setInterval(()=>doHatch(), 120); };
    const stop = ()=>{ clearInterval(hatchHold); hatchHold=null; };
    hb.addEventListener("pointerdown", start);
    hb.addEventListener("pointerup", stop);
    hb.addEventListener("pointerleave", stop);
    hb.addEventListener("pointercancel", stop);
  }
  $("#farm-upgrades")?.addEventListener("click", e=>{
    const u=e.target.closest("[data-upg]"); if(u) buyFarmUpgrade(u.dataset.upg);
  });

  $$("[data-nav]").forEach(b=> b.addEventListener("click",()=>showScreen(b.dataset.nav)));

  $("#squad-list").addEventListener("click", e=>{
    const up=e.target.closest("[data-up]"); if(up){ buyUpgrade(up.dataset.up); return; }
    const ft=e.target.closest("[data-feat]"); if(ft){ S.featured=ft.dataset.feat; renderHUD(); renderFarm(); renderSquad(); save(); toast("Manager set"); return; }
    if(e.target.closest("[data-goto-summon]")) showScreen("summon");
  });

  // banner tabs
  $("#banner-tabs").addEventListener("click", e=>{
    const t=e.target.closest("[data-banner]"); if(!t) return;
    S.activeBanner = t.dataset.banner; renderSummon(); save();
  });

  // summon buttons
  $("#pull-1").addEventListener("click",()=>summon(1));
  $("#pull-10").addEventListener("click",()=>summon(10));

  // summon overlay controls
  $("#summon-skip").addEventListener("click", e=>{ e.stopPropagation(); skipToReveal(); });
  $("#summon-continue").addEventListener("click", e=>{ e.stopPropagation(); closeSummon(); });
  $("#summon-overlay").addEventListener("click", ()=>{
    if(!pendingReveal) return;
    if($("#summon-overlay").classList.contains("revealed")) closeSummon();
    else skipToReveal();
  });

  // wishlist
  $("#wishlist-open").addEventListener("click", ()=>{ renderWishlist(); $("#wishlist-overlay").classList.add("show"); });
  $("#wishlist-close").addEventListener("click", ()=> $("#wishlist-overlay").classList.remove("show"));
  $("#wishlist-grid").addEventListener("click", e=>{ const w=e.target.closest("[data-wish]"); if(w) toggleWish(w.dataset.wish); });

  // boosts
  $("#boost-list").addEventListener("click", e=>{ const b=e.target.closest("[data-ability]"); if(b) triggerAbility(b.dataset.ability); });

  // shop
  $("#shop-list").addEventListener("click", e=>{ const b=e.target.closest("[data-shop]"); if(b) buyShopItem(b.dataset.shop); });

  // prestige
  $("#rebrand-btn").addEventListener("click", rebrand);

  // offline overlay dismiss
  $("#offline-collect").addEventListener("click",()=>$("#offline-overlay").classList.remove("show"));

  // settings
  $("#opt-sfx").addEventListener("change",e=>{S.settings.sfx=e.target.checked;save();});
  $("#opt-haptics").addEventListener("change",e=>{S.settings.haptics=e.target.checked;save();});
  $("#wipe-btn").addEventListener("click",()=>{
    if(confirm("Erase ALL progress? This cannot be undone.")){ localStorage.removeItem(SAVE_KEY); location.reload(); }
  });

  document.addEventListener("visibilitychange",()=>{ if(document.hidden) save(); });
  window.addEventListener("beforeunload", save);
}

function boot(){
  load();
  checkDaily();
  shopResetIfNewDay();
  applyOffline();
  bindEvents();
  $("#opt-sfx").checked = S.settings.sfx;
  $("#opt-haptics").checked = S.settings.haptics;
  const ver = $("#app-version"); if(ver) ver.textContent = GAME_VERSION;
  fillIcons();
  // boot the 3D farm world (guarded — falls back gracefully without WebGL)
  try {
    if(window.World){ World.init($("#farm-canvas")); World.setPopulation(S.pop); }
  } catch(e){ console.warn("3D world unavailable", e); }
  renderAll();
  showScreen("farm");
  checkAchievements();
  lastTick = Date.now();
  setInterval(tick, TICK_MS);
  setInterval(save, 15000);
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("service-worker.js").catch(()=>{});
  }
}

document.addEventListener("DOMContentLoaded", boot);
