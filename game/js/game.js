/* ============================================================
   SNAP SQUAD: Clout Empire — game engine
   Vanilla JS. No dependencies. Mobile-first.
   ============================================================ */
'use strict';

const SAVE_KEY = "snapsquad.save.v1";
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
    clout: 0,
    gems: 5,
    stars: 0,
    featured: "closer",
    squad,
    influence: 0,          // permanent prestige multiplier source
    abilityReady: {},      // id -> timestamp when ready
    activeBoosts: [],      // {type,until,mult,kind}
    daily: { streak:0, last:0, claimedToday:false },
    achievements: {},      // id -> true
    activeBanner: "snap",
    gacha: freshGacha(),   // per-banner pity/50-50 state
    wishlist: [],          // char ids the player wants (max 5)
    bannerEnds: freshBannerEnds(),
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
    return true;
  } catch(e){ return false; }
}

/* ---------------- derived numbers ---------------- */
function influenceMult(){ return 1 + S.influence * 0.02; } // +2% per influence point

function levelCps(c, lvl){ return c.baseCps * RARITY[c.rarity].mult * lvl; }
function memberCps(id){
  const st = S.squad[id]; if(!st.owned) return 0;
  return levelCps(ROSTER_BY_ID[id], st.level);
}
function baseCps(){
  let sum = 0;
  for(const id in S.squad) sum += memberCps(id);
  return sum;
}
function idleMult(){
  let m = influenceMult();
  for(const b of S.activeBoosts){ if(b.kind==="idle" || b.kind==="all") m *= b.mult; }
  return m;
}
function cps(){ return baseCps() * idleMult(); }

function tapBase(){
  let sum = 1;
  for(const id in S.squad){
    const st = S.squad[id];
    if(st.owned){ sum += ROSTER_BY_ID[id].tapBonus * RARITY[ROSTER_BY_ID[id].rarity].mult * (1 + (st.level-1)*0.5); }
  }
  sum += baseCps() * 0.15; // tapping benefits a little from your empire
  return sum * influenceMult();
}
function tapMult(){
  let m = 1;
  for(const b of S.activeBoosts){ if(b.kind==="tap" || b.kind==="all") m *= b.mult; }
  return m;
}

function upgradeCost(c, lvl){ return Math.ceil(c.baseCost * Math.pow(1.16, lvl)); }

/* influence you'd gain by rebranding now */
function pendingInfluence(){
  const tc = S.stats.totalClout;
  if(tc < 1e9) return 0;
  return Math.floor(Math.pow(tc / 1e9, 0.45));
}

/* ---------------- combo ---------------- */
let combo = 0, comboExpire = 0;
function comboMult(){ return 1 + Math.min(combo, COMBO_MAX) * 0.15; }

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
  const s = $("#hero-stage");
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
}

/* ---------- TAP screen ---------- */
function renderTapScreen(){
  const c = ROSTER_BY_ID[S.featured];
  const stage = $("#hero-stage");
  if(stage.dataset.cur !== S.featured){
    stage.dataset.cur = S.featured;
    $("#hero-img").src = imgFor(S.featured);
    $("#hero-img").style.boxShadow = `0 0 0 6px ${RARITY[c.rarity].ring}, 0 18px 50px rgba(0,0,0,.6)`;
    $("#hero-name").textContent = c.name;
    $("#hero-name").style.color = RARITY[c.rarity].ring;
    $("#hero-rarity").textContent = RARITY[c.rarity].name.toUpperCase();
    $("#hero-rarity").style.background = RARITY[c.rarity].ring;
    $("#hero-quote").textContent = "“"+c.quote+"”";
  }
  $("#tap-power").textContent = fmt(tapBase()*tapMult()*comboMult());
}

function updateComboUI(){
  const bar = $("#combo-wrap");
  if(combo > 1){
    bar.classList.add("show");
    $("#combo-mult").textContent = comboMult().toFixed(2)+"×";
    $("#combo-count").textContent = combo+" combo";
    $("#combo-fill").style.width = (Math.min(combo, COMBO_MAX)/COMBO_MAX*100)+"%";
  } else bar.classList.remove("show");
}

function doTap(clientX, clientY){
  const now = Date.now();
  if(now < comboExpire) combo++; else combo = 1;
  comboExpire = now + COMBO_WINDOW;
  if(combo > S.stats.bestCombo) S.stats.bestCombo = combo;

  let val = tapBase() * tapMult() * comboMult();
  let crit = Math.random() < CRIT_CHANCE;
  if(crit) val *= CRIT_MULT;

  S.clout += val;
  S.stats.totalClout += val;
  S.stats.totalTaps++;

  floatText(clientX, clientY, (crit?"CRIT! ":"+")+fmt(val), crit?"crit":"");
  burstParticles(clientX, clientY, crit?"#ffd166":"#3da9fc", crit?14:6);
  haptic(crit?28:10);
  shake(crit?7:3);
  $("#hero-img").classList.remove("pop"); void $("#hero-img").offsetWidth; $("#hero-img").classList.add("pop");
  updateComboUI();
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
      actionBtn = `<button class="btn-up ${affordable?'':'cant'}" data-up="${c.id}">Upgrade · ${fmt(cost)} 💠</button>`;
    } else if(rollOnly){
      actionBtn = `<button class="btn-up summon-only" data-goto-summon="1">✦ Summon only</button>`;
    } else {
      actionBtn = `<button class="btn-up ${affordable?'':'cant'}" data-up="${c.id}">Recruit · ${fmt(cost)} 💠</button>`;
    }
    card.innerHTML = `
      <div class="sq-portrait" style="--ring:${r.ring}">
        <img src="${imgFor(c.id)}" loading="lazy" alt="${c.name}">
        ${st.owned?`<span class="lvl">Lv ${st.level}</span>`:`<span class="lock">${rollOnly?'✦':'🔒'}</span>`}
      </div>
      <div class="sq-info">
        <div class="sq-top">
          <span class="sq-name">${st.owned?c.name:(rollOnly?'???':c.name)}</span>
          <span class="sq-rar" style="background:${r.ring}">${r.name}</span>
        </div>
        <div class="sq-sub">${st.owned
            ? `${fmt(memberCps(c.id))}/s · +${fmt(c.tapBonus*r.mult*(1+(st.level-1)*0.5))}/tap`
            : (rollOnly?`Pull on the Summon banner to unlock`:`Recruit to reveal`)}</div>
        <div class="sq-actions">
          ${actionBtn}
          ${st.owned?`<button class="btn-feat ${isFeatured?'on':''}" data-feat="${c.id}">${isFeatured?'★ Featured':'Feature'}</button>`:``}
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
    refund = Math.floor(c.baseCost * 0.5);
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
    toast(`Not enough ${CURRENCY[cur].name} ${CURRENCY[cur].icon}`);
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
    t.innerHTML = `<span>${b.name}</span><small>${CURRENCY[b.currency].icon} ${CURRENCY[b.currency].name}</small>`;
    tabs.appendChild(t);
  });

  // featured stage
  const stage = $("#featured-stage");
  stage.style.setProperty("--accent", banner.accent);
  stage.innerHTML = `
    <div class="feat-rays"></div>
    <div class="feat-glow"></div>
    <img class="feat-img" src="${imgFor(feat.id)}" alt="${feat.name}">
    <div class="feat-badge" style="background:${r.ring}">★ FEATURED ${r.name.toUpperCase()}</div>
    <div class="feat-meta">
      <div class="feat-name" style="color:${r.ring}">${feat.name}</div>
      <div class="feat-quote">“${feat.quote}”</div>
    </div>`;

  // banner title + countdown
  $("#banner-name").textContent = banner.name;
  $("#banner-tagline").textContent = banner.tagline;
  $("#banner-timer").textContent = "⏳ "+bannerCountdown(banner);

  // pity meter
  const toGuarantee = Math.max(0, PITY_LEGENDARY - gs.pity);
  $("#pity-count").textContent = toGuarantee;
  $("#pity-top").textContent = RARITY[banner.topRarity].name;
  $("#pity-fill").style.width = (gs.pity/PITY_LEGENDARY*100)+"%";
  $("#pity-fill").style.background = banner.accent;
  $("#fifty-state").textContent = gs.guaranteedFeatured ? "Guaranteed FEATURED next" : "50/50 next";
  $("#fifty-state").className = "fifty "+(gs.guaranteedFeatured?"guaranteed":"");

  // buttons w/ cost + currency
  const icon = CURRENCY[banner.currency].icon;
  $("#single-cost").textContent = banner.costSingle;
  $("#ten-cost").textContent = banner.costTen;
  $("#single-cur").textContent = icon;
  $("#ten-cur").textContent = icon;
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
      `<span style='color:${rr.ring}'>${rr.name}${isTop?' ▲':''}</span><span>${(rr.weight/total*100).toFixed(1)}%</span>`));
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
  charge.className = "summon-charge rar-"+best;
  void charge.offsetWidth;
  charge.classList.add("charging");
  $("#summon-cards").innerHTML = "";
  $("#summon-cards").classList.remove("show");
  $("#summon-skip").classList.add("show");
  $("#summon-continue").classList.remove("show");

  const chargeMs = best==="mythic"?2200 : best==="legendary"?1900 : best==="epic"?1500 : 1050;
  sTimeout(()=>charge.classList.add("peak"), chargeMs*0.45);
  sTimeout(()=>{ haptic(20); }, chargeMs*0.7);
  sTimeout(()=>{
    charge.classList.add("burst");
    flashScreen(accent);
    screenShake(best==="mythic"?16:best==="legendary"?12:7);
    haptic(best==="mythic"||best==="legendary"?90:40);
  }, chargeMs);
  sTimeout(()=>{
    charge.classList.add("done");
    revealCards(results, banner, false);
  }, chargeMs+420);
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
    const featTag = res.c.id===banner.featured ? `<span class="rv-feat">★ FEATURED</span>` : "";
    const refundTag = res.refund>0 ? `<span class="rv-refund">+${fmt(res.refund)} 💠</span>` : "";
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
        ${on?'<span class="wish-check">✓</span>':''}
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
   SHOP (under construction)
   ============================================================ */
function renderShop(){ /* static placeholder markup lives in index.html */ }

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
  if(type==="frenzy")    S.activeBoosts.push({type, until:now+A.dur*1000, mult:8, kind:"tap"});
  if(type==="overdrive") S.activeBoosts.push({type, until:now+A.dur*1000, mult:4, kind:"idle"});
  if(type==="blackout")  S.activeBoosts.push({type, until:now+A.dur*1000, mult:10, kind:"all"});
  if(type==="goldrush"){ for(let i=0;i<6;i++) setTimeout(spawnGold, i*350); }
  if(type==="cloutbomb"){ const amt = cps()*90; S.clout+=amt; S.stats.totalClout+=amt; floatText(window.innerWidth/2, window.innerHeight*0.4, "+"+fmt(amt), "crit"); }
  toast(A.icon+" "+A.name+"!", "#ffb23e");
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
      <div class="boost-icon">${A.icon}</div>
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
    const A=ABILITIES[b.type]||{icon:"⏱",name:b.type};
    const left=Math.max(0,(b.until-now)/1000);
    chips.appendChild(el("div","boost-chip",`${A.icon} ${A.name} ${left.toFixed(0)}s`));
  });
}

/* ============================================================
   GOLDEN SNAPS
   ============================================================ */
let goldTimer = 0;
function spawnGold(){
  const g = el("div","gold-snap","👻");
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
    const amt = Math.max(cps()*60, tapBase()*120);
    S.clout += amt; S.stats.totalClout+=amt;
    floatText(x,y,"+"+fmt(amt)+" CLOUT","gold");
  } else if(roll < 0.70){
    S.activeBoosts.push({type:"goldfrenzy", until:Date.now()+15000, mult:7, kind:"all"});
    floatText(x,y,"×7 FRENZY 15s","gold");
  } else if(roll < 0.93){
    const g = 1+Math.floor(Math.random()*3);
    S.gems += g; floatText(x,y,"+"+g+" 💎","gold");
  } else {
    S.stars += 1; floatText(x,y,"+1 ⭐ Star Snap","star");
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
  $("#rebrand-note").textContent = pend<=0
    ? "Reach 1B total Clout to Rebrand."
    : `Rebranding resets Clout & squad levels but grants permanent income + 3 ⭐.`;
}
function rebrand(){
  const pend = pendingInfluence();
  if(pend<=0) return;
  if(!confirm(`Rebrand for +${fmt(pend)} Influence? Your Clout and squad levels reset, but you keep Snaps, Star Snaps, achievements, and gain a permanent ×${(1+(S.influence+pend)*0.02).toFixed(2)} multiplier (and +3 ⭐).`)) return;
  S.influence += pend;
  S.stats.rebrands++;
  S.stars += 3;
  S.clout = 0; S.stats.totalClout = 0;
  S.activeBoosts = []; S.abilityReady = {};
  const squad = {};
  ROSTER.forEach(c => squad[c.id] = { owned:false, level:0 });
  squad.closer.owned=true; squad.closer.level=1;
  S.squad = squad;
  S.featured = "closer";
  combo=0;
  toast("Rebranded! New era begins ✨","#b06bff");
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
      toast(`🏆 ${a.name} (+${a.gems}💎)`, "#ffd166");
    }
  });
  if(gained){ renderHUD(); renderAchievements(); }
}
function renderAchievements(){
  const wrap=$("#ach-list"); if(!wrap) return; wrap.innerHTML="";
  ACHIEVEMENTS.forEach(a=>{
    const done=!!S.achievements[a.id];
    const c=el("div","ach-row"+(done?" done":""));
    c.innerHTML=`<div class="ach-ico">${done?"🏆":"🔒"}</div>
      <div class="ach-txt"><b>${a.name}</b><span>${a.desc}</span></div>
      <div class="ach-rew">+${a.gems}💎</div>`;
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
  toast(`Day ${S.daily.streak}: +${rw.gems}💎${rw.stars?` +${rw.stars}⭐`:""}`, "#ffd166");
  checkAchievements();
  renderHUD(); renderDaily(); save();
}
function renderDaily(){
  const box=$("#daily-box"); if(!box) return;
  const rw=dailyReward();
  box.innerHTML = `
    <div class="daily-streak">🔥 ${S.daily.streak}-day streak</div>
    <button id="daily-claim" class="big-btn ${S.daily.claimedToday?'cant':''}">
      ${S.daily.claimedToday?"Come back tomorrow":`Claim +${rw.gems} 💎${rw.stars?` +${rw.stars} ⭐`:""}`}
    </button>`;
  const b=$("#daily-claim"); if(b) b.onclick=claimDaily;
}

/* ============================================================
   STATS screen
   ============================================================ */
function renderStats(){
  const wrap=$("#stats-list"); if(!wrap) return;
  const rows = [
    ["Total Clout earned", fmt(S.stats.totalClout)],
    ["Clout / second", fmt(cps())],
    ["Clout / tap", fmt(tapBase()*tapMult())],
    ["Total taps", fmt(S.stats.totalTaps)],
    ["Best combo", S.stats.bestCombo+"×"],
    ["Total summons", fmt(S.stats.totalPulls||0)],
    ["Golden Snaps caught", S.stats.goldCaught],
    ["Squad recruited", ownedCount(S)+"/"+ROSTER.length],
    ["Influence", fmt(S.influence)+" (×"+influenceMult().toFixed(2)+")"],
    ["Rebrands", S.stats.rebrands],
    ["Snaps 💎", fmt(S.gems)],
    ["Star Snaps ⭐", fmt(S.stars)],
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
  t.textContent=msg;
  t.style.borderColor = color||"#3da9fc";
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove("show"),1900);
}

/* ============================================================
   NAV / SCREENS
   ============================================================ */
const SCREENS = ["tap","squad","summon","boosts","shop","stats"];
function showScreen(name){
  SCREENS.forEach(s=>{
    $("#screen-"+s).classList.toggle("active", s===name);
    const nav=$(`[data-nav="${s}"]`); if(nav) nav.classList.toggle("on", s===name);
  });
  if(name==="squad") renderSquad();
  if(name==="summon") renderSummon();
  if(name==="boosts") renderBoosts();
  if(name==="shop") renderShop();
  if(name==="stats"){ renderStats(); renderDaily(); renderPrestige(); }
  if(name==="tap") renderTapScreen();
}

function renderAll(){
  renderHUD(); renderTapScreen(); renderSquad(); renderSummon(); renderBoosts();
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

  const gain = cps()*dt;
  if(gain>0){ S.clout += gain; S.stats.totalClout += gain; }

  if(combo>0 && now>comboExpire){ combo=0; updateComboUI(); }

  goldTimer -= dt*1000;
  if(goldTimer<=0){ spawnGold(); goldTimer = GOLD_INTERVAL[0] + Math.random()*(GOLD_INTERVAL[1]-GOLD_INTERVAL[0]); }

  renderHUD();
  if($("#screen-tap").classList.contains("active")) $("#tap-power").textContent = fmt(tapBase()*tapMult()*comboMult());
  if($("#screen-boosts").classList.contains("active")) renderBoosts();
  if($("#screen-summon").classList.contains("active")) $("#banner-timer").textContent = "⏳ "+bannerCountdown(activeBanner());

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
function bindEvents(){
  const stage = $("#hero-stage");
  stage.addEventListener("pointerdown", e=>{
    if(e.target.closest(".gold-snap")) return;
    doTap(e.clientX, e.clientY);
  });

  $$("[data-nav]").forEach(b=> b.addEventListener("click",()=>showScreen(b.dataset.nav)));

  $("#squad-list").addEventListener("click", e=>{
    const up=e.target.closest("[data-up]"); if(up){ buyUpgrade(up.dataset.up); return; }
    const ft=e.target.closest("[data-feat]"); if(ft){ S.featured=ft.dataset.feat; renderTapScreen(); renderSquad(); save(); toast("Featured updated"); return; }
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
  applyOffline();
  bindEvents();
  $("#opt-sfx").checked = S.settings.sfx;
  $("#opt-haptics").checked = S.settings.haptics;
  renderAll();
  showScreen("tap");
  checkAchievements();
  lastTick = Date.now();
  setInterval(tick, TICK_MS);
  setInterval(save, 15000);
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("service-worker.js").catch(()=>{});
  }
}

document.addEventListener("DOMContentLoaded", boot);
